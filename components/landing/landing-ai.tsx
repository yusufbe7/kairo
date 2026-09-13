"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/social/platform-icon";
import { PLATFORMS } from "@/lib/platforms";
import { DEMO_AI_OUTPUT } from "@/data/demo/ai-samples";
import type { PlatformId } from "@/types/social";

const IDEAS = ["We're launching a free plan for students", "Our app now supports Telegram channels", "5 lessons from our first 1,000 customers"];
const OUTPUTS: [PlatformId, string][] = [["instagram", "Caption"], ["linkedin", "Long-form"], ["x", "Thread"]];

export function LandingAI() {
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const next = () => { setLoading(true); setTimeout(() => { setI((x) => (x + 1) % IDEAS.length); setLoading(false); }, 900); };
  const idea = IDEAS[i];
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2.5 rounded-xl border border-border-strong bg-white/[0.025] px-3.5 py-3">
        <Sparkles size={15} className="shrink-0 text-brand" /><span className="flex-1 text-sm">{idea}</span>
        <Button size="sm" onClick={next} disabled={loading}>{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}<span className="hidden sm:inline">Try another idea</span></Button>
      </div>
      <div className="flex h-[26px] justify-center"><div className="w-px bg-gradient-to-b from-border-strong to-transparent" /></div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {OUTPUTS.map(([p, label], j) => (
          <div key={p} className="min-h-[150px] rounded-xl border border-border bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium"><PlatformIcon platform={p} size={22} />{PLATFORMS[p].name}<span className="ml-auto text-[11px] text-dim">{label}</span></div>
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="s" exit={{ opacity: 0 }} className="mt-3.5 flex flex-col gap-2">{[90, 76, 84].map((w, k) => <Skeleton key={k} className="h-[9px]" style={{ width: `${w}%` }} />)}</motion.div>
              ) : (
                <motion.p key={idea} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: j * 0.08 }}
                  className="mt-2.5 line-clamp-5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  {DEMO_AI_OUTPUT[i][p]}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
