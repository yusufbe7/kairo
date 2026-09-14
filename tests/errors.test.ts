import { describe, expect, it } from "vitest";
import { AppError, fromDbError, HTTP_STATUS, messageFrom } from "@/lib/errors";

describe("error mapping", () => {
  it("turns RLS denials into a permission message, not a stack trace", () => {
    const error = fromDbError({ code: "42501", message: "new row violates row-level security policy" });
    expect(error.code).toBe("FORBIDDEN");
    expect(error.userMessage).not.toMatch(/row-level/i);
  });

  it("maps unique violations to CONFLICT and missing rows to NOT_FOUND", () => {
    expect(fromDbError({ code: "23505", message: "duplicate key" }).code).toBe("CONFLICT");
    expect(fromDbError({ code: "PGRST116", message: "no rows" }).code).toBe("NOT_FOUND");
  });

  it("keeps technical detail off the user-facing message", () => {
    const error = fromDbError({ code: "XX000", message: "connection to server at 10.0.0.3 failed" });
    expect(error.userMessage).not.toMatch(/10\.0\.0\.3/);
    expect(error.details?.cause).toBeTruthy();
  });

  it("has an HTTP status for every error code", () => {
    const codes: AppError["code"][] = ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "CONFLICT", "LIMIT_REACHED", "RATE_LIMITED", "NOT_CONFIGURED", "NOT_SUPPORTED", "PROVIDER", "INTERNAL"];
    codes.forEach((code) => expect(HTTP_STATUS[code]).toBeGreaterThan(0));
  });
});

describe("messageFrom", () => {
  it("reads a thrown Error", () => {
    expect(messageFrom(new Error("boom"))).toBe("boom");
  });

  it("reads a Supabase-style rejection, which is a plain object, not an Error", () => {
    // This is the shape that used to be logged as "Unknown error".
    expect(messageFrom({ message: "permission denied for table usage", code: "42501" }))
      .toBe("permission denied for table usage (42501)");
    expect(messageFrom({ message: "no rows" })).toBe("no rows");
  });

  it("reads a thrown string", () => {
    expect(messageFrom("plain failure")).toBe("plain failure");
  });

  it("falls back only when there is genuinely nothing to say", () => {
    expect(messageFrom(null)).toBe("Unknown error");
    expect(messageFrom({})).toBe("Unknown error");
    expect(messageFrom({ message: "   " })).toBe("Unknown error");
    expect(messageFrom(undefined, "nothing")).toBe("nothing");
  });
});
