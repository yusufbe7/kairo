import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView, type SettingsData } from "@/components/settings/settings-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { getProfile } from "@/lib/auth/session";
import { listAccounts } from "@/lib/services/accounts";
import { getPlanLimits, getUsage } from "@/lib/services/usage";
import type { ProfileRow, WorkspaceRole } from "@/types/database";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const ctx = await getWorkspacePage();
  const [profile, accounts, limits, usage, members, plan] = await Promise.all([
    getProfile(),
    listAccounts(ctx),
    getPlanLimits(ctx.workspace.id),
    getUsage(ctx.workspace.id),
    ctx.supabase.from("workspace_members").select("user_id, role, profiles(full_name, email)").eq("workspace_id", ctx.workspace.id),
    ctx.supabase.from("plans").select("id, name, price_cents").eq("id", ctx.workspace.plan_id).single(),
  ]);

  const memberRows = (members.data ?? []) as unknown as { user_id: string; role: WorkspaceRole; profiles: Pick<ProfileRow, "full_name" | "email"> | null }[];
  const planRow = (plan.data as { id: string; name: string; price_cents: number } | null) ?? { id: "free", name: "Free", price_cents: 0 };

  const data: SettingsData = {
    profile: {
      fullName: profile?.full_name ?? "", email: profile?.email ?? "", jobTitle: profile?.job_title ?? "",
      locale: profile?.locale ?? "en", notifications: profile?.notification_prefs ?? {},
    },
    members: memberRows
      .map((m) => ({ userId: m.user_id, name: m.profiles?.full_name ?? m.profiles?.email ?? "Member", email: m.profiles?.email ?? "", role: m.role }))
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name))),
    accounts,
    plan: { id: planRow.id, name: planRow.name, priceCents: planRow.price_cents },
    usage: { posts: usage.posts ?? 0, aiGenerations: usage.ai_generations ?? 0, accounts: accounts.length },
    limits,
  };

  return <Suspense><SettingsView data={data} /></Suspense>;
}
