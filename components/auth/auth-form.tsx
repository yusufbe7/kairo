"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, TriangleAlert, CircleCheck, MailCheck, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { requestPasswordReset, resendConfirmation, signIn, signInWithGoogle, signUp, updatePassword } from "@/lib/actions/auth";
import { forgotSchema, loginSchema, registerSchema, resendSchema, resetSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[400px] flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8" aria-label="Kairo home"><Logo /></Link>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">{subtitle}</p>
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-6 text-[13px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[13px] text-destructive">
      <TriangleAlert size={15} className="mt-px shrink-0" />{message}
    </div>
  );
}

/** Non-blocking notice: an expired link, a sent email — things that aren't form errors. */
function Notice({ tone, children }: { tone: "warning" | "success"; children: React.ReactNode }) {
  const warn = tone === "warning";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px]",
        warn ? "border-warning/25 bg-warning/[0.06] text-warning" : "border-success/25 bg-success/[0.06] text-success",
      )}
    >
      {warn ? <TriangleAlert size={15} className="mt-px shrink-0" /> : <CircleCheck size={16} className="shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/** Google's mark. Inline so it renders before any network request completes. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/**
 * Google sign-in. Shown only where it is configured, so nobody clicks a button that
 * bounces off a Supabase error page.
 */
function GoogleButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "true") return null;

  const onClick = () => {
    setError(null);
    start(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await signInWithGoogle({ timezone });
      if (result.ok) {
        window.location.assign(result.data.url);
        return;
      }
      setError(result.error.message);
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <FormError message={error} />
      <Button type="button" className="h-10" onClick={onClick} disabled={pending}>
        {pending ? <LoaderCircle size={15} className="animate-spin" /> : <GoogleMark />}
        {label}
      </Button>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11.5px] uppercase tracking-[0.08em] text-dim">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

/** Maps an ActionResult's field errors onto react-hook-form. */
function useActionForm<T extends Record<string, unknown>>(schema: Parameters<typeof zodResolver>[0], defaults: Partial<T>) {
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: defaults as never, mode: "onSubmit" });
  const [formError, setFormError] = useState<string | null>(null);
  const apply = (result: ActionResult<unknown>) => {
    if (result.ok) return true;
    Object.entries(result.error.fieldErrors ?? {}).forEach(([name, messages]) => {
      if (messages?.[0]) form.setError(name as never, { message: messages[0] });
    });
    setFormError(result.error.fieldErrors ? null : result.error.message);
    if (result.error.fieldErrors && !Object.keys(result.error.fieldErrors).length) setFormError(result.error.message);
    return false;
  };
  return { form, formError, setFormError, apply };
}

/** Messages for the `?error=` the auth routes redirect back with. */
const LINK_ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Sign in, or ask for a new one.",
  link_invalid: "That link isn't valid. Ask for a new one.",
  declined: "Google sign-in was canceled. Try again, or use your email and password.",
  provider: "Google sign-in didn't work. Try again, or use your email and password.",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const linkError = LINK_ERRORS[params.get("error") ?? ""] ?? null;
  const [pending, start] = useTransition();
  const { form, formError, setFormError, apply } = useActionForm<{ email: string; password: string }>(loginSchema, { email: "", password: "" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      if (apply(await signIn(values))) router.replace(next.startsWith("/") ? next : "/dashboard");
    });
  });

  return (
    <Shell title="Welcome back" subtitle="Sign in to your Kairo workspace."
      footer={<>New here? <Link href="/register" className="text-foreground underline underline-offset-[3px]">Create an account</Link></>}>
      {linkError && <div className="mb-3.5"><Notice tone="warning">{linkError}</Notice></div>}
      <GoogleButton label="Continue with Google" />
      <form onSubmit={onSubmit} className="mt-3.5 flex flex-col gap-3.5" noValidate>
        <FormError message={formError} />
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-[12.5px] text-muted-foreground hover:text-foreground">Forgot password?</Link>
        </div>
        <Button type="submit" variant="primary" className="mt-1 h-10" disabled={pending}>
          {pending && <LoaderCircle size={15} className="animate-spin" />}Sign in
        </Button>
      </form>
    </Shell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { form, formError, setFormError, apply } = useActionForm<{ fullName: string; email: string; password: string }>(registerSchema, { fullName: "", email: "", password: "" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await signUp({ ...values, timezone });
      if (apply(result) && result.ok) {
        // A real route, not local state: refreshing the page keeps the address and the
        // resend button, and the back button from the inbox lands somewhere sensible.
        router.replace(result.data.needsConfirmation ? "/verify-email" : "/dashboard");
      }
    });
  });

  return (
    <Shell title="Create your workspace" subtitle="Start a 7-day free trial. $0.00 today, cancel anytime."
      footer={<>Already have an account? <Link href="/login" className="text-foreground underline underline-offset-[3px]">Sign in</Link></>}>
      <GoogleButton label="Sign up with Google" />
      <form onSubmit={onSubmit} className="mt-3.5 flex flex-col gap-3.5" noValidate>
        <FormError message={formError} />
        <Field label="Full name" error={form.formState.errors.fullName?.message}>
          <Input autoComplete="name" autoFocus {...form.register("fullName")} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Button type="submit" variant="primary" className="mt-1 h-10" disabled={pending}>
          {pending && <LoaderCircle size={15} className="animate-spin" />}Create account
        </Button>
      </form>
    </Shell>
  );
}

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The screen people land on straight after signing up, and the one every expired
 * confirmation link redirects back to — so there is always a way forward from here.
 */
