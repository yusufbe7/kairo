import type { PostStatus } from "@/types/database";

/**
 * Allowed post status transitions. `publishing` → terminal states are driven by the worker;
 * users can pull a scheduled post back to draft, retry a failed one, but never edit a published post.
 */
const TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["draft", "scheduled", "publishing"],
  scheduled: ["draft", "scheduled", "publishing"],
  publishing: ["published", "failed"],
  failed: ["draft", "scheduled", "publishing"],
  published: [],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isEditable(status: PostStatus): boolean {
  return status === "draft" || status === "scheduled" || status === "failed";
}

/** Minimum lead time for scheduling, so a job is never created "in the past". */
export const MIN_SCHEDULE_LEAD_MS = 60_000;
