import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromDbError } from "@/lib/errors";
import { enqueuePublish, removeQueueJob } from "./driver";
import { kickPublishing } from "@/lib/publishing/kick";

/**
 * Durable publish-job records (public.scheduled_jobs). Every scheduled post has exactly one
 * live job, enforced by a partial unique index. Rescheduling cancels the old job first — in the
 * database AND in Redis — so no stale job is left behind.
 */
export async function cancelActiveJobs(postIds: string[]) {
  if (postIds.length === 0) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scheduled_jobs")
    .update({ status: "canceled" })
    .in("post_id", postIds)
    .in("status", ["queued", "retrying"])
    .select("queue_job_id");
  if (error) throw fromDbError(error);
  for (const row of (data ?? []) as { queue_job_id: string | null }[]) {
    if (row.queue_job_id) await removeQueueJob(row.queue_job_id);
  }
}

export async function schedulePublishJob(params: { workspaceId: string; postId: string; runAt: Date }) {
  await cancelActiveJobs([params.postId]);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scheduled_jobs")
    .insert({ workspace_id: params.workspaceId, post_id: params.postId, run_at: params.runAt.toISOString(), status: "queued" })
    .select("id")
    .single();
  if (error) throw fromDbError(error, "We couldn't queue this post for publishing.");

  const jobId = (data as { id: string }).id;
  const queueJobId = await enqueuePublish(jobId, params.runAt);
  if (queueJobId) await admin.from("scheduled_jobs").update({ queue_job_id: queueJobId }).eq("id", jobId);
  // The row above is what guarantees the post goes out; this just saves it the wait.
  kickPublishing(params.runAt);
  return jobId;
}
