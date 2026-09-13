"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowLeft, Building2, ChartColumn, FileText, Plug, ScrollText, ToggleRight, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: ChartColumn },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/admin/jobs", label: "Publishing jobs", icon: Activity },
  { href: "/admin/logs", label: "System logs", icon: ScrollText },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
  { href: "/admin/flags", label: "Feature flags", icon: ToggleRight },
];

export function AdminShell({ children, name }: { children: React.ReactNode; name: string }) {
  const pathname = usePathname();
  return (
    <div className="relative z-[1] flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border-strong bg-[rgba(9,10,13,0.86)] px-3 py-3.5 lg:flex">
        <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
          <Logo />
          <span className="rounded-[5px] border border-border-strong px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide text-dim">Admin</span>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-0.5" aria-label="Admin">
          {NAV.map((item) => {
            const on = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="nav-item" data-active={on} aria-current={on ? "page" : undefined}>
                <item.icon size={16} strokeWidth={1.8} />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-0.5">
          <Link href="/dashboard" className="nav-item"><ArrowLeft size={16} strokeWidth={1.8} />Back to app</Link>
          <div className="my-2.5 h-px bg-border" />
          <div className="px-2.5 py-1.5 text-[11.5px] text-dim">Signed in as {name}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-[rgba(6,7,9,0.86)] px-5 backdrop-blur-xl lg:hidden">
          <Logo size={20} />
          <span className="text-[11.5px] uppercase tracking-wide text-dim">Admin</span>
          <div className="flex-1" />
          <Link href="/dashboard" className="text-[12.5px] text-muted-foreground">Back to app</Link>
        </header>
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-4 lg:hidden">
          {NAV.map((item) => {
            const on = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn("-mb-px whitespace-nowrap border-b-[1.5px] border-transparent px-2.5 py-2.5 text-[12.5px] text-muted-foreground", on && "border-foreground text-foreground")}>
                {item.label}
              </Link>
            );
          })}
        </div>
        <main className="mx-auto max-w-[1400px] px-5 py-7 md:px-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Dense table styling shared by every admin list. */
export function AdminTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.flat() : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;
  return (
    <div className="surface">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[11.5px] uppercase tracking-wide text-dim">
              {headers.map((h) => <th key={h} className="whitespace-nowrap border-b border-border px-3.5 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      {isEmpty && <div className="px-3.5 py-8 text-center text-[12.5px] text-dim">{empty ?? "Nothing here yet."}</div>}
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap border-b border-border px-3.5 py-2.5", className)}>{children}</td>;
}
