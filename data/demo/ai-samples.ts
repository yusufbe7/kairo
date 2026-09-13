import type { PlatformId } from "@/types/social";

/**
 * Pre-written examples for the marketing page's "one idea, three ways" section.
 * The product calls the real model; this is illustration only.
 */
type Sample = Partial<Record<PlatformId, string>>;

export const DEMO_AI_OUTPUT: Sample[] = [
  {
    instagram: "Students, this one's for you ✨\n\nKairo is now free for anyone with a .edu address — the full calendar, every platform, no card.\n\nTag a friend who's been posting from four different apps. 👇",
    linkedin: "We're making Kairo free for students.\n\nThe people learning social strategy right now are doing it with the worst tooling: four tabs, a spreadsheet, and a phone alarm. That's a bad way to learn what actually works.\n\nStarting today, any verified student account gets the full plan at no cost.",
    x: "Kairo is now free for students.\n\n1/ Full calendar, every platform, no card.\n2/ Verify with a .edu address.\n3/ Keep it as long as you're enrolled.\n\nGo build something.",
  },
  {
    instagram: "Telegram channels are live in Kairo 📣\n\nSchedule to your channel alongside Instagram, TikTok and the rest — one queue, one calendar.\n\nWhat should we add next?",
    linkedin: "Kairo now supports Telegram channels.\n\nFor teams in markets where Telegram is the primary channel, this closes a real gap: the same post, the same schedule, no separate workflow.\n\nAvailable on every plan today.",
    x: "Telegram channels are now supported in Kairo.\n\nSame queue. Same calendar. One less tab.",
  },
  {
    instagram: "1,000 customers in, here's what surprised us 👀\n\n→ Most teams post less than they planned\n→ The calendar matters more than the editor\n→ Nobody reads analytics on Monday\n\nSave this one.",
    linkedin: "Five lessons from our first 1,000 customers.\n\n1. Teams overestimate how much they'll post by roughly half.\n2. The calendar, not the editor, is where people spend their time.\n3. Approval steps are used far more than we expected.\n4. Analytics get read on Thursdays, not Mondays.\n5. Nearly everyone customizes per platform once they try it.\n\nWe've built the roadmap around these.",
    x: "5 lessons from our first 1,000 customers:\n\n1/ Teams post half as much as they plan.\n2/ The calendar beats the editor.\n3/ Approvals matter more than we thought.\n4/ Analytics get read Thursday, not Monday.\n5/ Per-platform edits stick.",
  },
];
