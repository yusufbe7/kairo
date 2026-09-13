"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformIcon } from "@/components/social/platform-icon";
import { UserAvatar } from "@/components/social/user-avatar";
import { completeConnection } from "@/lib/actions/accounts";
import { cn } from "@/lib/utils";
import type { PlatformId } from "@/types/social";

export interface PickableAccount {
  externalAccountId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  subtitle: string | null;
}

const formatFollowers = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K followers` : `${n} followers`;

export function AccountPicker({ platform, platformName, accounts }: { platform: PlatformId; platformName: string; accounts: PickableAccount[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(accounts[0]?.externalAccountId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const connect = () => {
    setError(null);
    start(async () => {
      const result = await completeConnection({ platform, externalAccountId: selected });
      if (result.ok) {
        router.replace(`/accounts?connected=${platform}`);
        return;
      }
      setError(result.error.message);
    });
  };

  return (
    <>
      <PageHeader
        title={`Choose a ${platformName} account`}
        description={`You have access to ${accounts.length} — pick the one this workspace should publish to. You can connect the others afterwards.`}
      />

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-[13px] text-destructive">
          <TriangleAlert size={15} className="mt-px shrink-0" />{error}
        </div>
      )}

      <div className="flex max-w-[560px] flex-col gap-2">
        {accounts.map((account) => {
          const on = selected === account.externalAccountId;
          return (
            <button
              key={account.externalAccountId}
              type="button"
              onClick={() => setSelected(account.externalAccountId)}
              aria-pressed={on}
              className={cn(
                "surface flex items-center gap-3.5 p-3.5 text-left transition-colors",
                on ? "border-brand/40 bg-brand/[0.07]" : "hover:border-border-strong",
              )}
            >
              <span className="relative shrink-0">
                {account.avatarUrl ? (
                  // Provider-hosted avatar, so plain <img>: next/image would need every
                  // CDN these platforms use declared up front.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-full object-cover" />
                ) : (
                  <UserAvatar name={account.displayName ?? account.handle} size={38} />
                )}
                <span className="absolute -bottom-1 -right-1 rounded-full bg-panel p-[3px]">
                  <PlatformIcon platform={platform} size={15} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{account.displayName ?? account.handle}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  @{account.handle}
                  {account.subtitle && ` · ${account.subtitle}`}
                  {account.followers != null && ` · ${formatFollowers(account.followers)}`}
                </span>
              </span>
              <span className={cn("h-[15px] w-[15px] shrink-0 rounded-full border", on ? "border-brand bg-brand" : "border-border-strong")} />
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" className="h-10" onClick={connect} disabled={pending || !selected}>
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : null}
          Connect this account
          {!pending && <ArrowRight size={14} />}
        </Button>
        <Button variant="ghost" asChild><Link href="/accounts">Cancel</Link></Button>
      </div>
    </>
  );
}
