import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPublishingTick } from "@/lib/publishing/runner";
import { logger } from "@/lib/logger";

/**
 * The scheduler's doorbell. Anything that can make an HTTPS request once a minute — Supabase
 * `pg_cron` + `pg_net`, Vercel Cron, GitHub Actions, an uptime monitor — can drive publishing
 * through this route, so Kairo needs no long-lived worker process.
 *
 * Ticks are safe to overlap and safe to repeat: jobs are claimed with a conditional update, and
 * a tick that gets killed has its claim reclaimed by the next one. Missing a beat only delays a
 * post, it never loses one.
 */
export const dynamic = "force-dynamic";
/** Vercel kills the function here; the tick stops claiming work before that (BUDGET_MS). */
export const maxDuration = 60;

/**
 * Comfortably inside a one-minute beat, so a slow tick never still holds the queue when the
 * next one arrives. Overlapping ticks are correct but they double the load on the database,
 * which on a small Supabase plan is how a 504 starts.
 */
const BUDGET_MS = 25_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const presented =
    (header?.startsWith("Bearer ") ? header.slice(7) : null) ??
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("key");
  if (!presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    // Fail closed: an unauthenticated publish endpoint is a way to burn someone's API quota.
    logger.error("cron.publish_unconfigured", "CRON_SECRET is not set, so scheduled publishing is disabled.");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runPublishingTick({ budgetMs: BUDGET_MS, runnerId: `cron-${crypto.randomUUID().slice(0, 8)}` });
  return NextResponse.json({ ok: true, ...summary });
}

/** GET for Vercel Cron and uptime monitors, POST for `pg_net` and everything else. */
export const GET = handle;
export const POST = handle;
