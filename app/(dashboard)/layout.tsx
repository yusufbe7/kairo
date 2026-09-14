import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceProvider, type WorkspaceSummary } from "@/components/providers/workspace-provider";
import { getProfile, getUser } from "@/lib/auth/session";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listNotifications } from "@/lib/services/notifications";
import { getSubscription } from "@/lib/billing/subscription";
import { isBillingEnforced } from "@/lib/billing/enforcement";
import { sweepPublishing } from "@/lib/publishing/kick";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const ctx = await getWorkspacePage();

  // Kairo is paid-only: without a trialing or active subscription there is no
  // dashboard. /billing lives outside this group precisely so it stays reachable.
  // The ENFORCE_BILLING flag suspends this while the product is being tested.
  const [subscription, billingEnforced] = await Promise.all([
    getSubscription(ctx.workspace.id),
    isBillingEnforced(),
  ]);
  if (billingEnforced && !subscription.hasAccess) redirect("/billing");

  const profile = await getProfile();
  const notifications = await listNotifications(ctx, 8);

  // Runs after this page is sent, and only if the scheduler has fallen behind.
  sweepPublishing();

  const toSummary = (w: { id: string; name: string; timezone: string; plan_id: string }, role: WorkspaceSummary["role"]): WorkspaceSummary =>
    ({ id: w.id, name: w.name, timezone: w.timezone, planId: w.plan_id, role });

  return (
    <WorkspaceProvider
      value={{
        workspace: toSummary(ctx.workspace, ctx.role),
        workspaces: ctx.memberships.map((m) => toSummary(m.workspace, m.role)),
        today: ctx.today,
        user: { id: user.id, name: profile?.full_name ?? user.email?.split("@")[0] ?? "You", email: user.email ?? "" },
      }}
    >
      <AppShell notifications={notifications} isSuperAdmin={profile?.is_super_admin ?? false} billingBypassed={!billingEnforced}>{children}</AppShell>
    </WorkspaceProvider>
  );
}
