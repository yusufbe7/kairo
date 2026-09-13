/**
 * The Kairo mark: three folded blades forming a K, cyan through blue into violet.
 *
 * Corners are rounded by stroking each blade with its own fill and a round line
 * join, so the radius scales with the mark instead of being baked into the path.
 * `id` keeps the gradient ids unique when several marks share a page.
 */
export function KairoMark({ size = 24, id = "kairo", className }: { size?: number; id?: string; className?: string }) {
  const g = (name: string) => `${id}-${name}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={g("stem")} x1="28" y1="19" x2="40" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28C8F7" />
          <stop offset=".45" stopColor="#2E6CF0" />
          <stop offset="1" stopColor="#2433E2" />
        </linearGradient>
        <linearGradient id={g("up")} x1="42" y1="48" x2="75" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A32E4" />
          <stop offset=".55" stopColor="#2F6BF2" />
          <stop offset="1" stopColor="#45CDF8" />
        </linearGradient>
        <linearGradient id={g("down")} x1="47" y1="47" x2="76" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7B4CF6" />
          <stop offset="1" stopColor="#C481FB" />
        </linearGradient>
        {/* The fold: where a blade passes behind another it darkens, which is what
            keeps the mark reading as folded ribbon rather than three flat shapes. */}
        <linearGradient id={g("fold")} x1="34" y1="40" x2="44" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
      </defs>

      <g strokeLinejoin="round" strokeWidth="4">
        <path d="M27.5 21 41 18.5 41 63.5 27.5 68.5Z" fill={`url(#${g("stem")})`} stroke={`url(#${g("stem")})`} />
        <path d="M27.5 44 41 41 41 63.5 27.5 68.5Z" fill={`url(#${g("fold")})`} stroke="none" />
        <path d="M41 40 58.5 25 75.5 25 75.5 29.5 44 56Z" fill={`url(#${g("up")})`} stroke={`url(#${g("up")})`} />
        <path d="M44 57 55.5 46.5 76.5 66 66 70Z" fill={`url(#${g("down")})`} stroke={`url(#${g("down")})`} />
      </g>
    </svg>
  );
}
