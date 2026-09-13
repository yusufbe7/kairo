import type { Metadata } from "next";
import Link from "next/link";
import { Activity, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AdminChart } from "@/components/admin/admin-chart";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { dailySeries, platformOverview, publishingHealth } from "@/lib/admin/queries";
import { allProviderStatuses } from "@/lib/integrations/registry";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="surface p-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] ${tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : ""}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-dim">{hint}</div>}
    </div>
  );
}

export default async function Page() {
  const { db } = await requireSuperAdmin();
  const [stats, health, userSeries, postSeries] = await Promise.all([
    platformOverview(db),
    publishingHealth(db),
    dailySeries(db, "profiles", 30),
    dailySeries(db, "posts", 30),
  ]);
  const configured = allProviderStatuses().filter((p) => p.configured).length;

  return (
    <>
      <PageHeader title="Platform overview" description="Everything across every workspace on this deployment." />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Users" value={stats.users} hint={`${stats.activeUsers} active in 30 days`} />
        <Stat label="Workspaces" value={stats.workspaces} />
        <Stat label="Published today" value={stats.publishedToday} />
        <Stat label="Scheduled" value={stats.scheduled} hint="across all workspaces" />
        <Stat label="Failed posts" value={stats.failed} tone={stats.failed ? "bad" : undefined} hint={stats.failed ? "needs attention" : "all clear"} />
        <Stat label="Connected accounts" value={stats.accounts} />
        <Stat label="AI generations" value={stats.aiGenerations} hint="last 30 days" />
        <Stat label="Queue depth" value={stats.queueDepth} tone={stats.queueDepth > 50 ? "warn" : undefined} hint={`${stats.retrying} retrying`} />
        <Stat label="Publish success" value={health.successRate == null ? "—" : `${health.successRate}%`} hint={health.attempts ? `${health.attempts} attempts` : "no attempts yet"} />
        <Stat label="Providers configured" value={`${configured} / 7`} tone={configured === 0 ? "warn" : undefined} hint="credentials present" />
      </div>

      {stats.failed > 0 && (
        <Link href="/admin/jobs?status=failed" className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-[13px] text-destructive">
          <TriangleAlert size={15} className="mt-px shrink-0" />
          <span>{stats.failed} post{stats.failed === 1 ? "" : "s"} failed to publish. Open the jobs view to inspect the provider errors.</span>
        </Link>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminChart data={userSeries} title="User growth" subtitle="New sign-ups, last 30 days" />
        <AdminChart data={postSeries} title="Posts created" subtitle="Across all workspaces, last 30 days" />
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-dim">
        <Activity size={13} />Queue health reflects rows in <code className="text-muted-foreground">scheduled_jobs</code>. Start the worker with <code className="text-muted-foreground">npm run worker</code>.
      </p>
    </>
  );
}
