import type { PlatformId } from "@/types/social";

export const PLATFORMS: Record<PlatformId, { name: string; color: string }> = {
  instagram: { name: "Instagram", color: "#E4577E" },
  tiktok: { name: "TikTok", color: "#5EE7E0" },
  linkedin: { name: "LinkedIn", color: "#4C8DDB" },
  x: { name: "X", color: "#E7E9EA" },
  facebook: { name: "Facebook", color: "#5B8DEF" },
  youtube: { name: "YouTube", color: "#F2555A" },
  telegram: { name: "Telegram", color: "#4DB2EC" },
};

export const ALL_PLATFORMS = Object.keys(PLATFORMS) as PlatformId[];
export const MAIN_PLATFORMS: PlatformId[] = ["instagram", "tiktok", "linkedin", "x"];

export const CHAR_LIMITS: Record<PlatformId, number> = {
  x: 280, instagram: 2200, tiktok: 2200, linkedin: 3000, facebook: 63206, youtube: 5000, telegram: 4096,
};
