import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PENDING_EMAIL_COOKIE, safeNext } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";

/**
 * PKCE code exchange. Kairo's own email templates point at /auth/confirm instead, which
 * works across devices; this route stays for Supabase's built-in templates, OAuth sign-in
 * and any link that was already in someone's inbox before the templates were switched.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) redirect("/verify-email?error=link_expired");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("auth.callback_failed", error.message);
    redirect("/verify-email?error=link_expired");
  }

  (await cookies()).delete(PENDING_EMAIL_COOKIE);
  redirect(next);
}
