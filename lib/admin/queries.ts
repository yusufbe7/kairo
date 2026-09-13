import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Filter = { column: string; op: "eq" | "neq" | "gte"; value: string };

/** Head-only count with optional filters, so the admin dashboard never pulls whole tables. */
async function countRows(db: SupabaseClient, table: string, filters: Filter[] = []): Promise<number> {
  let query = db.from(table).select("id", { count: "exact", head: true });
  for (const f of filters) {
    if (f.op === "eq") query = query.eq(f.column, f.value);
    else if (f.op === "neq") query = query.neq(f.column, f.value);
    else query = query.gte(f.column, f.value);
  }
  const { count } = await query;
  return count ?? 0;
}

export async function platformOverview(db: SupabaseClient) {
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [users, workspaces, activeUsers, publishedToday, scheduled, failed, accounts, aiGenerations, queued, retrying] = await Promise.all([
    countRows(db, "profiles"),
    countRows(db, "workspaces"),
    countRows(db, "profiles", [{ column: "last_active_at", op: "gte", value: monthAgo }]),
    countRows(db, "posts", [{ column: "status", op: "eq", value: "published" }, { column: "published_at", op: "gte", value: dayAgo }]),
    countRows(db, "posts", [{ column: "status", op: "eq", value: "scheduled" }]),
    countRows(db, "posts", [{ column: "status", op: "eq", value: "failed" }]),
    countRows(db, "social_accounts", [{ column: "status", op: "neq", value: "disconnected" }]),
    countRows(db, "ai_generations", [{ column: "created_at", op: "gte", value: monthAgo }]),
    countRows(db, "scheduled_jobs", [{ column: "status", op: "eq", value: "queued" }]),
    countRows(db, "scheduled_jobs", [{ column: "status", op: "eq", value: "retrying" }]),
  ]);

  return { users, workspaces, activeUsers, publishedToday, scheduled, failed, accounts, aiGenerations, queueDepth: queued + retrying, retrying };
}

/** Publishing success rate over the last 30 days, from recorded attempts. */
export async function publishingHealth(db: SupabaseClient) {
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await db.from("publishing_attempts").select("status").gte("created_at", from).limit(10000);
  const rows = (data ?? []) as { status: string }[];
  const published = rows.filter((r) => r.status === "published").length;
  return { attempts: rows.length, published, successRate: rows.length ? Math.round((published / rows.length) * 100) : null };
}

/** Daily counts for the last `days` days from a table's timestamp column. */
export async function dailySeries(db: SupabaseClient, table: string, days = 30, column = "created_at") {
  const from = new Date(Date.now() - days * 86400000);
  const { data } = await db.from(table).select(column).gte(column, from.toISOString()).limit(10000);

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) buckets.set(new Date(from.getTime() + i * 86400000).toISOString().slice(0, 10), 0);

  ((data ?? []) as unknown as Record<string, string | null>[]).forEach((row) => {
    const key = row[column]?.slice(0, 10);
    if (key && buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  return [...buckets.entries()].map(([date, value]) => ({
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value,
  }));
}
