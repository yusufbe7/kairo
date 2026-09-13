import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/session";
import { listMemberships } from "@/lib/workspace/context";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function Page() {
  await requireUserPage();
  const memberships = await listMemberships();
  if (memberships.length > 0) redirect("/dashboard");
  return <CreateWorkspaceForm />;
}
