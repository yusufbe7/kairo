import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isBillingEnforced: vi.fn(), single: vi.fn() }));

vi.mock("@/lib/billing/enforcement", () => ({ isBillingEnforced: mocks.isBillingEnforced }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) }),
}));

import { getPlanLimits, limitReached } from "@/lib/services/usage";

/** What a brand-new signup gets: the 'free' plan, which since Kairo went paid-only is all zeros. */
const FREE_PLAN = { plans: { limits: { posts_per_month: 0, social_accounts: 0, members: 1, ai_generations: 0, api_requests: 0 } } };

beforeEach(() => {
  mocks.isBillingEnforced.mockReset();
  mocks.single.mockReset().mockResolvedValue({ data: FREE_PLAN });
});

describe("plan limits while the paywall is switched off", () => {
  it("meters nothing, so a new workspace can actually use the product", async () => {
    mocks.isBillingEnforced.mockResolvedValue(false);
    const limits = await getPlanLimits("ws");

    // Every signup lands on 'free'. Letting those zeros stand while nobody is being charged
    // put new users inside a product that refused to connect an account, draft a post or use
    // AI — each time telling them to upgrade on a deployment with billing turned off.
    for (const allowed of Object.values(limits)) {
      expect(limitReached(999, allowed)).toBe(false);
    }
  });

  it("does not even read the workspace's plan", async () => {
    mocks.isBillingEnforced.mockResolvedValue(false);
    await getPlanLimits("ws");
    expect(mocks.single).not.toHaveBeenCalled();
  });
});

describe("plan limits while the paywall is on", () => {
  it("holds the workspace to its plan", async () => {
    mocks.isBillingEnforced.mockResolvedValue(true);
    const limits = await getPlanLimits("ws");

    expect(limits.social_accounts).toBe(0);
    expect(limitReached(0, limits.social_accounts)).toBe(true);
  });

  it("falls back to a starter allowance rather than zero when the plan can't be read", async () => {
    mocks.isBillingEnforced.mockResolvedValue(true);
    mocks.single.mockResolvedValue({ data: null });
    const limits = await getPlanLimits("ws");

    expect(limitReached(0, limits.social_accounts)).toBe(false);
  });
});
