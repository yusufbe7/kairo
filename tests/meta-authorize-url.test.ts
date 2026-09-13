import { describe, expect, it } from "vitest";
import { buildMetaAuthorizeUrl } from "@/lib/integrations/meta/graph";

const base = {
  clientId: "1234567890123456",
  redirectUri: "https://kairohub.pro/api/accounts/facebook/callback",
  state: "abc",
  scopes: ["pages_show_list", "pages_manage_posts"],
};

describe("buildMetaAuthorizeUrl", () => {
  it("lists the scopes when the app uses plain Facebook Login", () => {
    const url = new URL(buildMetaAuthorizeUrl(base));
    expect(url.searchParams.get("scope")).toBe("pages_show_list,pages_manage_posts");
    expect(url.searchParams.get("config_id")).toBeNull();
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("sends the configuration instead of scopes for Facebook Login for Business", () => {
    // Sending both is what Meta rejects as "Invalid Scopes".
    const url = new URL(buildMetaAuthorizeUrl({ ...base, configId: "987654321" }));
    expect(url.searchParams.get("config_id")).toBe("987654321");
    expect(url.searchParams.get("scope")).toBeNull();
    // Without this the configuration's own default response type wins and no code comes back.
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
  });

  it("treats an empty configuration id as not set", () => {
    expect(new URL(buildMetaAuthorizeUrl({ ...base, configId: "" })).searchParams.get("scope")).toBeTruthy();
    expect(new URL(buildMetaAuthorizeUrl({ ...base, configId: null })).searchParams.get("scope")).toBeTruthy();
  });

  it("always carries the state that protects the callback", () => {
    expect(new URL(buildMetaAuthorizeUrl(base)).searchParams.get("state")).toBe("abc");
  });
});
