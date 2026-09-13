/**
 * The plan catalogue. Ids match `public.plans`; prices live in Stripe and the
 * Price ids come from the environment, so nothing here has to be redeployed to
 * change what a plan costs.
 */
export const BILLABLE_PLANS = ["starter", "pro", "business"] as const;
export type BillablePlanId = (typeof BILLABLE_PLANS)[number];

export type BillingInterval = "month" | "year";

export interface PlanCard {
  id: BillablePlanId;
  name: string;
  tagline: string;
  monthlyCents: number;
  /** Effective monthly price when billed yearly. */
  yearlyMonthlyCents: number;
  features: string[];
  featured?: boolean;
}

/** Display copy only — the amount actually charged is whatever the Stripe Price says. */
export const PLAN_CARDS: PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo creators and freelancers.",
    monthlyCents: 2900,
    yearlyMonthlyCents: 2320,
    features: ["10 social accounts", "Unlimited scheduled posts", "Unlimited team members", "Content calendar", "Basic analytics", "1,000 AI generations / month"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Growing teams and agencies.",
    monthlyCents: 4900,
    yearlyMonthlyCents: 3920,
    features: ["15 social accounts", "Unlimited scheduled posts", "Unlimited team members", "Advanced analytics", "Unified inbox", "1,000 AI generations / month"],
    featured: true,
  },
  {
    id: "business",
    name: "Pro Plus",
    tagline: "Advanced tooling for businesses.",
    monthlyCents: 9900,
    yearlyMonthlyCents: 7920,
    features: ["30 social accounts", "Unlimited scheduled posts", "Unlimited team members", "Advanced analytics", "Unified inbox", "2,000 AI generations / month"],
  },
];

export const TRIAL_DAYS = 7;

export const planCard = (id: string) => PLAN_CARDS.find((p) => p.id === id) ?? null;

export const isBillablePlan = (id: string): id is BillablePlanId =>
  (BILLABLE_PLANS as readonly string[]).includes(id);

/** Environment variable holding the Stripe Price id for a plan and interval. */
export function priceEnvKey(plan: BillablePlanId, interval: BillingInterval): string {
  const suffix = interval === "year" ? "YEARLY" : "MONTHLY";
  return `STRIPE_PRICE_${plan.toUpperCase()}_${suffix}`;
}

export const formatPrice = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
