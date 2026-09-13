"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, LogOut, Plus, RefreshCw, Settings, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/social/status-badge";
import { PlatformIcon } from "@/components/social/platform-icon";
import { ConfirmDialog } from "@/components/posts/confirm-dialog";
import { ConnectDialog } from "./connect-dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { disconnectAccount } from "@/lib/actions/accounts";
import { run } from "@/lib/client/action";
import { PLATFORMS } from "@/lib/platforms";
import { fmtNum, timeAgo } from "@/lib/format";
import type { AccountView, PlatformId } from "@/types/social";

export interface ProviderState { platform: PlatformId; configured: boolean; missingEnv: string[]; canConnect: boolean }

const STATUS_LABEL: Record<AccountView["status"], { tone: "connected" | "warning" | "failed"; label: string }> = {
  connected: { tone: "connected", label: "Connected" },
  needs_attention: { tone: "warning", label: "Needs attention" },
  expired: { tone: "warning", label: "Expired" },
  error: { tone: "failed", label: "Error" },
  disconnected: { tone: "warning", label: "Disconnected" },
};

export function AccountsView({ accounts, providers, openConnect }: { accounts: AccountView[]; providers: ProviderState[]; openConnect: boolean }) {
  const { can } = useWorkspace();
  const [connectOpen, setConnectOpen] = useState(openConnect);
  const [confirming, setConfirming] = useState<AccountView | null>(null);
  const [pending, start] = useTransition();

  const disconnect = (account: AccountView) => start(async () => {
    if (await run(disconnectAccount({ accountId: account.id }), { success: `${PLATFORMS[account.platform].name} disconnected` })) setConfirming(null);
  });

  const anyConfigured = providers.some((p) => p.canConnect);

  return (
    <>
      <PageHeader title="Connected accounts" description={accounts.length ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} connected to this workspace.` : "Connect a platform to start publishing."}>
        {can("account.manage") && <Button variant="primary" onClick={() => setConnectOpen(true)}><Plus size={15} />Connect account</Button>}
      </PageHeader>

      {!anyConfigured && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-[13px] text-warning">
          <TriangleAlert size={15} className="mt-px shrink-0" />
          <span>No social platform is configured on this deployment yet. An administrator needs to add each provider's API credentials before accounts can be connected.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {accounts.map((a) => {
            const status = STATUS_LABEL[a.status];
            return (
              <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="surface surface-lift p-[18px]">
                <div className="flex items-start justify-between">
                  <PlatformIcon platform={a.platform} size={42} />
                  {can("account.manage") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Account settings"><Settings size={15} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setConnectOpen(true)}><RefreshCw />Reconnect</DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setConfirming(a)}><LogOut />Disconnect</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-3.5">
                  <div className="text-[15px] font-semibold">{PLATFORMS[a.platform].name}</div>
                  <div className="truncate text-[13px] text-muted-foreground">{a.handle}</div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  <span className="text-xs text-dim">{a.followers != null ? `${fmtNum(a.followers)} followers` : "—"}</span>
                </div>
                {a.lastError && <p className="mt-2 text-xs text-destructive">{a.lastError}</p>}
                <div className="mt-3 text-xs text-dim">{a.lastSyncedAt ? `Last sync ${timeAgo(a.lastSyncedAt)}` : "Not synced yet"}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {can("account.manage") && (
          <button onClick={() => setConnectOpen(true)} className="dropzone flex min-h-[210px] flex-col items-center justify-center gap-2.5 hover:border-brand/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong"><Plus size={18} /></div>
            <div className="text-[13.5px] font-medium">Connect an account</div>
            <div className="max-w-[220px] text-center text-xs text-dim">Instagram, TikTok, LinkedIn, X, Facebook, YouTube or Telegram</div>
          </button>
        )}
      </div>

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} providers={providers} />
      <ConfirmDialog
        open={!!confirming}
        title={`Disconnect ${confirming ? PLATFORMS[confirming.platform].name : ""}?`}
        description="Scheduled posts targeting this account will fail until you reconnect it. Stored access tokens are deleted."
        confirmLabel="Disconnect"
        pending={pending}
        onConfirm={() => confirming && disconnect(confirming)}
        onClose={() => setConfirming(null)}
      />
      {pending && <span className="sr-only" aria-live="polite"><LoaderCircle size={12} />Working…</span>}
    </>
  );
}
