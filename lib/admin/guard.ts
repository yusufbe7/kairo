import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin access is a completely separate path from workspace roles: `profiles.is_super_admin`,
 * which no user can set themselves (the column is revoked from the `authenticated` role and
 * guarded by RLS). Every /admin page calls this first.
 */
export const requireSuperAdmin = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("is_super_admin, full_name, email").eq("id", user.id).single();
  const profile = data as { is_super_admin: boolean; full_name: string | null; email: string | null } | null;
  if (!profile?.is_super_admin) redirect("/dashboard");

  // Admin queries bypass RLS deliberately — this is the privileged server-side path.
  return { userId: user.id, name: profile.full_name ?? profile.email ?? "Admin", db: createAdminClient() };
});
