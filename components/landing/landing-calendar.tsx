"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlatformGlyph } from "@/components/social/platform-icon";
import { Thumb } from "@/components/social/thumb";
import { WEEK_HEADERS } from "@/lib/format";
import type { PlatformId } from "@/types/social";
import { cn } from "@/lib/utils";

interface Item { id: number; day: number; platform: PlatformId; title: string; thumb: number }
const INITIAL: Item[] = [
  { id: 1, day: 0, platform: "instagram", title: "Launch teaser", thumb: 0 }, { id: 2, day: 1, platform: "linkedin", title: "Series A news", thumb: 2 },
  { id: 3, day: 3, platform: "tiktok", title: "Behind the scenes", thumb: 1 }, { id: 4, day: 4, platform: "x", title: "Shipping log #42", thumb: 3 },
  { id: 5, day: 8, platform: "instagram", title: "5 scroll-stopping hooks", thumb: 5 }, { id: 6, day: 10, platform: "linkedin", title: "Customer story", thumb: 6 },
  { id: 7, day: 12, platform: "tiktok", title: "Desk tour", thumb: 7 },
];

/** Two-week interactive calendar for the marketing page. */
export function LandingCalendar() {
  const [items, setItems] = useState(INITIAL);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13.5px] font-semibold">September 2026</span><span className="text-xs text-dim">Drag a post to another day</span>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7">{WEEK_HEADERS.map((d) => <div key={d} className="border-b border-border px-2.5 py-2 text-[11.5px] text-dim">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} data-over={over === i} className={cn("cal-cell min-h-[108px]", (i + 1) % 7 === 0 && "border-r-0", i >= 7 && "border-b-0")}
                onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); setItems((s) => s.map((x) => (x.id === drag ? { ...x, day: i } : x))); setDrag(null); setOver(null); }}>
                <span className={cn("inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-xs text-muted-foreground", i === 3 && "bg-brand font-semibold text-brand-foreground")}>{7 + i}</span>
                {items.filter((x) => x.day === i).map((x) => (
                  <motion.div key={x.id} layoutId={`lc-${x.id}`} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
                    <div draggable onDragStart={() => setDrag(x.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                      className={cn("mt-1 flex cursor-grab items-center gap-1.5 rounded-[7px] border border-border bg-white/[0.04] p-1 pr-1.5 text-[11px] transition hover:border-border-strong", drag === x.id && "opacity-35")}>
                      <Thumb i={x.thumb} className="h-[22px] w-[22px]" rounded="rounded-[5px]" /><PlatformGlyph platform={x.platform} size={11} /><span className="truncate">{x.title}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