export function VerifyEmailPanel({ email, expired }: { email: string | null; expired: boolean }) {
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const { form, formError, setFormError, apply } = useActionForm<{ email: string }>(resendSchema, { email: "" });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    setSent(false);
    start(async () => {
      if (apply(await resendConfirmation({ email: values.email }))) {
        setSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    });
  });

  return (
    <Shell
      title={expired ? "That link has expired" : "Check your inbox"}
      subtitle={
        expired
          ? "Confirmation links are single-use and expire after 24 hours. Send yourself a fresh one."
          : "Open the link we just emailed you and your workspace will be ready."
      }
      footer={
        <>
          Already confirmed?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-[3px]">Sign in</Link>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {email && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.025] px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand/10">
              <MailCheck size={15} className="text-brand" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] uppercase tracking-[0.05em] text-dim">Sent to</span>
              <span className="block truncate text-[13.5px] font-medium">{email}</span>
            </span>
          </div>
        )}

        {sent && <Notice tone="success">A new confirmation link is on its way.</Notice>}

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
          <FormError message={formError} />
          {!email && (
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="you@example.com" autoFocus {...form.register("email")} />
            </Field>
          )}
          <Button type="submit" variant={expired ? "primary" : "default"} className="h-10" disabled={pending || cooldown > 0}>
            {pending ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCw size={14} />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new link"}
          </Button>
        </form>

        <p className="text-[12.5px] leading-relaxed text-dim">
          Nothing after a minute or two? Check your spam folder — and make sure the address above is spelled correctly.
        </p>
      </div>
    </Shell>
  );
}

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const { form, formError, setFormError, apply } = useActionForm<{ email: string }>(forgotSchema, { email: "" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => { if (apply(await requestPasswordReset(values))) setSent(true); });
  });

  return (
    <Shell title="Reset your password" subtitle={sent ? "If that address has an account, a reset link is on its way." : "We'll email you a link to choose a new password."}
      footer={<Link href="/login" className="text-foreground underline underline-offset-[3px]">Back to sign in</Link>}>
      {sent ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/[0.06] px-3.5 py-3 text-[13px] text-success"><CircleCheck size={16} />Check your inbox.</div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
          <FormError message={formError} />
          <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" autoComplete="email" autoFocus {...form.register("email")} /></Field>
          <Button type="submit" variant="primary" className="mt-1 h-10" disabled={pending}>
            {pending && <LoaderCircle size={15} className="animate-spin" />}Send reset link
          </Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { form, formError, setFormError, apply } = useActionForm<{ password: string; confirm: string }>(resetSchema, { password: "", confirm: "" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => { if (apply(await updatePassword(values))) router.replace("/dashboard"); });
  });

  return (
    <Shell title="Choose a new password" subtitle="Pick something you haven't used before.">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
        <FormError message={formError} />
        <Field label="New password" error={form.formState.errors.password?.message}><Input type="password" autoComplete="new-password" autoFocus {...form.register("password")} /></Field>
        <Field label="Confirm password" error={form.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...form.register("confirm")} /></Field>
        <Button type="submit" variant="primary" className="mt-1 h-10" disabled={pending}>
          {pending && <LoaderCircle size={15} className="animate-spin" />}Update password
        </Button>
      </form>
    </Shell>
  );
}
