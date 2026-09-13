import type { Metadata } from "next";
import { AccountsView, type ProviderState } from "@/components/accounts/accounts-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listAccounts } from "@/lib/services/accounts";
import { allProviderStatuses } from "@/lib/integrations/registry";

export const metadata: Metadata = { title: "Accounts" };

export default async function Page({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const { connect } = await searchParams;
  const ctx = await getWorkspacePage();
  const accounts = await listAccounts(ctx);

  const providers: ProviderState[] = allProviderStatuses().map((p) => ({
    platform: p.platform, configured: p.configured, missingEnv: p.missingEnv,
    canConnect: p.configured && p.capabilities.connect,
  }));

  return <AccountsView accounts={accounts} providers={providers} openConnect={connect === "1"} />;
}
