import "server-only";
import { graphPost, MetaError } from "@/lib/integrations/meta/graph";
import { getPublishingCredentials, markAccountStatus } from "@/lib/services/accounts";
import type { Publisher, PublishRequest, PublishResult } from "@/lib/publishing/types";

/**
 * Publishing to a Facebook Page.
 *
 * Three shapes, because the Graph API has three endpoints rather than one:
 *   text only        → /{page}/feed
 *   one photo        → /{page}/photos
 *   several photos   → each uploaded unpublished, then attached to one /{page}/feed post
 *   video            → /{page}/videos
 *
 * Media is handed over as a URL rather than bytes: Facebook fetches it itself, and the
 * signed Supabase links the worker passes in are reachable for an hour, which is ample.
 */
async function publishToPage(request: PublishRequest, page: { id: string; token: string }): Promise<PublishResult> {
  const caption = request.caption.trim();
  const images = request.media.filter((m) => m.kind === "image" || m.kind === "gif");
  const video = request.media.find((m) => m.kind === "video");

  if (!caption && request.media.length === 0) {
    throw new MetaError("EMPTY_POST", "A Facebook post needs text or media.", false);
  }

  if (video) {
    const result = await graphPost<{ id: string }>(`/${page.id}/videos`, {
      access_token: page.token,
      file_url: video.url,
      description: caption,
    });
    return { success: true, externalPostId: result.id, externalUrl: `https://www.facebook.com/${result.id}` };
  }

  if (images.length === 1) {
    const result = await graphPost<{ id: string; post_id?: string }>(`/${page.id}/photos`, {
      access_token: page.token,
      url: images[0].url,
      caption,
    });
    const postId = result.post_id ?? result.id;
    return { success: true, externalPostId: postId, externalUrl: `https://www.facebook.com/${postId}` };
  }

  if (images.length > 1) {
    // Unpublished uploads first: each returns a media id that the real post attaches,
    // so several photos become one post instead of several.
    const attachments = await Promise.all(
      images.map((image) =>
        graphPost<{ id: string }>(`/${page.id}/photos`, {
          access_token: page.token,
          url: image.url,
          published: "false",
        }),
      ),
    );
    const params: Record<string, string> = { access_token: page.token, message: caption };
    attachments.forEach((attachment, index) => {
      params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: attachment.id });
    });
    const result = await graphPost<{ id: string }>(`/${page.id}/feed`, params);
    return { success: true, externalPostId: result.id, externalUrl: `https://www.facebook.com/${result.id}` };
  }

  const result = await graphPost<{ id: string }>(`/${page.id}/feed`, {
    access_token: page.token,
    message: caption,
  });
  return { success: true, externalPostId: result.id, externalUrl: `https://www.facebook.com/${result.id}` };
}

export const facebookPublisher: Publisher = {
  platform: "facebook",
  async publish(request) {
    try {
      const { externalAccountId, accessToken } = await getPublishingCredentials(request.accountId);
      return await publishToPage(request, { id: externalAccountId, token: accessToken });
    } catch (error) {
      if (error instanceof MetaError) {
        // A revoked token will fail the same way forever, so say so on the account itself
        // rather than letting the post retry into the same wall.
        if (error.needsReconnect) {
          await markAccountStatus(request.accountId, "expired", "Facebook access was revoked or expired. Reconnect the Page.");
        }
        return { success: false, errorCode: error.code, errorMessage: error.message, retryable: error.retryable };
      }
      return {
        success: false,
        errorCode: "PROVIDER_ERROR",
        errorMessage: error instanceof Error ? error.message : "Facebook rejected this post.",
        retryable: true,
      };
    }
  },
};
