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

/** The authorize URL both providers send people to; only the scopes differ. */
export function buildMetaAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; scopes: string[] }) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
    scope: input.scopes.join(","),
  });
  return `${OAUTH_DIALOG}?${params}`;
}

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

export function requireEnv(idKey: string, secretKey: string) {
  const clientId = process.env[idKey];
  const clientSecret = process.env[secretKey];
  if (!clientId || !clientSecret) {
    throw new MetaError("NOT_CONFIGURED", `${idKey} and ${secretKey} must be set on this deployment.`, false);
  }
  return { clientId, clientSecret };
}
