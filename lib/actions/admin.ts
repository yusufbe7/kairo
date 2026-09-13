"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/services/audit";
import { logger } from "@/lib/logger";

const flagSchema = z.object({ key: z.string().min(1).max(64), enabled: z.boolean() });

/**
 * Flips a feature flag. Super admin only — `requireSuperAdmin` redirects anyone else,
 * and `feature_flags` is write-revoked from the `authenticated` role, so the service
 * role client used here is the only path in.
 */
export const setFeatureFlag = safeAction("admin.set_flag", flagSchema, async ({ key, enabled }) => {
  const { userId, db } = await requireSuperAdmin();

  const { data, error } = await db
    .from("feature_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("key")
    .single();
  if (error || !data) throw new AppError("NOT_FOUND", "We couldn't find that flag.");

  // Turning the paywall off is a decision worth being able to point at later.
  logger.warn("admin.flag_changed", `${key} set to ${enabled}`, { userId });
  await audit({ action: "admin.flag_changed", actorId: userId, targetType: "feature_flag", targetId: key, metadata: { enabled } });

  revalidatePath("/admin/flags");
  revalidatePath("/", "layout");
  return { key, enabled };
});
