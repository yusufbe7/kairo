"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, LoaderCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { Thumb } from "@/components/social/thumb";
import { RescheduleDialog } from "./reschedule-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { deletePosts, duplicatePost, reschedulePosts, retryPost } from "@/lib/actions/posts";
import { run } from "@/lib/client/action";
import { PLATFORMS, MAIN_PLATFORMS } from "@/lib/platforms";
import { fmtNum, fmtTime, relDay } from "@/lib/format";
import type { PostView } from "@/types/posts";
import { cn } from "@/lib/utils";

const TABS: [string, string][] = [["all", "All"], ["scheduled", "Scheduled"], ["published", "Published"], ["draft", "Drafts"], ["failed", "Failed"]];

export interface PostsQuery { status: string; q: string; platform: string; page: number; pageSize: number; sort: string }

export function PostsView({ posts, counts, total, query }: { posts: PostView[]; counts: Record<string, number>; total: number; query: PostsQuery }) {
  const router = useRouter();
  const { today, can } = useWorkspace();
  const [search, setSearch] = useState(query.q);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rescheduling, setRescheduling] = useState<PostView[] | null>(null);
  const [confirming, setConfirming] = useState<PostView[] | null>(null);
  const [pending, start] = useTransition();

  /** Filters live in the URL so the server does the querying and links stay shareable. */
  const setParam = (updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { tab: query.status, q: query.q, platform: query.platform, sort: query.sort, page: 1, ...updates };
    Object.entries(merged).forEach(([k, v]) => {
      if (v === undefined || v === "" || v === "all" || (k === "page" && v === 1) || (k === "sort" && v === "newest")) return;
      params.set(k, String(v));
    });
    router.push(`/posts${params.toString() ? `?${params}` : ""}`, { scroll: false });
    setSelectedIds([]);
  };

  const refresh = () => { setSelectedIds([]); router.refresh(); };
  const selected = posts.filter((p) => selectedIds.includes(p.id));
  const allSelected = posts.length > 0 && selectedIds.length === posts.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const hasFilters = Boolean(query.q || query.platform !== "all");

  const remove = (targets: PostView[]) => start(async () => {
    if (await run(deletePosts({ postIds: targets.map((p) => p.id) }), { success: targets.length > 1 ? `${targets.length} posts deleted` : "Post deleted" })) {
      setConfirming(null);
      refresh();
    }
  });
  const duplicate = (post: PostView) => start(async () => {
    if (await run(duplicatePost({ postId: post.id }), { success: "Duplicated as draft" })) refresh();
  });
  const retry = (post: PostView) => start(async () => {
    if (await run(retryPost({ postId: post.id }), { success: "Retrying now" })) refresh();
  });
  const reschedule = (date: string, time: string) => start(async () => {
    if (!rescheduling) return;
    if (await run(reschedulePosts({ postIds: rescheduling.map((p) => p.id), date, time }), { success: `Rescheduled for ${relDay(date, today)} at ${fmtTime(time)}` })) {
      setRescheduling(null);
      refresh();
    }
  });

  return (
    <>
      <PageHeader title="Posts" description="Everything you've written, scheduled, and shipped.">
        {can("post.draft") && <Button variant="primary" asChild><Link href="/create"><Plus size={15} />Create post</Link></Button>}
      </PageHeader>

      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={query.status === value} onClick={() => setParam({ tab: value })}
            className={cn("-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-[1.5px] border-transparent px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground", query.status === value && "border-foreground text-foreground")}>
            {label}<span className={cn("text-[11px] text-dim", value === "failed" && counts.failed && "text-destructive")}>{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <form className="relative max-w-[360px] flex-[1_1_240px]" onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }}>
          <Search size={14} className="absolute left-3 top-[11px] text-dim" />
          <Input className="pl-8" placeholder="Search posts" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search posts" />
        </form>
        <Select className="w-40" value={query.platform} onChange={(e) => setParam({ platform: e.target.value })} aria-label="Platform">
          <option value="all">All platforms</option>
          {MAIN_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORMS[p].name}</option>)}
        </Select>
        <Select className="w-40" value={query.sort} onChange={(e) => setParam({ sort: e.target.value })} aria-label="Sort">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="scheduled">By schedule</option>
        </Select>
        {hasFilters && <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setParam({ q: "", platform: "all" }); }}><X size={13} />Clear</Button>}
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border-strong bg-white/[0.03] px-3.5 py-2.5">
          <span className="text-[13px]">{selectedIds.length} selected</span>
          <div className="flex-1" />
          {can("post.schedule") && <Button size="sm" onClick={() => setRescheduling(selected)}><CalendarDays size={13} />Reschedule</Button>}
          {can("post.draft") && <Button size="sm" variant="danger" onClick={() => setConfirming(selected)}><Trash2 size={13} />Delete</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Cancel</Button>
        </div>
      )}

      <div className="surface">
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-dim">
                <th className="w-10 border-b border-border px-4 py-3">
                  <input type="checkbox" aria-label="Select all" className="accent-white" checked={allSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? posts.map((p) => p.id) : [])} />
                </th>
                {["Post", "Platform", "Status", "Scheduled", "Engagement", ""].map((h, i) => <th key={i} className="border-b border-border px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="row-hover border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" aria-label={`Select ${p.title}`} className="accent-white" checked={selectedIds.includes(p.id)}
                      onChange={(e) => setSelectedIds((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
                  </td>
                  <td className="max-w-[380px] px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Thumb i={p.thumb} src={p.media[0]?.url ?? undefined} className="h-11 w-11" rounded="rounded-[9px]" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.title || "Untitled"}</div>
                        {p.error ? <div className="truncate text-xs text-destructive">{p.error}</div> : <div className="truncate text-xs text-dim">{p.caption}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {p.platforms.slice(0, 3).map((pl) => <PlatformIcon key={pl} platform={pl} size={24} />)}
                      {p.platforms.length > 3 && <span className="text-xs text-dim">+{p.platforms.length - 3}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge tone={p.status === "publishing" ? "scheduled" : p.status}>{p.status === "publishing" ? "Publishing" : undefined}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{relDay(p.date, today)}, {fmtTime(p.time)}</td>
                  <td className="px-4 py-2.5">
                    {p.metrics ? <span><b className="font-semibold">{p.metrics.engagementRate ?? 0}%</b> <span className="text-dim">· {fmtNum(p.metrics.reach)} reach</span></span> : <span className="text-dim">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Post actions">{pending ? <LoaderCircle size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}</Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {p.status !== "published" && <DropdownMenuItem asChild><Link href={`/create?post=${p.id}`}><Pencil />Edit</Link></DropdownMenuItem>}
                        {can("post.draft") && <DropdownMenuItem onSelect={() => duplicate(p)}><Copy />Duplicate</DropdownMenuItem>}
                        {p.status === "failed" && can("post.publish") && <DropdownMenuItem onSelect={() => retry(p)}><RefreshCw />Retry now</DropdownMenuItem>}
                        {p.status !== "published" && can("post.schedule") && <DropdownMenuItem onSelect={() => setRescheduling([p])}><CalendarDays />Reschedule</DropdownMenuItem>}
                        {can("post.draft") && <><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={() => setConfirming([p])}><Trash2 />Delete</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {posts.length === 0 && (
          <EmptyState icon={Search} title={query.q ? `No posts match “${query.q}”` : "No posts here yet"}
            text={query.q ? "Try a different keyword or clear your filters." : "Posts you create will appear in this list."}
            action={hasFilters
              ? <Button size="sm" onClick={() => { setSearch(""); setParam({ q: "", platform: "all", tab: "all" }); }}>Clear filters</Button>
              : can("post.draft") ? <Button size="sm" variant="primary" asChild><Link href="/create">Create your first post</Link></Button> : undefined} />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>Page {query.page} of {totalPages} · {total} posts</span>
          <div className="flex gap-2">
            <Button size="sm" disabled={query.page <= 1} onClick={() => setParam({ page: query.page - 1 })}><ChevronLeft size={14} />Previous</Button>
            <Button size="sm" disabled={query.page >= totalPages} onClick={() => setParam({ page: query.page + 1 })}>Next<ChevronRight size={14} /></Button>
          </div>
        </div>
      )}

      <RescheduleDialog posts={rescheduling} onClose={() => setRescheduling(null)} onSave={reschedule} pending={pending} />
      <ConfirmDialog
        open={!!confirming?.length}
        title={confirming && confirming.length > 1 ? `Delete ${confirming.length} posts?` : "Delete this post?"}
        description="This can't be undone. Any scheduled publishing job will be canceled."
        confirmLabel="Delete"
        pending={pending}
        onConfirm={() => confirming && remove(confirming)}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
