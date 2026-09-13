import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong"><Icon size={18} className="text-muted-foreground" /></div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 max-w-xs text-[13px] text-muted-foreground">{text}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
