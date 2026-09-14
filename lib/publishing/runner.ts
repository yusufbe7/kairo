import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishToPlatform, type PublishRequest, type PublishResult } from "@/lib/publishing";
import { logger } from "@/lib/logger";
import { messageFrom } from "@/lib/errors";
import type { PlatformId } from "@/types/social";

/**
 * The publishing loop itself, with no opinion about who calls it.
 *
 * `scheduled_jobs` is the source of truth, so a "runner" is nothing more than something that
 * calls `runPublishingTick()` from time to time: a long-lived process (`npm run worker`), an
 * HTTP cron hit (`/api/cron/publish`), or the request that just scheduled a post. Two runners
 * ticking at once is safe — every job is claimed with a conditional update, so exactly one of
 * them wins the row.
 *
 * Serverless adds one failure mode a long-lived worker doesn't have: the function can be killed
 * mid-job, leaving the row `processing` forever. `reclaimStaleJobs` is the answer — a claim that
 * goes quiet for STALE_LOCK_MS is handed back, and a post can never be stuck on "Publishing".
 */

/** How long a claim may go quiet before another runner takes the job back. */
export const STALE_LOCK_MS = 10 * 60_000;
/** 1m, 5m, 15m, 1h — how long we wait after a retryable provider failure. */
export const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000];

export interface TickOptions {
  /** Identifies the claim holder in `locked_by`; defaults to a per-process id. */
  runnerId?: string;
  /** Most jobs to run in one tick. */
  limit?: number;
  /**
   * Stop picking up new jobs once this much wall time has passed. Serverless functions are
   * killed at their maxDuration, so a tick must hand the rest of the queue to the next tick
   * instead of claiming work it has no time to finish.
   */
  budgetMs?: number;
}

export interface TickSummary {
  reclaimed: number;
  published: number;
  failed: number;
  retrying: number;
  /** Jobs still due when the budget ran out. The next tick picks them up. */
  remaining: number;
}

interface JobRow {
  id: string;
  post_id: string;
  workspace_id: string;
  attempts: number;
  max_attempts: number;
}

const DEFAULT_RUNNER_ID = `runner-${Math.random().toString(36).slice(2, 10)}`;

/** Delay before the next attempt, given how many attempts have already been made. */
export function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts, 1) - 1, BACKOFF_MS.length - 1)];
}

/** A claim is stale — and may be taken back — once it has been quiet this long. */
export function isStale(lockedAt: string | null, now = Date.now()): boolean {
  if (!lockedAt) return true;
  const at = Date.parse(lockedAt);
  return Number.isNaN(at) || now - at >= STALE_LOCK_MS;
}

/**
 * Hands back jobs whose runner died mid-flight. Under the attempt limit they go back in the
 * queue; over it they fail loudly, because a post that says "Publishing" forever is worse than
 * one that says it failed.
 */
export async function reclaimStaleJobs(db: SupabaseClient, limit = 20): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data, error } = await db
    .from("scheduled_jobs")
    .select("id, post_id, workspace_id, attempts, max_attempts")
    .eq("status", "processing")
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .limit(limit);

  if (error) {
    logger.warn("publishing.reclaim_failed", messageFrom(error, "Could not look for abandoned jobs."));
    return 0;
  }

  let reclaimed = 0;
  for (const job of (data ?? []) as JobRow[]) {
    const givingUp = job.attempts >= job.max_attempts;
    const patch = givingUp
      ? { status: "failed", locked_by: null, locked_at: null, last_error: "Publishing was interrupted and did not recover." }
      : { status: "retrying", run_at: new Date().toISOString(), locked_by: null, locked_at: null, last_error: "Publishing was interrupted; retrying." };

    // Conditional on `processing`: if another runner finished the job in the meantime, it keeps it.
    const { data: updated } = await db.from("scheduled_jobs").update(patch).eq("id", job.id).eq("status", "processing").select("id");
    if (!updated?.length) continue;

    reclaimed += 1;
    if (givingUp) await failPost(db, job, "Publishing was interrupted and did not recover.");
    logger.warn("publishing.job_reclaimed", givingUp ? "Abandoned job gave up" : "Abandoned job requeued", {
      workspaceId: job.workspace_id,
      jobId: job.id,
      attempts: job.attempts,
    });
  }
  return reclaimed;
}

