import type { Metadata } from "next";
import { InboxView, type InboxData } from "@/components/inbox/inbox-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listConversations, listMessages, replyCapability } from "@/lib/services/inbox";
import { listAccounts } from "@/lib/services/accounts";

export const metadata: Metadata = { title: "Inbox" };

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const ctx = await getWorkspacePage();
  const [conversations, accounts] = await Promise.all([listConversations(ctx), listAccounts(ctx)]);

  const selected = conversations.find((x) => x.id === c) ?? conversations[0] ?? null;
  let active: InboxData["active"] = null;
  if (selected) {
    const capability = replyCapability(selected.platform);
    active = {
      conversation: selected,
      messages: await listMessages(ctx, selected.id),
      canReply: capability.supported,
      replyBlockedReason: capability.reason,
    };
  }

  return <InboxView data={{ conversations, active, hasAccounts: accounts.length > 0 }} />;
}
