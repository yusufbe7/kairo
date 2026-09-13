import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/** Records a sensitive action. Never throws — an audit failure is logged, not surfaced. */
export async function audit(entry: {
  action: string; actorId: string | null; workspaceId?: string | null;
  targetType?: string; targetId?: string; metadata?: Record<string, unknown>;
}) {
  const { error } = await createAdminClient().from("audit_logs").insert({
    action: entry.action, actor_id: entry.actorId, workspace_id: entry.workspaceId ?? null,
    target_type: entry.targetType ?? null, target_id: entry.targetId ?? null, metadata: entry.metadata ?? {},
  });
  if (error) logger.warn("audit.write_failed", error.message, { action: entry.action });
}
