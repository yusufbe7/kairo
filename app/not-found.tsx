import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <div className="text-sm text-dim">404</div>
      <h1 className="h1">This page isn&apos;t on the schedule.</h1>
      <p className="text-muted-foreground">The link may be broken, or the page was moved.</p>
      <Button variant="primary" className="mt-3" asChild><Link href="/dashboard">Back to overview</Link></Button>
    </div>
  );
}
