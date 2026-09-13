import Link from "next/link";
import { Clock } from "lucide-react";
import { Thumb } from "@/components/social/thumb";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { fmtTime, relDay } from "@/lib/format";
import type { PostView } from "@/types/posts";

export function PostCard({ post, today, href }: { post: PostView; today: string; href?: string }) {
  return (
    <Link href={href ?? `/create?post=${post.id}`} className="surface surface-lift block p-2.5 text-left">
      <div className="relative">
        <Thumb i={post.thumb} src={post.media[0]?.url ?? undefined} video={post.media[0]?.kind === "video"} className="h-32 w-full" />
        {post.platforms[0] && <div className="absolute left-2 top-2"><PlatformIcon platform={post.platforms[0]} size={24} /></div>}
      </div>
      <div className="px-1 pb-1 pt-3">
        <div className="truncate text-[13.5px] font-medium">{post.caption || post.title}</div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock size={12} />{relDay(post.date, today)} · {fmtTime(post.time)}</span>
          <StatusBadge tone={post.status === "publishing" ? "scheduled" : post.status} />
        </div>
      </div>
    </Link>
  );
}
