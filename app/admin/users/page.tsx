import type { Metadata } from "next";
import { AdminTable, Td } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/social/status-badge";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { timeAgo } from "@/lib/format";
import type { ProfileRow } from "@/types/database";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { db } = await requireSuperAdmin();

  let query = db.from("profiles").select("*, workspace_members(workspace_id, role)").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("email", `%${q.replace(/[%,]/g, "")}%`);
  const { data } = await query;

  const users = (data ?? []) as unknown as (ProfileRow & { workspace_members: { workspace_id: string; role: string }[] })[];

  return (
    <>
      <PageHeader title="Users" description={`${users.length} account${users.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}.`} />
      <form className="mb-3.5" action="/admin/users">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by email" aria-label="Search users"
          className="h-9 w-full max-w-[320px] rounded-[10px] border border-input bg-white/[0.03] px-3 text-[13px] outline-none placeholder:text-dim focus:border-border-strong" />
      </form>
      <AdminTable headers={["Email", "Name", "Workspaces", "Role", "Status", "Joined", "Last active"]} empty="No users match that search.">
        {users.map((u) => (
          <tr key={u.id} className="row-hover">
            <Td className="font-medium">{u.email ?? "—"}</Td>
            <Td>{u.full_name ?? "—"}</Td>
            <Td>{u.workspace_members?.length ?? 0}</Td>
            <Td>{u.is_super_admin ? <StatusBadge tone="scheduled">Super admin</StatusBadge> : <span className="text-dim">Member</span>}</Td>
            <Td>{u.status === "active" ? <StatusBadge tone="connected">Active</StatusBadge> : <StatusBadge tone="warning">Suspended</StatusBadge>}</Td>
            <Td className="text-dim">{timeAgo(u.created_at)}</Td>
            <Td className="text-dim">{u.last_active_at ? timeAgo(u.last_active_at) : "—"}</Td>
          </tr>
        ))}
      </AdminTable>
      <p className="mt-4 text-xs text-dim">
        Destructive user actions (suspend, delete, force password reset) go through the Supabase Auth admin API and are
        deliberately not wired to one-click buttons yet — see the README for the intended flow.
      </p>
    </>
  );
}
