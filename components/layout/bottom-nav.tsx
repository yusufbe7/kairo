"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Inbox, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", icon: LayoutGrid, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/create", icon: Plus, label: "Create" },
  { href: "/posts", icon: FileText, label: "Posts" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-border bg-[rgba(8,9,12,0.92)] backdrop-blur-xl lg:hidden" aria-label="Mobile">
      {ITEMS.map((it) =>
        it.href === "/create" ? (
          <Link key={it.href} href={it.href} aria-label="Create post" className="-mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Plus size={20} />
          </Link>
        ) : (
          <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-[3px] px-2 py-1.5 text-[10.5px] text-dim", pathname === it.href && "text-foreground [&_svg]:text-brand")}>
            <it.icon size={19} strokeWidth={1.8} />{it.label}
          </Link>
        ),
      )}
    </nav>
  );
}
