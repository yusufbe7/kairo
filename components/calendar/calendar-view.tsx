"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformGlyph } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { Thumb } from "@/components/social/thumb";
import { CalendarCard } from "./calendar-card";
import { PostDetailDialog } from "./post-detail-dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { movePostToDate } from "@/lib/actions/posts";
import { run } from "@/lib/client/action";
import { MAIN_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { DAY_NAMES, MONTHS, WEEK_HEADERS, fmtTime, iso, parseISO, relDay, shortDate } from "@/lib/format";
import type { PostView } from "@/types/posts";
import type { PlatformId } from "@/types/social";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "list";
const startOfWeek = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function CalendarView({ posts, month, initialView }: { posts: PostView[]; month: { year: number; month: number }; initialView: View }) {
  const router = useRouter();
  const { today, can } = useWorkspace();
  const todayDate = parseISO(today);

  const [view, setView] = useState<View>(initialView);
  const [cursor, setCursor] = useState(month);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayDate));
  const [platform, setPlatform] = useState<"all" | PlatformId>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [open, setOpen] = useState<PostView | null>(null);
  const [, start] = useTransition();

  const byDate = useMemo(() => {
    const map: Record<string, PostView[]> = {};
    posts.filter((p) => platform === "all" || p.platforms.includes(platform)).forEach((p) => { (map[p.date] ||= []).push(p); });
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [posts, platform]);

  const first = new Date(cursor.year, cursor.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Math.ceil((offset + new Date(cursor.year, cursor.month + 1, 0).getDate()) / 7) * 7;
  const monthDays = Array.from({ length: cells }, (_, i) => new Date(cursor.year, cursor.month, 1 - offset + i));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const listDates = Object.keys(byDate)
    .filter((d) => { const x = parseISO(d); return x.getFullYear() === cursor.year && x.getMonth() === cursor.month; })
    .sort();

  /** Server components hold the month's data, so navigation refetches. */
  const goToMonth = (year: number, monthIndex: number) => {
    setCursor({ year, month: monthIndex });
    router.push(`/calendar?month=${year}-${String(monthIndex + 1).padStart(2, "0")}&view=${view}`, { scroll: false });
  };
  const move = (dir: number) => {
    if (view === "week") {
      const d = addDays(weekStart, dir * 7);
      setWeekStart(d);
      if (d.getMonth() !== cursor.month) goToMonth(d.getFullYear(), d.getMonth());
    } else {
      const d = new Date(cursor.year, cursor.month + dir, 1);
      goToMonth(d.getFullYear(), d.getMonth());
    }
  };
  const goToday = () => { setWeekStart(startOfWeek(todayDate)); goToMonth(todayDate.getFullYear(), todayDate.getMonth()); };

  const drop = (day: string) => {
    const post = posts.find((p) => p.id === dragId);
    setOver(null);
    setDragId(null);
    if (!post || post.date === day) return;
    start(async () => {
      const result = await run(movePostToDate({ postId: post.id, date: day }), { success: `Moved to ${relDay(day, today)}` });
      if (result) { setLanded(post.id); setTimeout(() => setLanded(null), 600); router.refresh(); }
    });
  };

  const dropTarget = (day: string) => ({
    "data-over": over === day,
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(day); },
    onDragLeave: () => setOver((o) => (o === day ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(day); },
  });

  const card = (p: PostView, variant?: "large") => (
    <CalendarCard key={p.id} post={p} variant={variant} dragging={dragId === p.id} landed={landed === p.id}
      draggable={can("post.schedule") && p.status !== "published"}
      onDragStart={setDragId} onDragEnd={() => { setDragId(null); setOver(null); }} onOpen={setOpen} />
  );

  const title = view === "week"
    ? `${shortDate(weekDays[0])} – ${shortDate(weekDays[6])}, ${weekDays[6].getFullYear()}`
    : `${MONTHS[cursor.month]} ${cursor.year}`;

  return (
    <>
      <PageHeader title="Content Calendar" description={can("post.schedule") ? "Drag posts between days to reschedule." : "Everything planned for this workspace."} />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={goToday}>Today</Button>
          <Button size="icon-sm" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={15} /></Button>
          <div className="min-w-[150px] text-center text-[15px] font-semibold tracking-[-0.01em]" aria-live="polite">{title}</div>
          <Button size="icon-sm" onClick={() => move(1)} aria-label="Next"><ChevronRight size={15} /></Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented aria-label="Platform filter" value={platform} onChange={setPlatform}
            options={[{ value: "all" as const, label: "All platforms" }, ...MAIN_PLATFORMS.map((p) => ({ value: p, label: <><PlatformGlyph platform={p} size={12} /><span className="hidden md:inline">{PLATFORMS[p].name}</span></> }))]} />
          <Segmented aria-label="View" value={view} onChange={setView}
            options={[{ value: "month" as const, label: "Month" }, { value: "week" as const, label: "Week" }, { value: "list" as const, label: "List" }]} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={view + cursor.month + weekStart.getTime()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="surface overflow-hidden">
          <LayoutGroup>
            {view === "month" && (
              <div className="thin-scroll overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-7 border-b border-border">{WEEK_HEADERS.map((d) => <div key={d} className="px-2.5 py-2.5 text-xs text-dim">{d}</div>)}</div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((d, i) => {
                      const day = iso(d);
                      const inMonth = d.getMonth() === cursor.month;
                      const items = byDate[day] ?? [];
                      return (
                        <div key={day} className={cn("cal-cell", !inMonth && "opacity-40", (i + 1) % 7 === 0 && "border-r-0")} {...dropTarget(day)}>
                          <div className="flex items-center justify-between">
                            <span className={cn("inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-xs text-muted-foreground", day === today && "bg-brand font-semibold text-brand-foreground")}>{d.getDate()}</span>
                            {inMonth && day >= today && can("post.draft") && (
                              <Link href="/create" aria-label={`Create post on ${day}`} className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-dim opacity-60 hover:bg-white/5 hover:opacity-100"><Plus size={12} /></Link>
                            )}
                          </div>
                          {items.slice(0, 3).map((p) => card(p))}
                          {items.length > 3 && (
                            <button className="mt-1 text-[11px] text-dim hover:text-foreground" onClick={() => { setWeekStart(startOfWeek(d)); setView("week"); }}>+{items.length - 3} more</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === "week" && (
              <div className="thin-scroll overflow-x-auto">
                <div className="grid min-w-[820px] grid-cols-7">
                  {weekDays.map((d, i) => {
                    const day = iso(d);
                    const isToday = day === today;
                    return (
                      <div key={day} className={cn("cal-cell min-h-[460px] border-b-0 border-t-2 border-t-transparent", i === 6 && "border-r-0", isToday && "border-t-brand")} {...dropTarget(day)}>
                        <div className="mb-2"><div className="text-[11.5px] text-dim">{DAY_NAMES[d.getDay()]}</div><div className={cn("text-lg font-semibold", isToday && "text-brand")}>{d.getDate()}</div></div>
                        {isToday && (
                          <div className="mb-1.5 mt-1 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" /><span className="h-px flex-1 bg-brand/60" /><span className="text-[10.5px] text-brand">Now</span>
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">{(byDate[day] ?? []).map((p) => card(p, "large"))}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === "list" && (
              <div>
                {listDates.length === 0 && (
                  <EmptyState icon={CalendarDays} title="Nothing planned this month" text="Create a post or switch months to see scheduled content."
                    action={can("post.draft") ? <Button size="sm" variant="primary" asChild><Link href="/create"><Plus size={13} />Create post</Link></Button> : undefined} />
                )}
                {listDates.map((d) => (
                  <div key={d} className="border-b border-border last:border-b-0">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-3">
                      <span className={cn("text-[13px] font-semibold", d === today && "text-brand")}>{relDay(d, today)}</span>
                      <span className="text-xs text-dim">{/\d/.test(relDay(d, today)) ? DAY_NAMES[parseISO(d).getDay()] : shortDate(parseISO(d))}</span>
                    </div>
                    {byDate[d].map((p) => (
                      <button key={p.id} onClick={() => setOpen(p)} className="row-hover flex w-full items-center gap-3 px-4 py-2.5 text-left">
                        <span className="w-16 shrink-0 text-xs text-dim">{fmtTime(p.time)}</span>
                        <Thumb i={p.thumb} src={p.media[0]?.url ?? undefined} className="h-10 w-10" rounded="rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px]">{p.title}</div>
                          <div className="flex items-center gap-1.5 text-xs text-dim">
                            {p.platforms[0] && <PlatformGlyph platform={p.platforms[0]} size={11} />}
                            {p.platforms.map((x) => PLATFORMS[x].name).join(", ")}
                          </div>
                        </div>
                        <StatusBadge tone={p.status === "publishing" ? "scheduled" : p.status} />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </LayoutGroup>
        </motion.div>
      </AnimatePresence>

      {can("post.draft") && (
        <Button variant="primary" asChild className="fixed bottom-[84px] right-6 z-30 h-11 rounded-[14px] px-[18px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)] lg:bottom-6">
          <Link href="/create"><Plus size={16} />Create post</Link>
        </Button>
      )}

      <PostDetailDialog post={open} onClose={() => setOpen(null)} />
    </>
  );
}
