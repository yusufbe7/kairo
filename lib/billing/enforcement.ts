import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageFrom } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const BILLING_FLAG = "ENFORCE_BILLING";

/**
 * Whether the paywall is currently enforced.
 *
 * Fails closed: if the flag can't be read the paywall stays on, so a database
 * blip can never silently hand the whole product out for free. The flag has to
 * exist and be explicitly disabled for access to open up.
 */
export const isBillingEnforced = cache(async (): Promise<boolean> => {
  try {
    const { data, error } = await createAdminClient()
      .from("feature_flags")
      .select("enabled")
      .eq("key", BILLING_FLAG)
      .maybeSingle();
    if (error) throw error;
    // A missing row means the migration hasn't run yet — enforce.
    return (data as { enabled: boolean } | null)?.enabled ?? true;
  } catch (error) {
    logger.error("billing.flag_unreadable", messageFrom(error));
    return true;
  }
});
