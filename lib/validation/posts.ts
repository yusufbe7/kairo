import { z } from "zod";
import { ALL_PLATFORMS, CHAR_LIMITS } from "@/lib/platforms";
import type { PlatformId } from "@/types/social";

export const platformSchema = z.enum(ALL_PLATFORMS as [PlatformId, ...PlatformId[]]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

export const targetInputSchema = z.object({
  platform: platformSchema,
  captionOverride: z.string().max(63206).nullable().optional(),
});

export const postInputSchema = z
  .object({
    postId: z.string().uuid().optional(),
    caption: z.string().max(63206).default(""),
    format: z.enum(["post", "reel", "story", "thread"]).default("post"),
    targets: z.array(targetInputSchema).min(1, "Choose at least one platform to publish to.").max(7),
    mediaIds: z.array(z.string().uuid()).max(10, "You can attach up to 10 files.").default([]),
    mode: z.enum(["draft", "schedule", "now"]),
    date: dateSchema.optional(),
    time: timeSchema.optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.caption.trim() && v.mediaIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["caption"], message: "Add some text or media before you continue." });
    }
    if (v.mode === "schedule" && (!v.date || !v.time)) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "Pick a date and time to schedule." });
    }
    if (v.mode !== "draft") {
      for (const t of v.targets) {
        const text = t.captionOverride ?? v.caption;
        if (text.length > CHAR_LIMITS[t.platform]) {
          ctx.addIssue({ code: "custom", path: ["caption"], message: `Your ${t.platform === "x" ? "X" : t.platform} version is over ${CHAR_LIMITS[t.platform]} characters.` });
        }
      }
    }
  });

export type PostInput = z.infer<typeof postInputSchema>;

export const rescheduleSchema = z.object({
  postIds: z.array(z.string().uuid()).min(1).max(100),
  date: dateSchema,
  time: timeSchema,
});

export const moveToDateSchema = z.object({ postId: z.string().uuid(), date: dateSchema });
export const idsSchema = z.object({ postIds: z.array(z.string().uuid()).min(1).max(100) });

export const listPostsSchema = z.object({
  status: z.enum(["all", "draft", "scheduled", "publishing", "published", "failed"]).default("all"),
  q: z.string().trim().max(100).optional(),
  platform: platformSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  sort: z.enum(["newest", "oldest", "scheduled"]).default("newest"),
});
export type ListPostsQuery = z.infer<typeof listPostsSchema>;
