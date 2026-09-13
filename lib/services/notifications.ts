import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromDbError } from "@/lib/errors";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { NotificationRow } from "@/types/database";

export async function listNotifications(ctx: WorkspaceContext, limit = 10): Promise<NotificationRow[]> {
  const { data, error } = await ctx.supabase
    .from("notifications").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationsRead(ctx: WorkspaceContext, ids?: string[]) {
  let q = ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw fromDbError(error);
}

/** Created by services and the worker (publish results, expiring tokens, invitations). */
export async function notify(entry: { userId: string; workspaceId?: string | null; type: string; title: string; body?: string; link?: string }) {
  await createAdminClient().from("notifications").insert({
    user_id: entry.userId, workspace_id: entry.workspaceId ?? null, type: entry.type,
    title: entry.title, body: entry.body ?? null, link: entry.link ?? null,
  });
}

/** Notifies every member of a workspace who opted into this notification type. */
export async function notifyWorkspace(workspaceId: string, prefKey: string, entry: { type: string; title: string; body?: string; link?: string }) {
  const admin = createAdminClient();
  const { data } = await admin.from("workspace_members").select("user_id, profiles(notification_prefs)").eq("workspace_id", workspaceId);
  const rows = (data ?? []) as unknown as { user_id: string; profiles: { notification_prefs: Record<string, boolean> } | null }[];
  const recipients = rows.filter((r) => r.profiles?.notification_prefs?.[prefKey] !== false);
  if (recipients.length === 0) return;
  await admin.from("notifications").insert(recipients.map((r) => ({
    user_id: r.user_id, workspace_id: workspaceId, type: entry.type, title: entry.title, body: entry.body ?? null, link: entry.link ?? null,
  })));
}
