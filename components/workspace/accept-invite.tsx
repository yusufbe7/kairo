"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { acceptInvitation } from "@/lib/actions/workspace";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accept = () =>
    start(async () => {
      const result = await acceptInvitation({ token });
      if (result.ok) router.replace("/dashboard");
      else setError(result.error.message);
    });

  return (
    <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[400px] flex-col justify-center px-5 py-12">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em]">You've been invited</h1>
      <p className="mt-2 text-sm text-muted-foreground">Join this workspace to plan and publish content with the team.</p>
      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[13px] text-destructive">
          <TriangleAlert size={15} />{error}
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <Button variant="primary" className="h-10 flex-1" onClick={accept} disabled={pending}>
          {pending && <LoaderCircle size={15} className="animate-spin" />}Accept invitation
        </Button>
        <Button className="h-10" asChild><Link href="/dashboard">Not now</Link></Button>
      </div>
    </div>
  );
}
