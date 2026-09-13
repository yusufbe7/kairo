"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { signInWithGoogle } from "@/lib/actions/auth";
import { TRIAL_DAYS } from "@/lib/billing/plans";

/** Messages for the `?error=` the auth routes redirect back with. */
const SIGN_IN_ERRORS: Record<string, string> = {
  declined: "Sign-in was canceled. Nothing happened — try again when you're ready.",
  provider: "Google sign-in didn't work. Please try again in a moment.",
  link_expired: "That link has expired or was already used. Sign in again below.",
  link_invalid: "That link isn't valid. Sign in again below.",
};

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-3 text-left text-[13px] leading-relaxed text-warning">
      <TriangleAlert size={15} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Google's mark, inline so it renders before any network request completes. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/**
 * The only way into Kairo.
 *
 * Google is the sole identity provider: it has already verified the address, so
 * there is no confirmation email, no password to forget and no reset flow — one
 * click and the workspace exists. Disable the Email provider in Supabase too, or
 * accounts can still be created through the API with no UI to match.
 */
export function SignInCard({ mode }: { mode: "signin" | "signup" }) {
  const error = SIGN_IN_ERRORS[useSearchParams().get("error") ?? ""] ?? null;
  const [agreed, setAgreed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const signUp = mode === "signup";

  const onClick = () => {
    // Greying out the only button on the page reads as broken. Leave it live and say
    // what is missing when it is pressed.
    if (!agreed) {
      setFailure("Please accept the Terms and Privacy Policy first.");
      return;
    }
    setFailure(null);
    start(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await signInWithGoogle({ timezone });
      if (result.ok) {
        // Leave the SPA: Google's consent screen is on its own domain.
        window.location.assign(result.data.url);
        return;
      }
      setFailure(result.error.message);
    });
  };

  return (
    <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-5 py-12">
      <div className="surface p-7 text-center sm:p-8">
        <Link href="/" className="inline-flex" aria-label="Kairo home"><Logo /></Link>

        <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
          {signUp ? "Create your workspace" : "Sign in"}
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          {signUp ? `Start a ${TRIAL_DAYS}-day free trial. $0.00 today, cancel anytime.` : "Welcome back to Kairo."}
        </p>

        <div className="mt-6 flex flex-col gap-3.5">
          {error && <Notice>{error}</Notice>}
          {failure && <Notice>{failure}</Notice>}

          <label id="consent" className="flex cursor-pointer items-center justify-center gap-2.5 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-[15px] w-[15px] shrink-0 cursor-pointer accent-brand"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-foreground underline underline-offset-[3px]">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-foreground underline underline-offset-[3px]">Privacy Policy</Link>
            </span>
          </label>

          <Button variant="primary" className="h-11" onClick={onClick} disabled={pending} aria-describedby="consent">
            {pending ? <LoaderCircle size={16} className="animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>
        </div>

        <p className="mt-5 text-[12.5px] leading-relaxed text-dim">
          {signUp
            ? "No password to remember. We only ever see your name, email address and profile picture."
            : "New here? Signing in with Google creates your workspace automatically."}
        </p>
      </div>
    </div>
  );
}
