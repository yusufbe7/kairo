import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Deleting your data",
  description: "How to remove your Kairo account, your content and your connected social accounts.",
};

/** Meta requires a public data-deletion instructions URL before it will approve an app. */
export default function Page() {
  return (
    <LegalPage title="Deleting your data" updated="13 September 2026">
      <p>
        You can remove your data from Kairo yourself, at any time, without contacting us. Here is
        exactly what each option deletes.
      </p>

      <h2>Disconnect a single social account</h2>
      <p>
        Go to <strong>Accounts</strong> and choose <strong>Disconnect</strong> on the account you want
        removed.
      </p>
      <p>
        This deletes the access and refresh tokens that platform issued to us immediately and
        permanently. Kairo can no longer read from or publish to that account. Posts already published
        stay on the platform — they belong to your account there, not to us, so only that platform can
        remove them.
      </p>

      <h2>Delete your whole workspace</h2>
      <p>
        Go to <strong>Settings → Workspace</strong> and choose <strong>Delete workspace</strong>. Only
        the workspace owner can do this, and it cannot be undone.
      </p>
      <p>This removes:</p>
      <ul>
        <li>Every post, draft and scheduled job, including any queued for future publishing.</li>
        <li>Every uploaded image and video.</li>
        <li>Every connected social account and its stored tokens.</li>
        <li>All stored analytics, conversations and notifications.</li>
        <li>Team members&rsquo; access to that workspace.</li>
      </ul>

      <h2>Delete your account entirely</h2>
      <p>
        Email <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a> from the address you sign in
        with, asking us to delete your account. We remove your profile and every workspace you own
        within <strong>30 days</strong>, and confirm by email when it is done.
      </p>
      <p>
        Cancel your subscription first if you have one — deleting your account does not cancel billing
        on its own.
      </p>

      <h2>What is kept, and why</h2>
      <ul>
        <li>
          <strong>Invoices and payment records</strong> are held by Stripe for as long as accounting law
          requires. They contain your billing details, not your content.
        </li>
        <li>
          <strong>Server logs</strong> may retain a record of requests for up to 90 days before they
          rotate out. Our logger redacts anything token-shaped.
        </li>
        <li>
          <strong>Backups</strong> may hold copies for a short period before expiring on their own
          schedule.
        </li>
      </ul>

      <h2>Questions</h2>
      <p>
        Write to <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a> and a person will answer.
        See the <a href="/privacy">Privacy Policy</a> for what we collect in the first place.
      </p>
    </LegalPage>
  );
}
