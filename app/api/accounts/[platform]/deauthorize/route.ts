import { NextResponse, type NextRequest } from "next/server";
import { parseSignedRequest } from "@/lib/integrations/meta/signed-request";
import { disconnectMetaUser } from "@/lib/integrations/meta/disconnect";
import { metaAppSecret } from "@/lib/integrations/meta/app";
import { logger } from "@/lib/logger";
import type { PlatformId } from "@/types/social";

/**
 * Meta calls this when someone removes Kairo from their Facebook settings.
 *
 * Without it their tokens stay in the database and every scheduled post keeps failing
 * against a permission they have already withdrawn. Meta also checks the endpoint
 * during app review.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const secret = metaAppSecret(platform);
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const payload = parseSignedRequest(form?.get("signed_request")?.toString(), secret);

  if (!payload?.user_id) {
    // Never say why: an unsigned probe learns nothing from a 400.
    logger.warn("meta.deauthorize_unverified", "Rejected an unsigned deauthorize callback", { platform });
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  await disconnectMetaUser(platform as PlatformId, payload.user_id);
  return NextResponse.json({ received: true });
}
