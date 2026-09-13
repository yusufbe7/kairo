"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, TriangleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/actions/auth";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/errors";

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

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
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
  const [sent, setSent] = useState(false);
  const { form, formError, setFormError, apply } = useActionForm<{ fullName: string; email: string; password: string }>(registerSchema, { fullName: "", email: "", password: "" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await signUp({ ...values, timezone });
      if (apply(result) && result.ok) {
        if (result.data.needsConfirmation) setSent(true);
        else router.replace("/dashboard");
      }
    });
  });

  if (sent) {
    return (
      <Shell title="Check your inbox" subtitle="We sent you a link to confirm your email address. Open it to finish setting up your workspace."
        footer={<Link href="/login" className="text-foreground underline underline-offset-[3px]">Back to sign in</Link>}>
        <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/[0.06] px-3.5 py-3 text-[13px] text-success">
          <CircleCheck size={16} />Confirmation email sent.
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Create your workspace" subtitle="Free forever plan. No card required."
      footer={<>Already have an account? <Link href="/login" className="text-foreground underline underline-offset-[3px]">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
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
