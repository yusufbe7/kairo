import "server-only";
import { cookies } from "next/headers";
import { decryptSecret } from "@/lib/security/crypto";
import { AppError } from "@/lib/errors";
import type { PlatformId } from "@/types/social";

/**
 * The short-lived handover between the OAuth callback and the account picker.
 *
 * It holds only the user token, encrypted, in an httpOnly cookie: the picker re-lists
 * candidates from the provider when one is chosen, so no account token is ever parked
 * in the browser.
 */
export const CONNECT_COOKIE = "kairo_connect";

/**
 * How long a connection may sit half-finished.
 *
 * Meta's Login for Business flow is several screens deep — choosing a business, then
 * assets, then reviewing permissions — and people read them. Ten minutes ran out often
 * enough that the callback found no cookie and the connection died with "that attempt
 * expired", which reads like a bug rather than a timeout. The state is single-use and
 * only ever compared as a hash, so a longer window costs nothing.
 */
export const CONNECT_FLOW_MAX_AGE = 30 * 60;
export const CONNECT_COOKIE_MAX_AGE = CONNECT_FLOW_MAX_AGE;

export interface ConnectSession {
  platform: PlatformId;
  workspaceId: string;
  userToken: string;
  providerUserId: string | null;
}

export async function readConnectSession(platform: PlatformId): Promise<ConnectSession> {
  const raw = (await cookies()).get(CONNECT_COOKIE)?.value;
  if (!raw) throw new AppError("NOT_FOUND", "That connection has expired. Start connecting again.");

  let session: ConnectSession;
  try {
    session = JSON.parse(decryptSecret(raw));
  } catch {
    throw new AppError("NOT_FOUND", "That connection is no longer valid. Start connecting again.");
  }
  if (session.platform !== platform) {
    throw new AppError("NOT_FOUND", "That connection was for a different platform. Start connecting again.");
  }
  return session;
}

export async function clearConnectSession() {
  (await cookies()).delete(CONNECT_COOKIE);
}
