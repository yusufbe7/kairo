"use client";

import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  dim?: boolean;
}

/** Segmented control (single-select) built on Radix ToggleGroup. */
export function Segmented<T extends string>({
  options, value, onChange, className, "aria-label": ariaLabel,
}: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; className?: string; "aria-label"?: string }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 gap-0.5 rounded-[10px] border border-border bg-white/[0.03] p-[3px]", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[11px] text-xs text-muted-foreground transition-all hover:text-foreground",
            "data-[state=on]:bg-white/[0.085] data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
            o.dim && "opacity-45",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
