import "server-only";
import { fromDbError } from "@/lib/errors";
import { utcToZoned } from "@/lib/time";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { AnalyticsDailyRow, MetricSource } from "@/types/database";
import type { AnalyticsSummary, DailyPoint, Range, SeriesPoint } from "@/types/analytics";
import type { PlatformId } from "@/types/social";
import { MONTHS } from "@/lib/format";

export const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "3m": 90, "1y": 365 };

/**
 * Reads stored analytics snapshots. Nothing is invented: when a provider hasn't been
 * connected (or its analytics aren't implemented), the series is simply empty and the UI
 * says so rather than showing numbers.
 */
export async function getAnalytics(ctx: WorkspaceContext, range: Range = "30d"): Promise<AnalyticsSummary> {
  const days = RANGE_DAYS[range];
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await ctx.supabase
    .from("analytics_daily").select("*").eq("workspace_id", ctx.workspace.id).gte("date", from).order("date", { ascending: true });
  if (error) throw fromDbError(error);

  const rows = (data ?? []) as AnalyticsDailyRow[];
  const byDate = new Map<string, DailyPoint>();
  const byPlatform = new Map<PlatformId, { reach: number; engagement: number }>();
  let source: MetricSource | null = null;
  let lastFetchedAt: string | null = null;

  for (const r of rows) {
    const point = byDate.get(r.date) ?? { date: r.date, reach: 0, impressions: 0, engagement: 0, likes: 0, comments: 0, shares: 0, clicks: 0, followers: 0 };
    point.reach += r.reach ?? 0; point.impressions += r.impressions ?? 0; point.engagement += r.engagement ?? 0;
    point.likes += r.likes ?? 0; point.comments += r.comments ?? 0; point.shares += r.shares ?? 0;
    point.clicks += r.clicks ?? 0; point.followers += r.followers ?? 0;
    byDate.set(r.date, point);

    const p = byPlatform.get(r.platform) ?? { reach: 0, engagement: 0 };
    p.reach += r.reach ?? 0; p.engagement += r.engagement ?? 0;
    byPlatform.set(r.platform, p);

    source = r.source;
    if (!lastFetchedAt || r.fetched_at > lastFetchedAt) lastFetchedAt = r.fetched_at;
  }

  return {
    daily: [...byDate.values()],
    byPlatform: [...byPlatform.entries()]
      .map(([platform, v]) => ({ platform, reach: v.reach, engagementRate: v.reach ? +((v.engagement / v.reach) * 100).toFixed(2) : null }))
      .sort((a, b) => b.reach - a.reach),
    source,
    lastFetchedAt,
    bestTimes: null, // Derived from post-level timestamps once enough published posts exist.
  };
}

/** Buckets daily points into the labelled series the charts expect. */
export function toSeries(daily: DailyPoint[], range: Range, tz: string): SeriesPoint[] {
  if (daily.length === 0) return [];
  const point = (label: string, rows: DailyPoint[]): SeriesPoint => {
    const sum = (k: keyof DailyPoint) => rows.reduce((a, r) => a + (r[k] as number), 0);
    const reach = sum("reach");
    return {
      label, reach, likes: sum("likes"), comments: sum("comments"),
      followers: rows.length ? rows[rows.length - 1].followers : 0,
      engagement: reach ? +((sum("engagement") / reach) * 100).toFixed(2) : 0,
    };
  };

  if (range === "7d" || range === "30d") {
    return daily.map((d) => {
      const { date } = utcToZoned(`${d.date}T12:00:00Z`, tz);
      const parsed = new Date(date + "T00:00:00");
      return point(range === "7d" ? parsed.toLocaleDateString("en-US", { weekday: "short" }) : `${MONTHS[parsed.getMonth()].slice(0, 3)} ${parsed.getDate()}`, [d]);
    });
  }

  const buckets = new Map<string, DailyPoint[]>();
  for (const d of daily) {
    const date = new Date(d.date + "T00:00:00");
    const key = range === "3m"
      ? `W${Math.ceil(((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)}`
      : MONTHS[date.getMonth()].slice(0, 3);
    buckets.set(key, [...(buckets.get(key) ?? []), d]);
  }
  return [...buckets.entries()].map(([label, rows]) => point(label, rows));
}

export function summarize(daily: DailyPoint[]) {
  const sum = (k: keyof DailyPoint) => daily.reduce((a, r) => a + (r[k] as number), 0);
  const reach = sum("reach");
  return {
    reach, impressions: sum("impressions"), likes: sum("likes"), comments: sum("comments"), shares: sum("shares"), clicks: sum("clicks"),
    followers: daily.length ? daily[daily.length - 1].followers : 0,
    engagementRate: reach ? +((sum("engagement") / reach) * 100).toFixed(2) : 0,
  };
}
