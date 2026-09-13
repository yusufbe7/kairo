import { z } from "zod";

/** The browser timezone, so a Google signup does not land on a UTC workspace. */
export const googleSchema = z.object({ timezone: z.string().max(64).optional() });

export type GoogleInput = z.infer<typeof googleSchema>;
