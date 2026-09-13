"use client";

import { motion } from "framer-motion";
import { PlatformGlyph } from "@/components/social/platform-icon";
import { Thumb } from "@/components/social/thumb";
import { fmtTime } from "@/lib/format";
import type { PostView } from "@/types/posts";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<PostView["status"], string> = {
  scheduled: "", publishing: "bg-brand", published: "bg-success", failed: "bg-destructive", draft: "bg-dim",
};

export function CalendarCard({ post, variant = "compact", dragging, landed, draggable, onDragStart, onDragEnd, onOpen }: {
  post: PostView; variant?: "compact" | "large"; dragging?: boolean; landed?: boolean; draggable?: boolean;
  onDragStart: (id: string) => void; onDragEnd: () => void; onOpen: (post: PostView) => void;
}) {
  return (
    <motion.div layout="position" layoutId={`cal-${post.id}`} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
      <div
        draggable={draggable}
        role="button"
        tabIndex={0}
        title={post.caption}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(post.id); }}
        onDragEnd={onDragEnd}
        onClick={(e) => { e.stopPropagation(); onOpen(post); }}
        onKeyDown={(e) => e.key === "Enter" && onOpen(post)}
        className={cn(
          "mt-1 flex items-center gap-1.5 rounded-[7px] border border-border bg-white/[0.04] p-1 pr-1.5 text-[11px] transition-[transform,border-color,box-shadow,opacity] hover:-translate-y-px hover:border-border-strong hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.8)]",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          variant === "large" && "flex-col items-start gap-2 p-2",
          dragging && "scale-[0.97] opacity-35",
          landed && "animate-landed",
        )}
      >
        {variant === "large" ? (
          <>
            <Thumb i={post.thumb} src={post.media[0]?.url ?? undefined} className="h-[70px] w-full" rounded="rounded-md" />
            <div className="flex w-full items-center gap-1.5">
              {post.platforms[0] && <PlatformGlyph platform={post.platforms[0]} size={12} />}
              <span className="text-dim">{fmtTime(post.time)}</span>
              {post.status !== "scheduled" && <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", STATUS_DOT[post.status])} />}
            </div>
            <div className="line-clamp-2 text-[11.5px] leading-snug">{post.title}</div>
          </>
        ) : (
          <>
            <Thumb i={post.thumb} src={post.media[0]?.url ?? undefined} className="h-7 w-7" rounded="rounded-[5px]" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate">{post.title}</div>
              <div className="flex items-center gap-1 text-[10.5px] text-dim">
                {post.platforms[0] && <PlatformGlyph platform={post.platforms[0]} size={10} />}
                {post.platforms.length > 1 && <span>+{post.platforms.length - 1}</span>}
                {fmtTime(post.time)}
              </div>
            </div>
            {post.status !== "scheduled" && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[post.status])} />}
          </>
        )}
      </div>
    </motion.div>
  );
}
