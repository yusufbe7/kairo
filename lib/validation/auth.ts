import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(80),
  email,
  password,
  timezone: z.string().max(64).optional(),
});
export const forgotSchema = z.object({ email });
/**
 * The address is optional: normally it comes from the pending-signup cookie, and the
 * field is only shown when that cookie is gone. An empty field means "use the cookie".
 */
export const resendSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), email.optional()),
});
/** The browser timezone, so an OAuth signup does not land on a UTC workspace. */
export const googleSchema = z.object({ timezone: z.string().max(64).optional() });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResendInput = z.infer<typeof resendSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
