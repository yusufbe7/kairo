"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CircleHelp, Settings, Shield } from "lucide-react";
import { Logo } from "./logo";
import { NAV_GROUPS } from "./nav-config";
import { UserAvatar } from "@/components/social/user-avatar";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function SidebarContent({ onNavigate, isSuperAdmin, staticPath }: { onNavigate?: () => void; isSuperAdmin?: boolean; staticPath?: string }) {
  const pathname = usePathname();
  const active = staticPath ?? pathname;
  return (
    <>
      <Link href="/dashboard" className="px-2 pb-2.5 pt-1.5" onClick={onNavigate} aria-label="Kairo home"><Logo /></Link>
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 mt-[18px] px-2.5 text-[11.5px] font-medium text-dim">{g.label}</div>
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const on = active === it.href;
                return (
                  <Link key={it.href} href={it.href} onClick={onNavigate} className="nav-item" data-active={on} aria-current={on ? "page" : undefined}>
                    <it.icon size={16} strokeWidth={1.8} />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5">
        {isSuperAdmin && (
          <Link href="/admin" onClick={onNavigate} className="nav-item" data-active={active.startsWith("/admin")}>
            <Shield size={16} strokeWidth={1.8} />Admin
          </Link>
        )}
        <Link href="/help" onClick={onNavigate} className="nav-item" data-active={active === "/help"}><CircleHelp size={16} strokeWidth={1.8} />Help</Link>
        <Link href="/settings" onClick={onNavigate} className="nav-item" data-active={active === "/settings"}><Settings size={16} strokeWidth={1.8} />Settings</Link>
        <div className="my-2.5 h-px bg-border" />
        <UserCard onNavigate={onNavigate} />
      </div>
    </>
  );
}

function UserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user, workspace } = useWorkspace();
  return (
    <Link href="/settings" onClick={onNavigate} className="nav-item h-12">
      <UserAvatar name={user.name} size={28} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] text-foreground">{user.name}</span>
        <span className="block text-[11.5px] capitalize text-dim">{workspace.role}</span>
      </span>
      <ChevronDown size={14} className="ml-auto" />
    </Link>
  );
}

export function Sidebar({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-[rgba(9,10,13,0.72)] px-3 py-3.5 backdrop-blur-xl lg:flex">
      <SidebarContent isSuperAdmin={isSuperAdmin} />
    </aside>
  );
}
