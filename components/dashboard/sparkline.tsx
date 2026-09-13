"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { SeriesPoint } from "@/types/analytics";

export function Sparkline({ data, dataKey, id, color = "rgba(236,237,239,.55)" }: { data: SeriesPoint[]; dataKey: keyof SeriesPoint; id: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={1.4} fill={`url(#${id})`} animationDuration={700} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
