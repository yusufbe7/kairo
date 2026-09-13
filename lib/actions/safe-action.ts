import "server-only";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Wraps a server action: validates input with Zod, converts thrown errors into
 * user-safe results, and logs unexpected failures (never leaking stack traces to the client).
 */
export function safeAction<I, O>(name: string, schema: ZodType<I, ZodTypeDef, unknown>, handler: (input: I) => Promise<O>) {
  return async (raw: unknown): Promise<ActionResult<O>> => {
    try {
      const input = schema.parse(raw);
      return { ok: true, data: await handler(input) };
    } catch (err) {
      return toResult(name, err);
    }
  };
}

export function toResult(name: string, err: unknown): { ok: false; error: { code: AppError["code"]; message: string; fieldErrors?: Record<string, string[]> } } {
  if (err instanceof ZodError) {
    const flat = err.flatten();
    const first = err.issues[0]?.message ?? "Please check the form.";
    return { ok: false, error: { code: "VALIDATION", message: first, fieldErrors: flat.fieldErrors as Record<string, string[]> } };
  }
  if (err instanceof AppError) {
    if (err.code === "INTERNAL") logger.error(`action.${name}`, err.message, { cause: err.details?.cause });
    return { ok: false, error: { code: err.code, message: err.userMessage, fieldErrors: err.details?.fieldErrors } };
  }
  // next/navigation redirect() throws a special error that must propagate.
  if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
  logger.error(`action.${name}`, err instanceof Error ? err.message : "Unknown error", { error: err });
  return { ok: false, error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } };
}
