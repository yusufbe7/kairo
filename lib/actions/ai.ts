"use server";

import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { runGeneration } from "@/lib/services/ai";
import { AI_ACTIONS, CONTENT_TYPES, TONES } from "@/lib/ai";
import { platformSchema } from "@/lib/validation/posts";

const schema = z.object({
  action: z.enum(AI_ACTIONS),
  text: z.string().max(8000).default(""),
  platform: platformSchema.optional(),
  tone: z.enum(TONES).optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
});

export const generateContent = safeAction("ai.generate", schema, async (input) => {
  const ctx = await requireWorkspace("ai.use");
  return { text: await runGeneration(ctx, input as Parameters<typeof runGeneration>[1]) };
});
