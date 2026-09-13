import { NextResponse, type NextRequest } from "next/server";
import { parseSignedRequest } from "@/lib/integrations/meta/signed-request";
import { disconnectMetaUser } from "@/lib/integrations/meta/disconnect";
import { metaAppSecret } from "@/lib/integrations/meta/app";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/security/crypto";
import { appUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";
import type { PlatformId } from "@/types/social";

/**
 * Meta's data deletion callback: someone asked, from inside Facebook, that we delete
 * what we hold about them.
 *
 * The reply has to be a confirmation code plus a URL where they can check the request,
 * so the deletion is recorded in the audit log under that code and the status page
 * reads it back. Meta requires this endpoint before granting the Page and Instagram
 * permissions to anyone beyond the app's own developers.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const secret = metaAppSecret(platform);
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const payload = parseSignedRequest(form?.get("signed_request")?.toString(), secret);

  if (!payload?.user_id) {
    logger.warn("meta.deletion_unverified", "Rejected an unsigned data deletion callback", { platform });
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const confirmationCode = randomToken(12);
  const removed = await disconnectMetaUser(platform as PlatformId, payload.user_id);

  // Recorded so the status page can answer honestly later; the provider's user id is
  // hashed nowhere because it is already gone from every account row we just deleted.
  await createAdminClient().from("audit_logs").insert({
    action: "account.data_deletion_requested",
    target_type: "data_deletion",
    target_id: confirmationCode,
    metadata: { platform, accounts_removed: removed },
  });

  return NextResponse.json({
    url: `${appUrl()}/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
