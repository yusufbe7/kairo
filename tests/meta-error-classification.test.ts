import { describe, expect, it } from "vitest";
import { isAppUnavailable } from "@/lib/integrations/meta/graph";

/**
 * A deactivated Meta app invalidates every token it ever issued, so its failures arrive
 * looking exactly like a revoked user token (code 190 either way). Only the message tells
 * them apart, and getting it wrong sends someone to reconnect through the same dead app.
 */
describe("recognising a deactivated Meta app", () => {
  it("spots the wordings Meta actually returns", () => {
    for (const message of [
      "Error validating application. Application has been deleted.",
      "Error validating application.",
      "App not active. This app is not accessible right now.",
      "This application is not currently active",
    ]) {
      expect(isAppUnavailable(message)).toBe(true);
    }
  });

  it("leaves ordinary token and rate-limit failures to reconnect or retry as before", () => {
    for (const message of [
      "Session has expired on Friday, 12-Sep-25. The current time is Sunday, 14-Sep-25.",
      "The access token could not be decrypted",
      "Application request limit reached",
      "(#200) Permissions error",
    ]) {
      expect(isAppUnavailable(message)).toBe(false);
    }
  });
});
