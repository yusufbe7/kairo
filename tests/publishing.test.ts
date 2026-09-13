import { describe, expect, it } from "vitest";
import { publishToPlatform } from "@/lib/publishing";

describe("publishing abstraction", () => {
  it("refuses platforms with no implemented publisher, and marks it non-retryable", async () => {
    const result = await publishToPlatform({
      platform: "instagram", accountId: crypto.randomUUID(), caption: "hi", media: [], format: "post",
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_IMPLEMENTED");
    expect(result.retryable).toBe(false);
  });

  it("never claims success for an unconfigured provider", async () => {
    for (const platform of ["tiktok", "linkedin", "x", "youtube", "telegram", "facebook"] as const) {
      const result = await publishToPlatform({ platform, accountId: crypto.randomUUID(), caption: "hi", media: [], format: "post" });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeTruthy();
    }
  });
});
