"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { listMemberships, requireWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError, fromDbError } from "@/lib/errors";
import { canAssignRole } from "@/lib/permissions";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { getPlanLimits } from "@/lib/services/usage";
import { isValidTimezone } from "@/lib/time";
import { inviteSchema, memberRoleSchema, notificationPrefsSchema, profileSchema, workspaceSchema } from "@/lib/validation/workspace";
import type { WorkspaceRole } from "@/types/database";

export const switchWorkspace = safeAction("workspace.switch", z.object({ workspaceId: z.string().uuid() }), async ({ workspaceId }) => {
  await requireUser();
  const memberships = await listMemberships();
  if (!memberships.some((m) => m.workspace.id === workspaceId)) throw new AppError("FORBIDDEN", "You're not a member of that workspace.");
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { workspaceId };
});

export const createWorkspace = safeAction("workspace.create", workspaceSchema, async (input) => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: input.name,
    p_timezone: isValidTimezone(input.timezone) ? input.timezone : "UTC",
  });
  if (error) throw fromDbError(error, "We couldn't create that workspace.");
  const workspaceId = data as string;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  await audit({ action: "workspace.created", actorId: user.id, workspaceId });
  revalidatePath("/", "layout");
  return { workspaceId };
});

export const updateWorkspace = safeAction("workspace.update", workspaceSchema, async (input) => {
  const ctx = await requireWorkspace("workspace.update");
  const { error } = await ctx.supabase
    .from("workspaces")
    .update({ name: input.name, timezone: isValidTimezone(input.timezone) ? input.timezone : ctx.workspace.timezone })
    .eq("id", ctx.workspace.id);
  if (error) throw fromDbError(error, "We couldn't save those workspace settings.");
  await audit({ action: "workspace.updated", actorId: ctx.userId, workspaceId: ctx.workspace.id });
  revalidatePath("/", "layout");
  return { updated: true };
});

export const updateProfile = safeAction("profile.update", profileSchema, async (input) => {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: input.fullName, job_title: input.jobTitle || null, locale: input.locale }).eq("id", user.id);
  if (error) throw fromDbError(error, "We couldn't save your profile.");
  revalidatePath("/", "layout");
  return { updated: true };
});

export const updateNotificationPrefs = safeAction("profile.notifications", notificationPrefsSchema, async (prefs) => {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", user.id);
  if (error) throw fromDbError(error, "We couldn't save your notification settings.");
  return { updated: true };
});

export const inviteMember = safeAction("workspace.invite", inviteSchema, async (input) => {
  const ctx = await requireWorkspace("member.manage");
  if (!canAssignRole(ctx.role, "viewer", input.role)) throw new AppError("FORBIDDEN", "You can't grant a role above your own.");

  const admin = createAdminClient();
  const [limits, { count }] = await Promise.all([
    getPlanLimits(ctx.workspace.id),
    admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id),
  ]);
  if ((count ?? 0) >= limits.members) throw new AppError("LIMIT_REACHED", `Your plan includes ${limits.members} team member${limits.members === 1 ? "" : "s"}. Upgrade to invite more.`);

  const token = randomToken();
  const { error } = await admin.from("workspace_invitations").insert({
    workspace_id: ctx.workspace.id, email: input.email, role: input.role, token_hash: sha256(token), invited_by: ctx.userId,
  });
  if (error) throw fromDbError(error, "We couldn't send that invitation. They may already be invited.");

  // If they already have an account, notify them in-app as well as by link.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", input.email).maybeSingle();
  if (existing) {
    await notify({ userId: (existing as { id: string }).id, workspaceId: ctx.workspace.id, type: "invitation",
      title: `You've been invited to ${ctx.workspace.name}`, link: `/invite/${token}` });
  }
  await audit({ action: "member.invited", actorId: ctx.userId, workspaceId: ctx.workspace.id, metadata: { role: input.role } });
  return { inviteUrl: `/invite/${token}`, alreadyRegistered: Boolean(existing) };
});

export const changeMemberRole = safeAction("workspace.member_role", memberRoleSchema, async (input) => {
  const ctx = await requireWorkspace("member.manage");
  const { data } = await ctx.supabase.from("workspace_members").select("role").eq("workspace_id", ctx.workspace.id).eq("user_id", input.userId).single();
  const current = (data as { role: WorkspaceRole } | null)?.role;
  if (!current) throw new AppError("NOT_FOUND", "That person isn't in this workspace.");
  if (!canAssignRole(ctx.role, current, input.role)) throw new AppError("FORBIDDEN", "You can't change that member's role.");
  const { error } = await ctx.supabase.from("workspace_members").update({ role: input.role }).eq("workspace_id", ctx.workspace.id).eq("user_id", input.userId);
  if (error) throw fromDbError(error, "We couldn't change that role.");
  await audit({ action: "member.role_changed", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "user", targetId: input.userId, metadata: { from: current, to: input.role } });
  revalidatePath("/settings");
  return { updated: true };
});

export const removeMember = safeAction("workspace.member_remove", z.object({ userId: z.string().uuid() }), async ({ userId }) => {
  const ctx = await requireWorkspace("member.manage");
  if (userId === ctx.workspace.owner_id) throw new AppError("FORBIDDEN", "The workspace owner can't be removed.");
  const { error } = await ctx.supabase.from("workspace_members").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", userId);
  if (error) throw fromDbError(error, "We couldn't remove that member.");
  await audit({ action: "member.removed", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "user", targetId: userId });
  revalidatePath("/settings");
  return { removed: true };
});

export const acceptInvitation = safeAction("workspace.accept_invite", z.object({ token: z.string().min(10).max(200) }), async ({ token }) => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    const message = /expired/.test(error.message) ? "That invitation has expired. Ask for a new one."
      : /different email/.test(error.message) ? "That invitation was sent to a different email address."
      : "That invitation is no longer valid.";
    throw new AppError("FORBIDDEN", message);
  }
  const workspaceId = data as string;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { workspaceId };
});
