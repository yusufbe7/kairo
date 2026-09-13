import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta signs its deauthorize and data-deletion callbacks rather than authenticating
 * them, so verifying the signature is the only thing standing between a stranger and
 * deleting someone's connected accounts.
 *
 * Returns null for anything that does not verify — never a partially trusted payload.
 */
export interface SignedRequestPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

export function parseSignedRequest(signed: string | null | undefined, appSecret: string): SignedRequestPayload | null {
  if (!signed) return null;
  const [encodedSignature, encodedPayload] = signed.split(".", 2);
  if (!encodedSignature || !encodedPayload) return null;

  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  const actual = Buffer.from(encodedSignature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // Meta only signs with HMAC-SHA256; anything else is a payload we did not expect.
  if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
  return payload;
}
