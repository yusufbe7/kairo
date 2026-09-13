"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError, type ActionResult } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/services/audit";
import { forgotSchema, loginSchema, registerSchema, resendSchema, resetSchema } from "@/lib/validation/auth";
import { PENDING_EMAIL_COOKIE, PENDING_EMAIL_MAX_AGE } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { isValidTimezone } from "@/lib/time";
import { env } from "@/lib/env";

export const signIn = safeAction("auth.signIn", loginSchema, async (input) => {
  await rateLimit(`login:${input.email}`, { limit: 8, windowSeconds: 300 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error) {
    // Deliberately vague: don't reveal whether the address is registered.
    throw new AppError("UNAUTHENTICATED", error.message.includes("Email not confirmed")
      ? "Please confirm your email address first — check your inbox for the link."
      : "That email and password don't match.");
  }
  await audit({ action: "auth.login", actorId: data.user.id });
  revalidatePath("/", "layout");
  return { userId: data.user.id };
});

export const signUp = safeAction("auth.signUp", registerSchema, async (input) => {
  await rateLimit(`register:${input.email}`, { limit: 5, windowSeconds: 3600 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
      data: { full_name: input.fullName, timezone: input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC" },
    },
  });
  if (error) throw new AppError("VALIDATION", error.message);
  // With email confirmation on, there's no session yet — the profile and workspace
  // are created by the on_auth_user_created trigger either way.
  const needsConfirmation = !data.session;
  if (needsConfirmation) await rememberPendingEmail(input.email);
  if (data.user && !needsConfirmation) await audit({ action: "auth.registered", actorId: data.user.id });
  revalidatePath("/", "layout");
  return { needsConfirmation };
});

/** Lets /verify-email name the address and resend to it, without ever putting it in a URL. */
async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_EMAIL_MAX_AGE,
  });
}

/**
 * Sends a fresh confirmation link. The address comes from the signup cookie when we have
 * it; the optional input is the fallback for someone who comes back in a new browser.
 */
export const resendConfirmation = safeAction("auth.resend", resendSchema, async (input) => {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? input.email;
  if (!email) {
    throw new AppError("VALIDATION", "Enter the address you signed up with.", {
      fieldErrors: { email: ["Enter the address you signed up with."] },
    });
  }
  await rateLimit(`resend:${email}`, { limit: 3, windowSeconds: 900 });

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard` },
  });
  // Never surfaced: a distinct error here would reveal whether the address is registered
  // and whether it is already confirmed.
  if (error) logger.warn("auth.resend_failed", error.message);

  await rememberPendingEmail(email);
  return { sent: true };
});

export const requestPasswordReset = safeAction("auth.forgot", forgotSchema, async (input) => {
  await rateLimit(`forgot:${input.email}`, { limit: 5, windowSeconds: 3600 });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${env().NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password` });
  // Always report success so the form can't be used to discover registered addresses.
  return { sent: true };
});

export const updatePassword = safeAction("auth.reset", resetSchema, async (input) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "This reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw new AppError("VALIDATION", error.message);
  await audit({ action: "auth.password_changed", actorId: user.id });
  return { updated: true };
});

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) await audit({ action: "auth.logout", actorId: user.id });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
