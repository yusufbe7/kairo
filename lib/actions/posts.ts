"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { rateLimit } from "@/lib/security/rate-limit";
import * as posts from "@/lib/services/posts";
import { idsSchema, moveToDateSchema, postInputSchema, rescheduleSchema } from "@/lib/validation/posts";
import { z } from "zod";

/** Every screen that shows posts, so a mutation is reflected everywhere at once. */
function revalidatePosts() {
  ["/dashboard", "/posts", "/calendar", "/create", "/analytics"].forEach((p) => revalidatePath(p));
}

export const savePost = safeAction("posts.save", postInputSchema, async (input) => {
  const ctx = await requireWorkspace(input.mode === "draft" ? "post.draft" : "post.schedule");
  await rateLimit(`post:${ctx.userId}`, { limit: 60, windowSeconds: 60 });
  const result = await posts.savePost(ctx, input);
  revalidatePosts();
  return result;
});

export const deletePosts = safeAction("posts.delete", idsSchema, async ({ postIds }) => {
  const ctx = await requireWorkspace("post.draft");
  await posts.deletePosts(ctx, postIds);
  revalidatePosts();
  return { deleted: postIds.length };
});

export const reschedulePosts = safeAction("posts.reschedule", rescheduleSchema, async ({ postIds, date, time }) => {
  const ctx = await requireWorkspace("post.schedule");
  const runAt = await posts.reschedulePosts(ctx, postIds, date, time);
  revalidatePosts();
  return { runAt: runAt.toISOString() };
});

export const movePostToDate = safeAction("posts.move", moveToDateSchema, async ({ postId, date }) => {
  const ctx = await requireWorkspace("post.schedule");
  const runAt = await posts.movePostToDate(ctx, postId, date);
  revalidatePosts();
  return { runAt: runAt.toISOString() };
});

export const duplicatePost = safeAction("posts.duplicate", z.object({ postId: z.string().uuid() }), async ({ postId }) => {
  const ctx = await requireWorkspace("post.draft");
  const result = await posts.duplicatePost(ctx, postId);
  revalidatePosts();
  return result;
});

export const retryPost = safeAction("posts.retry", z.object({ postId: z.string().uuid() }), async ({ postId }) => {
  const ctx = await requireWorkspace("post.publish");
  await posts.retryPost(ctx, postId);
  revalidatePosts();
  return { retried: true };
});
