"use client";

import type { SeriesPoint } from "@/types/analytics";
import { Sparkline } from "./sparkline";

export function StatCard({ label, value, data, dataKey, id, brand, hint }: {
  label: string; value: string | number; data: SeriesPoint[]; dataKey: keyof SeriesPoint; id: string; brand?: boolean; hint: string;
}) {
  return (
    <div className="surface surface-lift p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</div>
        {data.length > 1 && <div className="w-[90px]"><Sparkline data={data} dataKey={dataKey} id={id} color={brand ? "#93ABFF" : undefined} /></div>}
      </div>
      <div className="mt-1.5 text-[11.5px] text-dim">{hint}</div>
    </div>
  );
}
