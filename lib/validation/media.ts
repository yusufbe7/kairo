import { z } from "zod";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"] as const;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_MIME, { errorMap: () => ({ message: "That file type isn't supported. Use JPG, PNG, WebP, GIF, MP4, MOV or WebM." }) }),
  sizeBytes: z.number().int().positive(),
});

export const registerMediaSchema = z.object({
  path: z.string().min(10).max(300),
  fileName: z.string().trim().min(1).max(200),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  durationSeconds: z.number().positive().max(60 * 60 * 3).nullable(),
});

export function mediaKindFor(mime: string): "image" | "video" | "gif" {
  if (mime === "image/gif") return "gif";
  return mime.startsWith("video/") ? "video" : "image";
}
