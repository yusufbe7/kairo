"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Building2, Menu, Check, ChevronDown, CircleCheck, Globe, LoaderCircle, LogOut, MessageCircle, Plus, Search, Settings, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/social/user-avatar";
import { Logo } from "./logo";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { signOut } from "@/lib/actions/auth";
import { switchWorkspace } from "@/lib/actions/workspace";
import { markNotificationsReadAction } from "@/lib/actions/notifications";
import { run } from "@/lib/client/action";
import { timeAgo } from "@/lib/format";
import type { NotificationRow } from "@/types/database";

const ICONS: Record<string, { icon: typeof CircleCheck; tone: string }> = {
  post_published: { icon: CircleCheck, tone: "text-success" },
  post_failed: { icon: TriangleAlert, tone: "text-destructive" },
  oauth_expired: { icon: TriangleAlert, tone: "text-warning" },
  inbox_message: { icon: MessageCircle, tone: "text-muted-foreground" },
};

export function Topbar({ onOpenMenu, notifications }: { onOpenMenu?: () => void; notifications: NotificationRow[] }) {
  const router = useRouter();
  const { workspace, workspaces, user } = useWorkspace();
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const unread = notifications.filter((n) => !n.read_at).length;

  const change = (id: string) => start(async () => { if (await run(switchWorkspace({ workspaceId: id }))) router.refresh(); });
  const logout = () => start(async () => { await signOut(); router.replace("/login"); });
  const openNotifications = (open: boolean) => { if (open && unread > 0) void markNotificationsReadAction({}); };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-[rgba(6,7,9,0.78)] px-5 backdrop-blur-xl">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open menu"><Search size={0} className="hidden" /><span className="sr-only">Menu</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </Button>
      <div className="lg:hidden"><Logo size={20} /></div>
      <div className="relative hidden w-[340px] max-w-[40vw] md:block">
        <Search size={15} className="absolute left-3 top-[10.5px] text-dim" />
        <Input
          className="pl-[34px] pr-11" placeholder="Search posts…" value={query} aria-label="Search posts"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) { router.push(`/posts?q=${encodeURIComponent(query.trim())}`); setQuery(""); } }}
        />
        <kbd className="absolute right-2 top-2 rounded-[5px] border border-border-strong px-1.5 text-[11px] text-dim">↵</kbd>
      </div>
      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="hidden h-[34px] max-w-[200px] md:inline-flex" disabled={pending}>
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Building2 size={14} className="text-muted-foreground" />}
            <span className="truncate">{workspace.name}</span><ChevronDown size={13} className="text-dim" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => change(w.id)}>
              {w.id === workspace.id ? <Check /> : <span className="w-3.5" />}<span className="truncate">{w.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/settings?section=workspace"><Plus />New workspace</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={openNotifications}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell size={17} />
            {unread > 0 && <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full bg-brand shadow-[0_0_0_2px_#060709]" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {notifications.length === 0 && <div className="px-2.5 py-4 text-center text-[12.5px] text-dim">Nothing new right now.</div>}
          {notifications.map((n) => {
            const { icon: Icon, tone } = ICONS[n.type] ?? { icon: CircleCheck, tone: "text-muted-foreground" };
            const body = (
              <>
                <Icon className={`mt-0.5 ${tone}`} />
                <span className="text-[12.5px] leading-snug text-foreground">{n.title}<span className="block text-[11.5px] text-dim">{timeAgo(n.created_at)}</span></span>
              </>
            );
            return (
              <DropdownMenuItem key={n.id} asChild={!!n.link} className="h-auto items-start py-2.5">
                {n.link ? <Link href={n.link}>{body}</Link> : <div>{body}</div>}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Account menu" className="rounded-full"><UserAvatar name={user.name} size={32} /></DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <div className="px-2.5 py-2"><div className="truncate text-[13px] font-medium">{user.name}</div><div className="truncate text-xs text-dim">{user.email}</div></div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/settings"><User />Profile</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/settings"><Settings />Settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/"><Globe />Marketing site</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={logout}><LogOut />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
