import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OAUTH_TZ_COOKIE, safeNext } from "@/lib/auth/redirect";
import { isValidTimezone } from "@/lib/time";
import { logger } from "@/lib/logger";

/**
 * PKCE code exchange — where Google sign-in lands.
 *
 * It also still handles any Supabase link built from `{{ .ConfirmationURL }}`, so
 * turning the Email provider back on stays a configuration change rather than a
 * code change.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Supabase bounces provider failures back here rather than to the provider.
  const providerError = searchParams.get("error");
  if (providerError) {
    const description = searchParams.get("error_description") ?? providerError;
    logger.warn("auth.provider_declined", description, { code: providerError });
    redirect(providerError === "access_denied" ? "/login?error=declined" : "/login?error=provider");
  }

  if (!code) redirect("/login?error=link_expired");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("auth.callback_failed", error.message);
    redirect("/login?error=link_expired");
  }

  const jar = await cookies();
  const timezone = jar.get(OAUTH_TZ_COOKIE)?.value;
  if (timezone) {
    jar.delete(OAUTH_TZ_COOKIE);
    if (data.user) await applySignupTimezone(data.user.id, timezone);
  }

  redirect(next);
}

/**
 * Gives a brand-new OAuth workspace the timezone of the browser that signed up.
 *
 * Google carries no timezone, so the signup trigger falls back to UTC — which would
 * silently shift every scheduled post. Only workspaces created moments ago and still
 * on the UTC default are touched, so this can never overwrite a deliberate choice on
 * a later sign-in.
 */
async function applySignupTimezone(userId: string, timezone: string) {
  if (!isValidTimezone(timezone)) return;
  const createdSince = new Date(Date.now() - 2 * 60_000).toISOString();
  const { error } = await createAdminClient()
    .from("workspaces")
    .update({ timezone })
    .eq("owner_id", userId)
    .eq("timezone", "UTC")
    .gte("created_at", createdSince);
  if (error) logger.warn("auth.timezone_not_applied", error.message, { userId });
}
