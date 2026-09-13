import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { BILLING_FLAG } from "@/lib/billing/enforcement";
import { FlagList, type Flag } from "@/components/admin/flag-list";

export const metadata: Metadata = { title: "Feature flags" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { db } = await requireSuperAdmin();
  const { data } = await db.from("feature_flags").select("key, enabled, description, updated_at").order("key");
  const flags = ((data ?? []) as Flag[]).slice().sort((a, b) => {
    // Billing first: it is the one with real consequences.
    if (a.key === BILLING_FLAG) return -1;
    if (b.key === BILLING_FLAG) return 1;
    return a.key.localeCompare(b.key);
  });

  // The paywall switch lives in a migration. Until that has run there is no row to
  // toggle, and silently showing nothing is exactly the confusing case to avoid.
  const billingFlagMissing = !flags.some((f) => f.key === BILLING_FLAG);

  return (
    <>
      <PageHeader title="Feature flags" description="Switches that change how this deployment behaves for everyone, immediately." />
      <FlagList flags={flags} billingKey={BILLING_FLAG} billingFlagMissing={billingFlagMissing} />
    </>
  );
}
