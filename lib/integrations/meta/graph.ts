import "server-only";

/**
 * Shared Meta Graph plumbing for the Facebook and Instagram integrations.
 *
 * Both sit on the same API, the same OAuth dialog and the same error envelope, so the
 * transport, the error classification and the token exchange live here once.
 */
export const GRAPH_VERSION = "v21.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

/** A Graph error, already classified as worth retrying or not. */
export class MetaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    /** True when the token is gone or was revoked — the account has to be reconnected. */
    readonly needsReconnect = false,
  ) {
    super(message);
    this.name = "MetaError";
  }
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string };
}

/**
 * Which failures are worth another attempt.
 *
 * Rate limits and Meta's own transient faults come back later; a revoked token or a
 * missing permission will fail identically forever, so retrying only delays the
 * moment someone is told to fix it.
 */
function classify(status: number, code: number | undefined, subcode: number | undefined) {
  // Token problems: expired, revoked, password changed, session invalidated.
  if (code === 190 || code === 102 || subcode === 463 || subcode === 467) {
    return { retryable: false, needsReconnect: true, label: "TOKEN_INVALID" };
  }
  // Throttling — app level, user level, page level, or "too many calls".
  if (code === 4 || code === 17 || code === 32 || code === 80001 || code === 80002 || code === 613) {
    return { retryable: true, needsReconnect: false, label: "RATE_LIMITED" };
  }
  // Meta's own unknown/transient faults.
  if (code === 1 || code === 2 || status >= 500) {
    return { retryable: true, needsReconnect: false, label: "PROVIDER_UNAVAILABLE" };
  }
  // Permission denied — the app is missing a scope or the user lost access to the Page.
  if (code === 200 || code === 10 || code === 803 || code === 3) {
    return { retryable: false, needsReconnect: false, label: "PERMISSION_DENIED" };
  }
  if (status === 429) return { retryable: true, needsReconnect: false, label: "RATE_LIMITED" };
  return { retryable: false, needsReconnect: false, label: code ? `META_${code}` : `HTTP_${status}` };
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    // A network failure or timeout says nothing about the request being wrong.
    throw new MetaError("NETWORK", error instanceof Error ? error.message : "Network error", true);
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* Graph always answers JSON; anything else is handled as an error below. */
  }

  if (!response.ok) {
    const err = (body as GraphErrorBody)?.error;
    const { retryable, needsReconnect, label } = classify(response.status, err?.code, err?.error_subcode);
    // error_user_msg is Meta's own user-facing wording and is better than ours when present.
    const message = err?.error_user_msg || err?.message || text.slice(0, 300) || `Graph API returned ${response.status}`;
    throw new MetaError(label, message, retryable, needsReconnect);
  }
  return body as T;
}

export const graphGet = <T>(path: string, params: Record<string, string>): Promise<T> =>
  call<T>(`${GRAPH}${path}?${new URLSearchParams(params)}`, { method: "GET" });

export const graphPost = <T>(path: string, params: Record<string, string>): Promise<T> =>
  call<T>(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

/**
 * The authorize URL both providers send people to.
 *
 * Meta has two login products and they ask for permissions differently:
 *
 *   Facebook Login              — permissions listed in `scope`
 *   Facebook Login for Business — permissions fixed in a configuration built in the app
 *                                 dashboard, and referenced by `config_id`
 *
 * Sending `scope` to an app set up for the Business product is rejected as "Invalid
 * Scopes", so a configuration id, when one is set, takes over and the scopes are left
 * out entirely. `override_default_response_type` is what keeps a code coming back
 * rather than whatever the configuration itself defaults to.
 */
export function buildMetaAuthorizeUrl(input: {
  clientId: string; redirectUri: string; state: string; scopes: string[]; configId?: string | null;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
  });

  if (input.configId) {
    params.set("config_id", input.configId);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", input.scopes.join(","));
  }

  return `${OAUTH_DIALOG}?${params}`;
}

