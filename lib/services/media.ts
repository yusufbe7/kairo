import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import { mediaKindFor, IMAGE_MAX_BYTES } from "@/lib/validation/media";
import { env } from "@/lib/env";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { MediaAssetRow } from "@/types/database";
import type { MediaView } from "@/types/posts";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Signed URLs for private objects, resolved in one batch. */
export async function signMediaUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await createAdminClient().storage.from("media").createSignedUrls(paths, SIGNED_URL_TTL);
  data?.forEach((item) => { if (item.signedUrl && item.path) map.set(item.path, item.signedUrl); });
  return map;
}

export async function listMedia(ctx: WorkspaceContext): Promise<MediaView[]> {
  const { data, error } = await ctx.supabase
    .from("media_assets")
    .select("*, post_media(post_id)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);

  const rows = (data ?? []) as (MediaAssetRow & { post_media: { post_id: string }[] })[];
  const urls = await signMediaUrls(rows.map((r) => r.storage_path));
  return rows.map((r) => ({
    id: r.id, name: r.file_name, kind: r.kind, mimeType: r.mime_type, url: urls.get(r.storage_path) ?? null,
    sizeBytes: r.size_bytes, width: r.width, height: r.height, createdAt: r.created_at, uses: r.post_media?.length ?? 0,
  }));
}

/**
 * Validates an upload request and returns the storage path the browser must use.
 * The path is workspace-scoped; both the storage policy and a DB check constraint enforce it.
 */
export function planUpload(ctx: WorkspaceContext, input: { fileName: string; mimeType: string; sizeBytes: number }) {
  const kind = mediaKindFor(input.mimeType);
  const max = kind === "video" ? env().MEDIA_MAX_BYTES : IMAGE_MAX_BYTES;
  if (input.sizeBytes > max) {
    throw new AppError("VALIDATION", `That file is too large. The limit is ${Math.round(max / 1024 / 1024)} MB for ${kind === "video" ? "videos" : "images"}.`);
  }
  const ext = (input.fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return { path: `${ctx.workspace.id}/${crypto.randomUUID()}.${ext}`, kind, bucket: "media" as const };
}

/** Records an uploaded object. Verifies the object exists and matches what the client claimed. */
export async function registerMedia(ctx: WorkspaceContext, input: { path: string; fileName: string; width: number | null; height: number | null; durationSeconds: number | null }) {
  if (!input.path.startsWith(`${ctx.workspace.id}/`)) throw new AppError("FORBIDDEN", "That upload doesn't belong to this workspace.");

  const admin = createAdminClient();
  const folder = input.path.split("/")[0];
  const name = input.path.split("/").slice(1).join("/");
  const { data: found } = await admin.storage.from("media").list(folder, { search: name, limit: 1 });
  const object = found?.[0];
  if (!object) throw new AppError("NOT_FOUND", "We couldn't find that upload. Please try again.");

  const mimeType = (object.metadata?.mimetype as string | undefined) ?? "application/octet-stream";
  const sizeBytes = Number(object.metadata?.size ?? 0);
  const kind = mediaKindFor(mimeType);
  const max = kind === "video" ? env().MEDIA_MAX_BYTES : IMAGE_MAX_BYTES;
  if (sizeBytes <= 0 || sizeBytes > max) {
    await admin.storage.from("media").remove([input.path]);
    throw new AppError("VALIDATION", "That file is too large.");
  }

  const { data, error } = await ctx.supabase
    .from("media_assets")
    .insert({
      workspace_id: ctx.workspace.id, uploaded_by: ctx.userId, storage_path: input.path, file_name: input.fileName,
      mime_type: mimeType, kind, size_bytes: sizeBytes, width: input.width, height: input.height, duration_seconds: input.durationSeconds,
    })
    .select("*")
    .single();
  if (error) throw fromDbError(error, "We couldn't save that file.");

  const row = data as MediaAssetRow;
  const urls = await signMediaUrls([row.storage_path]);
  return {
    id: row.id, name: row.file_name, kind: row.kind, mimeType: row.mime_type, url: urls.get(row.storage_path) ?? null,
    sizeBytes: row.size_bytes, width: row.width, height: row.height, createdAt: row.created_at, uses: 0,
  } satisfies MediaView;
}

export async function deleteMedia(ctx: WorkspaceContext, mediaId: string) {
  const { data, error } = await ctx.supabase.from("media_assets").select("storage_path").eq("id", mediaId).eq("workspace_id", ctx.workspace.id).single();
  if (error || !data) throw new AppError("NOT_FOUND", "We couldn't find that file.");
  const { error: delError } = await ctx.supabase.from("media_assets").delete().eq("id", mediaId);
  if (delError) throw fromDbError(delError, "We couldn't delete that file.");
  await createAdminClient().storage.from("media").remove([(data as { storage_path: string }).storage_path]);
}
