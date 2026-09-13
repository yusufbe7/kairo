import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Deletion request status", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Where the confirmation code from Meta's data deletion callback can be checked. */
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;

  const record = code
    ? (await createAdminClient()
        .from("audit_logs")
        .select("created_at, metadata")
        .eq("target_type", "data_deletion")
        .eq("target_id", code)
        .maybeSingle()).data as { created_at: string; metadata: { platform?: string; accounts_removed?: number } } | null
    : null;

  return (
    <LegalPage title="Deletion request status" updated="13 September 2026">
      {!code && <p>Open this page using the link from your deletion request — it carries the confirmation code.</p>}

      {code && !record && (
        <>
          <p>
            We have no record of the confirmation code <strong>{code}</strong>. Check that it was copied in full.
          </p>
          <p>
            If you believe this is wrong, write to <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a> and
            a person will look into it.
          </p>
        </>
      )}

      {record && (
        <>
          <p>
            Request <strong>{code}</strong> was completed on{" "}
            {new Date(record.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.
          </p>
          <p>
            {record.metadata?.accounts_removed
              ? `We removed ${record.metadata.accounts_removed} connected ${record.metadata.platform ?? "social"} account${record.metadata.accounts_removed === 1 ? "" : "s"}, along with the access tokens stored for them.`
              : "There were no connected accounts left to remove — nothing of yours was held at the time of the request."}
          </p>
          <p>
            Anything else we hold is covered by the <a href="/privacy">Privacy Policy</a>, and{" "}
            <a href="/data-deletion">deleting your workspace</a> removes it. Questions go to{" "}
            <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
