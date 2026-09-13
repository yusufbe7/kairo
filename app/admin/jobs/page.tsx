import type { Metadata } from "next";
import Link from "next/link";
import { AdminTable, Td } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/social/status-badge";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/database";

export const metadata: Metadata = { title: "Publishing jobs" };
export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [["all", "All"], ["queued", "Queued"], ["processing", "Processing"], ["retrying", "Retrying"], ["completed", "Completed"], ["failed", "Failed"]];

const TONE: Record<JobStatus, "connected" | "scheduled" | "warning" | "failed" | "neutral"> = {
  completed: "connected", queued: "scheduled", processing: "scheduled", retrying: "warning", failed: "failed", canceled: "neutral",
};

interface Row {
  id: string; status: JobStatus; run_at: string; attempts: number; max_attempts: number; last_error: string | null; created_at: string;
  posts: { title: string; caption: string } | null;
  workspaces: { name: string } | null;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { db } = await requireSuperAdmin();

  let query = db.from("scheduled_jobs").select("id, status, run_at, attempts, max_attempts, last_error, created_at, posts(title, caption), workspaces(name)")
    .order("run_at", { ascending: false }).limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;

  const jobs = (data ?? []) as unknown as Row[];
  const active = status ?? "all";

  return (
    <>
      <PageHeader title="Publishing jobs" description="Every scheduled and executed publish across the platform." />
      <div className="no-scrollbar mb-3.5 flex gap-1 overflow-x-auto">
        {FILTERS.map(([value, label]) => (
          <Link key={value} href={value === "all" ? "/admin/jobs" : `/admin/jobs?status=${value}`}
            className={cn("chip", active === value && "border-border-strong bg-white/[0.08] text-foreground")}>{label}</Link>
        ))}
      </div>
      <AdminTable headers={["Job", "Post", "Workspace", "Run at", "Status", "Attempts", "Last error"]} empty="No jobs match this filter.">
        {jobs.map((j) => (
          <tr key={j.id} className="row-hover">
            <Td className="font-mono text-[11.5px] text-dim">{j.id.slice(0, 8)}</Td>
            <Td className="max-w-[240px] truncate">{j.posts?.title || j.posts?.caption?.slice(0, 40) || "—"}</Td>
            <Td className="text-dim">{j.workspaces?.name ?? "—"}</Td>
            <Td className="text-dim">{timeAgo(j.run_at)}</Td>
            <Td><StatusBadge tone={TONE[j.status]}><span className="capitalize">{j.status}</span></StatusBadge></Td>
            <Td>{j.attempts} / {j.max_attempts}</Td>
            <Td className="max-w-[280px] truncate text-destructive">{j.last_error ?? ""}</Td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