/**
 * The Business-login configuration for a platform, when this deployment uses one.
 *
 * One configuration can serve both providers as long as it carries every permission
 * either flow needs, so `META_LOGIN_CONFIG_ID` covers that case with a single value.
 * A per-platform variable wins when set, for deployments that keep them separate —
 * which is the tidier option, since a shared configuration asks everyone for Instagram
 * permissions even when they are only connecting a Facebook Page.
 */
export const loginConfigId = (platform: "facebook" | "instagram"): string | null =>
  process.env[`${platform.toUpperCase()}_LOGIN_CONFIG_ID`]?.trim() ||
  process.env.META_LOGIN_CONFIG_ID?.trim() ||
  null;

interface TokenResponse { access_token: string; expires_in?: number }

/**
 * Code → short-lived user token → long-lived user token.
 *
 * The long-lived exchange matters: Page tokens derived from a short-lived user token
 * expire in about an hour, which would break every scheduled post. Derived from a
 * long-lived one they do not expire at all while the user keeps granting access.
 */
export async function exchangeForLongLivedToken(input: {
  clientId: string; clientSecret: string; code: string; redirectUri: string;
}): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const short = await graphGet<TokenResponse>("/oauth/access_token", {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const long = await graphGet<TokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    fb_exchange_token: short.access_token,
  });

  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
  };
}

export interface MetaPage {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  fan_count?: number;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number };
}

/** Every Page this user administers, each with its own non-expiring Page token. */
export async function listPages(userAccessToken: string, fields: string): Promise<MetaPage[]> {
  const result = await graphGet<{ data?: MetaPage[] }>("/me/accounts", {
    access_token: userAccessToken,
    fields,
    limit: "100",
  });
  return result.data ?? [];
}

/**
 * Meta app ids are numeric. The check matters because Meta's Instagram product page
 * shows its own "Instagram App ID", which is not the same value and is not accepted by
 * the Facebook login dialog this flow uses — sending it produces a dead-end error page
 * on facebook.com that says nothing about which setting is wrong.
 */
const APP_ID_PATTERN = /^\d{8,}$/;

/**
 * Which permissions the person actually granted.
 *
 * A Login for Business configuration decides this, not us, so a configuration saved
 * with nothing selected produces a working token that can do nothing. Without this
 * check the first symptom is /me/accounts coming back empty, which reads as "you have
 * no Pages" — a misleading answer to a question about permissions.
 */
export async function grantedPermissions(userToken: string): Promise<Set<string>> {
  const result = await graphGet<{ data?: { permission: string; status: string }[] }>("/me/permissions", {
    access_token: userToken,
  });
  return new Set((result.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission));
}

/** Throws naming exactly what is missing, so the fix is a checkbox rather than a guess. */
export async function assertPermissions(userToken: string, required: string[], platformName: string) {
  const granted = await grantedPermissions(userToken);
  const missing = required.filter((permission) => !granted.has(permission));
  if (missing.length === 0) return;

  throw new MetaError(
    "PERMISSIONS_MISSING",
    `${platformName} didn't grant ${missing.join(", ")}. If this app uses Facebook Login for Business, add those permissions to its login configuration — the consent screen only offers what the configuration asks for.`,
    false,
  );
}

export function requireEnv(idKey: string, secretKey: string) {
  const clientId = process.env[idKey]?.trim();
  const clientSecret = process.env[secretKey]?.trim();
  if (!clientId || !clientSecret) {
    throw new MetaError("NOT_CONFIGURED", `${idKey} and ${secretKey} must be set on this deployment.`, false);
  }
  if (!APP_ID_PATTERN.test(clientId)) {
    throw new MetaError(
      "INVALID_APP_ID",
      `${idKey} doesn't look like a Meta App ID. Use the numeric App ID from App settings → Basic — not the "Instagram App ID" shown on the Instagram product page.`,
      false,
    );
  }
  return { clientId, clientSecret };
}
