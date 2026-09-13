import "server-only";
import { assertPermissions, buildMetaAuthorizeUrl, exchangeForLongLivedToken, graphGet, listPages, loginConfigId, MetaError, requireEnv } from "@/lib/integrations/meta/graph";
import type { ConnectableAccount, ExchangeResult } from "@/lib/integrations/types";

/**
 * Instagram connection, through the Instagram Graph API.
 *
 * Publishing only works for a Business or Creator account linked to a Facebook Page —
 * Meta's rule, not ours. So the flow runs through Facebook's dialog and offers every
 * Instagram account reachable that way, each with its linked Page's token.
 */
/**
 * Instagram publishing reaches the account through its linked Page, so the two page
 * permissions come along with the two Instagram ones.
 *
 * `business_management` is here because Meta lists it as required for the "Instagram API
 * with Facebook login" use case, not because anything below calls the Business Manager
 * API — leaving it out makes the use case itself unavailable. Facebook's own scopes do
 * not include it, since the Pages use case does not require it.
 */
const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

/**
 * The subset without which nothing works. `pages_read_engagement` only adds the
 * follower count, and `business_management` is Meta's use-case requirement rather than
 * ours — neither should turn away a connection that can publish.
 */
const ESSENTIAL = ["pages_show_list", "instagram_basic", "instagram_content_publish"];
const PAGE_FIELDS = "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}";

export async function buildAuthorizeUrl(input: { state: string; redirectUri: string }): Promise<string> {
  const { clientId } = requireEnv("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET");
  return buildMetaAuthorizeUrl({
    clientId,
    redirectUri: input.redirectUri,
    state: input.state,
    scopes: SCOPES,
    configId: loginConfigId("instagram"),
  });
}

export async function listConnectable(userToken: string): Promise<ConnectableAccount[]> {
  const pages = await listPages(userToken, PAGE_FIELDS);
  return pages.flatMap((page) => {
    const ig = page.instagram_business_account;
    if (!ig?.id) return [];
    return [{
      externalAccountId: ig.id,
      handle: ig.username ?? ig.name ?? ig.id,
      displayName: ig.name ?? ig.username ?? null,
      avatarUrl: ig.profile_picture_url ?? null,
      followers: ig.followers_count ?? null,
      scopes: SCOPES,
      // Publishing to Instagram is authorised with the linked Page's token.
      accessToken: page.access_token,
      refreshToken: null,
      expiresAt: null,
      subtitle: `via ${page.name}`,
    }];
  });
}

export async function exchangeCode(input: { code: string; redirectUri: string }): Promise<ExchangeResult> {
  const { clientId, clientSecret } = requireEnv("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET");

  const { accessToken: userToken } = await exchangeForLongLivedToken({
    clientId, clientSecret, code: input.code, redirectUri: input.redirectUri,
  });

  // Fail on the real cause before the empty account list sends everyone hunting for Pages.
  await assertPermissions(userToken, ESSENTIAL, "Instagram");

  const [me, candidates] = await Promise.all([
    graphGet<{ id?: string }>("/me", { access_token: userToken, fields: "id" }).catch(() => ({ id: undefined })),
    listConnectable(userToken),
  ]);

  if (candidates.length === 0) {
    // Two different fixes, so say which one is missing.
    const pages = await listPages(userToken, "id").catch(() => []);
    throw new MetaError(
      "NO_INSTAGRAM_ACCOUNT",
      pages.length === 0
        ? "That Facebook account doesn't administer any Page, so there is no Instagram account to connect."
        : "None of your Facebook Pages has an Instagram Business or Creator account linked. Link one in Instagram's settings, then connect again.",
      false,
    );
  }

  return { providerUserId: me.id ?? null, userToken, candidates };
}
