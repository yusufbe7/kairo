import { describe, expect, it } from "vitest";
import { BACKOFF_MS, STALE_LOCK_MS, backoffFor, isStale } from "@/lib/publishing/runner";

describe("retry backoff", () => {
  it("waits longer after every attempt", () => {
    const delays = [1, 2, 3, 4].map(backoffFor);
    expect(delays).toEqual(BACKOFF_MS);
  });

  it("caps at the longest delay instead of running off the end of the table", () => {
    expect(backoffFor(5)).toBe(BACKOFF_MS.at(-1));
    expect(backoffFor(99)).toBe(BACKOFF_MS.at(-1));
  });

  it("treats a zeroth attempt as the first, never as a zero-length wait", () => {
    expect(backoffFor(0)).toBe(BACKOFF_MS[0]);
    expect(backoffFor(-1)).toBe(BACKOFF_MS[0]);
  });
});

describe("stale claims", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("leaves a fresh claim alone", () => {
    expect(isStale(ago(0), now)).toBe(false);
    expect(isStale(ago(STALE_LOCK_MS - 1_000), now)).toBe(false);
  });

  it("reclaims a claim that has gone quiet", () => {
    expect(isStale(ago(STALE_LOCK_MS), now)).toBe(true);
    expect(isStale(ago(STALE_LOCK_MS * 3), now)).toBe(true);
  });

  it("reclaims a row marked processing with no lock timestamp at all", () => {
    // Otherwise a bad write would strand the post on "Publishing" forever.
    expect(isStale(null, now)).toBe(true);
    expect(isStale("not a date", now)).toBe(true);
  });

  it("outlasts the longest single publish, so a slow Reel is never cut in half", () => {
    // lib/integrations/instagram/publish.ts polls a video container for up to 4 minutes.
    expect(STALE_LOCK_MS).toBeGreaterThan(4 * 60_000);
  });
});
