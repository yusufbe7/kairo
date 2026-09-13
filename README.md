# Kairo

A social media management platform: plan, create, schedule and analyze content across
Instagram, Facebook, TikTok, LinkedIn, X, YouTube and Telegram from one workspace.

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage) · Redis + BullMQ

---

## What actually works today

Everything below runs against the real database with server-side authorization and row-level security:

- **Auth** — register, log in, log out, Google sign-in, email confirmation (designed templates,
  cross-device links, resend with cooldown), forgot/reset password, protected routes
- **Billing** — Stripe Checkout with a 7-day card-required trial, hosted billing portal, and a
  signature-verified webhook that is the only thing able to grant or revoke access
- **Workspaces** — auto-created on signup, multiple per user, switcher, invitations by email, role changes, removal
- **Roles** — owner / admin / editor / member / viewer, enforced in server actions *and* in RLS policies
- **Posts** — create, edit, duplicate, delete, save draft, schedule, reschedule (single and bulk), retry
- **Calendar** — month / week / list, database-driven, drag-and-drop rescheduling that cancels and re-creates the job
- **Media** — direct browser→Supabase Storage uploads into a private bucket, signed URLs, type and size validation, delete
- **Scheduling** — every scheduled post writes a durable `scheduled_jobs` row; a separate worker publishes it
- **AI Studio** — real model calls server-side, per-platform adaptation, usage stored and rate-limited
- **Analytics** — reads stored snapshots only; shows honest empty states instead of invented numbers
- **Admin panel** — separate `/admin` area gated on `profiles.is_super_admin`: platform metrics, users, workspaces, job monitor, system logs, feature flags (including a paywall kill switch), and an environment-variable checklist per provider
- **Plans & usage** — monthly limits on posts, accounts, members and AI generations, enforced server-side
- **Paywall** — the dashboard is unreachable unless Stripe reports a `trialing` or `active` subscription

### What is deliberately not finished

**No social platform integration is implemented yet.** The schema, OAuth routes (with CSRF state
validation), AES-256-GCM token encryption, the publishing abstraction, the queue and the worker are
all built and tested — but no provider's API calls exist. So:

- Accounts show **"Not configured"** and the connect button is disabled per provider
- Publishing returns a clear `NOT_IMPLEMENTED` error and the post is marked failed with that reason
- Analytics and inbox stay empty rather than showing fabricated data
- Inbox replies say *"not supported by this platform"* instead of pretending to send

Setting the environment variables alone will not change this — each provider also needs its module.
See `lib/integrations/README.md` for the two functions and one class each provider requires.

Also not built yet: the public developer API (`api_keys` table and hashing exist, `/api/v1/*` routes do not), and
provider webhook handlers (`webhook_events` table with idempotency exists, routes do not).

---

## 1. Install

```bash
npm install
cp .env.example .env.local
```

Requires Node 20+.

## 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. From **Project Settings → API**, copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server only, never prefix it with `NEXT_PUBLIC_`
3. Generate the token encryption key:
   ```bash
   openssl rand -base64 32   # → TOKEN_ENCRYPTION_KEY
   ```
4. Under **Authentication → URL Configuration**, set the site URL to `http://localhost:3000` and add
   both `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/callback` as redirect URLs.
5. Paste Kairo's own email templates in — see section 5 below.

## 3. Database migration

With the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor, in filename order:

| Migration | What it creates |
|---|---|
| `…000100_core_schema.sql` | 25 tables, enums, foreign keys, indexes, `updated_at` triggers, seeded plans/roles/flags |
| `…000200_auth_and_rls.sql` | Authorization helpers, signup trigger, `create_workspace` / `accept_invitation` RPCs, column-level grants, RLS on every table |
| `…000300_storage.sql` | Private `media` bucket and membership-based storage policies |
| `…000400_usage_rpc.sql` | Atomic `increment_usage` counter (service role only) |

To verify isolation locally, `supabase/tests/rls_isolation.sql` runs cross-tenant checks
(it expects the stubs in `_supabase_stubs.sql` when run outside Supabase).

## 4. Seed demo data

```bash
npm run db:seed -- you@example.com
```

Register that email in the app first. This creates a **separate** workspace flagged `is_demo` with
demo posts, accounts, conversations and 60 days of analytics — your real workspace is untouched,
and demo accounts have no stored tokens, so they can never publish.

## 5. Auth emails

`supabase/templates/` holds the confirmation, password reset, invite, magic link, email change and
reauthentication emails, generated from one shared layout:

```bash
npm run emails     # regenerates the templates + _preview.html
```

Open `supabase/templates/_preview.html` in a browser to see all six, then follow
[`supabase/templates/README.md`](supabase/templates/README.md) to paste them into the dashboard.

