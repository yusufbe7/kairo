import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — use only in server code, and only after
 * an explicit permission check (or for system work: workers, OAuth callbacks, audit/log writes).
 */
let admin: SupabaseClient | null = null;
export function createAdminClient(): SupabaseClient {
  if (!admin) {
    const e = env();
    admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
