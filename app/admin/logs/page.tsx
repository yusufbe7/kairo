import type { Metadata } from "next";
import Link from "next/link";
import { AdminTable, Td } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "System logs" };
export const dynamic = "force-dynamic";

const LEVELS: [string, string][] = [["all", "All"], ["info", "Info"], ["warn", "Warn"], ["error", "Error"]];
const LEVEL_CLASS: Record<string, string> = { info: "text-muted-foreground", warn: "text-warning", error: "text-destructive" };

interface Row { id: string; level: string; event: string; message: string | null; workspace_id: string | null; created_at: string; metadata: Record<string, unknown> }

export default async function Page({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level } = await searchParams;
  const { db } = await requireSuperAdmin();

  let query = db.from("system_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (level && level !== "all") query = query.eq("level", level);
  const { data } = await query;

  const logs = (data ?? []) as unknown as Row[];
  const active = level ?? "all";

  return (
    <>
      <PageHeader title="System logs" description="Auth, publishing, OAuth, AI and background-job events." />
      <div className="no-scrollbar mb-3.5 flex gap-1 overflow-x-auto">
        {LEVELS.map(([value, label]) => (
          <Link key={value} href={value === "all" ? "/admin/logs" : `/admin/logs?level=${value}`}
            className={cn("chip", active === value && "border-border-strong bg-white/[0.08] text-foreground")}>{label}</Link>
        ))}
      </div>
      <AdminTable headers={["Time", "Level", "Event", "Message", "Workspace"]} empty="No log entries at this level yet.">
        {logs.map((l) => (
          <tr key={l.id} className="row-hover">
            <Td className="text-dim">{timeAgo(l.created_at)}</Td>
            <Td className={cn("uppercase", LEVEL_CLASS[l.level])}>{l.level}</Td>
            <Td className="font-mono text-[11.5px]">{l.event}</Td>
            <Td className="max-w-[420px] truncate">{l.message ?? "—"}</Td>
            <Td className="font-mono text-[11.5px] text-dim">{l.workspace_id?.slice(0, 8) ?? "—"}</Td>
          </tr>
        ))}
      </AdminTable>
      <p className="mt-4 text-xs text-dim">
        Persistence threshold is <code className="text-muted-foreground">LOG_PERSIST_LEVEL</code> (default <code className="text-muted-foreground">warn</code>). Everything is also written as JSON to stdout.
      </p>
    </>
  );
}
