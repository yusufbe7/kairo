import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { CHAR_LIMITS, PLATFORMS } from "@/lib/platforms";
import type { PlatformId } from "@/types/social";

export const AI_ACTIONS = ["improve", "shorter", "engaging", "professional", "caption", "hashtags", "ideas", "campaign", "adapt"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const CONTENT_TYPES = ["Social post", "Campaign", "Thread", "Carousel", "Short video script", "Hashtags"] as const;
export const TONES = ["Professional", "Friendly", "Bold", "Educational", "Minimal"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type Tone = (typeof TONES)[number];

const INSTRUCTION: Record<AiAction, string> = {
  improve: "Improve the writing: fix grammar, tighten phrasing, keep the author's voice and meaning.",
  shorter: "Make it significantly shorter while keeping the key message.",
  engaging: "Rewrite it to be more engaging: a strong hook, concrete detail, and one clear call to action.",
  professional: "Rewrite it in a professional, measured tone suitable for a company account. Remove emoji.",
  caption: "Write a social caption for the described content.",
  hashtags: "Return the original text followed by a blank line and 4-6 relevant hashtags.",
  ideas: "Suggest content ideas as a short numbered list.",
  campaign: "Outline a short multi-post campaign.",
  adapt: "Adapt the text for the target platform's format and length conventions.",
};

export interface AiRequest { action: AiAction; text: string; platform?: PlatformId; tone?: Tone; contentType?: ContentType }

function buildPrompt(req: AiRequest) {
  const platform = req.platform ? PLATFORMS[req.platform].name : null;
  const system = [
    "You write social media copy for a scheduling tool.",
    "Return ONLY the post text — no preamble, no explanation, no surrounding quotes.",
    platform ? `Target platform: ${platform}. Stay under ${CHAR_LIMITS[req.platform!]} characters and match how people read there.` : null,
    req.tone ? `Tone: ${req.tone}.` : null,
    req.contentType ? `Format: ${req.contentType}.` : null,
  ].filter(Boolean).join(" ");
  return { system, user: `${INSTRUCTION[req.action]}\n\n---\n${req.text.trim() || "(no text provided — write something suitable for the brief above)"}` };
}

export interface AiResult { text: string; model: string; inputTokens: number | null; outputTokens: number | null }

/**
 * Calls the model server-side. AI_API_KEY never reaches the browser.
 * The default target is the Anthropic Messages API; swap `fetch` here for another provider.
 */
export async function generate(req: AiRequest): Promise<AiResult> {
  const e = env();
  if (!e.AI_API_KEY) {
    throw new AppError("NOT_CONFIGURED", "AI isn't configured on this deployment yet. An administrator needs to add an AI API key.");
  }
  const { system, user } = buildPrompt(req);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": e.AI_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: e.AI_MODEL, max_tokens: 1024, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new AppError("RATE_LIMITED", "The AI service is busy right now. Try again in a moment.");
    throw new AppError("PROVIDER", "The AI service couldn't complete that request.", { cause: detail.slice(0, 500) });
  }

  const body = (await response.json()) as { content?: { type: string; text?: string }[]; model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
  if (!text) throw new AppError("PROVIDER", "The AI service returned an empty response.");
  return { text, model: body.model ?? e.AI_MODEL, inputTokens: body.usage?.input_tokens ?? null, outputTokens: body.usage?.output_tokens ?? null };
}

export const isAiConfigured = () => Boolean(process.env.AI_API_KEY);
