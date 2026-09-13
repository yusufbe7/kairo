import { describe, expect, it } from "vitest";
import { AppError, fromDbError, HTTP_STATUS } from "@/lib/errors";

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
