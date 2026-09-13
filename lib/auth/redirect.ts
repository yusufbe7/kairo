/**
 * Shared helpers for the links that bring people back into the app.
 *
 * The timezone cookie is stashed before the Google redirect: Google gives us no
 * way to pass custom metadata through, and a scheduling product whose workspace
 * silently defaults to UTC publishes every post at the wrong hour.
 */
export const OAUTH_TZ_COOKIE = "kairo_oauth_tz";

/**
 * Only ever redirect to a path inside this app. `//evil.com` and `/\evil.com` are
 * both treated as protocol-relative by browsers, so neither may pass.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
