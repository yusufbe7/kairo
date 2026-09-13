import { describe, expect, it } from "vitest";
import { canTransition, isEditable } from "@/lib/posts/state";

describe("post state machine", () => {
  it("allows scheduling a draft and pulling it back", () => {
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "draft")).toBe(true);
  });

  it("treats published as terminal", () => {
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("published", "scheduled")).toBe(false);
    expect(isEditable("published")).toBe(false);
  });

  it("lets a failed post be retried or edited", () => {
    expect(canTransition("failed", "publishing")).toBe(true);
    expect(canTransition("failed", "draft")).toBe(true);
    expect(isEditable("failed")).toBe(true);
  });

  it("only lets the worker resolve a publishing post", () => {
    expect(canTransition("publishing", "published")).toBe(true);
    expect(canTransition("publishing", "failed")).toBe(true);
    expect(canTransition("publishing", "draft")).toBe(false);
  });
});
