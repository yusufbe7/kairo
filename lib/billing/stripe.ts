import "server-only";
import Stripe from "stripe";
import { AppError } from "@/lib/errors";
import { BILLABLE_PLANS, priceEnvKey, type BillablePlanId, type BillingInterval } from "./plans";

/**
 * Stripe client and configuration. Constructed lazily so `next build` and every
 * page that doesn't touch billing keep working on a deployment without keys.
 */
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError("NOT_CONFIGURED", "Billing isn't set up on this deployment yet.");
  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia", typescript: true });
  return client;
}

/** The Stripe Price id for a plan, or null when that price hasn't been configured. */
export const priceIdFor = (plan: BillablePlanId, interval: BillingInterval): string | null =>
  process.env[priceEnvKey(plan, interval)] || null;

export function requirePriceId(plan: BillablePlanId, interval: BillingInterval): string {
  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    throw new AppError("NOT_CONFIGURED", "That plan isn't available on this deployment yet. An administrator needs to finish setting up billing.");
  }
  return priceId;
}

/** Every billing environment variable and whether it is set — powers /admin/integrations. */
export function billingEnvStatus(): { key: string; present: boolean }[] {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
  for (const plan of BILLABLE_PLANS) {
    keys.push(priceEnvKey(plan, "month"), priceEnvKey(plan, "year"));
  }
  return keys.map((key) => ({ key, present: Boolean(process.env[key]) }));
}

/** True when checkout can actually run: a secret key plus at least one monthly price. */
export const isBillingConfigured = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY) && BILLABLE_PLANS.some((plan) => priceIdFor(plan, "month"));
