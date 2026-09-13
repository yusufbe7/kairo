"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

/**
 * Runs a server action and surfaces failures as a toast.
 * Returns the data on success and null on failure, so call sites stay small.
 */
export async function run<T>(promise: Promise<ActionResult<T>>, options?: { success?: string; onError?: (message: string) => void }): Promise<T | null> {
  const result = await promise;
  if (result.ok) {
    if (options?.success) toast.success(options.success);
    return result.data;
  }
  if (options?.onError) options.onError(result.error.message);
  else toast.error(result.error.message);
  return null;
}
