import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { canTransition, isEditable, MIN_SCHEDULE_LEAD_MS } from "@/lib/posts/state";
import { cancelActiveJobs, schedulePublishJob } from "@/lib/queue/jobs";
import { signMediaUrls } from "@/lib/services/media";
import { audit } from "@/lib/services/audit";
import { checkLimit, incrementUsage } from "@/lib/services/usage";
import { zonedToUtc, utcToZoned, isValidTimezone } from "@/lib/time";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { ListPostsQuery, PostInput } from "@/lib/validation/posts";
import type { MediaAssetRow, PostMediaRow, PostRow, PostStatus, PostTargetRow } from "@/types/database";
import type { PostView } from "@/types/posts";
import type { PlatformId } from "@/types/social";

type PostJoin = PostRow & {
  post_targets: (PostTargetRow & { social_accounts: { handle: string } | null })[];
  post_media: (PostMediaRow & { media_assets: Pick<MediaAssetRow, "id" | "storage_path" | "kind" | "file_name"> | null })[];
};

const SELECT = `*, post_targets(*, social_accounts(handle)), post_media(position, media_assets(id, storage_path, kind, file_name))`;

/** Stable placeholder-art index so a post without media still looks intentional. */
const thumbFor = (id: string) => Array.from(id.slice(0, 8)).reduce((a, c) => a + c.charCodeAt(0), 0) % 8;

