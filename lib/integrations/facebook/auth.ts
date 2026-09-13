import "server-only";
import { buildMetaAuthorizeUrl, exchangeForLongLivedToken, graphGet, listPages, loginConfigId, MetaError, requireEnv } from "@/lib/integrations/meta/graph";
import type { ConnectableAccount, ExchangeResult } from "@/lib/integrations/types";

/**
 * Facebook Pages connection.
 *
 * Only Pages can be posted to programmatically — personal profiles cannot, by any tool.
 * So what gets stored is a Page, with the Page access token derived from the user's
 * long-lived token, which does not expire while access is granted.
 */
const SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management"];
const PAGE_FIELDS = "id,name,username,access_token,fan_count,picture{url}";

export async function buildAuthorizeUrl(input: { state: string; redirectUri: string }): Promise<string> {
  const { clientId } = requireEnv("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");
  return buildMetaAuthorizeUrl({
    clientId,
    redirectUri: input.redirectUri,
    state: input.state,
    scopes: SCOPES,
    configId: loginConfigId("facebook"),
  });
}

/** Every Page this token can publish to. Re-run when the picker completes. */
export async function listConnectable(userToken: string): Promise<ConnectableAccount[]> {
  const pages = await listPages(userToken, PAGE_FIELDS);
  return pages.map((page) => ({
    externalAccountId: page.id,
    handle: page.username ?? page.name,
    displayName: page.name,
    avatarUrl: page.picture?.data?.url ?? null,
    followers: page.fan_count ?? null,
    scopes: SCOPES,
    // The Page token, not the user token: it is what every publish call is made with.
    accessToken: page.access_token,
    refreshToken: null,
    // Page tokens derived from a long-lived user token carry no expiry.
    expiresAt: null,
  }));
}

export async function exchangeCode(input: { code: string; redirectUri: string }): Promise<ExchangeResult> {
  const { clientId, clientSecret } = requireEnv("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");

  const { accessToken: userToken } = await exchangeForLongLivedToken({
    clientId, clientSecret, code: input.code, redirectUri: input.redirectUri,
  });

  const [me, candidates] = await Promise.all([
    graphGet<{ id?: string }>("/me", { access_token: userToken, fields: "id" }).catch(() => ({ id: undefined })),
    listConnectable(userToken),
  ]);

  if (candidates.length === 0) {
    throw new MetaError(
      "NO_PAGE",
      "That Facebook account doesn't administer any Page. Create a Page, or ask its owner for access, then connect again.",
      false,
    );
  }

  return { providerUserId: me.id ?? null, userToken, candidates };
}
