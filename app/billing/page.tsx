import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/auth/session";
import { getWorkspacePage } from "@/lib/workspace/context";
import { getSubscription, trialDaysLeft } from "@/lib/billing/subscription";
import { isBillingConfigured, priceIdFor } from "@/lib/billing/stripe";
import { isBillingEnforced } from "@/lib/billing/enforcement";
import { BILLABLE_PLANS } from "@/lib/billing/plans";
import { can } from "@/lib/permissions";
import { BillingView } from "@/components/billing/billing-view";

export const metadata: Metadata = { title: "Billing" };

export default async function Page({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/billing");

  const [{ checkout }, ctx, profile] = await Promise.all([searchParams, getWorkspacePage(), getProfile()]);
  const [subscription, billingEnforced] = await Promise.all([getSubscription(ctx.workspace.id), isBillingEnforced()]);

  // Which plans can actually be bought here — a plan without a Stripe Price is not offered.
  const purchasable = BILLABLE_PLANS.filter((plan) => priceIdFor(plan, "month") || priceIdFor(plan, "year"));
  const yearlyAvailable = BILLABLE_PLANS.every((plan) => Boolean(priceIdFor(plan, "year")));

  return (
    <BillingView
      workspaceName={ctx.workspace.name}
      userName={profile?.full_name ?? user.email ?? "You"}
      canManageBilling={can(ctx.role, "billing.manage")}
      configured={isBillingConfigured()}
      purchasablePlans={purchasable}
      yearlyAvailable={yearlyAvailable}
      subscription={{
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status,
        hasAccess: subscription.hasAccess,
        isTrialing: subscription.isTrialing,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAt: subscription.cancelAt,
        trialDaysLeft: trialDaysLeft(subscription),
        hasCustomer: Boolean(subscription.customerId),
      }}
      billingEnforced={billingEnforced}
      checkoutResult={checkout === "success" ? "success" : checkout === "canceled" ? "canceled" : null}
    />
  );
}
