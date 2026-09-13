"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { rateLimit } from "@/lib/security/rate-limit";
import * as media from "@/lib/services/media";
import { registerMediaSchema, uploadRequestSchema } from "@/lib/validation/media";

/** Step 1: validate the file and reserve a workspace-scoped storage path. */
export const planUpload = safeAction("media.plan", uploadRequestSchema, async (input) => {
  const ctx = await requireWorkspace("media.upload");
  await rateLimit(`upload:${ctx.userId}`, { limit: 60, windowSeconds: 60 });
  return media.planUpload(ctx, input);
});

/** Step 3 (after the browser uploads directly to Storage): record the asset. */
export const registerMedia = safeAction("media.register", registerMediaSchema, async (input) => {
  const ctx = await requireWorkspace("media.upload");
  const asset = await media.registerMedia(ctx, input);
  revalidatePath("/media");
  return asset;
});

export const deleteMedia = safeAction("media.delete", z.object({ mediaId: z.string().uuid() }), async ({ mediaId }) => {
  const ctx = await requireWorkspace("media.upload");
  await media.deleteMedia(ctx, mediaId);
  revalidatePath("/media");
  return { deleted: true };
});
