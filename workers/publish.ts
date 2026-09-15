/**
 * Optional long-lived publishing runner:  npm run worker
 *
 * Kairo does not need this. Publishing is driven by whatever calls `runPublishingTick()` — in
 * production that is the `/api/cron/publish` route, hit once a minute by Supabase `pg_cron`
 * (see supabase/schedule-publishing.sql). This process is the same loop in a terminal, which is
 * handy for local development and for self-hosting without a scheduler.
 *
 * Running it alongside cron is safe: jobs are claimed with a conditional update, so whichever
 * runner gets there first owns the job.
 */
import "dotenv/config";
import { runPublishingTick } from "../lib/publishing/runner";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 15_000);
const RUNNER_ID = `worker-${process.pid}`;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the worker.");
  process.exit(1);
}

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), worker: RUNNER_ID, event, ...data }));

async function tick() {
  const summary = await runPublishingTick({ runnerId: RUNNER_ID });
  if (summary.published || summary.failed || summary.retrying || summary.reclaimed || summary.settled) log("tick.done", { ...summary });
}

async function main() {
  log("worker.started", { mode: process.env.REDIS_URL ? "redis+poll" : "poll", pollMs: POLL_MS });

  if (process.env.REDIS_URL) {
    // BullMQ wakes us exactly at the scheduled time; the poll loop below still runs as a
    // safety net so a lost Redis job can never strand a post.
    const { Worker } = await import("bullmq");
    new Worker("kairo-publishing", async () => { await tick(); }, { connection: { url: process.env.REDIS_URL } })
      .on("failed", (_job, err) => log("queue.job_failed", { error: err.message }));
  }

  await tick();
  setInterval(() => void tick(), POLL_MS);
}

const shutdown = (signal: string) => { log("worker.stopping", { signal }); process.exit(0); };
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void main();
