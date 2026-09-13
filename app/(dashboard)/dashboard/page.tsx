import type { Metadata } from "next";
import { Overview, type OverviewData } from "@/components/dashboard/overview";
import { getWorkspacePage } from "@/lib/workspace/context";
import { getDashboardStats, getUpcoming } from "@/lib/services/posts";
import { listAccounts } from "@/lib/services/accounts";
import { getAnalytics, summarize, toSeries } from "@/lib/services/analytics";
import { utcToZoned } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Page() {
  const ctx = await getWorkspacePage();
  const [stats, accounts, upcoming, analytics] = await Promise.all([
    getDashboardStats(ctx),
    listAccounts(ctx),
    getUpcoming(ctx, 4),
    getAnalytics(ctx, "30d"),
  ]);

  const totals = summarize(analytics.daily);
  const data: OverviewData = {
    greeting: greetingFor(Number(utcToZoned(new Date(), ctx.workspace.timezone).time.slice(0, 2))),
    stats: {
      scheduled: stats.scheduled,
      published: stats.published,
      followers: accounts.reduce((a, x) => a + (x.followers ?? 0), 0),
      engagementRate: totals.engagementRate,
    },
    series: toSeries(analytics.daily, "30d", ctx.workspace.timezone),
    accounts,
    upcoming,
    hasAnalytics: analytics.daily.length > 0,
  };
  return <Overview data={data} />;
}
