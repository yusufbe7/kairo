/**
 * Demo content. Two uses only:
 *  1. The public marketing page, where it is illustrative by definition.
 *  2. `npm run db:seed`, which writes it into a workspace flagged `is_demo`.
 * The product itself never falls back to this data.
 */
import type { PlatformId } from "@/types/social";

export interface DemoPost { title: string; caption: string; platform: PlatformId; status: "scheduled" | "published" | "draft" | "failed"; dayOffset: number; time: string; reach: number; engagementRate: number }

export const DEMO_POSTS: DemoPost[] = [
  { title: "Introducing our newest product", caption: "Introducing our newest product — Kairo Sync. One queue, every channel, zero copy-paste.", platform: "instagram", status: "scheduled", dayOffset: 1, time: "10:00", reach: 0, engagementRate: 0 },
  { title: "Behind the scenes", caption: "Behind the scenes of our launch week. Coffee count: classified.", platform: "tiktok", status: "scheduled", dayOffset: 1, time: "14:30", reach: 0, engagementRate: 0 },
  { title: "We are excited to announce", caption: "We are excited to announce our Series A, led by partners who believe content teams deserve better tools.", platform: "linkedin", status: "scheduled", dayOffset: 2, time: "09:00", reach: 0, engagementRate: 0 },
  { title: "Shipping log #42", caption: "Shipping log #42: bulk reschedule, smarter timezones, and a calmer calendar.", platform: "x", status: "scheduled", dayOffset: 4, time: "16:00", reach: 0, engagementRate: 0 },
  { title: "5 hooks that stop the scroll", caption: "5 hooks that stop the scroll (and why #3 works every time).", platform: "instagram", status: "scheduled", dayOffset: 5, time: "18:00", reach: 0, engagementRate: 0 },
  { title: "Customer story: Northwind", caption: "How Northwind cut weekly planning from 6 hours to 40 minutes.", platform: "linkedin", status: "scheduled", dayOffset: 7, time: "11:00", reach: 0, engagementRate: 0 },
  { title: "Desk setup tour", caption: "Our design lead's desk setup, ranked by how often it gets asked about.", platform: "tiktok", status: "scheduled", dayOffset: 8, time: "19:30", reach: 0, engagementRate: 0 },
  { title: "Thread: scheduling mistakes", caption: "7 scheduling mistakes we made so you don't have to. A thread.", platform: "x", status: "scheduled", dayOffset: 11, time: "15:00", reach: 0, engagementRate: 0 },
  { title: "The calm calendar", caption: "The calm calendar: why we removed 40% of our UI.", platform: "instagram", status: "published", dayOffset: -2, time: "10:00", reach: 48200, engagementRate: 9.4 },
  { title: "Launch day recap", caption: "Launch day recap in 30 seconds.", platform: "tiktok", status: "published", dayOffset: -3, time: "18:00", reach: 126400, engagementRate: 12.1 },
  { title: "Q3 product update", caption: "Our Q3 product update: what shipped, what's next.", platform: "linkedin", status: "published", dayOffset: -6, time: "09:00", reach: 21800, engagementRate: 6.2 },
  { title: "Hot take on analytics", caption: "Vanity metrics aren't useless. They're just early.", platform: "x", status: "published", dayOffset: -7, time: "13:00", reach: 33900, engagementRate: 4.8 },
  { title: "Team offsite photos", caption: "Team offsite photos from Samarkand.", platform: "instagram", status: "published", dayOffset: -9, time: "17:00", reach: 61200, engagementRate: 10.7 },
  { title: "Carousel: brand guidelines", caption: "Draft — carousel on building brand guidelines for small teams.", platform: "instagram", status: "draft", dayOffset: 9, time: "10:00", reach: 0, engagementRate: 0 },
  { title: "Weekly tips video", caption: "Draft — weekly tips format test.", platform: "tiktok", status: "draft", dayOffset: 12, time: "17:00", reach: 0, engagementRate: 0 },
];

export const DEMO_ACCOUNTS: { platform: PlatformId; handle: string; followers: number }[] = [
  { platform: "instagram", handle: "@kairo.studio", followers: 48200 },
  { platform: "tiktok", handle: "@kairo.studio", followers: 61400 },
  { platform: "linkedin", handle: "Kairo Studio", followers: 12900 },
  { platform: "x", handle: "@kairostudio", followers: 5900 },
];

export interface DemoConversation { name: string; handle: string; platform: PlatformId; unread: boolean; preview: string; avatar: number; messages: { me: boolean; text: string }[] }

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  { name: "Dilnoza R.", handle: "@dilnoza.designs", platform: "instagram", unread: true, preview: "Is the launch discount still available?", avatar: 0,
    messages: [{ me: false, text: "Hi! Loved the product video 🙌" }, { me: false, text: "Is the launch discount still available?" }] },
  { name: "Marcus Lee", handle: "@marcusbuilds", platform: "x", unread: true, preview: "Does it support Bluesky yet?", avatar: 1,
    messages: [{ me: false, text: "Does it support Bluesky yet?" }] },
  { name: "Aziza K.", handle: "@aziza.films", platform: "tiktok", unread: false, preview: "What camera did you use for the BTS clip?", avatar: 2,
    messages: [{ me: false, text: "What camera did you use for the BTS clip?" }, { me: true, text: "Just a phone and a small gimbal!" }] },
  { name: "Priya Shah", handle: "Head of Marketing, Northwind", platform: "linkedin", unread: false, preview: "Could we set up a call next week?", avatar: 3,
    messages: [{ me: false, text: "Great case study. Could we set up a call next week to talk about a team plan?" }] },
  { name: "Sofia M.", handle: "@sofia.makes", platform: "instagram", unread: true, preview: "Can I repost your carousel?", avatar: 5,
    messages: [{ me: false, text: "Can I repost your carousel with credit?" }] },
];

/** Deterministic series for the marketing page charts (never used inside the product). */
const seeded = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

export function demoSeries(points: number, seed = 3) {
  const r = seeded(seed * 17 + points);
  let reach = 30000, engagement = 6, followers = 118000;
  return Array.from({ length: points }, (_, i) => {
    reach = Math.max(12000, reach + (r() - 0.38) * 9000);
    engagement = Math.max(3, Math.min(12, engagement + (r() - 0.45) * 1.2));
    followers += r() * 900 + 200;
    const date = new Date(Date.now() - (points - 1 - i) * 86400000);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      date: date.toISOString().slice(0, 10),
      reach: Math.round(reach), engagement: +engagement.toFixed(2), followers: Math.round(followers),
      likes: Math.round(reach * 0.06), comments: Math.round(reach * 0.008),
      impressions: Math.round(reach * 1.4), shares: Math.round(reach * 0.004), clicks: Math.round(reach * 0.02),
    };
  });
}

/** Relative engagement by weekday (Mon→Sun) and slot (6a, 9a, 12p, 3p, 6p, 9p). */
export const DEMO_BEST_TIMES = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 6 }, (_, s) => {
    const base = [0.25, 0.35, 0.45, 0.4, 0.75, 0.95][s];
    return Math.min(1, base * (d >= 5 ? 0.85 : 1) * (0.75 + ((d * 7 + s * 3) % 5) / 10));
  }),
);
