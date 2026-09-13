"use client";

interface Payload { dataKey?: string | number; name?: string; value?: number; color?: string; stroke?: string }

export function ChartTooltip({ active, payload, label, format = (v: number) => v.toLocaleString() }: {
  active?: boolean; payload?: Payload[]; label?: string; format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border-strong bg-[#15181E] px-3 py-2 text-xs shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)]">
      <div className="mb-1 text-dim">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3.5 font-semibold">{format(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

export const AXIS_PROPS = { tick: { fill: "#5E636C", fontSize: 11 }, axisLine: false, tickLine: false } as const;
