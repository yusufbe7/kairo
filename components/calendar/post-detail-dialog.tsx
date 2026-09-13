"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { Thumb } from "@/components/social/thumb";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { deletePosts, retryPost } from "@/lib/actions/posts";
import { run } from "@/lib/client/action";
import { PLATFORMS } from "@/lib/platforms";
import { fmtTime, relDay } from "@/lib/format";
import type { PostView } from "@/types/posts";

export function PostDetailDialog({ post, onClose }: { post: PostView | null; onClose: () => void }) {
  const router = useRouter();
  const { today, can } = useWorkspace();
  const [pending, start] = useTransition();

  const remove = () => start(async () => {
    if (post && (await run(deletePosts({ postIds: [post.id] }), { success: "Post deleted" }))) { onClose(); router.refresh(); }
  });
  const retry = () => start(async () => {
    if (post && (await run(retryPost({ postId: post.id }), { success: "Retrying now" }))) { onClose(); router.refresh(); }
  });

  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[440px]">
        {post && (
          <>
            <div className="mb-3.5 flex items-center gap-2.5 pr-8">
              {post.platforms[0] && <PlatformIcon platform={post.platforms[0]} size={30} />}
              <div>
                <DialogTitle className="text-sm font-medium">{post.platforms.map((p) => PLATFORMS[p].name).join(" · ")}</DialogTitle>
                <DialogDescription className="mt-0 text-xs text-dim">{relDay(post.date, today)} · {fmtTime(post.time)}</DialogDescription>
              </div>
            </div>

            <Thumb i={post.thumb} src={post.media[0]?.url ?? undefined} video={post.media[0]?.kind === "video"} className="h-[200px] w-full" rounded="rounded-xl" />
            <p className="mt-3.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13.5px]">{post.caption}</p>

            {post.error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                <TriangleAlert size={13} className="mt-px shrink-0" />{post.error}
              </div>
            )}

            {post.status === "published" && post.targets.some((t) => t.externalUrl) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.targets.filter((t) => t.externalUrl).map((t) => (
                  <a key={t.platform} href={t.externalUrl!} target="_blank" rel="noreferrer" className="chip h-7">
                    <ExternalLink size={12} />View on {PLATFORMS[t.platform].name}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <StatusBadge tone={post.status === "publishing" ? "scheduled" : post.status} />
              <div className="flex gap-2">
                {post.status === "failed" && can("post.publish") && (
                  <Button size="sm" onClick={retry} disabled={pending}>{pending ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}Retry</Button>
                )}
                {can("post.draft") && <Button size="sm" onClick={remove} disabled={pending}><Trash2 size={13} />Delete</Button>}
                {post.status !== "published" && (
                  <Button size="sm" variant="primary" asChild><Link href={`/create?post=${post.id}`}><Pencil size={13} />Edit</Link></Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
