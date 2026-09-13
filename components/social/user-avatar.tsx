const AV_COLORS = ["#3B4A6B", "#5A4636", "#2F5A48", "#4E3F66", "#474B54", "#6B5B34"];

export function UserAvatar({ i = 0, name, size = 32 }: { i?: number; name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-border-strong font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(140deg, ${AV_COLORS[i % AV_COLORS.length]}, #1A1C22)` }}
      aria-hidden
    >
      {name[0]}
    </div>
  );
}
