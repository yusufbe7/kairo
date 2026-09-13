"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, LoaderCircle, Shield, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/social/platform-icon";
import { beginConnect } from "@/lib/actions/accounts";
import { PLATFORMS, ALL_PLATFORMS } from "@/lib/platforms";
import type { PlatformId } from "@/types/social";
import type { ProviderState } from "./accounts-view";

const PERMISSIONS = [
  "Publish and schedule posts on your behalf",
  "Read post performance and follower counts",
  "Read comments and messages where the platform allows it",
];

export function ConnectDialog({ open, onOpenChange, providers }: { open: boolean; onOpenChange: (open: boolean) => void; providers: ProviderState[] }) {
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { if (open) { setStep("pick"); setError(null); } }, [open]);

  const state = providers.find((p) => p.platform === platform);
  const name = PLATFORMS[platform].name;

  /** Server re-checks permission, plan limits and provider configuration before we leave the app. */
  const authorize = () =>
    start(async () => {
      setError(null);
      const result = await beginConnect({ platform });
      if (result.ok) window.location.href = result.data.url;
      else setError(result.error.message);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-[22px]">
        <DialogTitle>{step === "pick" ? "Connect an account" : `Connect ${name}`}</DialogTitle>
        <DialogDescription>
          {step === "pick" ? "Choose where you want to publish." : "You'll be sent to the provider to approve access, then back to Kairo."}
        </DialogDescription>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {step === "pick" ? (
              <div className="mt-[18px] grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {ALL_PLATFORMS.map((p) => {
                  const provider = providers.find((x) => x.platform === p);
                  const ready = provider?.canConnect ?? false;
                  return (
                    <button key={p} disabled={!ready} onClick={() => { setPlatform(p); setStep("confirm"); }}
                      className="surface surface-lift flex flex-col gap-2.5 p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
                      <PlatformIcon platform={p} size={32} />
                      <div>
                        <div className="text-[13px] font-medium">{PLATFORMS[p].name}</div>
                        <div className="text-[11.5px] text-dim">{ready ? "Available" : provider?.configured ? "Coming soon" : "Not configured"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-[18px]">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3.5"><PlatformIcon platform={platform} size={36} /><div className="text-[13px]">Kairo will be able to:</div></div>
                <div className="mx-1 my-3.5 flex flex-col gap-2.5">
                  {PERMISSIONS.map((t) => <div key={t} className="flex items-center gap-2.5 text-[13px]"><Check size={14} className="shrink-0 text-success" />{t}</div>)}
                </div>
                <div className="flex items-center gap-2 text-xs text-dim"><Shield size={13} className="shrink-0" />Tokens are encrypted and stored server-side. Disconnect any time.</div>

                {state && !state.configured && (
                  <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2 text-xs text-warning">
                    <TriangleAlert size={13} className="mt-px shrink-0" />
                    <span>{name} isn't configured on this deployment. Missing: {state.missingEnv.join(", ")}.</span>
                  </div>
                )}
                {error && (
                  <div role="alert" className="mt-3.5 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                    <TriangleAlert size={13} className="mt-px shrink-0" />{error}
                  </div>
                )}

                <div className="mt-[18px] flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => setStep("pick")}><ChevronLeft size={14} />Back</Button>
                  <Button variant="primary" onClick={authorize} disabled={pending || !state?.canConnect}>
                    {pending && <LoaderCircle size={15} className="animate-spin" />}Continue with {name}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
