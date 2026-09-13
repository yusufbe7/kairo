import { ChartColumn, Bookmark, Globe, Heart, MessageCircle, MoreHorizontal, Music2, Repeat2, Send, Share2, ThumbsUp } from "lucide-react";
import { Thumb } from "@/components/social/thumb";
import { UserAvatar } from "@/components/social/user-avatar";
import { Logo } from "@/components/layout/logo";
import type { MediaView } from "@/types/posts";

/**
 * Simplified feed previews — inspired by each platform's content structure,
 * intentionally not a copy of their UI.
 */
interface PreviewProps { text: string; media?: MediaView; handle: string }

const frame = "w-full overflow-hidden rounded-[14px] border border-border bg-[#0A0B0E]";
const Placeholder = ({ t }: { t: string }) => <span className="text-dim">{t}</span>;

export function InstagramPreview({ text, media, handle }: PreviewProps) {
  const h = handle.replace("@", "");
  return (
    <div className={`${frame} max-w-[380px]`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5"><UserAvatar name="K" size={30} /><div className="text-[13px] font-semibold">{h}</div><MoreHorizontal size={16} className="ml-auto text-muted-foreground" /></div>
      <Thumb i={0} src={media?.kind === "video" ? undefined : media?.url ?? undefined} video={media?.kind === "video"} rounded="rounded-none" className="aspect-square w-full" />
      <div className="flex items-center gap-3.5 px-3 pb-1 pt-2.5"><Heart size={20} /><MessageCircle size={20} /><Send size={19} /><Bookmark size={19} className="ml-auto" /></div>
      <div className="px-3 pb-3 pt-1 text-[13px]">
        <div className="font-semibold">1,284 likes</div>
        <div className="line-clamp-4 mt-1 whitespace-pre-wrap"><b className="font-semibold">{h}</b> {text || <Placeholder t="Your caption will appear here" />}</div>
        <div className="mt-1.5 text-dim">View all 48 comments</div>
      </div>
    </div>
  );
}

export function TikTokPreview({ text, media, handle }: PreviewProps) {
  return (
    <div className={`${frame} relative aspect-[9/16] max-w-[270px] rounded-[18px]`}>
      <Thumb i={1} src={media?.kind === "video" ? undefined : media?.url ?? undefined} rounded="rounded-none" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.25), transparent 25%, transparent 55%, rgba(0,0,0,.75))" }} />
      <div className="absolute inset-x-0 top-3 flex justify-center gap-3.5 text-[12.5px]"><span className="text-muted-foreground">Following</span><span className="font-semibold">For You</span></div>
      <div className="absolute bottom-[70px] right-2.5 flex flex-col items-center gap-3.5 text-[10.5px]">
        <UserAvatar i={1} name="K" size={34} />
        {([[Heart, "24.1K"], [MessageCircle, "312"], [Bookmark, "1.8K"], [Share2, "905"]] as const).map(([I, n], i) => (
          <div key={n} className="flex flex-col items-center gap-[3px]"><I size={22} fill={i === 0 ? "rgba(255,255,255,.9)" : "none"} />{n}</div>
        ))}
      </div>
      <div className="absolute bottom-3.5 left-3 right-[60px] text-[12.5px]">
        <div className="font-semibold">{handle}</div>
        <div className="mt-1 line-clamp-3 leading-snug">{text || "Your caption will appear here"}</div>
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px]"><Music2 size={12} />Original sound · kairo.studio</div>
      </div>
    </div>
  );
}

export function LinkedInPreview({ text, media }: Omit<PreviewProps, "handle">) {
  return (
    <div className={`${frame} max-w-[420px]`}>
      <div className="flex gap-2.5 p-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong" style={{ background: "linear-gradient(140deg,#2C3A57,#12151B)" }}><Logo size={18} /></div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold">Kairo Studio</div>
          <div className="text-[11.5px] text-dim">12,904 followers</div>
          <div className="flex items-center gap-1 text-[11.5px] text-dim">1h · <Globe size={10} /></div>
        </div>
      </div>
      <div className="line-clamp-4 whitespace-pre-wrap px-3.5 pb-3 text-[13px]">{text || <Placeholder t="Your post text will appear here" />}</div>
      <Thumb i={2} src={media?.kind === "video" ? undefined : media?.url ?? undefined} video={media?.kind === "video"} rounded="rounded-none" className="h-[210px] w-full" />
      <div className="flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] text-dim">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#4C8DDB]"><ThumbsUp size={8} color="#fff" /></span>342 · 28 comments
      </div>
      <div className="h-px bg-border" />
      <div className="flex justify-around px-1.5 py-2 text-xs text-muted-foreground">
        {([[ThumbsUp, "Like"], [MessageCircle, "Comment"], [Repeat2, "Repost"], [Send, "Send"]] as const).map(([I, l]) => <span key={l} className="flex items-center gap-1.5"><I size={14} />{l}</span>)}
      </div>
    </div>
  );
}

export function XPreview({ text, media, handle }: PreviewProps) {
  const over = text.length > 280;
  return (
    <div className={`${frame} max-w-[420px] p-3.5`}>
      <div className="flex gap-2.5">
        <UserAvatar i={3} name="K" size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px]"><b className="font-semibold">Kairo</b><span className="text-dim">{handle} · now</span></div>
          <div className="mt-[3px] whitespace-pre-wrap text-[13.5px]">
            {text ? (over ? <>{text.slice(0, 280)}<mark className="bg-destructive/20 text-destructive">{text.slice(280)}</mark></> : text) : <Placeholder t="What's happening?" />}
          </div>
          <div className="mt-2.5 overflow-hidden rounded-[14px] border border-border"><Thumb i={3} src={media?.kind === "video" ? undefined : media?.url ?? undefined} video={media?.kind === "video"} rounded="rounded-none" className="h-[190px] w-full" /></div>
          <div className="mt-2.5 flex max-w-[320px] justify-between text-xs text-dim">
            {([[MessageCircle, "24"], [Repeat2, "61"], [Heart, "418"], [ChartColumn, "12K"], [Bookmark, ""]] as const).map(([I, n], i) => <span key={i} className="flex items-center gap-1.5"><I size={14} />{n}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
