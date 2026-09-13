import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getProfile, getUser, requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { assertCan, type Permission } from "@/lib/permissions";
import { todayIn } from "@/lib/time";
import type { WorkspaceRole, WorkspaceRow } from "@/types/database";

export const WORKSPACE_COOKIE = "kairo_ws";

export interface Membership { workspace: WorkspaceRow; role: WorkspaceRole }

export interface WorkspaceContext {
  supabase: ServerSupabase;
  userId: string;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  memberships: Membership[];
  /** Today's date (YYYY-MM-DD) in the workspace timezone. */
  today: string;
}

export const listMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as { role: WorkspaceRole; workspace: WorkspaceRow | null }[])
    .filter((m): m is Membership => !!m.workspace && m.workspace.status === "active");
});

/**
 * Resolves the active workspace from the cookie — but only if the user is actually a member.
 * A tampered cookie simply falls back to the user's first workspace.
 */
const resolve = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const memberships = await listMemberships();
  if (memberships.length === 0) return null;
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === wanted) ?? memberships[0];
  return {
    supabase: await createClient(),
    userId: user.id,
    workspace: active.workspace,
    role: active.role,
    memberships,
    today: todayIn(active.workspace.timezone),
  };
});

/** For server components / pages. */
export async function getWorkspacePage(permission: Permission = "workspace.read"): Promise<WorkspaceContext> {
  const ctx = await resolve();
  if (!ctx) {
    const profile = await getProfile();
    redirect(profile ? "/onboarding" : "/login");
  }
  if (permission !== "workspace.read") assertCan(ctx.role, permission);
  return ctx;
}

/** For server actions / route handlers — every mutation goes through here. */
export async function requireWorkspace(permission: Permission): Promise<WorkspaceContext> {
  await requireUser();
  const ctx = await resolve();
  if (!ctx) throw new AppError("FORBIDDEN", "You're not a member of any workspace.");
  assertCan(ctx.role, permission);
  return ctx;
}
