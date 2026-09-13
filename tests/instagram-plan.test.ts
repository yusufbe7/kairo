import { describe, expect, it } from "vitest";
import { CAROUSEL_MAX, planInstagramPost } from "@/lib/integrations/instagram/media-plan";
import type { PublishRequest } from "@/lib/publishing/types";

const image = (n = 1): PublishRequest["media"] =>
  Array.from({ length: n }, (_, i) => ({ url: `https://cdn.test/${i}.jpg`, mimeType: "image/jpeg", kind: "image" as const }));
const video: PublishRequest["media"] = [{ url: "https://cdn.test/clip.mp4", mimeType: "video/mp4", kind: "video" }];

describe("planInstagramPost", () => {
  it("refuses a text-only post", () => {
    const result = planInstagramPost([], "post");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/at least one photo or video/i);
  });

  it("sends a single photo as an image", () => {
    expect(planInstagramPost(image(1), "post")).toEqual({ ok: true, plan: { kind: "image", url: "https://cdn.test/0.jpg" } });
  });

  it("gathers several photos into a carousel", () => {
    const result = planInstagramPost(image(3), "post");
    expect(result.ok && result.plan.kind).toBe("carousel");
    expect(result.ok && result.plan.kind === "carousel" && result.plan.urls).toHaveLength(3);
  });

  it("refuses a carousel over the limit", () => {
    expect(planInstagramPost(image(CAROUSEL_MAX), "post").ok).toBe(true);
    expect(planInstagramPost(image(CAROUSEL_MAX + 1), "post").ok).toBe(false);
  });

  it("publishes video as a reel, whichever format was asked for", () => {
    expect(planInstagramPost(video, "post")).toEqual({ ok: true, plan: { kind: "reel", url: video[0].url } });
    expect(planInstagramPost(video, "reel")).toEqual({ ok: true, plan: { kind: "reel", url: video[0].url } });
  });

  it("refuses to mix a video with photos rather than dropping one", () => {
    const result = planInstagramPost([...image(2), ...video], "post");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/video on its own/i);
  });

  it("refuses more than one video", () => {
    expect(planInstagramPost([...video, ...video], "post").ok).toBe(false);
  });

  it("takes exactly one item for a story, video or photo", () => {
    expect(planInstagramPost(image(1), "story")).toEqual({ ok: true, plan: { kind: "story", url: "https://cdn.test/0.jpg", isVideo: false } });
    expect(planInstagramPost(video, "story")).toEqual({ ok: true, plan: { kind: "story", url: video[0].url, isVideo: true } });
    expect(planInstagramPost(image(2), "story").ok).toBe(false);
  });
});
