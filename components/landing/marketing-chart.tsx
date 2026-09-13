"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_PROPS, ChartTooltip } from "@/components/analytics/chart-tooltip";
import { fmtNum } from "@/lib/format";

interface Point { label: string; reach: number; followers: number; engagement: number }

/** Demo-only chart for the marketing page. The product charts read from the database. */
export function MarketingChart({ series, height = 240, title }: { series: Point[]; height?: number; title: string }) {
  const total = series.reduce((a, d) => a + d.reach, 0);
  return (
    <div className="surface p-5">
      <div className="h2">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{fmtNum(total)}</div>
      <div className="-ml-2 mt-[18px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="marketing-perf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ECEDEF" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#ECEDEF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...AXIS_PROPS} width={44} tickFormatter={fmtNum} domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip format={fmtNum} />} cursor={{ stroke: "rgba(255,255,255,.15)", strokeDasharray: "3 3" }} />
            <Area type="monotone" dataKey="reach" name="Reach" stroke="#ECEDEF" strokeWidth={1.8} fill="url(#marketing-perf)" animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
