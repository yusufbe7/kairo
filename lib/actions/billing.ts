"use server";

import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/services/audit";
import { env } from "@/lib/env";
import { requirePriceId, stripe } from "@/lib/billing/stripe";
import { getSubscription } from "@/lib/billing/subscription";
import { BILLABLE_PLANS, TRIAL_DAYS, type BillablePlanId } from "@/lib/billing/plans";
import { getProfile } from "@/lib/auth/session";

const checkoutSchema = z.object({
  planId: z.enum(BILLABLE_PLANS as unknown as [BillablePlanId, ...BillablePlanId[]]),
  interval: z.enum(["month", "year"]).default("month"),
});

/**
 * Reuses this workspace's Stripe customer, or creates one and stores it, so a
 * workspace never ends up with two customers and two parallel subscriptions.
 */
async function customerIdFor(workspaceId: string, workspaceName: string, email: string | null) {
  const existing = await getSubscription(workspaceId);
  if (existing.customerId) return existing.customerId;

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    name: workspaceName,
    metadata: { workspace_id: workspaceId },
  });
  await createAdminClient()
    .from("subscriptions")
    .update({ provider: "stripe", provider_customer_id: customer.id })
    .eq("workspace_id", workspaceId);
  return customer.id;
}

/**
 * Starts a Stripe Checkout session and returns its URL for the browser to follow.
 *
 * The subscription is created with a trial, so the customer is charged nothing today —
 * but a payment method is still collected, which is what makes the trial convert
 * without asking them to come back.
 */
export const startCheckout = safeAction("billing.checkout", checkoutSchema, async (input) => {
  const ctx = await requireWorkspace("billing.manage");
  await rateLimit(`checkout:${ctx.userId}`, { limit: 10, windowSeconds: 300 });

  const current = await getSubscription(ctx.workspace.id);
  if (current.hasAccess && current.subscriptionId) {
    // Already paying: changing plan belongs in the portal, where Stripe handles proration.
    throw new AppError("CONFLICT", "This workspace already has a subscription. Use “Manage billing” to change plan.");
  }

  const price = requirePriceId(input.planId, input.interval);
  const profile = await getProfile();
  const customer = await customerIdFor(ctx.workspace.id, ctx.workspace.name, profile?.email ?? null);
  const appUrl = env().NEXT_PUBLIC_APP_URL;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing?checkout=canceled`,
    allow_promotion_codes: true,
    // A card is taken up front; nothing is charged until the trial ends.
    payment_method_collection: "always",
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { workspace_id: ctx.workspace.id, plan_id: input.planId },
    },
    // Repeated on the session so checkout.session.completed can be attributed even
    // if the subscription object arrives first.
    metadata: { workspace_id: ctx.workspace.id, plan_id: input.planId },
  });

  if (!session.url) throw new AppError("PROVIDER", "Stripe didn't return a checkout page. Please try again.");
  await audit({ action: "billing.checkout_started", actorId: ctx.userId, workspaceId: ctx.workspace.id, metadata: { plan: input.planId, interval: input.interval } });
  return { url: session.url };
});

/** Opens Stripe's hosted billing portal: change plan, update card, cancel, download invoices. */
export const openBillingPortal = safeAction("billing.portal", z.object({}).default({}), async () => {
  const ctx = await requireWorkspace("billing.manage");
  const subscription = await getSubscription(ctx.workspace.id);
  if (!subscription.customerId) throw new AppError("NOT_FOUND", "This workspace doesn't have a billing account yet.");

  const session = await stripe().billingPortal.sessions.create({
    customer: subscription.customerId,
    return_url: `${env().NEXT_PUBLIC_APP_URL}/billing`,
  });
  return { url: session.url };
});
