import { describe, expect, it } from "vitest";
import { BILLABLE_PLANS, formatPrice, isBillablePlan, planCard, priceEnvKey } from "@/lib/billing/plans";
import { limitReached, describeLimit } from "@/lib/services/usage";

describe("plan catalogue", () => {
  it("maps every billable plan to the env key holding its Stripe price", () => {
    expect(priceEnvKey("starter", "month")).toBe("STRIPE_PRICE_STARTER_MONTHLY");
    expect(priceEnvKey("business", "year")).toBe("STRIPE_PRICE_BUSINESS_YEARLY");
  });

  it("has a card for every billable plan, and none for the unpaid placeholder", () => {
    for (const id of BILLABLE_PLANS) expect(planCard(id)).not.toBeNull();
    expect(planCard("free")).toBeNull();
    expect(isBillablePlan("free")).toBe(false);
  });

  it("prices yearly below monthly", () => {
    for (const card of BILLABLE_PLANS.map(planCard)) {
      expect(card!.yearlyMonthlyCents).toBeLessThan(card!.monthlyCents);
    }
  });

  it("formats whole dollars without cents", () => {
    expect(formatPrice(2900)).toBe("$29");
    expect(formatPrice(2320)).toBe("$23.20");
  });
});

describe("limitReached", () => {
  it("blocks once the count reaches the allowance", () => {
    expect(limitReached(9, 10)).toBe(false);
    expect(limitReached(10, 10)).toBe(true);
    expect(limitReached(11, 10)).toBe(true);
  });

  it("treats null as unlimited", () => {
    // Comparing against null directly coerces it to 0, which would block everything.
    expect(limitReached(0, null)).toBe(false);
    expect(limitReached(9999, null)).toBe(false);
    expect(limitReached(1, undefined)).toBe(false);
    expect(describeLimit(null)).toBe("an unlimited number of");
    expect(describeLimit(10)).toBe("10");
  });

  it("blocks everything on a zero allowance", () => {
    expect(limitReached(0, 0)).toBe(true);
  });
});
