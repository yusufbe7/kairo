import "server-only";
import { buildMetaAuthorizeUrl, exchangeForLongLivedToken, listPages, MetaError, requireEnv } from "@/lib/integrations/meta/graph";

/**
 * Facebook Pages connection.
 *
 * Only Pages can be posted to programmatically — personal profiles cannot, by any tool.
 * So what gets stored is a Page: its id, and the Page access token derived from the
 * user's long-lived token, which does not expire while access is granted.
 */
const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
];

const PAGE_FIELDS = "id,name,username,access_token,fan_count,picture{url}";

export async function buildAuthorizeUrl(input: { state: string; redirectUri: string }): Promise<string> {
  const { clientId } = requireEnv("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");
  return buildMetaAuthorizeUrl({ clientId, redirectUri: input.redirectUri, state: input.state, scopes: SCOPES });
}

export async function exchangeCode(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = requireEnv("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");

  const { accessToken: userToken } = await exchangeForLongLivedToken({
    clientId, clientSecret, code: input.code, redirectUri: input.redirectUri,
  });

  const pages = await listPages(userToken, PAGE_FIELDS);
  if (pages.length === 0) {
    throw new MetaError(
      "NO_PAGE",
      "That Facebook account doesn't administer any Page. Create a Page, or grant access to one, then connect again.",
      false,
    );
  }

  // One connection stores one Page. Someone who administers several gets the first;
  // connecting the others needs a picker in the connect flow, which does not exist yet.
  const page = pages[0];

  return {
    externalAccountId: page.id,
    handle: page.username ?? page.name,
    displayName: page.name,
    avatarUrl: page.picture?.data?.url ?? null,
    scopes: SCOPES,
    // The Page token, not the user token: it is what every publish call is made with.
    accessToken: page.access_token,
    refreshToken: null,
    // Page tokens derived from a long-lived user token do not carry an expiry.
    expiresAt: null,
  };
}
