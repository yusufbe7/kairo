import { cn } from "@/lib/utils";

const TONES = {
  scheduled: "text-brand bg-brand/[0.08] border-brand/20",
  published: "text-success bg-success/[0.07] border-success/20",
  connected: "text-success bg-success/[0.07] border-success/20",
  draft: "text-muted-foreground bg-white/[0.04] border-border-strong",
  neutral: "text-muted-foreground bg-white/[0.04] border-border-strong",
  failed: "text-destructive bg-destructive/[0.07] border-destructive/20",
  warning: "text-warning bg-warning/[0.07] border-warning/20",
} as const;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({ tone, children, dot = true, className }: { tone: BadgeTone; children?: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium", TONES[tone], className)}>
      {dot && <i className="block h-1.5 w-1.5 rounded-full bg-current" />}
      {children ?? tone[0].toUpperCase() + tone.slice(1)}
    </span>
  );
}
