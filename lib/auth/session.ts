import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { ProfileRow } from "@/types/database";

/** The verified user for this request (JWT checked by Supabase), or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as ProfileRow | null) ?? null;
});

/** For pages: redirects to /login when signed out. */
export async function requireUserPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** For actions / route handlers: throws a user-safe error when signed out. */
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Your session has ended. Please sign in again.");
  return user;
}
