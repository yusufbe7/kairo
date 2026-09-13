import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getWorkspacePage } from "@/lib/workspace/context";
import { readConnectSession } from "@/lib/integrations/connect-session";
import { PROVIDERS } from "@/lib/integrations/registry";
import { PLATFORMS } from "@/lib/platforms";
import { can } from "@/lib/permissions";
import { AccountPicker } from "@/components/accounts/account-picker";
import type { ConnectableAccount } from "@/lib/integrations/types";
import type { PlatformId } from "@/types/social";

export const metadata: Metadata = { title: "Choose an account" };
export const dynamic = "force-dynamic";

/** Shown only when a provider offered more than one account to connect. */
export default async function Page({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!(platform in PROVIDERS)) notFound();
  const id = platform as PlatformId;

  const ctx = await getWorkspacePage();
  if (!can(ctx.role, "account.manage")) redirect("/accounts?error=forbidden");

  // An expired or missing handover means the OAuth round trip has to start again.
  const session = await readConnectSession(id).catch(() => null);
  if (!session || session.workspaceId !== ctx.workspace.id) redirect("/accounts?error=connect_expired");

  const { listConnectable } = await import(`@/lib/integrations/${id}/auth`).catch(() => ({ listConnectable: null }));
  if (!listConnectable) redirect("/accounts?error=not_implemented");

  const candidates: ConnectableAccount[] = await listConnectable(session.userToken).catch(() => []);
  if (candidates.length === 0) redirect("/accounts?error=connect_expired");

  return (
    <AccountPicker
      platform={id}
      platformName={PLATFORMS[id].name}
      accounts={candidates.map((c) => ({
        externalAccountId: c.externalAccountId,
        handle: c.handle,
        displayName: c.displayName ?? null,
        avatarUrl: c.avatarUrl ?? null,
        followers: c.followers ?? null,
        subtitle: c.subtitle ?? null,
      }))}
    />
  );
}
