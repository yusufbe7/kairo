import type { Metadata } from "next";
import { AnalyticsView, type AnalyticsData } from "@/components/analytics/analytics-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { getAnalytics, summarize, toSeries } from "@/lib/services/analytics";
import { listAccounts } from "@/lib/services/accounts";
import { listPosts } from "@/lib/services/posts";
import type { Range } from "@/types/analytics";

export const metadata: Metadata = { title: "Analytics" };

const RANGES: Range[] = ["7d", "30d", "3m", "1y"];

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.includes(rangeParam as Range) ? (rangeParam as Range) : "30d";
  const ctx = await getWorkspacePage();

  const [summary, accounts, published] = await Promise.all([
    getAnalytics(ctx, range),
    listAccounts(ctx),
    listPosts(ctx, { status: "published", page: 1, pageSize: 20, sort: "newest" }),
  ]);

  const totals = summarize(summary.daily);
  const data: AnalyticsData = {
    range,
    series: toSeries(summary.daily, range, ctx.workspace.timezone),
    totals: { ...totals, followers: totals.followers || accounts.reduce((a, x) => a + (x.followers ?? 0), 0) },
    summary,
    topPosts: published.posts.filter((p) => p.metrics).sort((a, b) => (b.metrics?.engagementRate ?? 0) - (a.metrics?.engagementRate ?? 0)).slice(0, 4),
    hasAccounts: accounts.length > 0,
  };
  return <AnalyticsView data={data} />;
}
