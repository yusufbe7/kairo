import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Kairo Labs for using Kairo.",
};

export default function Page() {
  return (
    <LegalPage title="Terms of Service" updated="13 September 2026">
      <p>
        These terms are the agreement between you and Kairo Labs for using{" "}
        <strong>kairohub.pro</strong>. By creating an account you accept them.
      </p>

      <h2>The service</h2>
      <p>
        Kairo lets you plan, create, schedule and analyze content across social platforms from one
        workspace. It is provided as a subscription.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with Google and are responsible for keeping that Google account secure — anyone who
        controls it controls your Kairo workspace. You must be at least 16, and the information you give
        us must be accurate.
      </p>

      <h2>Subscriptions, trials and refunds</h2>
      <ul>
        <li>
          Every plan starts with a <strong>{TRIAL_DAYS}-day free trial</strong>. A payment method is
          collected up front, but nothing is charged during the trial.
        </li>
        <li>
          <strong>Cancel before the trial ends and you are not charged.</strong> Otherwise the
          subscription starts automatically at the plan price.
        </li>
        <li>Subscriptions renew automatically until you cancel. Cancel any time from the billing portal.</li>
        <li>
          Cancelling stops the next renewal; it does not refund the current period, and you keep access
          until that period ends.
        </li>
        <li>
          If a payment fails we may suspend access until it is resolved. Prices may change with at least
          30 days&rsquo; notice by email.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        <strong>Everything you upload or publish through Kairo stays yours.</strong> You grant us only the
        permission needed to run the service: to store your content, and to transmit it to the platforms
        you have chosen, at the times you have set.
      </p>
      <p>
        You are responsible for what you publish — that you have the rights to it, and that it complies
        with the rules of each platform you send it to.
      </p>

      <h2>Connected accounts</h2>
      <p>
        Connecting a social account authorizes Kairo to act on your behalf there, within the permissions
        you granted. Those platforms have their own terms, and they can change their APIs, restrict
        access or suspend your account for reasons outside our control. We are not responsible for their
        decisions, and a platform withdrawing access is not grounds for a refund.
      </p>

      <h2>What you may not do</h2>
      <ul>
        <li>Publish anything unlawful, or content that infringes someone else&rsquo;s rights.</li>
        <li>Send spam, or use Kairo for coordinated inauthentic behaviour.</li>
        <li>Break, probe or overload the service, or work around its limits and rate limiting.</li>
        <li>Resell access, or share one workspace across organizations to avoid paying for seats.</li>
        <li>Use Kairo in any way that breaches a connected platform&rsquo;s rules.</li>
      </ul>
      <p>We may suspend or close an account that does these things.</p>

      <h2>Availability</h2>
      <p>
        We work to keep Kairo running and publishing on time, but we do not promise uninterrupted
        service. Scheduled publishing depends on the social platforms&rsquo; own APIs; if a platform is
        down or rejects a post, Kairo retries transient failures and shows you the error.{" "}
        <strong>We cannot guarantee that any individual post will be published.</strong>
      </p>

      <h2>Liability</h2>
      <p>
        Kairo is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for lost
        profits, lost reach, missed campaigns or indirect damages, and our total liability is limited to
        what you paid us in the 12 months before the claim.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You may close your account at any time. We may end it if you materially breach these terms, or
        with 30 days&rsquo; notice for any other reason — in which case we refund the unused part of your
        current period. On closure your data is deleted as described in the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of Uzbekistan. We would rather resolve any
        dispute by talking first: <a href="mailto:support@kairohub.pro">support@kairohub.pro</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We will email you before any material change takes effect. Continuing to use Kairo afterwards
        means you accept the updated terms.
      </p>
    </LegalPage>
  );
}
