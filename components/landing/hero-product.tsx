"use client";

import { CalendarDays, ChartColumn, Inbox, Image as ImageIcon, LayoutGrid, Link2, Search, Settings, Sparkles, SquarePen, FileText } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { Thumb } from "@/components/social/thumb";
import { UserAvatar } from "@/components/social/user-avatar";
import { DEMO_ACCOUNTS, DEMO_POSTS, demoSeries } from "@/data/demo/content";
import { PLATFORMS } from "@/lib/platforms";
import { fmtNum } from "@/lib/format";
import { ScaledFrame } from "./scaled-frame";
import { MarketingChart } from "./marketing-chart";

const NAV = [
  [LayoutGrid, "Overview", true], [SquarePen, "Create", false], [CalendarDays, "Calendar", false], [FileText, "Posts", false],
  [ChartColumn, "Analytics", false], [Inbox, "Inbox", false], [Link2, "Accounts", false], [ImageIcon, "Media Library", false], [Sparkles, "AI Studio", false],
] as const;

/**
 * A still of the product for the marketing hero. It reuses the real design system but
 * renders demo content — the live dashboard is behind sign-in.
 */
export function HeroProduct() {
  const series = demoSeries(30);
  const upcoming = DEMO_POSTS.filter((p) => p.status === "scheduled").slice(0, 4);

  return (
    <div className="overflow-hidden rounded-[18px] border border-border-strong bg-[#08090C] shadow-[0_50px_120px_-40px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,0.03),0_-1px_60px_-30px_rgba(147,171,255,0.35)]">
      <div className="flex h-10 items-center gap-2 border-b border-border bg-white/[0.02] px-3.5">
        {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />)}
        <div className="mx-auto rounded-[7px] border border-border bg-white/[0.04] px-10 py-0.5 text-[11.5px] text-dim">kairohub.pro</div>
      </div>
      <ScaledFrame width={1320} height={800}>
        <div className="flex h-[800px]">
          <aside className="flex h-[800px] w-60 shrink-0 flex-col border-r border-border bg-[rgba(9,10,13,0.72)] px-3 py-3.5">
            <div className="px-2 pb-2.5 pt-1.5"><Logo /></div>
            <div className="mb-1.5 mt-[18px] px-2.5 text-[11.5px] font-medium text-dim">Workspace</div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map(([Icon, label, active]) => (
                <span key={label} className="nav-item" data-active={active}><Icon size={16} strokeWidth={1.8} />{label}</span>
              ))}
            </nav>
            <div className="flex-1" />
            <span className="nav-item"><Settings size={16} strokeWidth={1.8} />Settings</span>
            <div className="my-2.5 h-px bg-border" />
            <span className="nav-item h-12">
              <UserAvatar name="Alex" size={28} />
              <span className="leading-tight"><span className="block text-[13px] text-foreground">Alex Rivera</span><span className="block text-[11.5px] text-dim">Owner</span></span>
            </span>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-16 items-center gap-3 border-b border-border px-5">
              <div className="relative w-[340px]">
                <Search size={15} className="absolute left-3 top-[10.5px] text-dim" />
                <div className="h-9 rounded-[10px] border border-input bg-white/[0.03] pl-[34px] pt-[9px] text-[13px] text-dim">Search posts…</div>
              </div>
              <div className="flex-1" />
              <div className="h-[34px] rounded-[10px] border border-border bg-secondary px-3.5 pt-2 text-[13px]">Northwind Studio</div>
              <UserAvatar name="Alex" size={32} />
            </div>

            <div className="px-9 py-8">
              <h2 className="h1">Good evening 👋</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your content.</p>

              <div className="mt-7 grid grid-cols-4 gap-3">
                {([["Scheduled", "18", "upcoming"], ["Published", "146", "last 30 days"], ["Engagement", "8.4%", "last 30 days"], ["Followers", fmtNum(128400), "across accounts"]] as const).map(([label, value, hint]) => (
                  <div key={label} className="surface p-4">
                    <div className="text-[12.5px] text-muted-foreground">{label}</div>
                    <div className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</div>
                    <div className="mt-1.5 text-[11.5px] text-dim">{hint}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                <MarketingChart series={series} height={260} title="Content performance" />
                <div className="surface p-5">
                  <div className="h2">Connected accounts</div>
                  <div className="mt-3.5 flex flex-col gap-1">
                    {DEMO_ACCOUNTS.map((a) => (
                      <div key={a.platform} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5">
                        <PlatformIcon platform={a.platform} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium">{PLATFORMS[a.platform].name}</div>
                          <div className="truncate text-xs text-dim">{a.handle}</div>
                        </div>
                        <StatusBadge tone="connected">Connected</StatusBadge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <div className="h2">Upcoming posts</div>
                <div className="mt-3.5 grid grid-cols-4 gap-3">
                  {upcoming.map((p, i) => (
                    <div key={p.title} className="surface p-2.5">
                      <div className="relative">
                        <Thumb i={i} className="h-32 w-full" />
                        <div className="absolute left-2 top-2"><PlatformIcon platform={p.platform} size={24} /></div>
                      </div>
                      <div className="px-1 pb-1 pt-3">
                        <div className="truncate text-[13.5px] font-medium">{p.caption}</div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{p.time}</span>
                          <StatusBadge tone="scheduled" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScaledFrame>
    </div>
  );
}
