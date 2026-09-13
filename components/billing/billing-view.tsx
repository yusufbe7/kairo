"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, CreditCard, LoaderCircle, LogOut, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Logo } from "@/components/layout/logo";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { signOut } from "@/lib/actions/auth";
import { PLAN_CARDS, TRIAL_DAYS, formatPrice, type BillablePlanId, type BillingInterval } from "@/lib/billing/plans";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface SubscriptionSummary {
  planId: string;
  planName: string;
  status: string;
  hasAccess: boolean;
  isTrialing: boolean;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  trialDaysLeft: number | null;
  hasCustomer: boolean;
}

interface Props {
  workspaceName: string;
  userName: string;
  canManageBilling: boolean;
  configured: boolean;
  purchasablePlans: readonly BillablePlanId[];
  yearlyAvailable: boolean;
  subscription: SubscriptionSummary;
  /** False while an admin has the paywall switched off for testing. */
  billingEnforced: boolean;
  checkoutResult: "success" | "canceled" | null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null;

/** What the workspace should be told about where its subscription stands. */
function statusLine(s: SubscriptionSummary): { tone: "success" | "warning" | "neutral"; text: string } | null {
  if (s.isTrialing && s.trialDaysLeft !== null) {
    return {
      tone: "success",
      text: s.trialDaysLeft === 0
        ? `Your ${s.planName} trial ends today — your card will be charged after that.`
        : `${s.trialDaysLeft} ${s.trialDaysLeft === 1 ? "day" : "days"} left in your ${s.planName} trial. Cancel any time before it ends and you won't be charged.`,
    };
  }
  if (s.status === "past_due") {
    return { tone: "warning", text: "Your last payment failed. Update your card to restore access." };
  }
  if (s.status === "paused") {
    return { tone: "warning", text: "This subscription is paused. Resume it to get back in." };
  }
  if (s.hasAccess && s.cancelAt) {
    return { tone: "warning", text: `Your ${s.planName} plan is set to end on ${formatDate(s.cancelAt)}.` };
  }
  if (s.hasAccess) {
    const renews = formatDate(s.currentPeriodEnd);
    return { tone: "neutral", text: renews ? `Your ${s.planName} plan renews on ${renews}.` : `You're on the ${s.planName} plan.` };
  }
  return null;
}

export function BillingView({
  workspaceName, userName, canManageBilling, configured, purchasablePlans, yearlyAvailable, subscription, billingEnforced, checkoutResult,
}: Props) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const status = statusLine(subscription);
  const offered = PLAN_CARDS.filter((plan) => purchasablePlans.includes(plan.id));

  /** Runs a billing action and hands the browser over to the Stripe page it returns. */
  const go = (action: () => Promise<ActionResult<{ url: string }>>, key: string) => {
    setError(null);
    setPendingPlan(key);
    start(async () => {
      const result = await action();
      if (result.ok) {
        // Leave the SPA entirely: Stripe is hosted on its own domain.
        window.location.assign(result.data.url);
        return;
      }
      setError(result.error.message);
      setPendingPlan(null);
    });
  };

