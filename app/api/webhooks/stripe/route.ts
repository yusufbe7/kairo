import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBillablePlan } from "@/lib/billing/plans";
import { messageFrom } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Stripe webhook — the only thing that may grant or revoke access.
 *
 * Checkout redirecting the browser back to /billing proves nothing (the user can
 * close the tab, or forge the URL), so subscription state is written here and
 * nowhere else.
 *
 * Deliveries are recorded in `webhook_events` first, whose unique
 * (provider, external_event_id) index makes replays and Stripe's at-least-once
 * retries no-ops.
 */
export const dynamic = "force-dynamic";

const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("stripe.webhook_unconfigured", "STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  // The raw body is required: any parsing or re-encoding invalidates the signature.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature ?? "", secret);
  } catch (error) {
    // Never reveal why: an attacker probing the endpoint learns nothing from a 400.
    logger.warn("stripe.signature_invalid", messageFrom(error));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("webhook_events").insert({
    provider: "stripe",
    external_event_id: event.id,
    payload: event as unknown as Record<string, unknown>,
    signature_valid: true,
  });
  if (insertError) {
    // 23505 = we have already seen this event id. Stripe retries until it gets a 2xx.
    if (insertError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    logger.error("stripe.webhook_record_failed", insertError.message, { eventId: event.id });
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }

  try {
    if (RELEVANT.has(event.type)) await handle(event);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("external_event_id", event.id);
  } catch (error) {
    const message = messageFrom(error);
    // Persisted to system_logs by the logger, which is where the failure is diagnosed.
    logger.error("stripe.webhook_failed", message, { eventId: event.id, type: event.type });
    // Drop the idempotency row: a 500 makes Stripe retry, and the retry has to be
    // allowed to actually run instead of short-circuiting as a duplicate.
    await admin.from("webhook_events").delete().eq("provider", "stripe").eq("external_event_id", event.id);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription !== "string") return;
      // Fetch rather than trust the session: the subscription is the source of truth
      // for status, period end and which price was actually bought.
      const subscription = await stripe().subscriptions.retrieve(session.subscription);
      await applySubscription(subscription, session.metadata?.workspace_id ?? null);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applySubscription(event.data.object as Stripe.Subscription, null);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) logger.warn("stripe.payment_failed", "Invoice payment failed", { customerId });
      // Stripe moves the subscription to past_due or unpaid itself and sends
      // customer.subscription.updated; that event does the state change.
      return;
    }
  }
}

/** Maps a Stripe subscription onto the workspace's `subscriptions` row. */
async function applySubscription(subscription: Stripe.Subscription, workspaceIdHint: string | null) {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const workspaceId =
    subscription.metadata?.workspace_id ||
    workspaceIdHint ||
    (await workspaceIdForCustomer(customerId));

  if (!workspaceId) {
    // A customer we have no record of — refusing to guess is safer than writing
    // a subscription onto the wrong workspace.
    throw new Error(`No workspace for Stripe customer ${customerId}`);
  }

  const planId = planIdFrom(subscription);
  // `canceled` and `unpaid` both mean no access; the rest map onto our enum directly.
  const status = mapStatus(subscription.status);
  const item = subscription.items.data[0];

  const { error } = await admin
    .from("subscriptions")
    .update({
      provider: "stripe",
      provider_customer_id: customerId,
      provider_subscription_id: subscription.id,
      plan_id: planId,
      status,
      current_period_start: toIso(item?.current_period_start),
      current_period_end: toIso(item?.current_period_end),
      cancel_at: toIso(subscription.cancel_at),
    })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Failed to store subscription: ${error.message}`);

  // workspaces.plan_id is denormalised for the sidebar and plan limits; keep it in step.
  await admin.from("workspaces").update({ plan_id: planId }).eq("id", workspaceId);

  await admin.from("audit_logs").insert({
    workspace_id: workspaceId,
    action: `billing.subscription_${status}`,
    target_type: "subscription",
    target_id: subscription.id,
    metadata: { plan_id: planId, stripe_status: subscription.status },
  });

  logger.info("stripe.subscription_synced", "Subscription state stored", { workspaceId, plan: planId, status });
}

async function workspaceIdForCustomer(customerId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("workspace_id")
    .eq("provider_customer_id", customerId)
    .maybeSingle();
  return (data as { workspace_id: string } | null)?.workspace_id ?? null;
}

/**
 * Which plan this subscription is for. The price metadata is authoritative when set,
 * so plans can be re-priced in Stripe without a redeploy; the subscription metadata
 * written at checkout is the fallback.
 */
function planIdFrom(subscription: Stripe.Subscription): string {
  const price = subscription.items.data[0]?.price;
  const fromPrice = price?.metadata?.plan_id;
  if (fromPrice && isBillablePlan(fromPrice)) return fromPrice;

  const fromSubscription = subscription.metadata?.plan_id;
  if (fromSubscription && isBillablePlan(fromSubscription)) return fromSubscription;

  const fromEnv = matchEnvPrice(price?.id);
  if (fromEnv) return fromEnv;

  // Unknown price: fall back to no plan rather than handing out the most generous one.
  logger.warn("stripe.unknown_price", "Could not map price to a plan", { priceId: price?.id });
  return "free";
}

/** Reverse lookup: which configured STRIPE_PRICE_* variable holds this price id. */
function matchEnvPrice(priceId: string | undefined): string | null {
  if (!priceId) return null;
  for (const [key, value] of Object.entries(process.env)) {
    if (value === priceId && key.startsWith("STRIPE_PRICE_")) {
      const plan = key.replace("STRIPE_PRICE_", "").replace(/_(MONTHLY|YEARLY)$/, "").toLowerCase();
      if (isBillablePlan(plan)) return plan;
    }
  }
  return null;
}

function mapStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "paused": return "paused";
    // incomplete / incomplete_expired / unpaid / canceled all mean "no access".
    default: return "canceled";
  }
}

const toIso = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
