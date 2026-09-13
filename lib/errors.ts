export type ErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT"
  | "LIMIT_REACHED" | "RATE_LIMITED" | "NOT_CONFIGURED" | "NOT_SUPPORTED" | "PROVIDER" | "INTERNAL";

/** An error that is safe to show to users. Technical detail goes in `cause` and the logs only. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly details?: { fieldErrors?: Record<string, string[]>; cause?: unknown },
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 422, CONFLICT: 409, LIMIT_REACHED: 402,
  RATE_LIMITED: 429, NOT_CONFIGURED: 503, NOT_SUPPORTED: 501, PROVIDER: 502, INTERNAL: 500,
};

/** Maps Postgres/PostgREST errors to user-safe AppErrors. */
export function fromDbError(error: { code?: string; message: string } | null, fallback = "Something went wrong. Please try again."): AppError {
  if (!error) return new AppError("INTERNAL", fallback);
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message))
    return new AppError("FORBIDDEN", "You don't have permission to do that in this workspace.", { cause: error });
  if (error.code === "23505") return new AppError("CONFLICT", "That already exists.", { cause: error });
  if (error.code === "PGRST116") return new AppError("NOT_FOUND", "We couldn't find that item.", { cause: error });
  return new AppError("INTERNAL", fallback, { cause: error });
}
