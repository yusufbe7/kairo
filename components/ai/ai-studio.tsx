"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, LoaderCircle, RefreshCw, Sparkles, SquarePen, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformGlyph, PlatformIcon } from "@/components/social/platform-icon";
import { generateContent } from "@/lib/actions/ai";
import { MAIN_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import type { PlatformId } from "@/types/social";

const CONTENT_TYPES = ["Social post", "Campaign", "Thread", "Carousel", "Short video script", "Hashtags"] as const;
const TONES = ["Professional", "Friendly", "Bold", "Educational", "Minimal"] as const;
const EXAMPLES = ["Create a product launch campaign for our new SaaS.", "A week of tips for freelance designers", "Announce our Series A"];

interface Result { id: string; platform: PlatformId; text: string }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-[12.5px] text-dim">{label}</span>{children}</div>;
}

export function AIStudio({ enabled, usage }: { enabled: boolean; usage: { used: number; limit: number | null } }) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]>("Campaign");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Professional");
  const [platforms, setPlatforms] = useState<PlatformId[]>(["instagram", "linkedin", "x"]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () => {
    if (!platforms.length) { setError("Pick at least one platform."); return; }
    setError(null);
    start(async () => {
      // One request per platform: each gets copy written for how people read there.
      const responses = await Promise.all(
        platforms.map(async (platform) => {
          const result = await generateContent({ action: "adapt", text: prompt, platform, tone, contentType });
          return result.ok ? { id: `${platform}-${Date.now()}`, platform, text: result.data.text } : { platform, error: result.error.message };
        }),
      );
      const good = responses.filter((r): r is Result => "text" in r);
      const bad = responses.find((r) => "error" in r) as { error: string } | undefined;
      if (bad && good.length === 0) setError(bad.error);
      else if (bad) toast.error(bad.error);
      setResults(good.length ? good : null);
    });
  };

  const regenerate = (index: number) => start(async () => {
    const target = results?.[index];
    if (!target) return;
    const result = await generateContent({ action: "adapt", text: prompt, platform: target.platform, tone, contentType });
    if (result.ok) setResults((rs) => rs?.map((r, i) => (i === index ? { ...r, id: `${r.platform}-${Date.now()}`, text: result.data.text } : r)) ?? null);
    else toast.error(result.error.message);
  });

  if (!enabled) {
    return (
      <div className="mx-auto max-w-[720px]">
        <div className="surface">
          <EmptyState icon={Sparkles} title="AI Studio isn't configured"
            text="An administrator needs to add an AI API key to this deployment before content generation is available."
            action={<Button size="sm" asChild><Link href="/create">Write a post instead</Link></Button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-7 mt-3 text-center">
        <div className="flex items-center justify-center gap-2 text-[13px] text-brand"><Sparkles size={15} />AI Studio</div>
        <h1 className="mt-2.5 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">Turn ideas into ready-to-publish content.</h1>
      </div>

      <div className="surface">
        <div className="p-[18px]">
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What do you want to create?" aria-label="Prompt"
            className="w-full resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-dim" />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-dim">Try</span>
            {EXAMPLES.map((s) => <button key={s} className="chip h-[26px] text-xs" onClick={() => setPrompt(s)}>{s}</button>)}
          </div>
        </div>
        <div className="grid gap-4 border-t border-border p-[18px]">
          <Row label="Content type">{CONTENT_TYPES.map((o) => <button key={o} className="chip" data-on={contentType === o} onClick={() => setContentType(o)}>{o}</button>)}</Row>
          <Row label="Tone">{TONES.map((o) => <button key={o} className="chip" data-on={tone === o} onClick={() => setTone(o)}>{o}</button>)}</Row>
          <Row label="Platforms">
            {MAIN_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return <button key={p} className="chip" data-on={on} aria-pressed={on} onClick={() => setPlatforms((s) => (on ? s.filter((x) => x !== p) : [...s, p]))}><PlatformGlyph platform={p} size={13} />{PLATFORMS[p].name}</button>;
            })}
          </Row>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-[18px] py-3">
          <span className="text-xs text-dim">{usage.used} of {usage.limit ?? "unlimited"} generations used this month</span>
          <Button variant="primary" onClick={generate} disabled={pending}>
            {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}{pending ? "Generating…" : "Generate content ✨"}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[13px] text-destructive">
          <TriangleAlert size={15} className="mt-px shrink-0" />{error}
        </div>
      )}

      {pending && !results && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((p) => (
            <div key={p} className="surface p-[18px]">
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><PlatformGlyph platform={p} size={14} />Drafting for {PLATFORMS[p].name}…</div>
              <div className="mt-4 flex flex-col gap-[9px]">{[92, 84, 96, 60, 72].map((w, i) => <Skeleton key={i} className="h-2.5" style={{ width: `${w}%` }} />)}</div>
            </div>
          ))}
        </div>
      )}

      {results && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          <AnimatePresence mode="popLayout">
            {results.map((r, i) => (
              <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.07, duration: 0.25 }}
                className="surface surface-lift flex flex-col p-[18px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-medium"><PlatformIcon platform={r.platform} size={26} />{PLATFORMS[r.platform].name}</span>
                  <span className="text-[11.5px] text-dim">{contentType} · {tone}</span>
                </div>
                <p className="mt-3.5 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{r.text}</p>
                <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
                  <Tip label="Copy"><Button variant="ghost" size="icon-sm" aria-label="Copy" onClick={() => { void navigator.clipboard?.writeText(r.text); toast.success("Copied to clipboard"); }}><Copy size={14} /></Button></Tip>
                  <Tip label="Regenerate"><Button variant="ghost" size="icon-sm" aria-label="Regenerate" onClick={() => regenerate(i)} disabled={pending}><RefreshCw size={14} /></Button></Tip>
                  <div className="flex-1" />
                  <Button size="sm" asChild><Link href={`/create?draft=${encodeURIComponent(r.text)}`}><SquarePen size={13} />Open in editor</Link></Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!results && !pending && <p className="mt-7 text-center text-[13px] text-dim">Your drafts will appear here — one per platform, ready to edit.</p>}
    </div>
  );
}
