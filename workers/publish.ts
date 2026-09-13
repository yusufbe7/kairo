/**
 * Publishing worker. Run separately from the web app:  npm run worker
 *
 * With REDIS_URL set it consumes the BullMQ queue; without it, it polls `scheduled_jobs`.
 * Either way the database row is the source of truth, so a restart never loses a post and
 * a job is never executed twice (rows are claimed with a conditional update).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { publishToPlatform } from "../lib/publishing";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the worker.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 15_000);
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000]; // 1m, 5m, 15m, 1h

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), worker: WORKER_ID, event, ...data }));

interface JobRow { id: string; post_id: string; workspace_id: string; attempts: number; max_attempts: number }

/** Claims a due job atomically: only one worker can move it out of `queued`. */
async function claimDueJobs(limit = 5): Promise<JobRow[]> {
  const { data } = await db
    .from("scheduled_jobs")
    .select("id, post_id, workspace_id, attempts, max_attempts")
    .in("status", ["queued", "retrying"])
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(limit);

  const claimed: JobRow[] = [];
  for (const job of (data ?? []) as JobRow[]) {
    const { data: updated } = await db
      .from("scheduled_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), locked_by: WORKER_ID, attempts: job.attempts + 1 })
      .eq("id", job.id)
      .in("status", ["queued", "retrying"])
      .select("id");
    if (updated?.length) claimed.push({ ...job, attempts: job.attempts + 1 });
  }
  return claimed;
}

async function signedUrls(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await db.storage.from("media").createSignedUrls(paths, 3600);
  return new Map((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

async function runJob(job: JobRow) {
  const { data: post } = await db
    .from("posts")
    .select("*, post_targets(*), post_media(position, media_assets(storage_path, mime_type, kind))")
    .eq("id", job.post_id)
    .single();

  if (!post) {
    await db.from("scheduled_jobs").update({ status: "canceled", last_error: "Post no longer exists" }).eq("id", job.id);
    return;
  }

  type Target = { id: string; platform: string; social_account_id: string | null; caption_override: string | null; status: string };
  const p = post as unknown as {
    id: string; caption: string; format: string; workspace_id: string;
    post_targets: Target[];
    post_media: { position: number; media_assets: { storage_path: string; mime_type: string; kind: string } | null }[];
  };

  await db.from("posts").update({ status: "publishing" }).eq("id", p.id);

  const ordered = [...(p.post_media ?? [])].sort((a, b) => a.position - b.position);
  const urls = await signedUrls(ordered.flatMap((m) => (m.media_assets ? [m.media_assets.storage_path] : [])));
  const media = ordered.flatMap((m) =>
    m.media_assets && urls.get(m.media_assets.storage_path)
      ? [{ url: urls.get(m.media_assets.storage_path)!, mimeType: m.media_assets.mime_type, kind: m.media_assets.kind as "image" | "video" | "gif" }]
      : [],
  );

  const pending = (p.post_targets ?? []).filter((t) => t.status !== "published");
  let anyFailed = false;
  let anyRetryable = false;

  for (const target of pending) {
    await db.from("post_targets").update({ status: "processing" }).eq("id", target.id);

    const result = target.social_account_id
      ? await publishToPlatform({
          platform: target.platform as never,
          accountId: target.social_account_id,
          caption: target.caption_override ?? p.caption,
          media,
          format: p.format as never,
        })
      : { success: false, errorCode: "NO_ACCOUNT", errorMessage: `No connected ${target.platform} account for this workspace.`, retryable: false };

    await db.from("publishing_attempts").insert({
      job_id: job.id, post_target_id: target.id, workspace_id: p.workspace_id, attempt_number: job.attempts,
      status: result.success ? "published" : "failed", error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null, external_post_id: result.externalPostId ?? null,
      finished_at: new Date().toISOString(),
    });

    await db.from("post_targets").update({
      status: result.success ? "published" : "failed",
      external_post_id: result.externalPostId ?? null,
      external_url: result.externalUrl ?? null,
      last_error: result.success ? null : result.errorMessage ?? "Publishing failed",
      published_at: result.success ? new Date().toISOString() : null,
    }).eq("id", target.id);

    if (!result.success) {
      anyFailed = true;
      if (result.retryable) anyRetryable = true;
      log("publish.failed", { jobId: job.id, platform: target.platform, code: result.errorCode });
    } else {
      log("publish.succeeded", { jobId: job.id, platform: target.platform });
    }
  }

  const shouldRetry = anyFailed && anyRetryable && job.attempts < job.max_attempts;

  if (shouldRetry) {
    const delay = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)];
    await db.from("scheduled_jobs").update({
      status: "retrying", run_at: new Date(Date.now() + delay).toISOString(), locked_by: null,
      last_error: "Retrying after a transient failure",
    }).eq("id", job.id);
    await db.from("post_targets").update({ status: "retrying" }).eq("post_id", p.id).eq("status", "failed");
    log("job.retry_scheduled", { jobId: job.id, attempt: job.attempts, delayMs: delay });
    return;
  }

  const finalStatus = anyFailed ? "failed" : "published";
  await db.from("posts").update({
    status: finalStatus,
    published_at: finalStatus === "published" ? new Date().toISOString() : null,
    last_error: anyFailed ? "One or more platforms rejected this post." : null,
  }).eq("id", p.id);
  await db.from("scheduled_jobs").update({ status: anyFailed ? "failed" : "completed", locked_by: null }).eq("id", job.id);

  await notifyMembers(p.workspace_id, finalStatus, p.id);
  log("job.finished", { jobId: job.id, status: finalStatus });
}

async function notifyMembers(workspaceId: string, status: "published" | "failed", postId: string) {
  const prefKey = status === "published" ? "published" : "failed";
  const { data } = await db.from("workspace_members").select("user_id, profiles(notification_prefs)").eq("workspace_id", workspaceId);
  const rows = (data ?? []) as unknown as { user_id: string; profiles: { notification_prefs: Record<string, boolean> } | null }[];
  const recipients = rows.filter((r) => r.profiles?.notification_prefs?.[prefKey] !== false);
  if (!recipients.length) return;
  await db.from("notifications").insert(recipients.map((r) => ({
    user_id: r.user_id, workspace_id: workspaceId,
    type: status === "published" ? "post_published" : "post_failed",
    title: status === "published" ? "Your post went live" : "A scheduled post failed to publish",
    link: status === "published" ? "/posts?tab=published" : "/posts?tab=failed",
    body: status === "failed" ? "Open the post to see the provider's error and retry." : null,
  })));
  void postId;
}

async function tick() {
  try {
    const jobs = await claimDueJobs();
    for (const job of jobs) {
      try {
        await runJob(job);
      } catch (error) {
        log("job.crashed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
        await db.from("scheduled_jobs").update({
          status: "failed", locked_by: null,
          last_error: error instanceof Error ? error.message : "Worker error",
        }).eq("id", job.id);
      }
    }
  } catch (error) {
    log("tick.error", { error: error instanceof Error ? error.message : String(error) });
  }
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
