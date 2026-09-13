"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { AXIS_PROPS, ChartTooltip } from "@/components/analytics/chart-tooltip";
import { EmptyState } from "@/components/layout/empty-state";
import { fmtNum } from "@/lib/format";
import type { SeriesPoint } from "@/types/analytics";

type Metric = "reach" | "engagement" | "followers";
const META: Record<Metric, { name: string; format: (v: number) => string }> = {
  reach: { name: "Reach", format: fmtNum },
  engagement: { name: "Engagement", format: (v) => v + "%" },
  followers: { name: "Followers", format: fmtNum },
};

export function PerformanceChart({ series, hasData, height = 280, title = "Content performance" }: { series: SeriesPoint[]; hasData: boolean; height?: number; title?: string }) {
  const [metric, setMetric] = useState<Metric>("reach");
  const m = META[metric];
  const total = useMemo(() => {
    if (!series.length) return "—";
    if (metric === "engagement") return (series.reduce((a, d) => a + d.engagement, 0) / series.length).toFixed(2) + "%";
    if (metric === "followers") return fmtNum(series[series.length - 1].followers);
    return fmtNum(series.reduce((a, d) => a + d.reach, 0));
  }, [series, metric]);

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="h2">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{total}</div>
        </div>
        <Segmented aria-label="Metric" value={metric} onChange={setMetric}
          options={[{ value: "reach", label: "Reach" }, { value: "engagement", label: "Engagement" }, { value: "followers", label: "Followers" }]} />
      </div>
      {hasData && series.length > 1 ? (
        <div className="-ml-2 mt-[18px]" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} key={metric} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ECEDEF" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#ECEDEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...AXIS_PROPS} width={44} domain={["auto", "auto"]} tickFormatter={(v: number) => (metric === "engagement" ? v + "%" : fmtNum(v))} />
              <Tooltip content={<ChartTooltip format={m.format} />} cursor={{ stroke: "rgba(255,255,255,.15)", strokeDasharray: "3 3" }} />
              <Area type="monotone" dataKey={metric} name={m.name} stroke="#ECEDEF" strokeWidth={1.8} fill="url(#perf)" animationDuration={800}
                activeDot={{ r: 4, fill: "#ECEDEF", stroke: "#060709", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ minHeight: height }} className="flex items-center justify-center">
          <EmptyState icon={ChartColumn} title="No analytics yet" text="Once a connected account reports its first daily snapshot, your performance shows up here." />
        </div>
      )}
    </div>
  );
}
