import { AppError } from "@/lib/errors";
import type { WorkspaceRole } from "@/types/database";

/** Mirrors `public.roles.rank` in the database — keep in sync. */
export const ROLE_RANK: Record<WorkspaceRole, number> = { owner: 50, admin: 40, editor: 30, member: 20, viewer: 10 };
export const ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "member", "viewer"];

/** Minimum role required for each capability. Enforced in server actions (and again by RLS). */
export const PERMISSIONS = {
  "workspace.read": "viewer",
  "post.draft": "member",
  "post.schedule": "editor",
  "post.publish": "editor",
  "post.edit_any": "editor",
  "post.delete_any": "editor",
  "media.upload": "member",
  "media.delete_any": "editor",
  "ai.use": "member",
  "inbox.reply": "editor",
  "account.manage": "admin",
  "member.manage": "admin",
  "workspace.update": "admin",
  "api_key.manage": "admin",
  "audit.read": "admin",
  "billing.manage": "owner",
  "workspace.delete": "owner",
} as const satisfies Record<string, WorkspaceRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: WorkspaceRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[permission]];
}

export function assertCan(role: WorkspaceRole | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new AppError("FORBIDDEN", "Your role in this workspace doesn't allow this action.");
}

/**
 * Who may assign which role. Nobody assigns `owner` here (ownership transfer is a separate flow),
 * and you can never grant — or change someone at — a role above your own.
 */
export function canAssignRole(actor: WorkspaceRole, target: WorkspaceRole, next: WorkspaceRole): boolean {
  if (!can(actor, "member.manage")) return false;
  if (target === "owner" || next === "owner") return false;
  return ROLE_RANK[next] <= ROLE_RANK[actor] && ROLE_RANK[target] <= ROLE_RANK[actor];
}
