"use client";

import Link from "next/link";
import { CalendarDays, ChartColumn, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { PLATFORMS } from "@/lib/platforms";
import { fmtNum, timeAgo } from "@/lib/format";
import type { PostView } from "@/types/posts";
import type { AccountView } from "@/types/social";
import type { SeriesPoint } from "@/types/analytics";
import { StatCard } from "./stat-card";
import { PerformanceChart } from "./performance-chart";
import { PostCard } from "./post-card";

export interface OverviewData {
  greeting: string;
  stats: { scheduled: number; published: number; followers: number; engagementRate: number };
  series: SeriesPoint[];
  accounts: AccountView[];
  upcoming: PostView[];
  hasAnalytics: boolean;
}

export function Overview({ data }: { data: OverviewData }) {
  const { today, can } = useWorkspace();
  const { stats, accounts, upcoming } = data;

  return (
    <>
      <PageHeader title={`${data.greeting} 👋`} description="Here's what's happening with your content.">
        {can("post.draft") && <Button variant="primary" asChild><Link href="/create"><Plus size={15} />Create post</Link></Button>}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Scheduled" value={stats.scheduled} data={data.series} dataKey="reach" id="s1" brand hint="upcoming" />
        <StatCard label="Published" value={stats.published} data={data.series} dataKey="likes" id="s2" hint="last 30 days" />
        <StatCard label="Engagement" value={data.hasAnalytics ? `${stats.engagementRate}%` : "—"} data={data.series} dataKey="engagement" id="s3" hint={data.hasAnalytics ? "last 30 days" : "no data yet"} />
        <StatCard label="Followers" value={stats.followers ? fmtNum(stats.followers) : "—"} data={data.series} dataKey="followers" id="s4" hint={accounts.length ? "across accounts" : "connect an account"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PerformanceChart series={data.series} hasData={data.hasAnalytics} />
        <div className="surface flex flex-col p-5">
          <div className="flex items-center justify-between">
            <div className="h2">Connected accounts</div>
            <Button variant="ghost" size="sm" asChild><Link href="/accounts">Manage</Link></Button>
          </div>
          <div className="mt-3.5 flex flex-1 flex-col gap-1">
            {accounts.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <p className="text-[13px] text-muted-foreground">No accounts connected yet.</p>
                <p className="max-w-[220px] text-xs text-dim">Connect a social account to publish and pull in analytics.</p>
              </div>
            )}
            {accounts.map((a) => (
              <div key={a.id} className="row-hover -mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2.5">
                <PlatformIcon platform={a.platform} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{PLATFORMS[a.platform].name}</div>
                  <div className="truncate text-xs text-dim">{a.handle}</div>
                </div>
                {a.status === "connected"
                  ? <StatusBadge tone="connected">Connected</StatusBadge>
                  : <StatusBadge tone="warning">{a.status === "expired" ? "Expired" : "Reconnect"}</StatusBadge>}
              </div>
            ))}
          </div>
          {can("account.manage") && <Button size="sm" className="mt-3 w-full" asChild><Link href="/accounts"><Plus size={13} />Connect account</Link></Button>}
        </div>
      </div>

      {accounts.some((a) => a.status !== "connected") && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-[13px] text-warning">
          <TriangleAlert size={15} className="mt-px shrink-0" />
          <span>One of your connections needs attention. Scheduled posts to that account will fail until it's reconnected. <Link href="/accounts" className="underline underline-offset-[3px]">Fix it now</Link></span>
        </div>
      )}

      <section className="mt-7">
        <div className="mb-3.5 flex items-center justify-between">
          <div><div className="h2">Upcoming posts</div><div className="mt-0.5 text-[12.5px] text-dim">Next in your queue</div></div>
          <Button size="sm" asChild><Link href="/calendar"><CalendarDays size={13} />View calendar</Link></Button>
        </div>
        {upcoming.length ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{upcoming.map((p) => <PostCard key={p.id} post={p} today={today} />)}</div>
        ) : (
          <div className="surface">
            <EmptyState icon={CalendarDays} title="Your queue is empty" text="Schedule a post and it will show up here."
              action={can("post.draft") ? <Button variant="primary" size="sm" asChild><Link href="/create">Create post</Link></Button> : undefined} />
          </div>
        )}
      </section>

      {data.hasAnalytics === false && accounts.length > 0 && (
        <p className="mt-6 flex items-center gap-2 text-xs text-dim"><ChartColumn size={13} />Analytics appear here once your connected accounts report their first daily snapshot.</p>
      )}
      {accounts.length > 0 && accounts[0].lastSyncedAt && (
        <p className="mt-2 text-xs text-dim">Accounts last synced {timeAgo(accounts[0].lastSyncedAt)}.</p>
      )}
    </>
  );
}
