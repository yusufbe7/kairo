"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2, CalendarDays, Check, Clock, Eye, FileText, Hash, Layers, LoaderCircle, Paperclip,
  RefreshCw, Send, Smile, Sparkles, TriangleAlert, WandSparkles, Zap, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformGlyph } from "@/components/social/platform-icon";
import { InstagramPreview, LinkedInPreview, TikTokPreview, XPreview } from "./previews";
import { MediaPicker } from "./media-picker";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ALL_PLATFORMS, CHAR_LIMITS, MAIN_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { savePost } from "@/lib/actions/posts";
import { generateContent } from "@/lib/actions/ai";
import { run } from "@/lib/client/action";
import { fmtTime, relDay } from "@/lib/format";
import { COMMON_TIMEZONES } from "@/lib/time";
import type { AiAction } from "@/lib/ai";
import type { MediaView, PostView } from "@/types/posts";
import type { AccountView, PlatformId } from "@/types/social";
import { cn } from "@/lib/utils";

type Mode = "now" | "schedule" | "draft";
type Format = "post" | "reel" | "story" | "thread";

const EMOJIS = ["✨", "🚀", "🔥", "👇", "💡", "🎯", "📈", "🙌", "👀", "✅", "📅", "💬", "🎉", "⚡", "🧠", "❤️"];
const HASHTAGS = ["#ContentStrategy", "#BuildInPublic", "#SocialMediaTips", "#SaaS", "#CreatorEconomy", "#ProductLaunch", "#Marketing"];
const AI_BUTTONS: { id: AiAction; label: string; icon: LucideIcon }[] = [
  { id: "improve", label: "Improve writing", icon: WandSparkles },
  { id: "shorter", label: "Make shorter", icon: Layers },
  { id: "engaging", label: "Make more engaging", icon: Zap },
  { id: "professional", label: "Professional tone", icon: Building2 },
  { id: "caption", label: "Generate caption", icon: Sparkles },
  { id: "hashtags", label: "Generate hashtags", icon: Hash },
];

export interface EditorProps {
  accounts: AccountView[];
  library: MediaView[];
  post: PostView | null;
  /** Text handed over from AI Studio via ?draft=. */
  initialText?: string;
  aiEnabled: boolean;
}

