import "server-only";
import { graphGet, graphPost, MetaError } from "@/lib/integrations/meta/graph";
import { getPublishingCredentials, markAccountStatus } from "@/lib/services/accounts";
import { planInstagramPost, type InstagramPlan } from "./media-plan";
import type { Publisher, PublishRequest, PublishResult } from "@/lib/publishing/types";

/**
 * Publishing to Instagram.
 *
 * Always two steps: build a media container, then publish it. Video containers are
 * processed asynchronously, so they have to be polled until Instagram says they are
 * ready — publishing one too early is rejected.
 */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 4 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Container { id: string }

async function createContainer(igId: string, token: string, params: Record<string, string>) {
  const result = await graphPost<Container>(`/${igId}/media`, { access_token: token, ...params });
  return result.id;
}

/**
 * Waits for a video container to finish processing.
 *
 * Running out of time is reported as retryable on purpose: nothing has been published
 * at this point, so another attempt can only cost a wasted container — unlike a retry
 * after publishing, which would post twice.
 */
async function waitUntilReady(containerId: string, token: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { status_code, status } = await graphGet<{ status_code?: string; status?: string }>(`/${containerId}`, {
      access_token: token,
      fields: "status_code,status",
    });

    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") {
      throw new MetaError("MEDIA_REJECTED", status || "Instagram couldn't process that video. Check its format, length and aspect ratio.", false);
    }
    if (status_code === "EXPIRED") {
      throw new MetaError("MEDIA_EXPIRED", "Instagram expired this upload before it could be published.", true);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new MetaError("MEDIA_PROCESSING", "Instagram is still processing this video. Nothing was published; it will be tried again.", true);
}

async function buildContainer(plan: InstagramPlan, caption: string, igId: string, token: string): Promise<string> {
  switch (plan.kind) {
    case "image":
      return createContainer(igId, token, { image_url: plan.url, caption });

    case "reel": {
      const id = await createContainer(igId, token, { media_type: "REELS", video_url: plan.url, caption });
      await waitUntilReady(id, token);
      return id;
    }

    case "story": {
      const id = await createContainer(igId, token, {
        media_type: "STORIES",
        ...(plan.isVideo ? { video_url: plan.url } : { image_url: plan.url }),
      });
      if (plan.isVideo) await waitUntilReady(id, token);
      return id;
    }

    case "carousel": {
      // Children are uploaded first, then gathered into one carousel container.
      const children = await Promise.all(
        plan.urls.map((url) => createContainer(igId, token, { image_url: url, is_carousel_item: "true" })),
      );
      return createContainer(igId, token, { media_type: "CAROUSEL", children: children.join(","), caption });
    }
  }
}

/** The public link to a post. Best effort — a missing permalink must not fail a publish that worked. */
async function permalinkFor(mediaId: string, token: string): Promise<string | undefined> {
  try {
    const { permalink } = await graphGet<{ permalink?: string }>(`/${mediaId}`, { access_token: token, fields: "permalink" });
    return permalink;
  } catch {
    return undefined;
  }
}

async function publishToInstagram(request: PublishRequest, account: { id: string; token: string }): Promise<PublishResult> {
  const planned = planInstagramPost(request.media, request.format);
  if (!planned.ok) throw new MetaError("UNSUPPORTED_MEDIA", planned.reason, false);

  const containerId = await buildContainer(planned.plan, request.caption.trim(), account.id, account.token);

  const published = await graphPost<{ id: string }>(`/${account.id}/media_publish`, {
    access_token: account.token,
    creation_id: containerId,
  });

  return {
    success: true,
    externalPostId: published.id,
    externalUrl: await permalinkFor(published.id, account.token),
  };
}

export const instagramPublisher: Publisher = {
  platform: "instagram",
  async publish(request) {
    try {
      const { externalAccountId, accessToken } = await getPublishingCredentials(request.accountId);
      return await publishToInstagram(request, { id: externalAccountId, token: accessToken });
    } catch (error) {
      if (error instanceof MetaError) {
        if (error.needsReconnect) {
          await markAccountStatus(request.accountId, "expired", "Instagram access was revoked or expired. Reconnect the account.");
        }
        return { success: false, errorCode: error.code, errorMessage: error.message, retryable: error.retryable };
      }
      return {
        success: false,
        errorCode: "PROVIDER_ERROR",
        errorMessage: error instanceof Error ? error.message : "Instagram rejected this post.",
        retryable: true,
      };
    }
  },
};
