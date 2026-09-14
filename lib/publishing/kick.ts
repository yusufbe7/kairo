import "server-only";
import { after } from "next/server";
import { runPublishingTick } from "./runner";
import { logger } from "@/lib/logger";
import { messageFrom } from "@/lib/errors";

/** Jobs due within this window are worth publishing on the spot instead of waiting for cron. */
const IMMEDIATE_WINDOW_MS = 30_000;

/**
 * "Publish now" should mean now, not "within a minute".
 *
 * The scheduler (cron) is what makes publishing reliable; this only makes it feel instant. The
 * work runs in `after()`, so the response is already on its way to the browser — and if the
 * function is killed before the tick finishes, the next cron beat picks the job up again.
 * Never throws: a post that is safely queued must not fail because the nudge did.
 */
export function kickPublishing(runAt: Date): void {
  if (runAt.getTime() - Date.now() > IMMEDIATE_WINDOW_MS) return;

  try {
    after(async () => {
      try {
        await runPublishingTick({ budgetMs: 30_000, runnerId: "inline" });
      } catch (error) {
        logger.warn("publishing.kick_failed", messageFrom(error, "The immediate publish attempt failed; cron will retry."));
      }
    });
  } catch {
    // Outside a request scope (scripts, tests). Cron still picks the job up.
  }
}

/** At most one opportunistic sweep per minute, per server instance. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/**
 * Safety net for a deployment whose scheduler was never wired up (see
 * supabase/schedule-publishing.sql). Called from the dashboard layout, it drains anything
 * overdue after the page has already been sent, so a missed cron beat costs a delay rather
 * than a post that silently never goes out. Throttled, and a no-op when the queue is empty.
 */
export function sweepPublishing(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  try {
    after(async () => {
      try {
        await runPublishingTick({ budgetMs: 20_000, limit: 5, runnerId: "sweep" });
      } catch (error) {
        logger.warn("publishing.sweep_failed", messageFrom(error, "The opportunistic publish sweep failed."));
      }
    });
  } catch {
    // Outside a request scope. Cron still picks the job up.
  }
}
