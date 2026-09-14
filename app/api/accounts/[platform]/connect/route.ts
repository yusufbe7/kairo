import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/workspace/context";
import { assertCanConnect } from "@/lib/services/accounts";
import { PROVIDERS } from "@/lib/integrations/registry";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { AppError } from "@/lib/errors";
import { MetaError } from "@/lib/integrations/meta/graph";
import { CONNECT_FLOW_MAX_AGE } from "@/lib/integrations/connect-session";
import { logger } from "@/lib/logger";
import type { PlatformId } from "@/types/social";

export const OAUTH_STATE_COOKIE = "kairo_oauth_state";

/**
 * Starts an OAuth connection.
 *
 * CSRF protection: a random state token is generated, its hash stored in an httpOnly cookie
 * alongside the workspace id, and the raw token sent to the provider. The callback only
 * proceeds if the returned state hashes to the cookie value.
 *
 * The redirect itself is built by the provider's own auth module. Until a provider ships one,
 * this returns a clear error rather than sending the user somewhere that won't work.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const origin = request.nextUrl.origin;

  if (!(platform in PROVIDERS)) {
    return NextResponse.redirect(`${origin}/accounts?error=unknown_platform`);
  }
  const id = platform as PlatformId;

  try {
    const ctx = await requireWorkspace("account.manage");
    await assertCanConnect(ctx, id);

    const state = randomToken();
    (await cookies()).set(OAUTH_STATE_COOKIE, JSON.stringify({ hash: sha256(state), platform: id, workspaceId: ctx.workspace.id }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CONNECT_FLOW_MAX_AGE,
    });

    const { buildAuthorizeUrl } = await import(`@/lib/integrations/${id}/auth`).catch(() => ({ buildAuthorizeUrl: null }));
    if (!buildAuthorizeUrl) {
      return NextResponse.redirect(`${origin}/accounts?error=not_implemented&platform=${id}`);
    }

    const url = await buildAuthorizeUrl({ state, redirectUri: `${origin}/api/accounts/${id}/callback` });
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("oauth.connect_blocked", error.userMessage, { platform: id, code: error.code });
      return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent(error.code.toLowerCase())}`);
    }
    // A provider error carries its own reason; keeping it means the accounts page can
    // say which setting is wrong instead of "something went wrong".
    if (error instanceof MetaError) {
      logger.error("oauth.connect_blocked", error.message, { platform: id, code: error.code });
      return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent(error.code.toLowerCase())}`);
    }
    logger.error("oauth.connect_failed", error instanceof Error ? error.message : "Unknown error", { platform: id });
    return NextResponse.redirect(`${origin}/accounts?error=connect_failed`);
  }
}
