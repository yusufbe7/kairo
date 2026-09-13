import "server-only";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";

/**
 * Server environment. Validated lazily (on first use) so `next build` works
 * without secrets; a misconfigured deployment fails loudly at request time.
 * Only NEXT_PUBLIC_* values are ever sent to the browser.
 */
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default(appUrl()),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** 32-byte key, base64. Encrypts provider OAuth tokens at rest. */
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  REDIS_URL: z.string().optional(),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(200 * 1024 * 1024),
  LOG_PERSIST_LEVEL: z.enum(["info", "warn", "error", "off"]).default("warn"),
});

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** True when the minimum Supabase configuration is present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
