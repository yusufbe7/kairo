"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChartColumn, Check, Inbox, Play, Sparkles, SquarePen, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Logo } from "@/components/layout/logo";
import { MarketingChart } from "./marketing-chart";
import { PlatformGlyph, PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { UserAvatar } from "@/components/social/user-avatar";
import { HeroProduct } from "./hero-product";
import { LandingCalendar } from "./landing-calendar";
import { LandingAI } from "./landing-ai";
import { ALL_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { PLAN_CARDS, TRIAL_DAYS } from "@/lib/billing/plans";
import { DEMO_CONVERSATIONS, demoSeries } from "@/data/demo/content";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const wrap = "mx-auto max-w-[1180px] px-5";

const FEATURES: { title: string; text: string; icon: LucideIcon; span?: string }[] = [
  { title: "Create", text: "One editor for every format — posts, reels, stories, threads — with a live preview for each platform.", icon: SquarePen, span: "md:col-span-2" },
  { title: "Schedule", text: "Queue posts at the times your audience is actually online.", icon: CalendarDays },
  { title: "Analyze", text: "Reach, engagement and growth across every channel, side by side.", icon: ChartColumn },
  { title: "Collaborate", text: "Drafts, comments and approvals so nothing ships by accident.", icon: Users },
  { title: "AI Studio", text: "Turn one idea into platform-ready drafts in your brand's tone.", icon: Sparkles },
  { title: "Unified Inbox", text: "Every comment and DM in one list, with suggested replies.", icon: Inbox, span: "md:col-span-3" },
];

/** Mirrors lib/billing/plans.ts — the amount charged is whatever the Stripe Price says. */
const PLANS = PLAN_CARDS.map((plan) => ({
  name: plan.name,
  monthly: plan.monthlyCents / 100,
  yearly: plan.yearlyMonthlyCents / 100,
  text: plan.tagline,
  features: plan.features.slice(0, 4),
  featured: plan.featured,
}));

function SectionTitle({ title, text }: { title: React.ReactNode; text?: string }) {
  return (
    <div className="mb-9 max-w-[620px]">
      <h2 className="text-[clamp(28px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">{title}</h2>
      {text && <p className="mt-3.5 text-base leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}

function FloatingCard({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div className={cn("absolute z-[3] hidden xl:block", className)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + delay * 0.15, duration: 0.5, ease: EASE }}>
      <div className="animate-float" style={{ animationDelay: `${delay * 1.2}s` }}>
        <div className="flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-border-strong bg-[rgba(17,19,24,0.88)] px-3.5 py-2.5 text-[13px] shadow-[0_20px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">{children}</div>
      </div>
    </motion.div>
  );
}

export function LandingPage() {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="relative z-[1]">
      <header className="sticky top-0 z-40 border-b border-border bg-[rgba(6,7,9,0.72)] backdrop-blur-xl">
        <div className={cn(wrap, "flex h-16 items-center gap-7")}>
          <Link href="/" aria-label="Kairo home"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-[13.5px] text-muted-foreground md:flex">
            {[["Features", "#features"], ["Calendar", "#calendar"], ["AI", "#ai"], ["Pricing", "#pricing"]].map(([l, h]) => <a key={h} href={h} className="transition-colors hover:text-foreground">{l}</a>)}
          </nav>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild><Link href="/login">Sign in</Link></Button>
          <Button variant="primary" size="sm" asChild><Link href="/register">Start free trial</Link></Button>
        </div>
      </header>

      {/* Hero — one orchestrated entrance, nothing else moves on load */}
      <section className={cn(wrap, "pt-[clamp(48px,7vw,88px)]")}>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}
            className="text-[clamp(44px,7vw,86px)] font-semibold leading-[0.98] tracking-[-0.045em]">
            Create once.<br />Publish everywhere.
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7, ease: EASE }} className="max-w-[380px] pb-2">
            <p className="text-[17px] leading-relaxed text-muted-foreground">Plan, create, schedule and analyze your social content from one beautifully designed workspace.</p>
            <div className="mt-[22px] flex flex-wrap gap-2.5">
              <Button variant="primary" size="lg" asChild><Link href="/register">Start free trial</Link></Button>
              <Button size="lg" asChild><Link href="/create"><Play size={13} />View demo</Link></Button>
            </div>
            <div className="mt-3.5 text-[12.5px] text-dim">{TRIAL_DAYS}-day free trial. $0.00 today, cancel anytime.</div>
          </motion.div>
        </div>

        <motion.div className="relative mt-16" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.9, ease: EASE }}>
          <div className="pointer-events-none absolute inset-x-[10%] -top-16 h-[300px] blur-xl" style={{ background: "radial-gradient(closest-side, rgba(147,171,255,.14), transparent)" }} />
          <FloatingCard className="-left-7 top-[12%]" delay={0}><span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-brand/10"><Check size={12} className="text-brand" /></span>Post scheduled ✓</FloatingCard>
          <FloatingCard className="-right-6 top-[6%]" delay={1}><PlatformIcon platform="instagram" size={22} />Instagram connected</FloatingCard>
          <FloatingCard className="-right-8 bottom-[22%]" delay={2}><TrendingUp size={15} className="text-success" /><b className="font-semibold">+18.4%</b><span className="text-muted-foreground">engagement</span></FloatingCard>
          <FloatingCard className="-left-9 bottom-[12%]" delay={3}><Sparkles size={14} className="text-brand" />AI generated caption</FloatingCard>
          <HeroProduct />
        </motion.div>
      </section>

      <section className={cn(wrap, "mt-[88px]")}>
        <p className="text-center text-[13px] text-dim">Trusted by modern creators and teams</p>
        <div className="mt-[22px] flex flex-wrap items-center justify-center gap-x-12 gap-y-[18px] text-xl text-white/[0.38]">
          <span className="font-bold tracking-[-0.04em]">Northwind</span>
          <span className="font-medium">lumen</span>
          <span className="font-semibold tracking-[0.14em]">ARCADIA</span>
          <span className="font-semibold tracking-[-0.02em]">Foundry&amp;Co</span>
          <span className="font-normal tracking-[-0.03em]">halcyon</span>
          <span className="font-bold tracking-[-0.01em]">Meridian</span>
        </div>
      </section>

      <section id="features" className={cn(wrap, "mt-[130px] scroll-mt-24")}>
        <SectionTitle title="Everything you need to manage social content" text="Six tools that usually live in six tabs — built to work as one." />
        <div className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={cn("surface surface-lift p-[22px]", f.span)}>
              <f.icon size={18} className={f.title === "Schedule" ? "text-brand" : "text-muted-foreground"} />
              <div className="mt-4 text-[15.5px] font-semibold">{f.title}</div>
              <p className="mt-1.5 max-w-[440px] text-[13.5px] leading-relaxed text-muted-foreground">{f.text}</p>
              {f.title === "Create" && (
                <div className="mt-[18px] flex flex-wrap gap-1.5">{ALL_PLATFORMS.map((p) => <span key={p} className="chip h-7 cursor-default"><PlatformGlyph platform={p} size={12} />{PLATFORMS[p].name}</span>)}</div>
              )}
              {f.title === "Unified Inbox" && (
                <div className="mt-[18px] flex flex-wrap gap-2">
                  {DEMO_CONVERSATIONS.slice(0, 3).map((c) => (
                    <div key={c.name} className="flex flex-[1_1_240px] items-center gap-2.5 rounded-[10px] border border-border px-3 py-2 text-[12.5px]">
                      <UserAvatar name={c.name} size={24} /><span className="truncate">{c.preview}</span><PlatformGlyph platform={c.platform} size={12} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="calendar" className={cn(wrap, "mt-[130px] scroll-mt-24")}>
        <SectionTitle title="A calendar that stays calm when your plans don't" text="See the whole month at a glance. Move a post by dragging it — timezones and platform limits are handled for you." />
        <LandingCalendar />
      </section>

      <section id="ai" className={cn(wrap, "mt-[130px] scroll-mt-24")}>
        <SectionTitle title="One idea, written three ways" text="Type one idea. Get a caption for Instagram, a long-form post for LinkedIn and a thread for X — each written for how people read there." />
        <LandingAI />
      </section>

      <section className={cn(wrap, "mt-[130px]")}>
        <SectionTitle title="Numbers you can act on" text="Know which posts moved the needle, which platform is growing, and when to post next." />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MarketingChart series={demoSeries(30)} height={240} title="Content performance" />
          <div className="flex flex-col gap-3">
            {[["Reach this month", "842K", "+14.2%"], ["Avg. engagement", "8.42%", "+2.4%"], ["New followers", "+9,812", "+8.7%"]].map(([l, v, d]) => (
              <div key={l} className="surface flex-1 p-[18px]">
                <div className="text-[12.5px] text-muted-foreground">{l}</div>
                <div className="mt-1.5 flex items-baseline gap-2.5"><span className="text-[26px] font-semibold tracking-[-0.02em]">{v}</span><span className="text-xs text-success">{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(wrap, "mt-[130px]")}>
        <SectionTitle title="Every channel your audience uses" text="Connect in a couple of clicks. Publish natively — no share links, no reminders." />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {ALL_PLATFORMS.map((p, i) => (
            <div key={p} className="surface surface-lift p-4">
              <PlatformIcon platform={p} size={34} />
              <div className="mt-3.5 text-[13.5px] font-medium">{PLATFORMS[p].name}</div>
              <div className="mt-2">{i < 4 ? <StatusBadge tone="connected">Connected</StatusBadge> : <StatusBadge tone="neutral">Available</StatusBadge>}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className={cn(wrap, "mt-[130px] scroll-mt-24")}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle title="Simple pricing" text={`Every plan starts with a ${TRIAL_DAYS}-day free trial. Cancel any time before it ends and you won\u2019t be charged.`} />
          <div className="mb-9">
            <Segmented aria-label="Billing period" value={yearly ? "y" : "m"} onChange={(v) => setYearly(v === "y")} options={[{ value: "m", label: "Monthly" }, { value: "y", label: "Yearly · save 20%" }]} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className={cn("surface p-6", plan.featured && "border-white/[0.28] bg-gradient-to-b from-white/[0.055] to-white/[0.015]")}>
              <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">{plan.name}</span>{plan.featured && <StatusBadge tone="neutral" dot={false} className="text-foreground">Most popular</StatusBadge>}</div>
              <div className="mt-[18px] flex items-baseline gap-1.5"><span className="text-[40px] font-semibold tracking-[-0.03em]">${yearly ? plan.yearly : plan.monthly}</span><span className="text-muted-foreground">/ month</span></div>
              <p className="mt-1 text-[13.5px] text-muted-foreground">{plan.text}</p>
              <Button variant={plan.featured ? "primary" : "default"} className="mt-5 h-10 w-full" asChild><Link href="/register">Start {TRIAL_DAYS}-day trial</Link></Button>
              <p className="mt-2 text-center text-[12px] text-dim">$0.00 today · cancel anytime</p>
              <div className="mt-[22px] flex flex-col gap-2.5">{plan.features.map((f) => <div key={f} className="flex items-center gap-2.5 text-[13.5px]"><Check size={14} className="text-muted-foreground" />{f}</div>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(wrap, "mb-20 mt-[140px]")}>
        <div className="surface relative overflow-hidden px-6 py-[clamp(40px,7vw,80px)] text-center">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 240px at 50% 0%, rgba(147,171,255,.12), transparent 70%)" }} />
          <h2 className="relative text-[clamp(30px,4.6vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">Your content deserves<br />a better workflow.</h2>
          <Button variant="primary" size="lg" className="relative mt-7" asChild><Link href="/register">Start your free trial</Link></Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className={cn(wrap, "flex flex-wrap items-center justify-between gap-4 py-7")}><Logo size={18} /><span className="text-[12.5px] text-dim">© 2026 Kairo Labs. Made in Tashkent.</span></div>
      </footer>
    </div>
  );
}
