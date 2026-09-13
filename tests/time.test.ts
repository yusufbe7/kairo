import { describe, expect, it } from "vitest";
import { isValidTimezone, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

describe("timezone handling", () => {
  it("converts a local wall-clock time to the right UTC instant", () => {
    // Tashkent is UTC+5 year-round.
    expect(zonedToUtc("2026-03-15", "10:00", "Asia/Tashkent").toISOString()).toBe("2026-03-15T05:00:00.000Z");
    expect(zonedToUtc("2026-03-15", "10:00", "UTC").toISOString()).toBe("2026-03-15T10:00:00.000Z");
  });

  it("round-trips a scheduled time without drift", () => {
    const tz = "America/New_York";
    const utc = zonedToUtc("2026-07-04", "18:30", tz);
    expect(utcToZoned(utc, tz)).toEqual({ date: "2026-07-04", time: "18:30" });
  });

  it("handles the spring-forward DST boundary", () => {
    // US DST starts 2026-03-08; 09:00 local is UTC-4 after the jump, not UTC-5.
    const utc = zonedToUtc("2026-03-08", "09:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(utcToZoned(utc, "America/New_York").time).toBe("09:00");
  });

  it("computes the local calendar day, not the server's", () => {
    // 22:00 UTC is already the next day in Tashkent (UTC+5).
    const instant = new Date("2026-05-10T22:00:00Z");
    expect(todayIn("Asia/Tashkent", instant)).toBe("2026-05-11");
    expect(todayIn("UTC", instant)).toBe("2026-05-10");
  });

  it("validates timezone names", () => {
    expect(isValidTimezone("Asia/Tashkent")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });
});