/** Marks a post and its unfinished targets failed, so the UI stops showing "Publishing". */
async function failPost(db: SupabaseClient, job: JobRow, reason: string) {
  await db.from("posts").update({ status: "failed", last_error: reason }).eq("id", job.post_id);
  await db.from("post_targets").update({ status: "failed", last_error: reason }).eq("post_id", job.post_id).in("status", ["processing", "queued", "retrying"]);
  await notifyMembers(db, job.workspace_id, "failed");
}

/** Claims the single most overdue job. Returns null when nothing is due. */
async function claimNextJob(db: SupabaseClient, runnerId: string): Promise<JobRow | null> {
  const { data, error } = await db
    .from("scheduled_jobs")
    .select("id, post_id, workspace_id, attempts, max_attempts")
    .in("status", ["queued", "retrying"])
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(5);

  if (error) {
    logger.error("publishing.claim_failed", messageFrom(error, "Could not read the publishing queue."));
    return null;
  }

  for (const job of (data ?? []) as JobRow[]) {
    const { data: updated } = await db
      .from("scheduled_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), locked_by: runnerId, attempts: job.attempts + 1 })
      .eq("id", job.id)
      .in("status", ["queued", "retrying"])
      .select("id");
    // Lost the race to another runner — try the next due job instead.
    if (updated?.length) return { ...job, attempts: job.attempts + 1 };
  }
  return null;
}

/** True while at least one job is due, used to report what the next tick still has to do. */
async function countDue(db: SupabaseClient): Promise<number> {
  const { count } = await db
    .from("scheduled_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "retrying"])
    .lte("run_at", new Date().toISOString());
  return count ?? 0;
}

async function signedUrls(db: SupabaseClient, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await db.storage.from("media").createSignedUrls(paths, 3600);
  return new Map((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

type JobOutcome = "published" | "failed" | "retrying" | "canceled";

async function runJob(db: SupabaseClient, job: JobRow): Promise<JobOutcome> {
  const { data: post } = await db
    .from("posts")
    .select("*, post_targets(*), post_media(position, media_assets(storage_path, mime_type, kind))")
    .eq("id", job.post_id)
    .single();

  if (!post) {
    await db.from("scheduled_jobs").update({ status: "canceled", locked_by: null, locked_at: null, last_error: "Post no longer exists" }).eq("id", job.id);
    return "canceled";
  }

  type Target = { id: string; platform: string; social_account_id: string | null; caption_override: string | null; status: string };
  const p = post as unknown as {
    id: string;
    caption: string;
    format: string;
    workspace_id: string;
    post_targets: Target[];
    post_media: { position: number; media_assets: { storage_path: string; mime_type: string; kind: string } | null }[];
  };

  await db.from("posts").update({ status: "publishing" }).eq("id", p.id);

  const ordered = [...(p.post_media ?? [])].sort((a, b) => a.position - b.position);
  const urls = await signedUrls(db, ordered.flatMap((m) => (m.media_assets ? [m.media_assets.storage_path] : [])));
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
          platform: target.platform as PlatformId,
          accountId: target.social_account_id,
          caption: target.caption_override ?? p.caption,
          media,
          format: p.format as PublishRequest["format"],
        })
      : ({
          success: false,
          errorCode: "NO_ACCOUNT",
          errorMessage: `No connected ${target.platform} account for this workspace.`,
          retryable: false,
        } satisfies PublishResult);

    await db.from("publishing_attempts").insert({
      job_id: job.id,
      post_target_id: target.id,
      workspace_id: p.workspace_id,
      attempt_number: job.attempts,
      status: result.success ? "published" : "failed",
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      external_post_id: result.externalPostId ?? null,
      finished_at: new Date().toISOString(),
    });

    await db
      .from("post_targets")
      .update({
        status: result.success ? "published" : "failed",
        external_post_id: result.externalPostId ?? null,
        external_url: result.externalUrl ?? null,
        last_error: result.success ? null : result.errorMessage ?? "Publishing failed",
        published_at: result.success ? new Date().toISOString() : null,
      })
      .eq("id", target.id);

    if (result.success) {
      logger.info("publishing.target_published", `Published to ${target.platform}`, { workspaceId: p.workspace_id, jobId: job.id, platform: target.platform });
    } else {
      anyFailed = true;
      if (result.retryable) anyRetryable = true;
      logger.warn("publishing.target_failed", result.errorMessage ?? `Publishing to ${target.platform} failed`, {
        workspaceId: p.workspace_id,
        jobId: job.id,
        platform: target.platform,
        code: result.errorCode,
        retryable: result.retryable,
      });
    }
  }

  if (anyFailed && anyRetryable && job.attempts < job.max_attempts) {
    const delay = backoffFor(job.attempts);
    await db
      .from("scheduled_jobs")
      .update({
        status: "retrying",
        run_at: new Date(Date.now() + delay).toISOString(),
        locked_by: null,
        locked_at: null,
        last_error: "Retrying after a transient failure",
      })
      .eq("id", job.id);
    await db.from("post_targets").update({ status: "retrying" }).eq("post_id", p.id).eq("status", "failed");
    logger.info("publishing.retry_scheduled", "Retrying a post after a transient failure", { workspaceId: p.workspace_id, jobId: job.id, attempt: job.attempts, delayMs: delay });
    return "retrying";
  }

  const finalStatus = anyFailed ? "failed" : "published";
  await db
    .from("posts")
    .update({
      status: finalStatus,
      published_at: finalStatus === "published" ? new Date().toISOString() : null,
      last_error: anyFailed ? "One or more platforms rejected this post." : null,
    })
    .eq("id", p.id);
  await db.from("scheduled_jobs").update({ status: anyFailed ? "failed" : "completed", locked_by: null, locked_at: null }).eq("id", job.id);

  await notifyMembers(db, p.workspace_id, finalStatus);
  return finalStatus;
}

async function notifyMembers(db: SupabaseClient, workspaceId: string, status: "published" | "failed") {
  const { data } = await db.from("workspace_members").select("user_id, profiles(notification_prefs)").eq("workspace_id", workspaceId);
  const rows = (data ?? []) as unknown as { user_id: string; profiles: { notification_prefs: Record<string, boolean> } | null }[];
  const recipients = rows.filter((r) => r.profiles?.notification_prefs?.[status] !== false);
  if (!recipients.length) return;
  await db.from("notifications").insert(
    recipients.map((r) => ({
      user_id: r.user_id,
      workspace_id: workspaceId,
      type: status === "published" ? "post_published" : "post_failed",
      title: status === "published" ? "Your post went live" : "A scheduled post failed to publish",
      link: status === "published" ? "/posts?tab=published" : "/posts?tab=failed",
      body: status === "failed" ? "Open the post to see the provider's error and retry." : null,
    })),
  );
}

/**
 * Runs one pass of the queue: reclaim what was abandoned, then publish what is due until the
 * job limit or the time budget runs out. Never throws — a runner that crashes stops publishing
 * for everyone, so failures are recorded on the job and reported in the summary instead.
 */
export async function runPublishingTick(options: TickOptions = {}): Promise<TickSummary> {
  const runnerId = options.runnerId ?? DEFAULT_RUNNER_ID;
  const limit = options.limit ?? 25;
  const budgetMs = options.budgetMs ?? Number.POSITIVE_INFINITY;
  const startedAt = Date.now();
  const summary: TickSummary = { reclaimed: 0, published: 0, failed: 0, retrying: 0, remaining: 0 };
  const db = createAdminClient();

  try {
    summary.reclaimed = await reclaimStaleJobs(db);

    for (let ran = 0; ran < limit; ran += 1) {
      if (Date.now() - startedAt >= budgetMs) break;

      const job = await claimNextJob(db, runnerId);
      if (!job) return summary;

      try {
        const outcome = await runJob(db, job);
        if (outcome === "published") summary.published += 1;
        else if (outcome === "failed") summary.failed += 1;
        else if (outcome === "retrying") summary.retrying += 1;
      } catch (error) {
        // The claim is ours and the job is half-done: record it rather than leave it `processing`.
        const message = messageFrom(error, "The publishing runner crashed.");
        summary.failed += 1;
        logger.error("publishing.job_crashed", message, { workspaceId: job.workspace_id, jobId: job.id });
        await db.from("scheduled_jobs").update({ status: "failed", locked_by: null, locked_at: null, last_error: message }).eq("id", job.id);
        await failPost(db, job, "Publishing failed unexpectedly. Open the post to retry.");
      }
    }

    summary.remaining = await countDue(db);
  } catch (error) {
    logger.error("publishing.tick_failed", messageFrom(error, "The publishing tick failed."));
  }

  return summary;
}
