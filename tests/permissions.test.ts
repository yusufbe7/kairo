import { describe, expect, it } from "vitest";
import { can, canAssignRole, ROLE_RANK } from "@/lib/permissions";

describe("permissions", () => {
  it("grants publishing to editors and above, but not members or viewers", () => {
    expect(can("owner", "post.publish")).toBe(true);
    expect(can("admin", "post.publish")).toBe(true);
    expect(can("editor", "post.publish")).toBe(true);
    expect(can("member", "post.publish")).toBe(false);
    expect(can("viewer", "post.publish")).toBe(false);
  });

  it("lets members draft but not schedule", () => {
    expect(can("member", "post.draft")).toBe(true);
    expect(can("member", "post.schedule")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(can("viewer", "workspace.read")).toBe(true);
    expect(can("viewer", "post.draft")).toBe(false);
    expect(can("viewer", "media.upload")).toBe(false);
  });

  it("reserves billing and workspace deletion for the owner", () => {
    expect(can("admin", "billing.manage")).toBe(false);
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("admin", "workspace.delete")).toBe(false);
  });

  it("returns false for a missing role rather than throwing", () => {
    expect(can(null, "post.draft")).toBe(false);
    expect(can(undefined, "workspace.read")).toBe(false);
  });

  describe("role assignment", () => {
    it("never allows granting or changing the owner role", () => {
      expect(canAssignRole("owner", "editor", "owner" as never)).toBe(false);
      expect(canAssignRole("owner", "owner", "admin")).toBe(false);
    });

    it("prevents granting a role above your own", () => {
      expect(canAssignRole("admin", "member", "admin")).toBe(true);
      expect(canAssignRole("editor", "member", "admin")).toBe(false);
    });

    it("requires member-management permission", () => {
      expect(canAssignRole("editor", "member", "viewer")).toBe(false);
      expect(canAssignRole("admin", "viewer", "editor")).toBe(true);
    });
  });

  it("ranks roles in the same order as the database", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeGreaterThan(ROLE_RANK.viewer);
  });
});
