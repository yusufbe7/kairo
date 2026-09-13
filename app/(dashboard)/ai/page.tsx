import type { Metadata } from "next";
import { AIStudio } from "@/components/ai/ai-studio";
import { getWorkspacePage } from "@/lib/workspace/context";
import { getPlanLimits, getUsage } from "@/lib/services/usage";
import { isAiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "AI Studio" };

export default async function Page() {
  const ctx = await getWorkspacePage("ai.use");
  const [limits, usage] = await Promise.all([getPlanLimits(ctx.workspace.id), getUsage(ctx.workspace.id)]);
  return <AIStudio enabled={isAiConfigured()} usage={{ used: usage.ai_generations ?? 0, limit: limits.ai_generations }} />;
}
