import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "@/lib/integrations/meta/signed-request";

const SECRET = "app-secret";

function sign(payload: object, secret = SECRET) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${signature}.${encoded}`;
}

describe("parseSignedRequest", () => {
  it("accepts a request signed with our app secret", () => {
    const parsed = parseSignedRequest(sign({ user_id: "123", algorithm: "HMAC-SHA256" }), SECRET);
    expect(parsed?.user_id).toBe("123");
  });

  it("rejects a signature made with a different secret", () => {
    // Without this check anyone could delete another person's connected accounts.
    expect(parseSignedRequest(sign({ user_id: "123" }, "not-our-secret"), SECRET)).toBeNull();
  });

  it("rejects a payload whose body was changed after signing", () => {
    const [signature] = sign({ user_id: "123" }).split(".");
    const tampered = Buffer.from(JSON.stringify({ user_id: "999" })).toString("base64url");
    expect(parseSignedRequest(`${signature}.${tampered}`, SECRET)).toBeNull();
  });

  it("rejects anything malformed rather than trusting part of it", () => {
    expect(parseSignedRequest(null, SECRET)).toBeNull();
    expect(parseSignedRequest("", SECRET)).toBeNull();
    expect(parseSignedRequest("no-dot", SECRET)).toBeNull();
    expect(parseSignedRequest(`${"x".repeat(43)}.${"y".repeat(20)}`, SECRET)).toBeNull();
  });

  it("rejects an algorithm we never agreed to", () => {
    expect(parseSignedRequest(sign({ user_id: "123", algorithm: "none" }), SECRET)).toBeNull();
  });
});