  return (
    <div className="relative z-[1] mx-auto w-full max-w-[1100px] px-5 py-10">
      <header className="flex flex-wrap items-center gap-4">
        <Link href={subscription.hasAccess ? "/dashboard" : "/billing"} aria-label="Kairo"><Logo /></Link>
        <div className="flex-1" />
        <span className="text-[12.5px] text-dim">{userName}</span>
        <Button size="sm" variant="ghost" onClick={() => start(async () => { await signOut(); router.replace("/login"); })}>
          <LogOut size={14} />Sign out
        </Button>
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} className="mt-12">
        <h1 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.035em]">
          {subscription.hasAccess ? "Your plan" : "Choose your plan"}
        </h1>
        <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted-foreground">
          {subscription.hasAccess
            ? <>Billing for <span className="text-foreground">{workspaceName}</span>.</>
            : <>Start a {TRIAL_DAYS}-day free trial of <span className="text-foreground">{workspaceName}</span>. $0.00 today, cancel any time.</>}
        </p>
      </motion.div>

      {checkoutResult === "success" && (
        <Banner tone="success" icon={<ShieldCheck size={16} />}>
          Payment method saved. If your workspace still looks locked, give Stripe a few seconds and refresh —
          access is granted when Stripe confirms the subscription, not when this page loads.
        </Banner>
      )}
      {checkoutResult === "canceled" && (
        <Banner tone="neutral" icon={<TriangleAlert size={16} />}>Checkout was canceled. Nothing was charged.</Banner>
      )}
      {status && (
        <Banner tone={status.tone} icon={status.tone === "warning" ? <TriangleAlert size={16} /> : <ShieldCheck size={16} />}>{status.text}</Banner>
      )}
      {error && <Banner tone="warning" icon={<TriangleAlert size={16} />}>{error}</Banner>}

      {!billingEnforced && (
        <Banner tone="neutral" icon={<TriangleAlert size={16} />}>
          The paywall is switched off on this deployment, so your workspace already has full access.
          You can still start a subscription here, and it will take effect when the paywall goes back on.
        </Banner>
      )}

      {!configured && (
        <Banner tone="warning" icon={<TriangleAlert size={16} />}>
          Billing isn&apos;t configured on this deployment yet. An administrator needs to add the Stripe keys and
          price ids — see <code className="text-foreground">/admin/integrations</code>.
        </Banner>
      )}

      {!canManageBilling && (
        <Banner tone="neutral" icon={<TriangleAlert size={16} />}>
          Only the workspace owner can manage billing. Ask them to choose a plan.
        </Banner>
      )}

      {subscription.hasCustomer && canManageBilling && (
        <div className="mt-8">
          <Button onClick={() => go(() => openBillingPortal({}), "portal")} disabled={pending}>
            {pending && pendingPlan === "portal" ? <LoaderCircle size={15} className="animate-spin" /> : <CreditCard size={15} />}
            Manage billing
          </Button>
          <p className="mt-2 text-[12.5px] text-dim">Change plan, update your card, download invoices or cancel — all on Stripe.</p>
        </div>
      )}

      {offered.length > 0 && (!subscription.hasAccess || !subscription.hasCustomer) && (
        <>
          {yearlyAvailable && (
            <div className="mt-10">
              <Segmented
                aria-label="Billing period"
                value={interval}
                onChange={(v) => setInterval(v as BillingInterval)}
                options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly · save 20%" }]}
              />
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {offered.map((plan) => {
              const cents = interval === "year" ? plan.yearlyMonthlyCents : plan.monthlyCents;
              const busy = pending && pendingPlan === plan.id;
              return (
                <div key={plan.id} className={cn("surface flex flex-col p-6", plan.featured && "border-white/[0.28] bg-gradient-to-b from-white/[0.055] to-white/[0.015]")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold">{plan.name}</span>
                    {plan.featured && <span className="rounded-full border border-border bg-white/[0.04] px-2.5 py-1 text-[11px] text-foreground">Most popular</span>}
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{plan.tagline}</p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-[38px] font-semibold tracking-[-0.03em]">{formatPrice(cents)}</span>
                    <span className="text-muted-foreground">/ month</span>
                  </div>
                  {interval === "year" && <p className="mt-1 text-[12px] text-dim">Billed yearly</p>}

                  <Button
                    variant={plan.featured ? "primary" : "default"}
                    className="mt-5 h-10 w-full"
                    disabled={!canManageBilling || !configured || pending}
                    onClick={() => go(() => startCheckout({ planId: plan.id, interval }), plan.id)}
                  >
                    {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
                    Start {TRIAL_DAYS}-day trial
                    {!busy && <ArrowRight size={14} />}
                  </Button>
                  <p className="mt-2 text-center text-[12px] text-dim">$0.00 today · cancel anytime</p>

                  <div className="mt-5 flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 text-[13px]">
                        <Check size={14} className="mt-px shrink-0 text-muted-foreground" />{feature}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-10 text-[12.5px] leading-relaxed text-dim">
        Payments are processed by Stripe. Kairo never sees or stores your card details.
      </p>
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: "success" | "warning" | "neutral"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mt-8 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        tone === "success" && "border-success/25 bg-success/[0.06] text-success",
        tone === "warning" && "border-warning/25 bg-warning/[0.06] text-warning",
        tone === "neutral" && "border-border bg-white/[0.025] text-muted-foreground",
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
