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
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
