import Link from "next/link";
import { Logo } from "@/components/layout/logo";

/** Shared chrome for the public legal pages, so they read as part of the product. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="relative z-[1]">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[760px] items-center px-5">
          <Link href="/" aria-label="Kairo home"><Logo /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 py-14">
        <h1 className="text-[clamp(30px,4.4vw,40px)] font-semibold leading-[1.1] tracking-[-0.035em]">{title}</h1>
        <p className="mt-3 text-[13px] text-dim">Last updated {updated}</p>
        <div className="legal mt-10">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-7 text-[12.5px] text-dim">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <span className="flex-1" />
          <span>© {new Date().getFullYear()} Kairo Labs · Tashkent</span>
        </div>
      </footer>
    </div>
  );
}
