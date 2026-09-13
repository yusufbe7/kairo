import "server-only";
import { buildMetaAuthorizeUrl, exchangeForLongLivedToken, listPages, MetaError, requireEnv } from "@/lib/integrations/meta/graph";

/**
 * Instagram connection, through the Instagram Graph API.
 *
 * Publishing only works for a Business or Creator account linked to a Facebook Page —
 * that is Meta's rule, not ours, and personal accounts cannot be published to by any
 * tool. So the flow runs through Facebook's dialog, finds the Page whose linked
 * Instagram account we can post to, and stores that account with the Page's token.
 */
const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

const PAGE_FIELDS =
  "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}";

export async function buildAuthorizeUrl(input: { state: string; redirectUri: string }): Promise<string> {
  const { clientId } = requireEnv("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET");
  return buildMetaAuthorizeUrl({ clientId, redirectUri: input.redirectUri, state: input.state, scopes: SCOPES });
}

export async function exchangeCode(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = requireEnv("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET");

  const { accessToken: userToken } = await exchangeForLongLivedToken({
    clientId, clientSecret, code: input.code, redirectUri: input.redirectUri,
  });

  const pages = await listPages(userToken, PAGE_FIELDS);
  const linked = pages.find((page) => page.instagram_business_account?.id);

  if (!linked?.instagram_business_account) {
    throw new MetaError(
      "NO_INSTAGRAM_ACCOUNT",
      pages.length === 0
        ? "That Facebook account doesn't administer any Page, so there is no Instagram account to connect."
        : "None of your Facebook Pages has an Instagram Business or Creator account linked. Link one in Instagram's settings, then connect again.",
      false,
    );
  }

  const ig = linked.instagram_business_account;

  return {
    externalAccountId: ig.id,
    handle: ig.username ?? ig.name ?? ig.id,
    displayName: ig.name ?? ig.username ?? null,
    avatarUrl: ig.profile_picture_url ?? null,
    scopes: SCOPES,
    // Publishing to Instagram is authorised with the linked Page's token.
    accessToken: linked.access_token,
    refreshToken: null,
    expiresAt: null,
  };
}
