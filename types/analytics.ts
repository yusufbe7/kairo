import type { MetricSource } from "./database";
import type { PlatformId } from "./social";

export type Range = "7d" | "30d" | "3m" | "1y";

export interface SeriesPoint {
  label: string;
  reach: number;
  engagement: number;
  followers: number;
  likes: number;
  comments: number;
}

export interface DailyPoint {
  date: string; reach: number; impressions: number; engagement: number; likes: number;
  comments: number; shares: number; clicks: number; followers: number;
}

export interface AnalyticsSummary {
  /** One point per day for the last 365 days that have data, summed across accounts. */
  daily: DailyPoint[];
  byPlatform: { platform: PlatformId; reach: number; engagementRate: number | null }[];
  source: MetricSource | null;
  lastFetchedAt: string | null;
  bestTimes: number[][] | null;
}
