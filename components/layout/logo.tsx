export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-[9px]">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9.5" stroke="#ECEDEF" strokeWidth="1.6" opacity=".9" />
        <path d="M12 12 L12 5.5" stroke="#ECEDEF" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 12 L16.6 14.6" stroke="#93ABFF" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.5" fill="#ECEDEF" />
      </svg>
      <span className="text-base font-semibold tracking-[-0.02em]">Kairo</span>
    </span>
  );
}
