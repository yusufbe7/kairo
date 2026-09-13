import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { PlatformId } from "@/types/social";

/**
 * Removes every account a Meta user connected, on their instruction.
 *
 * Both of Meta's callbacks — "they removed your app" and "they asked you to delete
 * their data" — mean the same thing here: the tokens are dead and the rows have to go.
 * Deleting the account cascades to `oauth_tokens`, so nothing is left behind.
 */
export async function disconnectMetaUser(platform: PlatformId, providerUserId: string): Promise<number> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("social_accounts")
    .delete()
    .eq("platform", platform)
    .eq("metadata->>provider_user_id", providerUserId)
    .select("id, workspace_id");

  if (error) {
    logger.error("meta.disconnect_failed", error.message, { platform });
    throw new Error(error.message);
  }

  const removed = (data ?? []) as { id: string; workspace_id: string }[];
  for (const account of removed) {
    await admin.from("audit_logs").insert({
      workspace_id: account.workspace_id,
      action: "account.revoked_by_provider",
      target_type: "social_account",
      target_id: account.id,
      metadata: { platform },
    });
  }

  logger.info("meta.disconnected", `Removed ${removed.length} account(s) at the user's request`, { platform });
  return removed.length;
}
