"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError } from "@/lib/errors";
import { markConversationRead, replyCapability } from "@/lib/services/inbox";
import { platformSchema } from "@/lib/validation/posts";

export const markRead = safeAction("inbox.mark_read", z.object({ conversationId: z.string().uuid() }), async ({ conversationId }) => {
  const ctx = await requireWorkspace("workspace.read");
  await markConversationRead(ctx, conversationId);
  revalidatePath("/inbox");
  return { read: true };
});

/**
 * Sending is gated on the provider's messaging API. Until a platform's inbox capability
 * is implemented this reports honestly instead of pretending the reply was delivered.
 */
export const sendReply = safeAction("inbox.reply", z.object({ conversationId: z.string().uuid(), platform: platformSchema, body: z.string().trim().min(1).max(4000) }), async ({ platform }) => {
  await requireWorkspace("inbox.reply");
  const capability = replyCapability(platform);
  if (!capability.supported) throw new AppError("NOT_SUPPORTED", capability.reason);
  throw new AppError("NOT_SUPPORTED", "Replying isn't wired up for this platform yet.");
});
