import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/redirect";

describe("safeNext", () => {
  it("keeps in-app paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/posts?tab=failed")).toBe("/posts?tab=failed");
  });

  it("falls back when there is nothing to go to", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
    expect(safeNext(undefined, "/login")).toBe("/login");
  });

  it("refuses anything that leaves the app", () => {
    // Browsers treat both of these as protocol-relative URLs.
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
  });
});
