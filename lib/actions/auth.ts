"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError, type ActionResult } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/services/audit";
import { googleSchema } from "@/lib/validation/auth";
import { OAUTH_TZ_COOKIE } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { isValidTimezone } from "@/lib/time";
import { env } from "@/lib/env";

/**
 * Google is the only way in, so this is the only way in.
 *
 * It serves sign-up and sign-in alike: Supabase creates the user on first use and
 * the signup trigger builds their profile and workspace. Google has already
 * verified the address, so there is no confirmation email and no password — which
 * is the point. The code exchange happens in /auth/callback.
 */
export const signInWithGoogle = safeAction("auth.google", googleSchema, async (input) => {
  await rateLimit("google-signin", { limit: 60, windowSeconds: 60 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
      // Ask for a refresh token, and let people pick which Google account to use
      // instead of silently reusing whichever one the browser is signed into.
      queryParams: { access_type: "offline", prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    logger.error("auth.google_unavailable", error?.message ?? "No authorize URL returned");
    throw new AppError("NOT_CONFIGURED", "Sign-in is temporarily unavailable. Please try again in a moment.");
  }
  if (!(await authorizeUrlWorks(data.url))) {
    throw new AppError("NOT_CONFIGURED", "Google sign-in isn't switched on for this deployment yet. An administrator needs to enable the Google provider in Supabase.");
  }

  // Google carries no timezone, and a scheduling product that defaults to UTC
  // publishes every post at the wrong hour. Applied in the callback.
  if (input.timezone && isValidTimezone(input.timezone)) {
    (await cookies()).set(OAUTH_TZ_COOKIE, input.timezone, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900,
    });
  }
  return { url: data.url };
});

/**
 * Supabase builds the authorize URL in the SDK without contacting its server, so a
 * provider that has not been enabled is only discovered once the browser has already
 * landed on a raw JSON error page. One probe turns that dead end into a message.
 *
 * Fails open: a probe that cannot run must never block a sign-in that would have worked.
 */
async function authorizeUrlWorks(url: string): Promise<boolean> {
  try {
    // A configured provider answers with a redirect to Google; a disabled one returns 400.
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    if (response.status < 400) return true;
    logger.error("auth.google_provider_disabled", `Supabase returned ${response.status} for the Google authorize URL`);
    return false;
  } catch {
    return true;
  }
}

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) await audit({ action: "auth.logout", actorId: user.id });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
