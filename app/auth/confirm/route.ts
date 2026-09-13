import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";

/**
 * Where every link in a Kairo auth email lands.
 *
 * Inactive while Google is the only sign-in method — Supabase sends no auth emails
 * then. It is kept working so re-enabling the Email provider needs no code change.
 *
 * Unlike the PKCE `code` flow in /auth/callback, `verifyOtp` with a token hash does not
 * need the code verifier cookie from the browser that started the flow — so confirming
 * works when someone signs up on their phone and opens the email on their laptop.
 */
const TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type || !TYPES.has(type as EmailOtpType)) redirect("/login?error=link_invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  if (error) {
    // Expired, already used, or tampered with — all indistinguishable to the user, and
    // all recoverable by requesting a fresh link.
    logger.warn("auth.confirm_failed", error.message, { type });
    redirect("/login?error=link_expired");
  }

  redirect(next);
}
