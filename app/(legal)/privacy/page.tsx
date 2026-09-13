import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Kairo collects, why, who it is shared with, and how to delete it.",
};

export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="13 September 2026">
      <p>
        Kairo is a social media management tool operated by Kairo Labs. This policy describes what we
        collect when you use <strong>kairohub.pro</strong>, why we collect it, who else sees it, and how
        you get it deleted.
      </p>

      <h2>Who we are</h2>
      <p>
        Kairo Labs, Tashkent, Uzbekistan. For anything in this policy, contact{" "}
        <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a>.
      </p>

      <h2>What we collect</h2>
      <h3>Your account</h3>
      <p>
        You sign in with Google. From your Google account we receive your <strong>name, email address
        and profile picture</strong> — nothing else, and we never receive your Google password. We also
        store the timezone your browser reports, so scheduled posts publish at the hour you intended.
      </p>

      <h3>Your content</h3>
      <p>
        The posts, captions and media you create, the schedule you set, and the results of publishing
        them. Uploaded media is stored in a private bucket and served only through short-lived signed
        links.
      </p>

      <h3>Connected social accounts</h3>
      <p>
        When you connect a social account we store the access tokens that platform issues, along with
        your handle, display name and follower count there. <strong>Tokens are encrypted with AES-256-GCM
        before they are written to the database</strong> and are never sent to your browser. We request
        only the permissions needed to publish and to read the analytics we show you.
      </p>

      <h3>Payment details</h3>
      <p>
        Payments are processed by Stripe. <strong>We never see or store your card number.</strong> We keep
        only your Stripe customer id, which plan you are on, and your subscription status.
      </p>

      <h3>Technical records</h3>
      <p>
        Server logs (timestamps, error messages, the action taken), and an audit log of sensitive events
        such as sign-ins, account connections, role changes and publishing. Our logger redacts anything
        token-shaped before writing.
      </p>
      <p>We do not use advertising cookies or third-party analytics trackers.</p>

      <h2>Why we collect it</h2>
      <ul>
        <li><strong>To run the service</strong> — publishing your posts is the product.</li>
        <li><strong>To bill you</strong> — Kairo is a paid subscription.</li>
        <li><strong>To keep it secure</strong> — rate limiting, abuse prevention, and the audit log.</li>
        <li><strong>To support you</strong> — diagnosing a failure you report.</li>
      </ul>
      <p>
        We do not sell your data, and we do not use your content to train machine learning models.
      </p>

      <h2>Who else processes it</h2>
      <table>
        <thead>
          <tr><th>Processor</th><th>What they handle</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase</td><td>Database, authentication and file storage</td></tr>
          <tr><td>Vercel</td><td>Application hosting and request logs</td></tr>
          <tr><td>Stripe</td><td>Subscriptions and card payments</td></tr>
          <tr><td>Google</td><td>Sign-in only</td></tr>
          <tr><td>The social platforms you connect</td><td>Receive the posts you choose to publish</td></tr>
          <tr><td>Anthropic</td><td>Text you send to AI Studio, when you use it</td></tr>
        </tbody>
      </table>
      <p>
        These providers operate outside Uzbekistan, so using Kairo means your data is transferred and
        stored abroad.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your content and account data are kept while your account is open. Delete your workspace and we
        remove them, including your social tokens, within 30 days. Records we are required to keep for
        accounting — invoices and payment history — are retained by Stripe for as long as the law
        requires. Server logs are kept for up to 90 days.
      </p>

      <h2>Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li>Get a copy of your data.</li>
        <li>Correct anything inaccurate.</li>
        <li>Disconnect a social account, which deletes its stored tokens immediately.</li>
        <li>Delete your account and everything in it.</li>
      </ul>
      <p>
        See <a href="/data-deletion">how to delete your data</a>, or email{" "}
        <a href="mailto:privacy@kairohub.pro">privacy@kairohub.pro</a> and we will act within 30 days.
      </p>

      <h2>Security</h2>
      <ul>
        <li>Row-level security in the database: you can only ever read rows in workspaces you belong to.</li>
        <li>Social platform tokens are encrypted at rest and unreachable from the browser.</li>
        <li>All traffic is served over HTTPS.</li>
        <li>Every write is permission-checked on the server, never only in the interface.</li>
      </ul>
      <p>
        No system is perfectly secure. If you find a vulnerability, please tell us at{" "}
        <a href="mailto:security@kairohub.pro">security@kairohub.pro</a> before disclosing it publicly.
      </p>

      <h2>Children</h2>
      <p>Kairo is not intended for anyone under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy materially we will email you before it takes effect. The date at the
        top always reflects the current version.
      </p>
    </LegalPage>
  );
}
