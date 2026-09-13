"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_PROPS, ChartTooltip } from "@/components/analytics/chart-tooltip";

export function AdminChart({ data, title, subtitle }: { data: { label: string; value: number }[]; title: string; subtitle: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="surface p-5">
      <div className="h2">{title}</div>
      <div className="mt-0.5 text-[12.5px] text-dim">{subtitle}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{total.toLocaleString()}</div>
      <div className="-ml-2 mt-4 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`admin-${title.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ECEDEF" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#ECEDEF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
            <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...AXIS_PROPS} width={34} allowDecimals={false} />
            <Tooltip content={<ChartTooltip format={(v) => String(v)} />} cursor={{ stroke: "rgba(255,255,255,.15)", strokeDasharray: "3 3" }} />
            <Area type="monotone" dataKey="value" name={title} stroke="#ECEDEF" strokeWidth={1.8} fill={`url(#admin-${title.replace(/\W/g, "")})`} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
