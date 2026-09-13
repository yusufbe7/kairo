import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "editor", "member", "viewer"]);
export const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Give your workspace a name.").max(80),
  timezone: z.string().min(1).max(64),
});
export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: roleSchema.exclude(["owner"]),
});
export const memberRoleSchema = z.object({ userId: z.string().uuid(), role: roleSchema.exclude(["owner"]) });
export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(80),
  jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
  locale: z.enum(["en", "uz", "ru"]),
});
export const notificationPrefsSchema = z.object({
  published: z.boolean(), failed: z.boolean(), messages: z.boolean(), weekly: z.boolean(), product: z.boolean(),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
