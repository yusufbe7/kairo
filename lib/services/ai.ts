import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generate, type AiRequest } from "@/lib/ai";
import { checkLimit, incrementUsage } from "@/lib/services/usage";
import { rateLimit } from "@/lib/security/rate-limit";
import type { WorkspaceContext } from "@/lib/workspace/context";

/** Runs a generation with plan limits, rate limiting and persistence. */
export async function runGeneration(ctx: WorkspaceContext, req: AiRequest) {
  await rateLimit(`ai:${ctx.userId}`, { limit: 20, windowSeconds: 60 });
  await checkLimit(ctx, "ai_generations");

  const result = await generate(req);

  await createAdminClient().from("ai_generations").insert({
    workspace_id: ctx.workspace.id, user_id: ctx.userId, action: req.action,
    prompt: req.text.slice(0, 4000), output: result.text, model: result.model,
    input_tokens: result.inputTokens, output_tokens: result.outputTokens,
  });
  await incrementUsage(ctx.workspace.id, "ai_generations");
  return result.text;
}
