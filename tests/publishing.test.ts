import { afterEach, describe, expect, it, vi } from "vitest";
import { publishToPlatform } from "@/lib/publishing";
import { PROVIDERS } from "@/lib/integrations/registry";
import type { PlatformId } from "@/types/social";

const request = (platform: PlatformId) => ({
  platform, accountId: crypto.randomUUID(), caption: "hi", media: [], format: "post" as const,
});

afterEach(() => vi.unstubAllEnvs());

describe("publishing abstraction", () => {
  it("refuses a platform whose publisher isn't built, and doesn't retry it", async () => {
    // TikTok is declared in the registry but has no module behind it.
    const result = await publishToPlatform(request("tiktok"));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_IMPLEMENTED");
    expect(result.retryable).toBe(false);
  });

  it("refuses a built platform whose credentials are missing, and doesn't retry it", async () => {
    vi.stubEnv("INSTAGRAM_CLIENT_ID", "");
    vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "");
    const result = await publishToPlatform(request("instagram"));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_CONFIGURED");
    expect(result.retryable).toBe(false);
    // The message names what is missing, so a deployment can be fixed from the error alone.
    expect(result.errorMessage).toContain("INSTAGRAM_CLIENT_ID");
  });

  it("never claims success, for any platform, without a real publish", async () => {
    for (const platform of Object.keys(PROVIDERS) as PlatformId[]) {
      vi.stubEnv("INSTAGRAM_CLIENT_ID", "");
      vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "");
      vi.stubEnv("FACEBOOK_CLIENT_ID", "");
      vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
      const result = await publishToPlatform(request(platform));
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeTruthy();
    }
  });
});
