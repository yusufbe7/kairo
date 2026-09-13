"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformGlyph, PlatformIcon } from "@/components/social/platform-icon";
import { Thumb } from "@/components/social/thumb";
import { AXIS_PROPS, ChartTooltip } from "./chart-tooltip";
import { PLATFORMS } from "@/lib/platforms";
import { fmtNum, timeAgo } from "@/lib/format";
import type { AnalyticsSummary, Range, SeriesPoint } from "@/types/analytics";
import type { PostView } from "@/types/posts";

const RANGE_OPTIONS = [
  { value: "7d" as const, label: "7 days" }, { value: "30d" as const, label: "30 days" },
  { value: "3m" as const, label: "3 months" }, { value: "1y" as const, label: "1 year" },
];

export interface AnalyticsData {
  range: Range;
  series: SeriesPoint[];
  totals: { reach: number; impressions: number; likes: number; comments: number; shares: number; clicks: number; followers: number; engagementRate: number };
  summary: AnalyticsSummary;
  topPosts: PostView[];
  hasAccounts: boolean;
}

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const [range, setRange] = useState<Range>(data.range);
  const [compare, setCompare] = useState<"reach" | "eng">("reach");

  const changeRange = (next: Range) => { setRange(next); router.push(`/analytics?range=${next}`, { scroll: false }); };
  const hasData = data.series.length > 0;
  const platforms = data.summary.byPlatform;
  const max = Math.max(1, ...platforms.map((p) => (compare === "reach" ? p.reach : p.engagementRate ?? 0)));

  const metrics: [string, string][] = [
    ["Reach", hasData ? fmtNum(data.totals.reach) : "—"],
    ["Engagement", hasData ? `${data.totals.engagementRate}%` : "—"],
    ["Followers", data.totals.followers ? fmtNum(data.totals.followers) : "—"],
    ["Clicks", hasData ? fmtNum(data.totals.clicks) : "—"],
    ["Likes", hasData ? fmtNum(data.totals.likes) : "—"],
    ["Comments", hasData ? fmtNum(data.totals.comments) : "—"],
    ["Shares", hasData ? fmtNum(data.totals.shares) : "—"],
  ];

  if (!data.hasAccounts) {
    return (
      <>
        <PageHeader title="Analytics" description="How your content is landing, across every channel." />
        <div className="surface">
          <EmptyState icon={Link2} title="Connect an account to see analytics"
            text="Kairo pulls reach, engagement and follower data from the platforms you connect. Nothing here is estimated."
            action={<Button variant="primary" size="sm" asChild><Link href="/accounts">Connect an account</Link></Button>} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Analytics" description="How your content is landing, across every channel.">
        <Segmented aria-label="Date range" value={range} onChange={changeRange} options={RANGE_OPTIONS} />
      </PageHeader>

      {data.summary.lastFetchedAt && (
        <p className="-mt-4 mb-5 text-xs text-dim">
          {data.summary.source === "live" ? "Live data" : "Cached data"} · last synced {timeAgo(data.summary.lastFetchedAt)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
        {metrics.map(([label, value]) => (
          <div key={label} className="surface px-3.5 pb-3 pt-3.5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="surface p-5">
          <div className="h2">Audience growth</div>
          <div className="mt-0.5 text-[12.5px] text-dim">Total followers across connected accounts</div>
          {hasData ? (
            <div className="-ml-2 mt-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} key={range} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="aud" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ECEDEF" stopOpacity={0.14} /><stop offset="100%" stopColor="#ECEDEF" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                  <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={24} />
                  <YAxis {...AXIS_PROPS} width={46} tickFormatter={fmtNum} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip format={fmtNum} />} cursor={{ stroke: "rgba(255,255,255,.15)", strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="followers" name="Followers" stroke="#ECEDEF" strokeWidth={1.8} fill="url(#aud)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center">
              <EmptyState icon={ChartColumn} title="No snapshots yet" text="Daily analytics appear once your connected accounts have reported data." />
            </div>
          )}
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div className="h2">Platform comparison</div>
            <Segmented aria-label="Compare by" value={compare} onChange={setCompare} options={[{ value: "reach" as const, label: "Reach" }, { value: "eng" as const, label: "Eng." }]} />
          </div>
          {platforms.length ? (
            <div className="mt-[22px] flex flex-col gap-[18px]">
              {platforms.map((p) => {
                const value = compare === "reach" ? p.reach : p.engagementRate ?? 0;
                return (
                  <motion.div key={p.platform} layout transition={{ type: "spring", stiffness: 400, damping: 36 }}>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2"><PlatformGlyph platform={p.platform} size={14} />{PLATFORMS[p.platform].name}</span>
                      <b className="font-semibold">{compare === "reach" ? fmtNum(value) : `${value}%`}</b>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div className="h-full rounded-full" initial={false} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                        style={{ background: `linear-gradient(90deg, rgba(236,237,239,.35), ${PLATFORMS[p.platform].color})` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-[13px] text-dim">No platform data for this range yet.</p>
          )}
        </div>
      </div>

      {hasData && (
        <div className="mt-4 surface p-5">
          <div className="h2">Engagement over time</div>
          <div className="mt-0.5 text-[12.5px] text-dim">Likes and comments per period</div>
          <div className="-ml-2 mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} key={range} margin={{ top: 8, right: 18, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={24} />
                <YAxis {...AXIS_PROPS} width={46} tickFormatter={fmtNum} />
                <Tooltip content={<ChartTooltip format={fmtNum} />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                <Bar dataKey="likes" name="Likes" fill="rgba(236,237,239,.75)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={700} />
                <Bar dataKey="comments" name="Comments" fill="rgba(236,237,239,.25)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <section className="mt-7">
        <div className="h2 mb-3.5">Top performing content</div>
        {data.topPosts.length ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.topPosts.map((p, i) => (
              <div key={p.id} className="surface surface-lift p-2.5">
                <div className="relative">
                  <Thumb i={p.thumb} src={p.media[0]?.url ?? undefined} video={p.media[0]?.kind === "video"} className="h-[120px] w-full" />
                  <span className="absolute left-2 top-2 rounded-[7px] bg-black/50 px-[7px] py-0.5 text-[11.5px] font-semibold backdrop-blur-md">#{i + 1}</span>
                  {p.platforms[0] && <div className="absolute right-2 top-2"><PlatformIcon platform={p.platforms[0]} size={24} /></div>}
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="truncate text-[13px] font-medium">{p.caption || p.title}</div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <div><div className="text-[11px] text-dim">Reach</div><div className="text-[13px] font-semibold">{p.metrics ? fmtNum(p.metrics.reach) : "—"}</div></div>
                    <div><div className="text-[11px] text-dim">Engagement</div><div className="text-[13px] font-semibold">{p.metrics?.engagementRate != null ? `${p.metrics.engagementRate}%` : "—"}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface"><EmptyState icon={ChartColumn} title="No published posts with metrics yet" text="Once posts go live and the platforms report back, your best performers land here." /></div>
        )}
      </section>
    </>
  );
}
