"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError, type ActionResult } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/services/audit";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/auth";
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
  if (data.user && !needsConfirmation) await audit({ action: "auth.registered", actorId: data.user.id });
  revalidatePath("/", "layout");
  return { needsConfirmation };
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
