import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth/session";
import { upsertConnectedAccount } from "@/lib/services/accounts";
import { PROVIDERS } from "@/lib/integrations/registry";
import { sha256 } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";
import { OAUTH_STATE_COOKIE } from "../connect/route";
import type { PlatformId } from "@/types/social";

/**
 * OAuth callback: validates state, exchanges the code for tokens via the provider's auth
 * module, and stores the connection with the token encrypted at rest.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const origin = request.nextUrl.origin;
  const fail = (reason: string) => NextResponse.redirect(`${origin}/accounts?error=${reason}`);

  if (!(platform in PROVIDERS)) return fail("unknown_platform");
  const id = platform as PlatformId;

  const jar = await cookies();
  const raw = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return fail("declined");
  if (!code || !state || !raw) return fail("state_missing");

  let stored: { hash: string; platform: string; workspaceId: string };
  try {
    stored = JSON.parse(raw);
  } catch {
    return fail("state_invalid");
  }
  // Reject a state that wasn't issued by us, or was issued for a different platform.
  if (stored.platform !== id || stored.hash !== sha256(state)) return fail("state_invalid");

  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const { exchangeCode } = await import(`@/lib/integrations/${id}/auth`).catch(() => ({ exchangeCode: null }));
    if (!exchangeCode) return fail("not_implemented");

    const result = await exchangeCode({ code, redirectUri: `${origin}/api/accounts/${id}/callback` });

    await upsertConnectedAccount({
      workspaceId: stored.workspaceId,
      userId: user.id,
      platform: id,
      externalAccountId: result.externalAccountId,
      handle: result.handle,
      displayName: result.displayName ?? null,
      avatarUrl: result.avatarUrl ?? null,
      scopes: result.scopes ?? [],
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? null,
      expiresAt: result.expiresAt ?? null,
    });

    return NextResponse.redirect(`${origin}/accounts?connected=${id}`);
  } catch (error) {
    logger.error("oauth.callback_failed", error instanceof Error ? error.message : "Unknown error", { platform: id, workspaceId: stored.workspaceId });
    return fail("exchange_failed");
  }
}
