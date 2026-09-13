/**
 * Shared helpers for the links Supabase emails point at.
 *
 * The pending-email cookie lets /verify-email show the address and resend the
 * confirmation without ever putting it in a URL (where it would leak into logs,
 * referrers and browser history) and without letting the resend endpoint be
 * pointed at an arbitrary address.
 */
export const PENDING_EMAIL_COOKIE = "kairo_pending_email";
/**
 * The browser timezone, stashed before an OAuth redirect. Google gives us no way to
 * pass custom metadata through, and a scheduling product whose workspace silently
 * defaults to UTC publishes every post at the wrong hour.
 */
export const OAUTH_TZ_COOKIE = "kairo_oauth_tz";
export const PENDING_EMAIL_MAX_AGE = 60 * 30; // 30 minutes

/**
 * Only ever redirect to a path inside this app. `//evil.com` and `/\evil.com` are
 * both treated as protocol-relative by browsers, so neither may pass.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** Where an expired or already-used email link should land, so the user can recover. */
export function recoveryPathFor(type: string | null | undefined): string {
  if (type === "recovery") return "/forgot-password?error=link_expired";
  if (type === "invite" || type === "magiclink") return "/login?error=link_expired";
  return "/verify-email?error=link_expired";
}