export function CreateEditor({ accounts, library, post, initialText, aiEnabled }: EditorProps) {
  const router = useRouter();
  const { workspace, today, can } = useWorkspace();

  const connected = useMemo(() => new Set(accounts.filter((a) => a.status === "connected").map((a) => a.platform)), [accounts]);
  const defaultPlatforms = useMemo<PlatformId[]>(() => {
    if (post?.platforms.length) return post.platforms;
    const live = MAIN_PLATFORMS.filter((p) => connected.has(p));
    return live.length ? live : ["instagram"];
  }, [post, connected]);

  const [format, setFormat] = useState<Format>(post?.format ?? "post");
  const [text, setText] = useState(post?.caption ?? initialText ?? "");
  const [media, setMedia] = useState<MediaView[]>(post?.media.flatMap((m) => library.filter((l) => l.id === m.id)) ?? []);
  const [selected, setSelected] = useState<PlatformId[]>(defaultPlatforms);
  const [customize, setCustomize] = useState(Boolean(post?.targets.some((t) => t.captionOverride)));
  const [perText, setPerText] = useState<Partial<Record<PlatformId, string>>>(
    Object.fromEntries((post?.targets ?? []).filter((t) => t.captionOverride).map((t) => [t.platform, t.captionOverride!])),
  );
  const [customTab, setCustomTab] = useState<PlatformId>(defaultPlatforms[0]);
  const [preview, setPreview] = useState<PlatformId>(MAIN_PLATFORMS.find((p) => defaultPlatforms.includes(p)) ?? "instagram");
  const [mode, setMode] = useState<Mode>(post?.status === "draft" ? "draft" : "schedule");
  const [date, setDate] = useState(post?.scheduledAt ? post.date : today);
  const [time, setTime] = useState(post?.scheduledAt ? post.time : "10:00");
  const [timezone, setTimezone] = useState(workspace.timezone);
  const [aiBusy, setAiBusy] = useState<AiAction | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editing = customize ? customTab : null;
  const current = editing ? perText[editing] ?? text : text;
  const setCurrent = (value: string) => {
    setError("");
    if (editing) setPerText((s) => ({ ...s, [editing]: value }));
    else setText(value);
  };
  const textFor = (p: PlatformId) => (customize ? perText[p] ?? text : text);

  const tightest = selected.reduce<PlatformId>((a, p) => (CHAR_LIMITS[p] < CHAR_LIMITS[a] ? p : a), selected[0] ?? "instagram");
  const limitPlatform = editing ?? tightest;
  const remaining = CHAR_LIMITS[limitPlatform] - current.length;

  const togglePlatform = (p: PlatformId) => {
    setError("");
    setSelected((s) => {
      const on = s.includes(p);
      const next = on ? s.filter((x) => x !== p) : [...s, p];
      if (!on && MAIN_PLATFORMS.includes(p)) setPreview(p);
      if (!next.includes(customTab) && next.length) setCustomTab(next[0]);
      return next;
    });
  };

  const runAi = (action: AiAction) => {
    setAiBusy(action);
    void (async () => {
      const result = await run(generateContent({ action, text: current, platform: editing ?? undefined }));
      if (result) setCurrent(result.text);
      setAiBusy(null);
    })();
  };

  const insert = (snippet: string) => {
    const pos = textareaRef.current?.selectionStart ?? current.length;
    setCurrent(current.slice(0, pos) + snippet + current.slice(pos));
  };

  const submit = (submitMode: Mode = mode) => {
    setError("");
    start(async () => {
      const result = await savePost({
        postId: post?.id,
        caption: text,
        format,
        targets: selected.map((p) => ({ platform: p, captionOverride: customize ? perText[p] ?? null : null })),
        mediaIds: media.map((m) => m.id),
        mode: submitMode,
        date, time, timezone,
      });
      if (!result.ok) { setError(result.error.message); return; }
      const where = selected.length === 1 ? PLATFORMS[selected[0]].name : `${selected.length} platforms`;
      if (submitMode === "draft") router.push("/posts?tab=draft");
      else if (submitMode === "now") router.push("/posts?tab=published");
      else router.push("/calendar");
      router.refresh();
      void where;
    });
  };

  const reset = () => { setText(""); setMedia([]); setPerText({}); setError(""); };
  const handle = (p: PlatformId) => accounts.find((a) => a.platform === p)?.handle ?? "@yourbrand";
  const canSchedule = can("post.schedule");
  const primaryMode: Mode = canSchedule ? mode : "draft";
  const primaryLabel = { now: "Publish now", schedule: "Schedule post", draft: "Save draft" }[primaryMode];
  const unconnected = selected.filter((p) => !connected.has(p));

  return (
    <>
      <PageHeader title={post ? "Edit content" : "Create content"} description="Write once, then tailor it for every platform.">
        <Button size="sm" className="lg:hidden" onClick={() => document.getElementById("live-preview")?.scrollIntoView({ behavior: "smooth" })}><Eye size={13} />Preview</Button>
        <Button size="sm" variant="ghost" onClick={reset}><RefreshCw size={13} />Reset</Button>
      </PageHeader>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="surface">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
              <Segmented aria-label="Format" value={format} onChange={setFormat}
                options={[{ value: "post" as const, label: "Post" }, { value: "reel" as const, label: "Reel" }, { value: "story" as const, label: "Story" }, { value: "thread" as const, label: "Thread" }]} />
            </div>

            {customize && selected.length > 0 && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pt-3">
                {selected.map((p) => (
                  <button key={p} className="chip" data-on={customTab === p} onClick={() => { setCustomTab(p); if (MAIN_PLATFORMS.includes(p)) setPreview(p); }}>
                    <PlatformGlyph platform={p} size={13} />{PLATFORMS[p].name}
                    {perText[p] !== undefined && <span className="h-[5px] w-[5px] rounded-full bg-brand" />}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 pb-1.5 pt-3.5">
              {aiBusy ? (
                <div className="flex min-h-[150px] flex-col gap-2.5 pt-1" aria-live="polite">
                  <div className="flex items-center gap-2 text-[12.5px] text-brand"><Sparkles size={14} />Writing with AI…</div>
                  <Skeleton className="h-3 w-[92%]" /><Skeleton className="h-3 w-[80%]" /><Skeleton className="h-3 w-[64%]" />
                </div>
              ) : (
                <textarea
                  ref={textareaRef} rows={6} value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="Post text"
                  placeholder={format === "thread" ? "Start your thread… use a blank line to split posts" : "Write something worth sharing..."}
                  className="min-h-[150px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
                />
              )}
            </div>

            <div className="flex items-center gap-0.5 border-t border-border px-2.5 py-2">
              <DropdownMenu>
                <Tip label="Emoji"><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Emoji"><Smile size={16} /></Button></DropdownMenuTrigger></Tip>
                <DropdownMenuContent align="start" side="top" className="grid min-w-0 grid-cols-8 gap-0.5 p-2">
                  {EMOJIS.map((e) => <button key={e} className="h-[30px] w-[30px] rounded-md text-base hover:bg-white/5" onClick={() => insert(e)}>{e}</button>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <Tip label="Media"><Button variant="ghost" size="icon-sm" aria-label="Media" onClick={() => document.getElementById("media-picker")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Paperclip size={16} /></Button></Tip>
              <Tip label="Hashtag helper"><Button variant="ghost" size="icon-sm" aria-label="Hashtags" aria-pressed={showTags} onClick={() => setShowTags((v) => !v)}><Hash size={16} /></Button></Tip>
              {aiEnabled && <Tip label="Generate a caption"><Button variant="ghost" size="sm" onClick={() => runAi("caption")} disabled={!!aiBusy}><Sparkles size={14} className="text-brand" /><span className="hidden md:inline">AI</span></Button></Tip>}
              <div className="flex-1" />
              <span aria-live="polite" className={cn("text-xs", remaining < 0 ? "text-destructive" : remaining < 30 ? "text-warning" : "text-dim")}>
                {PLATFORMS[limitPlatform].name} · {remaining.toLocaleString()} left
              </span>
            </div>

            <AnimatePresence initial={false}>
              {showTags && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
                    {HASHTAGS.map((h) => <button key={h} className="chip h-7" onClick={() => setCurrent(`${current} ${h}`.trim())}>{h}</button>)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div id="media-picker"><MediaPicker selected={media} onChange={setMedia} library={library} /></div>

          <div className="surface p-[18px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="h2">Publish to</div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted-foreground">
                Customize for each platform
                <Switch checked={customize} onCheckedChange={(v) => { setCustomize(v); if (v && selected.length) setCustomTab(selected[0]); }} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const on = selected.includes(p);
                const live = connected.has(p);
                return (
                  <button key={p} className="chip" data-on={on} aria-pressed={on} onClick={() => togglePlatform(p)}
                    title={live ? PLATFORMS[p].name : `${PLATFORMS[p].name} isn't connected — you can still save a draft`}>
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded-[5px] border border-border-strong transition-colors", on && "border-brand bg-brand text-brand-foreground")}>
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <PlatformGlyph platform={p} size={14} />
                    <span className={cn(!live && "text-dim")}>{PLATFORMS[p].name}</span>
                    {!live && <span className="text-[10.5px] text-dim">not connected</span>}
                  </button>
                );
              })}
            </div>
            {unconnected.length > 0 && mode !== "draft" && (
              <p className="mt-3 text-xs text-dim">
                {unconnected.map((p) => PLATFORMS[p].name).join(", ")} {unconnected.length === 1 ? "isn't" : "aren't"} connected yet — publishing there will be blocked until you connect {unconnected.length === 1 ? "it" : "them"}.
              </p>
            )}
          </div>

          {aiEnabled && (
            <div className="surface p-[18px]">
              <div className="mb-3 flex items-center gap-2">
                <div className="h2">AI Assistant ✨</div>
                <span className="text-xs text-dim">Edits {editing ? `your ${PLATFORMS[editing].name} version` : "the main text"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_BUTTONS.map((a) => (
                  <button key={a.id} className={cn("chip", aiBusy && aiBusy !== a.id && "opacity-50")} onClick={() => runAi(a.id)} disabled={!!aiBusy}>
                    {aiBusy === a.id ? <LoaderCircle size={13} className="animate-spin" /> : <a.icon size={13} />}{a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="surface p-[18px]">
            <div className="h2 mb-3">Publishing</div>
            {canSchedule ? (
              <Segmented aria-label="Publishing" value={mode} onChange={setMode}
                options={[{ value: "now" as const, label: "Publish now" }, { value: "schedule" as const, label: "Schedule" }, { value: "draft" as const, label: "Save as draft" }]} />
            ) : (
              <p className="text-[13px] text-muted-foreground">Your role can save drafts. An editor can review and schedule them.</p>
            )}
            <AnimatePresence initial={false}>
              {canSchedule && mode === "schedule" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5 pt-3.5">
                    <label><span className="text-xs text-dim">Date</span><Input type="date" className="mt-1.5" value={date} min={today} onChange={(e) => setDate(e.target.value)} /></label>
                    <label><span className="text-xs text-dim">Time</span><Input type="time" className="mt-1.5" value={time} onChange={(e) => setTime(e.target.value)} /></label>
                    <label><span className="text-xs text-dim">Timezone</span>
                      <Select className="mt-1.5" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        {[...new Set([workspace.timezone, ...COMMON_TIMEZONES])].map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
                      </Select>
                    </label>
                    <div className="col-span-full flex items-center gap-2 text-[12.5px] text-brand"><Clock size={13} />Goes out {relDay(date, today)} at {fmtTime(time)}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[13px] text-destructive">
                <TriangleAlert size={15} className="mt-px shrink-0" />{error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-2.5">
            {primaryMode !== "draft" && <Button onClick={() => submit("draft")} disabled={pending}>Save draft</Button>}
            <Button variant={primaryMode === "schedule" ? "brand" : "primary"} className="min-w-[140px]" onClick={() => submit(primaryMode)} disabled={pending}>
              {pending ? <LoaderCircle size={15} className="animate-spin" /> : primaryMode === "schedule" ? <CalendarDays size={15} /> : primaryMode === "now" ? <Send size={15} /> : <FileText size={15} />}
              {primaryLabel}
            </Button>
          </div>
        </div>

        <div id="live-preview" className="scroll-mt-20 lg:sticky lg:top-[88px]">
          <div className="surface p-[18px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2"><span className="h-[7px] w-[7px] rounded-full bg-success shadow-[0_0_10px_#6EDCA0]" /><span className="h2">Live preview</span></div>
              <Segmented aria-label="Preview platform" value={preview} onChange={setPreview}
                options={MAIN_PLATFORMS.map((p) => ({ value: p, dim: !selected.includes(p), label: <><PlatformGlyph platform={p} size={13} /><span className="hidden md:inline">{PLATFORMS[p].name}</span></> }))} />
            </div>
            {!selected.includes(preview) && <div className="mb-2.5 text-xs text-dim">{PLATFORMS[preview].name} isn't selected — this post won't publish there.</div>}
            <AnimatePresence mode="wait">
              <motion.div key={preview} className="flex justify-center" initial={{ opacity: 0, y: 8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                {preview === "instagram" && <InstagramPreview text={textFor("instagram")} media={media[0]} handle={handle("instagram")} />}
                {preview === "tiktok" && <TikTokPreview text={textFor("tiktok")} media={media[0]} handle={handle("tiktok")} />}
                {preview === "linkedin" && <LinkedInPreview text={textFor("linkedin")} media={media[0]} />}
                {preview === "x" && <XPreview text={textFor("x")} media={media[0]} handle={handle("x")} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
