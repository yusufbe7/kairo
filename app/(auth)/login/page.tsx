import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense>
      <SignInCard mode="signin" />
    </Suspense>
  );
}
