import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Kairo Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireSuperAdmin();
  return <AdminShell name={name}>{children}</AdminShell>;
}
