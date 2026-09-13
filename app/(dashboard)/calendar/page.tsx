import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listPostsInRange } from "@/lib/services/posts";
import { iso, parseISO } from "@/lib/format";

export const metadata: Metadata = { title: "Calendar" };

/** Widens the window to whole weeks so the month grid's leading/trailing days are populated. */
function windowFor(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const from = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const to = new Date(year, month, last.getDate() + (7 - ((last.getDay() + 6) % 7) - 1));
  return { from: iso(from), to: iso(to) };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const { month: monthParam, view } = await searchParams;
  const ctx = await getWorkspacePage();

  const parsed = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam!.split("-").map(Number) : null;
  const anchor = parsed ? new Date(parsed[0], parsed[1] - 1, 1) : parseISO(ctx.today);
  const month = { year: anchor.getFullYear(), month: anchor.getMonth() };

  const { from, to } = windowFor(month.year, month.month);
  const posts = await listPostsInRange(ctx, from, to);
  const initialView = view === "week" || view === "list" ? view : "month";

  return <CalendarView posts={posts} month={month} initialView={initialView} />;
}
