import "server-only";
import type { PlatformId } from "@/types/social";

/**
 * Single source of truth for provider integrations: which credentials each one needs and
 * which capabilities are implemented. Nothing is presented as working unless `implemented` is true.
 */
export interface ProviderDefinition {
  platform: PlatformId;
  requiredEnv: string[];
  capabilities: { connect: boolean; publish: boolean; analytics: boolean; inbox: boolean };
  docs: string;
}

export const PROVIDERS: Record<PlatformId, ProviderDefinition> = {
  instagram: { platform: "instagram", requiredEnv: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://developers.facebook.com/docs/instagram-platform" },
  facebook: { platform: "facebook", requiredEnv: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://developers.facebook.com/docs/pages-api" },
  tiktok: { platform: "tiktok", requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://developers.tiktok.com/doc/content-posting-api-get-started" },
  linkedin: { platform: "linkedin", requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api" },
  x: { platform: "x", requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://docs.x.com/x-api/posts/manage-tweets/introduction" },
  youtube: { platform: "youtube", requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://developers.google.com/youtube/v3/guides/uploading_a_video" },
  telegram: { platform: "telegram", requiredEnv: ["TELEGRAM_BOT_TOKEN"], capabilities: { connect: false, publish: false, analytics: false, inbox: false }, docs: "https://core.telegram.org/bots/api" },
};

export interface ProviderStatus {
  platform: PlatformId;
  configured: boolean;
  missingEnv: string[];
  capabilities: ProviderDefinition["capabilities"];
}

export function providerStatus(platform: PlatformId): ProviderStatus {
  const def = PROVIDERS[platform];
  const missingEnv = def.requiredEnv.filter((k) => !process.env[k]);
  return { platform, configured: missingEnv.length === 0, missingEnv, capabilities: def.capabilities };
}

export const allProviderStatuses = () => (Object.keys(PROVIDERS) as PlatformId[]).map(providerStatus);
