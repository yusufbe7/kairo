import { describe, expect, it } from "vitest";
import { postInputSchema, listPostsSchema } from "@/lib/validation/posts";
import { registerSchema } from "@/lib/validation/auth";
import { mediaKindFor, uploadRequestSchema } from "@/lib/validation/media";

const base = { caption: "Hello world", targets: [{ platform: "instagram" as const }], mediaIds: [], format: "post" as const };

describe("post validation", () => {
  it("requires text or media", () => {
    expect(postInputSchema.safeParse({ ...base, caption: "", mode: "draft" }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...base, caption: "", mediaIds: [crypto.randomUUID()], mode: "draft" }).success).toBe(true);
  });

  it("requires at least one platform", () => {
    expect(postInputSchema.safeParse({ ...base, targets: [], mode: "draft" }).success).toBe(false);
  });

  it("requires a date and time when scheduling", () => {
    expect(postInputSchema.safeParse({ ...base, mode: "schedule" }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...base, mode: "schedule", date: "2026-12-01", time: "10:00" }).success).toBe(true);
  });

  it("enforces per-platform character limits only when publishing", () => {
    const long = "x".repeat(400);
    expect(postInputSchema.safeParse({ ...base, caption: long, targets: [{ platform: "x" }], mode: "draft" }).success).toBe(true);
    expect(postInputSchema.safeParse({ ...base, caption: long, targets: [{ platform: "x" }], mode: "now" }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...base, caption: long, targets: [{ platform: "instagram" }], mode: "now" }).success).toBe(true);
  });

  it("falls back to safe defaults for malformed list queries", () => {
    const parsed = listPostsSchema.parse({});
    expect(parsed.status).toBe("all");
    expect(parsed.page).toBe(1);
    expect(listPostsSchema.safeParse({ page: -5 }).success).toBe(false);
  });
});

describe("auth validation", () => {
  it("rejects short passwords and bad emails", () => {
    expect(registerSchema.safeParse({ fullName: "A", email: "nope", password: "secret12" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "A", email: "a@b.com", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "A", email: "a@b.com", password: "secret12" }).success).toBe(true);
  });

  it("normalizes email casing", () => {
    const parsed = registerSchema.parse({ fullName: "A", email: "  UPPER@Example.COM ", password: "secret12" });
    expect(parsed.email).toBe("upper@example.com");
  });
});

describe("media validation", () => {
  it("rejects unsupported file types", () => {
    expect(uploadRequestSchema.safeParse({ fileName: "a.exe", mimeType: "application/x-msdownload", sizeBytes: 10 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ fileName: "a.png", mimeType: "image/png", sizeBytes: 10 }).success).toBe(true);
  });

  it("classifies media kinds", () => {
    expect(mediaKindFor("image/gif")).toBe("gif");
    expect(mediaKindFor("video/mp4")).toBe("video");
    expect(mediaKindFor("image/png")).toBe("image");
  });
});
