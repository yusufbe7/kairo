# Provider integrations

Each platform lives in its own folder and is wired in through two registries. Nothing in the UI
claims a provider works until both are updated — that is deliberate.

## Adding a provider

1. **`lib/integrations/<platform>/auth.ts`** — export two functions:

   ```ts
   export async function buildAuthorizeUrl(input: { state: string; redirectUri: string }): Promise<string>;

   export async function exchangeCode(input: { code: string; redirectUri: string }): Promise<{
     externalAccountId: string;
     handle: string;
     displayName?: string | null;
     avatarUrl?: string | null;
     scopes?: string[];
     accessToken: string;
     refreshToken?: string | null;
     expiresAt?: Date | null;
   }>;
   ```

   The OAuth routes (`app/api/accounts/[platform]/{connect,callback}`) handle state generation,
   CSRF validation, token encryption and account storage. You only implement the provider calls.

2. **`lib/integrations/<platform>/publish.ts`** — export a `Publisher` (see `lib/publishing/types.ts`)
   whose `publish()` returns the normalized `PublishResult`. Mark transient failures
   (rate limits, 5xx) as `retryable: true` so the worker backs off instead of giving up;
   leave credential and validation errors as `retryable: false`.

3. **`lib/integrations/<platform>/analytics.ts`** — fetch metrics and map them onto
   `analytics_daily` / `analytics_post`.

4. Register the publisher in `lib/publishing/index.ts` and flip the matching capability flags in
   `lib/integrations/registry.ts` (`connect`, `publish`, `analytics`, `inbox`).

## Rules

- Official APIs only. No scraping, no browser automation, no unofficial endpoints.
- Secrets stay in environment variables and never reach the browser.
- Tokens are encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256-GCM) before they touch the database,
  and `oauth_tokens` is unreadable by the `authenticated` role.
- Normalize every provider error. Users see a plain-language message; details go to the logs.

## Current status

All seven providers are declared in the registry with their required environment variables, and
every capability is `false`: the schema, OAuth plumbing, token encryption, queue and worker are
built, but no provider's API calls are implemented yet. The UI reflects this honestly —
accounts show "Not configured", publishing is refused with a clear reason, and analytics
show empty states rather than invented numbers.