function toView(row: PostJoin, tz: string, urls: Map<string, string>, metrics?: Map<string, { reach: number; engagementRate: number | null }>): PostView {
  const anchor = row.published_at ?? row.scheduled_at ?? row.created_at;
  const { date, time } = utcToZoned(anchor, tz);
  const media = [...(row.post_media ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => (m.media_assets ? [{ id: m.media_assets.id, url: urls.get(m.media_assets.storage_path) ?? null, kind: m.media_assets.kind, name: m.media_assets.file_name }] : []));

  const targets = (row.post_targets ?? []).map((t) => ({
    platform: t.platform, status: t.status, accountHandle: t.social_accounts?.handle ?? null,
    captionOverride: t.caption_override, error: t.last_error, externalUrl: t.external_url,
  }));

  const agg = (row.post_targets ?? []).reduce<{ reach: number; rates: number[] }>((acc, t) => {
    const m = metrics?.get(t.id);
    if (m) { acc.reach += m.reach; if (m.engagementRate != null) acc.rates.push(m.engagementRate); }
    return acc;
  }, { reach: 0, rates: [] });

  return {
    id: row.id, title: row.title || row.caption.split("\n")[0].slice(0, 60), caption: row.caption, format: row.format,
    status: row.status, platforms: targets.map((t) => t.platform), targets, date, time,
    scheduledAt: row.scheduled_at, publishedAt: row.published_at, media, thumb: media.length ? thumbFor(media[0].id) : thumbFor(row.id),
    error: row.last_error ?? targets.find((t) => t.error)?.error ?? null,
    metrics: agg.rates.length || agg.reach ? { reach: agg.reach, engagementRate: agg.rates.length ? +(agg.rates.reduce((a, b) => a + b, 0) / agg.rates.length).toFixed(2) : null } : null,
    createdAt: row.created_at,
  };
}

async function decorate(ctx: WorkspaceContext, rows: PostJoin[]): Promise<PostView[]> {
  const paths = rows.flatMap((r) => (r.post_media ?? []).flatMap((m) => (m.media_assets ? [m.media_assets.storage_path] : [])));
  const targetIds = rows.flatMap((r) => (r.post_targets ?? []).map((t) => t.id));
  const [urls, metrics] = await Promise.all([signMediaUrls([...new Set(paths)]), loadPostMetrics(ctx, targetIds)]);
  return rows.map((r) => toView(r, ctx.workspace.timezone, urls, metrics));
}

async function loadPostMetrics(ctx: WorkspaceContext, targetIds: string[]) {
  const map = new Map<string, { reach: number; engagementRate: number | null }>();
  if (targetIds.length === 0) return map;
  const { data } = await ctx.supabase.from("analytics_post").select("post_target_id, reach, engagement_rate").in("post_target_id", targetIds.slice(0, 500));
  (data ?? []).forEach((m: { post_target_id: string; reach: number | null; engagement_rate: number | null }) =>
    map.set(m.post_target_id, { reach: m.reach ?? 0, engagementRate: m.engagement_rate }));
  return map;
}

export async function listPosts(ctx: WorkspaceContext, query: ListPostsQuery): Promise<{ posts: PostView[]; total: number; counts: Record<string, number> }> {
  let q = ctx.supabase.from("posts").select(SELECT, { count: "exact" }).eq("workspace_id", ctx.workspace.id);
  if (query.status !== "all") q = q.eq("status", query.status);
  if (query.q) q = q.or(`caption.ilike.%${query.q.replace(/[%,]/g, "")}%,title.ilike.%${query.q.replace(/[%,]/g, "")}%`);
  if (query.from) q = q.gte("scheduled_at", zonedToUtc(query.from, "00:00", ctx.workspace.timezone).toISOString());
  if (query.to) q = q.lte("scheduled_at", zonedToUtc(query.to, "23:59", ctx.workspace.timezone).toISOString());
  if (query.platform) {
    const { data: ids } = await ctx.supabase.from("post_targets").select("post_id").eq("workspace_id", ctx.workspace.id).eq("platform", query.platform).limit(1000);
    q = q.in("id", (ids ?? []).map((r: { post_id: string }) => r.post_id).slice(0, 1000));
  }
  const order = query.sort === "scheduled" ? { col: "scheduled_at", asc: true } : { col: "created_at", asc: query.sort === "oldest" };
  const from = (query.page - 1) * query.pageSize;
  const { data, error, count } = await q.order(order.col, { ascending: order.asc, nullsFirst: false }).range(from, from + query.pageSize - 1);
  if (error) throw fromDbError(error);

  return { posts: await decorate(ctx, (data ?? []) as PostJoin[]), total: count ?? 0, counts: await countByStatus(ctx) };
}

export async function countByStatus(ctx: WorkspaceContext): Promise<Record<string, number>> {
  const { data, error } = await ctx.supabase.from("posts").select("status").eq("workspace_id", ctx.workspace.id).limit(5000);
  if (error) throw fromDbError(error);
  const counts: Record<string, number> = { all: (data ?? []).length };
  (data ?? []).forEach((r: { status: PostStatus }) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
  return counts;
}

/** Posts for a calendar window, given as local dates in the workspace timezone. */
export async function listPostsInRange(ctx: WorkspaceContext, fromDate: string, toDate: string): Promise<PostView[]> {
  const tz = ctx.workspace.timezone;
  const from = zonedToUtc(fromDate, "00:00", tz).toISOString();
  const to = zonedToUtc(toDate, "23:59", tz).toISOString();
  const { data, error } = await ctx.supabase
    .from("posts").select(SELECT).eq("workspace_id", ctx.workspace.id)
    .or(`and(scheduled_at.gte.${from},scheduled_at.lte.${to}),and(published_at.gte.${from},published_at.lte.${to}),and(scheduled_at.is.null,published_at.is.null,created_at.gte.${from},created_at.lte.${to})`)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw fromDbError(error);
  return decorate(ctx, (data ?? []) as PostJoin[]);
}

export async function getPost(ctx: WorkspaceContext, postId: string): Promise<PostView> {
  const { data, error } = await ctx.supabase.from("posts").select(SELECT).eq("id", postId).eq("workspace_id", ctx.workspace.id).single();
  if (error || !data) throw new AppError("NOT_FOUND", "We couldn't find that post.");
  return (await decorate(ctx, [data as PostJoin]))[0];
}

export async function getUpcoming(ctx: WorkspaceContext, limit = 4): Promise<PostView[]> {
  const { data, error } = await ctx.supabase
    .from("posts").select(SELECT).eq("workspace_id", ctx.workspace.id).eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(limit);
  if (error) throw fromDbError(error);
  return decorate(ctx, (data ?? []) as PostJoin[]);
}

/** Creates or updates a post, its targets and media, then schedules or publishes it. */
export async function savePost(ctx: WorkspaceContext, input: PostInput): Promise<{ postId: string; status: PostStatus; scheduledAt: string | null }> {
  const nextStatus: PostStatus = input.mode === "draft" ? "draft" : input.mode === "schedule" ? "scheduled" : "publishing";
  if (nextStatus !== "draft" && !can(ctx.role, "post.schedule")) {
    throw new AppError("FORBIDDEN", "Your role can save drafts, but not schedule or publish. Ask an editor to review it.");
  }

  const tz = input.timezone && isValidTimezone(input.timezone) ? input.timezone : ctx.workspace.timezone;
  let scheduledAt: Date | null = null;
  if (input.mode === "schedule") {
    scheduledAt = zonedToUtc(input.date!, input.time!, tz);
    if (scheduledAt.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
      throw new AppError("VALIDATION", "Pick a time at least a minute from now.", { fieldErrors: { date: ["That time has already passed."] } });
    }
  }

  const existing = input.postId ? await loadRow(ctx, input.postId) : null;
  if (existing) {
    if (!isEditable(existing.status)) throw new AppError("CONFLICT", "Published posts can't be edited. Duplicate it to make a new version.");
    if (!canTransition(existing.status, nextStatus)) throw new AppError("CONFLICT", "That post can't move to this state.");
    if (existing.author_id !== ctx.userId && !can(ctx.role, "post.edit_any")) throw new AppError("FORBIDDEN", "You can only edit posts you created.");
  } else {
    await checkLimit(ctx, "posts");
  }

  await assertMediaBelongs(ctx, input.mediaIds);
  const accounts = await resolveAccounts(ctx, input.targets.map((t) => t.platform), input.mode !== "draft");

  const payload = {
    workspace_id: ctx.workspace.id, caption: input.caption, title: input.caption.split("\n")[0].slice(0, 60),
    format: input.format, status: nextStatus, timezone: tz,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : null, last_error: null,
  };

  let postId = input.postId ?? "";
  if (existing) {
    const { error } = await ctx.supabase.from("posts").update(payload).eq("id", existing.id);
    if (error) throw fromDbError(error, "We couldn't save your changes.");
  } else {
    const { data, error } = await ctx.supabase.from("posts").insert({ ...payload, author_id: ctx.userId }).select("id").single();
    if (error) throw fromDbError(error, "We couldn't save this post.");
    postId = (data as { id: string }).id;
    await incrementUsage(ctx.workspace.id, "posts");
  }

  await ctx.supabase.from("post_targets").delete().eq("post_id", postId);
  const { error: targetError } = await ctx.supabase.from("post_targets").insert(
    input.targets.map((t) => ({
      post_id: postId, workspace_id: ctx.workspace.id, platform: t.platform,
      social_account_id: accounts.get(t.platform) ?? null,
      caption_override: t.captionOverride?.trim() ? t.captionOverride : null,
      status: nextStatus === "draft" ? "pending" : "queued",
    })),
  );
  if (targetError) throw fromDbError(targetError, "We couldn't save the platforms for this post.");

  await ctx.supabase.from("post_media").delete().eq("post_id", postId);
  if (input.mediaIds.length) {
    const { error: mediaError } = await ctx.supabase.from("post_media").insert(
      input.mediaIds.map((id, position) => ({ post_id: postId, media_id: id, workspace_id: ctx.workspace.id, position })),
    );
    if (mediaError) throw fromDbError(mediaError, "We couldn't attach your media.");
  }

  if (input.mode === "schedule" && scheduledAt) {
    await schedulePublishJob({ workspaceId: ctx.workspace.id, postId, runAt: scheduledAt });
  } else if (input.mode === "now") {
    await schedulePublishJob({ workspaceId: ctx.workspace.id, postId, runAt: new Date() });
  } else {
    await cancelActiveJobs([postId]);
  }

  await audit({ action: existing ? "post.updated" : `post.${input.mode === "draft" ? "drafted" : input.mode === "schedule" ? "scheduled" : "publish_requested"}`, actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "post", targetId: postId, metadata: { platforms: input.targets.map((t) => t.platform) } });
  return { postId, status: nextStatus, scheduledAt: scheduledAt?.toISOString() ?? null };
}

async function loadRow(ctx: WorkspaceContext, postId: string): Promise<PostRow> {
  const { data, error } = await ctx.supabase.from("posts").select("*").eq("id", postId).eq("workspace_id", ctx.workspace.id).single();
  if (error || !data) throw new AppError("NOT_FOUND", "We couldn't find that post.");
  return data as PostRow;
}

async function assertMediaBelongs(ctx: WorkspaceContext, mediaIds: string[]) {
  if (mediaIds.length === 0) return;
  const { data } = await ctx.supabase.from("media_assets").select("id").eq("workspace_id", ctx.workspace.id).in("id", mediaIds);
  if ((data ?? []).length !== mediaIds.length) throw new AppError("FORBIDDEN", "One of those files isn't in this workspace.");
}

/** Maps each platform to a connected account. Publishing without one is rejected up front. */
async function resolveAccounts(ctx: WorkspaceContext, platforms: PlatformId[], required: boolean) {
  const { data } = await ctx.supabase
    .from("social_accounts").select("id, platform, status, handle").eq("workspace_id", ctx.workspace.id).in("platform", platforms);
  const rows = (data ?? []) as { id: string; platform: PlatformId; status: string; handle: string }[];
  const map = new Map<PlatformId, string>();
  rows.forEach((r) => { if (!map.has(r.platform) && r.status === "connected") map.set(r.platform, r.id); });
  if (required) {
    const missing = platforms.filter((p) => !map.has(p));
    if (missing.length) {
      const names = missing.join(", ");
      throw new AppError("NOT_CONFIGURED", `Connect ${names} before publishing there. You can still save this as a draft.`);
    }
  }
  return map;
}

export async function deletePosts(ctx: WorkspaceContext, postIds: string[]) {
  const rows = await loadMany(ctx, postIds);
  for (const p of rows) {
    if (p.status === "published" && !can(ctx.role, "post.delete_any")) throw new AppError("FORBIDDEN", "Only editors can remove published posts.");
    if (p.author_id !== ctx.userId && !can(ctx.role, "post.delete_any")) throw new AppError("FORBIDDEN", "You can only delete posts you created.");
  }
  await cancelActiveJobs(postIds);
  const { error } = await ctx.supabase.from("posts").delete().in("id", postIds).eq("workspace_id", ctx.workspace.id);
  if (error) throw fromDbError(error, "We couldn't delete those posts.");
  await audit({ action: "post.deleted", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "post", metadata: { count: postIds.length } });
}

export async function reschedulePosts(ctx: WorkspaceContext, postIds: string[], date: string, time: string) {
  const runAt = zonedToUtc(date, time, ctx.workspace.timezone);
  if (runAt.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) throw new AppError("VALIDATION", "Pick a time at least a minute from now.");
  const rows = await loadMany(ctx, postIds);
  for (const p of rows) {
    if (p.status === "published") throw new AppError("CONFLICT", "Published posts can't be moved.");
    if (p.status === "publishing") throw new AppError("CONFLICT", "That post is publishing right now.");
  }
  const { error } = await ctx.supabase
    .from("posts").update({ status: "scheduled", scheduled_at: runAt.toISOString(), last_error: null })
    .in("id", postIds).eq("workspace_id", ctx.workspace.id);
  if (error) throw fromDbError(error, "We couldn't reschedule those posts.");
  await ctx.supabase.from("post_targets").update({ status: "queued", last_error: null }).in("post_id", postIds);
  for (const id of postIds) await schedulePublishJob({ workspaceId: ctx.workspace.id, postId: id, runAt });
  await audit({ action: "post.rescheduled", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "post", metadata: { count: postIds.length, runAt: runAt.toISOString() } });
  return runAt;
}

/** Calendar drag & drop: keeps the time of day, moves the post to another local date. */
export async function movePostToDate(ctx: WorkspaceContext, postId: string, date: string) {
  const post = (await loadMany(ctx, [postId]))[0];
  if (post.status === "published") throw new AppError("CONFLICT", "Published posts can't be moved.");
  const tz = ctx.workspace.timezone;
  const { time } = utcToZoned(post.scheduled_at ?? post.created_at, tz);
  return reschedulePosts(ctx, [postId], date, time);
}

export async function duplicatePost(ctx: WorkspaceContext, postId: string) {
  const source = await getPost(ctx, postId);
  return savePost(ctx, {
    caption: source.caption, format: source.format, mode: "draft", mediaIds: source.media.map((m) => m.id),
    targets: source.targets.map((t) => ({ platform: t.platform, captionOverride: t.captionOverride })),
  } as PostInput);
}

async function loadMany(ctx: WorkspaceContext, postIds: string[]): Promise<PostRow[]> {
  const { data, error } = await ctx.supabase.from("posts").select("*").in("id", postIds).eq("workspace_id", ctx.workspace.id);
  if (error) throw fromDbError(error);
  const rows = (data ?? []) as PostRow[];
  if (rows.length !== postIds.length) throw new AppError("NOT_FOUND", "Some of those posts no longer exist.");
  return rows;
}

/** Requeues the failed targets of a post. */
export async function retryPost(ctx: WorkspaceContext, postId: string) {
  const post = (await loadMany(ctx, [postId]))[0];
  if (post.status !== "failed") throw new AppError("CONFLICT", "Only failed posts can be retried.");
  await ctx.supabase.from("posts").update({ status: "publishing", last_error: null }).eq("id", postId);
  await ctx.supabase.from("post_targets").update({ status: "queued", last_error: null }).eq("post_id", postId).eq("status", "failed");
  await schedulePublishJob({ workspaceId: ctx.workspace.id, postId, runAt: new Date() });
  await audit({ action: "post.retried", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "post", targetId: postId });
}

export async function getDashboardStats(ctx: WorkspaceContext) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [scheduled, published] = await Promise.all([
    admin.from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).eq("status", "scheduled"),
    admin.from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).eq("status", "published").gte("published_at", since),
  ]);
  return { scheduled: scheduled.count ?? 0, published: published.count ?? 0 };
}
