import "server-only";
import { fromDbError } from "@/lib/errors";
import { PROVIDERS } from "@/lib/integrations/registry";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { ConversationRow, MessageRow } from "@/types/database";
import type { ConversationView, MessageView, PlatformId } from "@/types/social";

export async function listConversations(ctx: WorkspaceContext): Promise<ConversationView[]> {
  const { data, error } = await ctx.supabase
    .from("conversations").select("*").eq("workspace_id", ctx.workspace.id)
    .order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (error) throw fromDbError(error);
  return ((data ?? []) as ConversationRow[]).map((c) => ({
    id: c.id, platform: c.platform, name: c.participant_name, handle: c.participant_handle,
    preview: c.last_message_preview ?? "", lastMessageAt: c.last_message_at, unread: c.unread_count,
  }));
}

export async function listMessages(ctx: WorkspaceContext, conversationId: string): Promise<MessageView[]> {
  const { data, error } = await ctx.supabase
    .from("messages").select("*").eq("conversation_id", conversationId).eq("workspace_id", ctx.workspace.id)
    .order("sent_at", { ascending: true }).limit(200);
  if (error) throw fromDbError(error);
  return ((data ?? []) as MessageRow[]).map((m) => ({ id: m.id, me: m.direction === "outgoing", text: m.body, sentAt: m.sent_at }));
}

export async function markConversationRead(ctx: WorkspaceContext, conversationId: string) {
  const { error } = await ctx.supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId).eq("workspace_id", ctx.workspace.id);
  if (error) throw fromDbError(error);
}

/** Replying requires the provider's messaging API — surfaced honestly until implemented. */
export function replyCapability(platform: PlatformId): { supported: boolean; reason: string } {
  return PROVIDERS[platform].capabilities.inbox
    ? { supported: true, reason: "" }
    : { supported: false, reason: `Replying on ${platform} isn't available yet — it needs that platform's messaging API.` };
}