**Google sign-in** is optional: enable the Google provider under **Authentication → Providers**
(its redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`, registered in the Google
Cloud console), then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` to show the button. Left unset,
the button is hidden rather than broken.

**Configure custom SMTP before launch.** Supabase's built-in email service is rate limited to a few
messages an hour and is documented as development-only — without your own SMTP provider most
signups never receive their confirmation link.

## 6. Stripe billing

Kairo is paid-only: `app/(dashboard)/layout.tsx` sends any workspace without a `trialing` or
`active` subscription to `/billing`, and only the Stripe webhook can change that.

1. Create the products in Stripe (**Products → Add product**), one recurring Price per plan and
   interval. The plan ids Kairo knows are `starter`, `pro` and `business` (shown as "Pro Plus").
2. Copy each Price id (`price_…`) into the matching variable:

   | Plan | Monthly | Yearly |
   |---|---|---|
   | Starter | `STRIPE_PRICE_STARTER_MONTHLY` | `STRIPE_PRICE_STARTER_YEARLY` |
   | Pro | `STRIPE_PRICE_PRO_MONTHLY` | `STRIPE_PRICE_PRO_YEARLY` |
   | Pro Plus | `STRIPE_PRICE_BUSINESS_MONTHLY` | `STRIPE_PRICE_BUSINESS_YEARLY` |

   A plan whose Price id is missing simply isn't offered at checkout, so you can launch with one.
   Optionally set `plan_id` in each Price's Stripe metadata — then re-pricing in Stripe never needs
   a redeploy, because the webhook reads the plan from the Price itself.
3. Add `STRIPE_SECRET_KEY` from **Developers → API keys**.
4. Register the webhook at **Developers → Webhooks** pointing to
   `https://kairohub.pro/api/webhooks/stripe`, subscribed to `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `invoice.payment_failed`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.

   **Without the webhook secret nobody can ever get in**, no matter how many successful payments
   Stripe records — returning from Checkout proves nothing, so access is granted only here.

Locally, forward events instead of registering an endpoint:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use a [test card](https://docs.stripe.com/testing) such as `4242 4242 4242 4242` while the keys are
in test mode. `/admin/integrations` shows a ✓/✗ for every billing variable.

### Trials

Checkout is created with `trial_period_days: 7` and `payment_method_collection: "always"`: nothing
is charged today, but a card is on file so the trial converts without asking anyone to come back.
Stripe moves the subscription from `trialing` to `active` on its own, and the webhook writes that
to `subscriptions`.

### Turning the paywall off while you test

`/admin/flags` has an `ENFORCE_BILLING` switch. Off, every workspace goes straight into the
dashboard without a subscription, so you can walk the whole product before Stripe is live. A
warning banner then appears on every page, and the flag change is written to the audit log.

It fails closed: if the flag can't be read, the paywall stays on. Turn it back on before you take
real customers.

## 7. Social provider configuration

**[`docs/social-credentials.md`](docs/social-credentials.md) walks through getting the keys** for
each platform — which developer console, which products to add, which permissions to request, and
what each reviewer will demand of you (a privacy policy, terms, a data-deletion page and a demo
video, none of which Kairo has yet). Telegram needs none of that and is the fastest way to see the
publishing path work end to end; X's API is paid.

Add each provider's credentials to `.env.local` (see `.env.example`). The callback URL to register
with every provider is:

```
https://kairohub.pro/api/accounts/<platform>/callback
```

`/admin/integrations` shows a per-variable ✓/✗ checklist, which is the fastest way to debug a
deployment. Remember that credentials are necessary but not sufficient — the integration module
must exist too.

## 8. Redis

```bash
docker run -p 6379:6379 redis:7
# .env.local → REDIS_URL=redis://localhost:6379
```

Optional in development. Without it the rate limiter falls back to in-process memory and the worker
polls the database instead of consuming a queue. **Use Redis in production**, where serverless
instances don't share memory.

## 9. Worker startup

```bash
npm run worker
```

Scheduled publishing does not depend on a browser being open. The worker claims due jobs with a
conditional update (so two workers never run the same job), records every attempt in
`publishing_attempts`, retries transient failures with exponential backoff (1m → 5m → 15m → 1h),
stops immediately on permanent failures like bad credentials, and notifies workspace members of the
result. It must run as a long-lived process — Railway, Fly.io, Render, or a container — not on Vercel's
serverless runtime.

## 10. Development

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # strict TypeScript, no `any`
npm test           # vitest unit tests
```

## 11. Production build

```bash
npm run build && npm start
```

## 12. Deployment

**Web app (Vercel):** import the repo, add every variable from `.env.example`, set
`NEXT_PUBLIC_APP_URL` to your production URL, and add both `https://kairohub.pro/auth/confirm` and
`https://kairohub.pro/auth/callback` to the Supabase redirect allowlist. Set the Supabase **Site URL**
to the same production origin — the email templates build every link from it.

**Worker (separate service):** deploy the same repo with the start command `npm run worker`. It
needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY` and
`REDIS_URL`.

**First super admin:** run once in the SQL editor —

```sql
update public.profiles set is_super_admin = true where email = 'you@example.com';
```

An "Admin" link then appears in the sidebar. No user can grant this to themselves: the column is
revoked from the `authenticated` role.

---

## Architecture

```
app/
  (auth)/          login, register, verify-email, forgot-password, reset-password
  (dashboard)/     overview, create, calendar, posts, analytics, inbox, accounts, media, ai, settings, help
  admin/           separate control centre — never mixed into the user dashboard
  api/accounts/    OAuth connect + callback per platform
  api/webhooks/    Stripe webhook — the only writer of subscription state
  billing/         plan picker and portal entry, outside the paywall by design
  auth/confirm/    token-hash verification — the link in every Kairo auth email
  auth/callback/   Supabase PKCE code exchange (OAuth, legacy links)
components/        layout, dashboard, editor, calendar, posts, analytics, inbox, accounts, media, ai, settings, admin, auth, social, ui
lib/
  actions/         server actions — the only mutation entry points
  services/        domain logic (posts, media, accounts, analytics, inbox, notifications, usage, ai, audit)
  integrations/    per-provider modules + capability registry
  billing/         Stripe client, plan catalogue, subscription access rules
  publishing/      provider-agnostic publish abstraction
  queue/           durable job records + BullMQ driver
  supabase/        server / admin / browser / middleware clients
  permissions, validation, security, logger, time, env
workers/publish.ts scheduled publishing worker
supabase/          migrations, RLS tests, auth email templates
docs/              how to obtain each social platform's API credentials
tests/             vitest unit tests
```

**Request flow for every mutation:** client component → server action → `requireWorkspace(permission)`
→ Zod validation → service → Supabase (as the user, with RLS) → `revalidatePath`. Errors become
`ActionResult` objects with user-safe messages; technical detail goes to the logger.

### Database

25 tables, UUID keys, foreign keys and indexes on `workspace_id`, `user_id`, `status`,
`scheduled_at`, `platform` and `created_at`.

| Group | Tables |
|---|---|
| Identity | `profiles`, `workspaces`, `workspace_members`, `workspace_invitations`, `roles` |
| Content | `posts`, `post_targets`, `post_media`, `media_assets` |
| Publishing | `scheduled_jobs`, `publishing_attempts` |
| Social | `social_accounts`, `oauth_tokens` |
| Engagement | `conversations`, `messages`, `notifications` |
| Insight | `analytics_daily`, `analytics_post`, `ai_generations` |
| Platform | `plans`, `subscriptions`, `usage`, `api_keys`, `feature_flags`, `system_settings` |
| Audit | `audit_logs`, `system_logs`, `webhook_events` |

### Security

- RLS on every table; users only ever see rows in workspaces they belong to
- `oauth_tokens` has RLS enabled with **no policies** and grants revoked — unreachable from the client
- Column-level grants stop users changing `is_super_admin`, `plan_id`, or their own role
- Provider tokens are AES-256-GCM encrypted before insert
- A partial unique index guarantees one live job per post, so rescheduling can't double-publish
- OAuth state is hashed into an httpOnly cookie and verified on callback
- Server actions validate with Zod and re-check permissions; frontend role checks are cosmetic only
- Rate limits on login, registration, password reset, uploads, post writes, checkout and AI calls
- Stripe webhooks are signature-verified against the raw body and deduplicated by event id
- Audit log for logins, connections, post lifecycle, role changes and admin actions
- Secrets never cross into client bundles; the logger redacts anything token-shaped

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | OAuth and email redirect base |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Client and server Supabase access |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only privileged access |
| `TOKEN_ENCRYPTION_KEY` | for connections | 32-byte base64 key for provider tokens |
| `AI_API_KEY`, `AI_MODEL` | for AI Studio | Hidden in the UI when unset |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | yes | Checkout, portal, and the only path to access |
| `STRIPE_PRICE_*` | per plan | Stripe Price id; a plan without one isn't offered |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | no | Shows the Google button once the provider is enabled |
| `REDIS_URL` | production | Queue + distributed rate limiting |
| `MEDIA_MAX_BYTES`, `LOG_PERSIST_LEVEL` | no | Upload ceiling, log persistence threshold |
| `INSTAGRAM_*`, `FACEBOOK_*`, `TIKTOK_*`, `LINKEDIN_*`, `X_*`, `YOUTUBE_*`, `TELEGRAM_BOT_TOKEN` | per provider | Listed with ✓/✗ at `/admin/integrations` |
