"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, LoaderCircle, LogOut, Plus, RefreshCw, Settings, TriangleAlert } from "lucide-react";
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

/**
 * What the connect round trip redirected back with. Every one of these used to land on
 * a page that showed nothing at all, so a failed connection looked like a dead button.
 */
const CONNECT_ERRORS: Record<string, string> = {
  invalid_app_id:
    "That platform's App ID isn't valid. Use the numeric App ID from the Meta app's Settings → Basic — the “Instagram App ID” shown on the Instagram product page is a different value and won't work here.",
  not_configured: "This deployment is missing that platform's API credentials. An administrator needs to add them.",
  not_supported: "Connecting that platform isn't available in this version yet.",
  not_implemented: "That platform's integration hasn't been built yet.",
  limit_reached: "Your plan doesn't include another social account. Upgrade to connect more.",
  forbidden: "Your role in this workspace doesn't allow managing accounts.",
  declined: "You cancelled the connection. Nothing was changed.",
  no_page: "That account doesn't administer any Facebook Page, so there's nothing to publish to.",
  no_instagram_account: "None of your Facebook Pages has an Instagram Business or Creator account linked.",
  token_invalid: "The provider rejected those credentials. Check the App ID and secret, then try again.",
  rate_limited: "The provider is rate limiting us right now. Try again in a few minutes.",
  provider_unavailable: "The provider isn't responding right now. Try again in a few minutes.",
  permission_denied: "The provider refused a permission this connection needs. Check the app's approved permissions.",
  permissions_missing:
    "You signed in, but the app wasn't granted the permissions it needs to publish. If it uses Facebook Login for Business, add those permissions to its login configuration — the consent screen only offers what the configuration asks for.",
  state_missing: "That connection attempt expired. Start again.",
  state_invalid: "That connection attempt couldn't be verified. Start again.",
  connect_expired: "That connection expired before you chose an account. Start again.",
  exchange_failed: "The provider wouldn't complete the connection. Try again.",
  connect_failed: "We couldn't start that connection. Try again.",
  unknown_platform: "That platform isn't one Kairo supports.",
};

const STATUS_LABEL: Record<AccountView["status"], { tone: "connected" | "warning" | "failed"; label: string }> = {
  connected: { tone: "connected", label: "Connected" },
  needs_attention: { tone: "warning", label: "Needs attention" },
  expired: { tone: "warning", label: "Expired" },
  error: { tone: "failed", label: "Error" },
  disconnected: { tone: "warning", label: "Disconnected" },
};

export function AccountsView({ accounts, providers, openConnect, error, connected }: { accounts: AccountView[]; providers: ProviderState[]; openConnect: boolean; error?: string | null; connected?: string | null }) {
  const { can } = useWorkspace();
  const [connectOpen, setConnectOpen] = useState(openConnect);
  const connectError = error ? CONNECT_ERRORS[error] ?? "We couldn't complete that connection. Try again." : null;
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

      {connectError && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-[13px] leading-relaxed text-destructive">
          <TriangleAlert size={15} className="mt-px shrink-0" />
          <span>{connectError}</span>
        </div>
      )}

      {connected && !connectError && (
        <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-success/25 bg-success/[0.06] px-4 py-3 text-[13px] text-success">
          <CircleCheck size={15} className="mt-px shrink-0" />
          <span>{PLATFORMS[connected as PlatformId]?.name ?? "Account"} connected.</span>
        </div>
      )}

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
