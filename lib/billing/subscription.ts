import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { planCard } from "./plans";

/**
 * Access control for a paid-only product.
 *
 * A workspace may use Kairo while Stripe says its subscription is `trialing` or
 * `active`. Everything else — never subscribed, payment failed past the retry
 * window, canceled, paused — sends the workspace to /billing.
 *
 * `past_due` deliberately does NOT grant access: Stripe keeps a subscription
 * active through its retry schedule and only moves it to `past_due` once
 * payment has actually failed.
 */
const ACTIVE_STATUSES = new Set(["trialing", "active"]);

export interface WorkspaceSubscription {
  planId: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  /** True while the workspace may use the product. */
  hasAccess: boolean;
  /** True while Stripe is still in the free trial window. */
  isTrialing: boolean;
}

export const getSubscription = cache(async (workspaceId: string): Promise<WorkspaceSubscription> => {
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("plan_id, status, current_period_end, cancel_at, provider_customer_id, provider_subscription_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const row = (data ?? null) as {
    plan_id: string; status: string; current_period_end: string | null; cancel_at: string | null;
    provider_customer_id: string | null; provider_subscription_id: string | null;
  } | null;

  // No row at all is the same as never having subscribed.
  const status = row?.status ?? "canceled";
  const planId = row?.plan_id ?? "free";

  return {
    planId,
    planName: planCard(planId)?.name ?? "No plan",
    status,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAt: row?.cancel_at ?? null,
    customerId: row?.provider_customer_id ?? null,
    subscriptionId: row?.provider_subscription_id ?? null,
    hasAccess: ACTIVE_STATUSES.has(status) && planId !== "free",
    isTrialing: status === "trialing",
  };
});

/** Days left in the trial, rounded up. Null when not trialing or the end is unknown. */
export function trialDaysLeft(subscription: WorkspaceSubscription): number | null {
  if (!subscription.isTrialing || !subscription.currentPeriodEnd) return null;
  const ms = new Date(subscription.currentPeriodEnd).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
