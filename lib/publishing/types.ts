import type { PlatformId } from "@/types/social";

/** Normalized result every publisher must return, whatever the provider's own API looks like. */
export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Transient errors are retried with backoff; permanent ones (bad credentials, rejected media) are not. */
  retryable?: boolean;
}

export interface PublishRequest {
  platform: PlatformId;
  accountId: string;
  caption: string;
  media: { url: string; mimeType: string; kind: "image" | "video" | "gif" }[];
  format: "post" | "reel" | "story" | "thread";
}

export interface Publisher {
  platform: PlatformId;
  publish(request: PublishRequest): Promise<PublishResult>;
}
