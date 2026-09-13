import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPendingEmail, getUser } from "@/lib/auth/session";
import { VerifyEmailPanel } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, user, email] = await Promise.all([searchParams, getUser(), getPendingEmail()]);
  // A session only exists once the address is confirmed, so there's nothing to wait for.
  if (user) redirect("/dashboard");
  return <VerifyEmailPanel email={email} expired={error === "link_expired"} />;
}
