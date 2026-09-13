"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, CircleCheck, Inbox as InboxIcon, Info, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { PlatformGlyph, PlatformIcon } from "@/components/social/platform-icon";
import { UserAvatar } from "@/components/social/user-avatar";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { markRead, sendReply } from "@/lib/actions/inbox";
import { run } from "@/lib/client/action";
import { MAIN_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { timeAgo } from "@/lib/format";
import type { ConversationView, MessageView, PlatformId } from "@/types/social";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | PlatformId;

export interface InboxData {
  conversations: ConversationView[];
  active: { conversation: ConversationView; messages: MessageView[]; canReply: boolean; replyBlockedReason: string } | null;
  hasAccounts: boolean;
}

export function InboxView({ data }: { data: InboxData }) {
  const router = useRouter();
  const { can } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [reply, setReply] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const active = data.active;
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [active?.messages.length]);

  const list = data.conversations.filter((c) => filter === "all" || (filter === "unread" ? c.unread > 0 : c.platform === filter));
  const unreadCount = data.conversations.filter((c) => c.unread > 0).length;

  const open = (id: string) => {
    setMobileOpen(true);
    setReply("");
    router.push(`/inbox?c=${id}`, { scroll: false });
    void markRead({ conversationId: id });
  };

  const send = () => {
    if (!active || !reply.trim()) return;
    start(async () => {
      const result = await sendReply({ conversationId: active.conversation.id, platform: active.conversation.platform, body: reply.trim() });
      if (result.ok) { setReply(""); router.refresh(); }
      else await run(Promise.resolve(result));
    });
  };

  if (!data.hasAccounts) {
    return (
      <>
        <PageHeader title="Inbox" description="Comments and messages from every account, in one place." />
        <div className="surface">
          <EmptyState icon={InboxIcon} title="Connect an account to use the inbox"
            text="Once a platform is connected, its conversations are pulled in here."
            action={<Button size="sm" variant="primary" asChild><Link href="/accounts">Connect an account</Link></Button>} />
        </div>
      </>
    );
  }

  const filters: [Filter, string][] = [["all", "All"], ["unread", "Unread"], ...MAIN_PLATFORMS.map((p) => [p, PLATFORMS[p].name] as [Filter, string])];

  return (
    <>
      <PageHeader title="Inbox" description="Comments and messages from every account, in one place." />
      <div className="surface grid h-[calc(100vh-260px)] min-h-[520px] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={cn("flex min-h-0 flex-col border-r border-border", mobileOpen && "hidden lg:flex")}>
          <div className="border-b border-border p-3">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {filters.map(([value, label]) => (
                <button key={value} className="chip h-7 shrink-0" data-on={filter === value} onClick={() => setFilter(value)}>
                  {value !== "all" && value !== "unread" && <PlatformGlyph platform={value} size={12} />}{label}
                  {value === "unread" && unreadCount > 0 && <span className="text-dim">{unreadCount}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto">
            {list.length === 0 && <EmptyState icon={CircleCheck} title="Nothing here" text="New messages will land in this list." />}
            {list.map((c) => (
              <button key={c.id} onClick={() => open(c.id)}
                className={cn("row-hover flex w-full gap-3 border-l-2 border-transparent px-3.5 py-3 text-left", active?.conversation.id === c.id && "border-l-foreground bg-white/[0.04]")}>
                <div className="relative">
                  <UserAvatar name={c.name} size={36} />
                  <div className="absolute -bottom-[3px] -right-[3px] rounded-md bg-background p-px"><PlatformIcon platform={c.platform} size={16} /></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[13px]", c.unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                    <span className="shrink-0 text-[11.5px] text-dim">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex-1 truncate text-[12.5px]", c.unread ? "text-foreground" : "text-dim")}>{c.preview}</span>
                    {c.unread > 0 && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-foreground" aria-label="Unread" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className={cn("flex min-h-0 flex-col", !mobileOpen && "hidden lg:flex")}>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Back"><ChevronLeft size={16} /></Button>
              <UserAvatar name={active.conversation.name} size={34} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{active.conversation.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-dim"><PlatformGlyph platform={active.conversation.platform} size={11} />{active.conversation.handle}</div>
              </div>
            </div>

            <div className="thin-scroll flex flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] py-5">
              {active.messages.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("max-w-[74%]", m.me ? "self-end" : "self-start")}>
                  <div className={cn("rounded-[14px] px-3 py-2 text-[13.5px]", m.me ? "rounded-br-[4px] bg-primary text-primary-foreground" : "rounded-bl-[4px] border border-border bg-white/5")}>{m.text}</div>
                  <div className={cn("mt-1 text-[11px] text-dim", m.me && "text-right")}>{timeAgo(m.sentAt)}</div>
                </motion.div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="px-4 pb-4">
              {active.canReply && can("inbox.reply") ? (
                <div className="flex items-center gap-1 rounded-xl border border-border-strong bg-white/[0.02] p-[5px]">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Reply..." aria-label="Reply" className="min-w-0 flex-1 bg-transparent px-2.5 text-[13.5px] outline-none placeholder:text-dim" />
                  <Button variant="primary" size="icon-sm" onClick={send} disabled={!reply.trim() || pending} aria-label="Send">
                    {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-white/[0.02] px-3.5 py-2.5 text-xs text-dim">
                  <Info size={13} className="mt-px shrink-0" />
                  {can("inbox.reply") ? active.replyBlockedReason : "Your role can read the inbox but not reply."}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden items-center justify-center lg:flex">
            <EmptyState icon={InboxIcon} title="No conversation selected" text="Pick a conversation from the list to read it." />
          </div>
        )}
      </div>
    </>
  );
}
