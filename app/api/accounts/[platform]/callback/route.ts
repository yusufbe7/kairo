import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth/session";
import { upsertConnectedAccount } from "@/lib/services/accounts";
import { PROVIDERS } from "@/lib/integrations/registry";
import { encryptSecret, sha256 } from "@/lib/security/crypto";
import { CONNECT_COOKIE, CONNECT_COOKIE_MAX_AGE } from "@/lib/integrations/connect-session";
import { logger } from "@/lib/logger";
import { OAUTH_STATE_COOKIE } from "../connect/route";
import type { ExchangeResult } from "@/lib/integrations/types";
import type { PlatformId } from "@/types/social";

/**
 * OAuth callback: validates state, exchanges the code for tokens via the provider's auth
 * module, and stores the connection with the token encrypted at rest.
 *
 * When the provider offers more than one account — several Facebook Pages, several linked
 * Instagram accounts — nothing is stored yet. Choosing for them is how a post ends up on
 * the wrong brand, so the user is sent to a picker instead.
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

    const result: ExchangeResult = await exchangeCode({ code, redirectUri: `${origin}/api/accounts/${id}/callback` });

    if (result.candidates.length > 1) {
      // Only the user token is held, encrypted and briefly: the picker re-lists the
      // candidates on selection rather than parking several account tokens in a cookie.
      jar.set(
        CONNECT_COOKIE,
        encryptSecret(JSON.stringify({
          platform: id,
          workspaceId: stored.workspaceId,
          userToken: result.userToken,
          providerUserId: result.providerUserId,
        })),
        { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CONNECT_COOKIE_MAX_AGE },
      );
      return NextResponse.redirect(`${origin}/accounts/connect/${id}`);
    }

    const account = result.candidates[0];
    await upsertConnectedAccount({
      workspaceId: stored.workspaceId,
      userId: user.id,
      platform: id,
      externalAccountId: account.externalAccountId,
      handle: account.handle,
      displayName: account.displayName ?? null,
      avatarUrl: account.avatarUrl ?? null,
      followers: account.followers ?? null,
      scopes: account.scopes ?? [],
      accessToken: account.accessToken,
      refreshToken: account.refreshToken ?? null,
      expiresAt: account.expiresAt ?? null,
      metadata: result.providerUserId ? { provider_user_id: result.providerUserId } : {},
    });

    return NextResponse.redirect(`${origin}/accounts?connected=${id}`);
  } catch (error) {
    logger.error("oauth.callback_failed", error instanceof Error ? error.message : "Unknown error", { platform: id, workspaceId: stored.workspaceId });
    return fail("exchange_failed");
  }
}
