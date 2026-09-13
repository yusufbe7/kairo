import type { Metadata } from "next";
import { AdminTable, Td } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/social/status-badge";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Workspaces" };
export const dynamic = "force-dynamic";

interface Row {
  id: string; name: string; plan_id: string; status: string; created_at: string; is_demo: boolean;
  workspace_members: { user_id: string }[];
  posts: { id: string }[];
  social_accounts: { id: string }[];
}

export default async function Page() {
  const { db } = await requireSuperAdmin();
  const { data } = await db
    .from("workspaces")
    .select("id, name, plan_id, status, created_at, is_demo, workspace_members(user_id), posts(id), social_accounts(id)")
    .order("created_at", { ascending: false })
    .limit(100);

  const workspaces = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Workspaces" description={`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} on this deployment.`} />
      <AdminTable headers={["Workspace", "Plan", "Members", "Posts", "Accounts", "Status", "Created"]}>
        {workspaces.map((w) => (
          <tr key={w.id} className="row-hover">
            <Td className="font-medium">{w.name}{w.is_demo && <span className="ml-2 text-[11px] text-dim">demo</span>}</Td>
            <Td className="capitalize">{w.plan_id}</Td>
            <Td>{w.workspace_members?.length ?? 0}</Td>
            <Td>{w.posts?.length ?? 0}</Td>
            <Td>{w.social_accounts?.length ?? 0}</Td>
            <Td>{w.status === "active" ? <StatusBadge tone="connected">Active</StatusBadge> : <StatusBadge tone="warning">Suspended</StatusBadge>}</Td>
            <Td className="text-dim">{timeAgo(w.created_at)}</Td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
