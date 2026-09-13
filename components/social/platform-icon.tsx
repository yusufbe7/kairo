import { PLATFORMS } from "@/lib/platforms";
import type { PlatformId } from "@/types/social";

/** Simplified, monoline platform glyphs — consistent weight with Lucide. */
export function PlatformGlyph({ platform, size = 14 }: { platform: PlatformId; size?: number }) {
  const c = PLATFORMS[platform].color;
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (platform) {
    case "instagram":
      return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="16.9" cy="7.1" r=".6" fill={c} /></svg>;
    case "tiktok":
      return <svg {...p}><path d="M14 4v10.6a3.4 3.4 0 1 1-3.4-3.4" /><path d="M14 4.2c.6 2.3 2.1 3.6 4.4 3.8" /></svg>;
    case "linkedin":
      return <svg {...p}><path d="M7 10.5V17M7 7.2v.01M11 17v-6.5M11 13.6c0-2 1.2-3.2 2.9-3.2S17 11.6 17 13.6V17" /></svg>;
    case "x":
      return <svg {...p}><path d="M5 4.5h3.6L19 19.5h-3.6z" /><path d="M18.6 4.5 13 10.8M5.4 19.5l5.5-6.2" /></svg>;
    case "facebook":
      return <svg {...p}><path d="M14.5 8H16V5h-2a3.5 3.5 0 0 0-3.5 3.5V11H8.5v3h2v6h3v-6H16l.5-3h-3V9a1 1 0 0 1 1-1z" /></svg>;
    case "youtube":
      return <svg {...p}><rect x="3" y="6" width="18" height="12" rx="4" /><path d="m10.5 9.6 3.8 2.4-3.8 2.4z" fill={c} /></svg>;
    case "telegram":
      return <svg {...p}><path d="M20.5 4.5 3.5 11l5.6 2 2 6 3-3.8 4.6 3.6z" /><path d="m9.1 13 7.6-5.6" /></svg>;
  }
}

export function PlatformIcon({ platform, size = 28 }: { platform: PlatformId; size?: number }) {
  const c = PLATFORMS[platform].color;
  return (
    <div
      className="flex shrink-0 items-center justify-center border"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: `${c}14`, borderColor: `${c}2A` }}
      title={PLATFORMS[platform].name}
    >
      <PlatformGlyph platform={platform} size={Math.round(size * 0.55)} />
    </div>
  );
}
