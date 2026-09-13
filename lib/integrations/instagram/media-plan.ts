import type { PublishRequest } from "@/lib/publishing/types";

/**
 * What Instagram will accept for a given post, decided before any network call.
 *
 * Instagram's rules are strict and unlike the other platforms': no text-only posts,
 * carousels of two to ten, video goes out as a Reel. Working them out here keeps the
 * publisher free of branching and makes every rule directly testable.
 */
export type InstagramPlan =
  | { kind: "image"; url: string }
  | { kind: "carousel"; urls: string[] }
  | { kind: "reel"; url: string }
  | { kind: "story"; url: string; isVideo: boolean };

export const CAROUSEL_MAX = 10;

export type PlanResult =
  | { ok: true; plan: InstagramPlan }
  | { ok: false; reason: string };

export function planInstagramPost(
  media: PublishRequest["media"],
  format: PublishRequest["format"],
): PlanResult {
  if (media.length === 0) {
    return { ok: false, reason: "Instagram posts need at least one photo or video — text on its own can't be published." };
  }

  const videos = media.filter((m) => m.kind === "video");
  const images = media.filter((m) => m.kind !== "video");

  if (format === "story") {
    if (media.length > 1) {
      return { ok: false, reason: "A story takes a single photo or video. Post the rest separately." };
    }
    return { ok: true, plan: { kind: "story", url: media[0].url, isVideo: videos.length === 1 } };
  }

  if (videos.length > 1) {
    return { ok: false, reason: "Instagram takes one video per post. Post the others separately." };
  }

  if (videos.length === 1) {
    if (images.length > 0) {
      // Mixed carousels exist in the API but each video child needs its own processing
      // poll; until that is built, saying so beats a post that silently loses the video.
      return { ok: false, reason: "Mixing a video with photos in one Instagram post isn't supported yet. Post the video on its own." };
    }
    // Instagram publishes feed video as Reels, whichever format was asked for.
    return { ok: true, plan: { kind: "reel", url: videos[0].url } };
  }

  if (images.length === 1) return { ok: true, plan: { kind: "image", url: images[0].url } };

  if (images.length > CAROUSEL_MAX) {
    return { ok: false, reason: `An Instagram carousel holds up to ${CAROUSEL_MAX} photos. This post has ${images.length}.` };
  }

  return { ok: true, plan: { kind: "carousel", urls: images.map((m) => m.url) } };
}
