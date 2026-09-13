import "server-only";
import { PROVIDERS } from "@/lib/integrations/registry";
import type { PlatformId } from "@/types/social";

/** The Meta platforms whose callbacks this deployment answers. */
const META_PLATFORMS = new Set<string>(["facebook", "instagram"]);

/**
 * The app secret a signed request from this platform must verify against.
 * Null for anything that is not a Meta provider, or is not configured here.
 */
export function metaAppSecret(platform: string): string | null {
  if (!META_PLATFORMS.has(platform) || !(platform in PROVIDERS)) return null;
  const key = PROVIDERS[platform as PlatformId].requiredEnv.find((name) => name.endsWith("_CLIENT_SECRET"));
  return (key && process.env[key]) || null;
}
