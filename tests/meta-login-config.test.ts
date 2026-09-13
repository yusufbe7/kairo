import { afterEach, describe, expect, it, vi } from "vitest";
import { loginConfigId } from "@/lib/integrations/meta/graph";

afterEach(() => vi.unstubAllEnvs());

describe("loginConfigId", () => {
  it("is null when no configuration is set, so the scope path is used", () => {
    vi.stubEnv("FACEBOOK_LOGIN_CONFIG_ID", "");
    vi.stubEnv("INSTAGRAM_LOGIN_CONFIG_ID", "");
    vi.stubEnv("META_LOGIN_CONFIG_ID", "");
    expect(loginConfigId("facebook")).toBeNull();
    expect(loginConfigId("instagram")).toBeNull();
  });

  it("lets one shared configuration serve both providers", () => {
    vi.stubEnv("FACEBOOK_LOGIN_CONFIG_ID", "");
    vi.stubEnv("INSTAGRAM_LOGIN_CONFIG_ID", "");
    vi.stubEnv("META_LOGIN_CONFIG_ID", "shared-123");
    expect(loginConfigId("facebook")).toBe("shared-123");
    expect(loginConfigId("instagram")).toBe("shared-123");
  });

  it("prefers a per-platform configuration over the shared one", () => {
    vi.stubEnv("META_LOGIN_CONFIG_ID", "shared-123");
    vi.stubEnv("FACEBOOK_LOGIN_CONFIG_ID", "fb-456");
    vi.stubEnv("INSTAGRAM_LOGIN_CONFIG_ID", "");
    expect(loginConfigId("facebook")).toBe("fb-456");
    // Instagram has none of its own, so it still falls back to the shared one.
    expect(loginConfigId("instagram")).toBe("shared-123");
  });

  it("ignores surrounding whitespace, which is easy to paste in", () => {
    vi.stubEnv("FACEBOOK_LOGIN_CONFIG_ID", "  fb-456  ");
    expect(loginConfigId("facebook")).toBe("fb-456");
  });
});
