import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { PlanLimits } from "@/types/database";

export type Metric = "posts" | "ai_generations" | "api_requests";

const LIMIT_KEY: Record<Metric, keyof PlanLimits> = {
  posts: "posts_per_month", ai_generations: "ai_generations", api_requests: "api_requests",
};

const MESSAGE: Record<Metric, string> = {
  posts: "You've reached this month's post limit on your plan. Upgrade to keep scheduling.",
  ai_generations: "You've used all the AI generations included this month. Upgrade for more.",
  api_requests: "You've reached this month's API request limit on your plan.",
};

const periodStart = () => new Date(new Date().toISOString().slice(0, 8) + "01").toISOString().slice(0, 10);

export async function getPlanLimits(workspaceId: string): Promise<PlanLimits> {
  const { data } = await createAdminClient().from("workspaces").select("plans(limits)").eq("id", workspaceId).single();
  return ((data as { plans: { limits: PlanLimits } | null } | null)?.plans?.limits ?? { posts_per_month: 30, social_accounts: 3, members: 1, ai_generations: 20, api_requests: 0 }) as PlanLimits;
}

export async function getUsage(workspaceId: string): Promise<Record<string, number>> {
  const { data } = await createAdminClient().from("usage").select("metric, count").eq("workspace_id", workspaceId).eq("period_start", periodStart());
  return Object.fromEntries(((data ?? []) as { metric: string; count: number }[]).map((r) => [r.metric, r.count]));
}

/** Throws LIMIT_REACHED when the workspace has hit its monthly allowance. */
export async function checkLimit(ctx: WorkspaceContext, metric: Metric) {
  const [limits, usage] = await Promise.all([getPlanLimits(ctx.workspace.id), getUsage(ctx.workspace.id)]);
  const allowed = limits[LIMIT_KEY[metric]];
  if (allowed == null) return; // unlimited on this plan
  if ((usage[metric] ?? 0) >= allowed) throw new AppError("LIMIT_REACHED", MESSAGE[metric]);
}

export async function incrementUsage(workspaceId: string, metric: Metric, amount = 1) {
  await createAdminClient().rpc("increment_usage", { p_workspace: workspaceId, p_metric: metric, p_amount: amount });
}
