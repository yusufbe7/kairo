import "server-only";
import type { Queue } from "bullmq";

/**
 * Queue driver. BullMQ is used when REDIS_URL is set; otherwise the worker falls back to
 * polling `scheduled_jobs` directly, which is fine for development and small deployments.
 * Either way `scheduled_jobs` is the source of truth — the queue only decides when we wake up.
 */
export const QUEUE_NAME = "kairo-publishing";

let queue: Queue | null = null;
let unavailable = false;

export async function getQueue(): Promise<Queue | null> {
  if (unavailable || !process.env.REDIS_URL) return null;
  if (queue) return queue;
  try {
    const { Queue: BullQueue } = await import("bullmq");
    queue = new BullQueue(QUEUE_NAME, { connection: { url: process.env.REDIS_URL } });
    return queue;
  } catch {
    unavailable = true;
    return null;
  }
}

/** Enqueues a delayed job keyed by the scheduled_jobs row id. Returns the queue job id, if any. */
export async function enqueuePublish(jobId: string, runAt: Date): Promise<string | null> {
  const q = await getQueue();
  if (!q) return null;
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const job = await q.add("publish", { jobId }, { jobId, delay, attempts: 1, removeOnComplete: 1000, removeOnFail: 5000 });
  return job.id ?? null;
}

export async function removeQueueJob(queueJobId: string) {
  const q = await getQueue();
  if (!q) return;
  const job = await q.getJob(queueJobId);
  await job?.remove().catch(() => { /* already gone */ });
}
