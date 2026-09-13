/**
 * The public origin of this deployment.
 *
 * Everything user-facing is built from here: OAuth redirects, the links in auth
 * emails, Stripe's success and return URLs, Open Graph tags, robots and sitemap.
 *
 * `NEXT_PUBLIC_APP_URL` is the setting of record. Vercel's own production URL is
 * the fallback so a forgotten variable degrades to the right host instead of
 * mailing people links to localhost.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
