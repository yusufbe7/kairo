import type { MediaKind, PostFormat, PostStatus, TargetStatus } from "./database";
import type { PlatformId } from "./social";

export type { PostStatus, PostFormat };

export interface PostTargetView {
  platform: PlatformId;
  status: TargetStatus;
  accountHandle: string | null;
  captionOverride: string | null;
  error: string | null;
  externalUrl: string | null;
}

export interface PostMediaView { id: string; url: string | null; kind: MediaKind; name: string }

/** A post as the UI consumes it. Dates are already converted to the workspace timezone. */
export interface PostView {
  id: string;
  title: string;
  caption: string;
  format: PostFormat;
  status: PostStatus;
  platforms: PlatformId[];
  targets: PostTargetView[];
  /** Local calendar day (YYYY-MM-DD) the post belongs to: scheduled / published / created date. */
  date: string;
  /** Local time HH:mm for `date`. */
  time: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  media: PostMediaView[];
  /** Stable index for placeholder art when a post has no media. */
  thumb: number;
  error: string | null;
  metrics: { reach: number; engagementRate: number | null } | null;
  createdAt: string;
}

export interface MediaView {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  url: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  uses: number;
}

/** Content handed from another screen into the editor (AI Studio → editor). */
export interface DraftHandoff { text: string }
