"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { setFeatureFlag } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

export interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

export function FlagList({ flags, billingKey }: { flags: Flag[]; billingKey: string }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = (key: string, enabled: boolean) => {
    setError(null);
    setPendingKey(key);
    start(async () => {
      const result = await setFeatureFlag({ key, enabled });
      if (!result.ok) setError(result.error.message);
      setPendingKey(null);
      router.refresh();
    });
  };

  const billingOff = flags.some((f) => f.key === billingKey && !f.enabled);

  return (
    <div className="flex flex-col gap-3">
      {billingOff && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-[13px] leading-relaxed text-warning">
          <TriangleAlert size={16} className="mt-px shrink-0" />
          <span>
            The paywall is off. Anyone who signs up gets the full product for free, and a warning
            banner is shown across the app. Turn this back on before you take real customers.
          </span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-[13px] text-destructive">
          <TriangleAlert size={15} className="mt-px shrink-0" />{error}
        </div>
      )}

      {flags.map((flag) => {
        const isBilling = flag.key === billingKey;
        const busy = pendingKey === flag.key;
        return (
          <div key={flag.key} className={cn("surface flex items-start gap-4 p-[18px]", isBilling && "border-border-strong")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-medium">{flag.key}</span>
                {isBilling && (
                  <span className="rounded-[5px] border border-border-strong px-1.5 py-px text-[10.5px] uppercase tracking-wide text-dim">
                    Paywall
                  </span>
                )}
              </div>
              {flag.description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{flag.description}</p>}
              {isBilling && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                  On: a workspace needs a trialing or active Stripe subscription to open the dashboard.
                  Off: everyone goes straight in — use this to walk the product end to end before launch.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2.5 pt-1">
              {busy && <LoaderCircle size={14} className="animate-spin text-dim" />}
              <Switch
                checked={flag.enabled}
                disabled={busy}
                onCheckedChange={(next) => toggle(flag.key, next)}
                aria-label={`${flag.key} ${flag.enabled ? "enabled" : "disabled"}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
