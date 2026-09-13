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

| Provider | Connect | Publish | Analytics | Inbox |
|---|---|---|---|---|
| Facebook | ✅ Pages | ✅ text, photo, carousel, video | — | — |
| Instagram | ✅ Business/Creator | ✅ photo, carousel, Reels, Stories | — | — |
| TikTok, LinkedIn, X, YouTube, Telegram | — | — | — | — |

Facebook and Instagram share `meta/graph.ts`: one transport, one error classification and one
token exchange, because they are the same API underneath.

### What the Meta modules do and do not do

- **Facebook stores a Page**, never a personal profile — only Pages can be posted to through the
  API. Someone who administers several is asked which, at `/accounts/connect/<platform>`; only the
  user token crosses into that step, encrypted in an httpOnly cookie, and the candidates are
  fetched again from the provider on selection so the stored token is always one Meta just issued.
- **Instagram requires a Business or Creator account linked to a Page.** The connect flow finds
  that Page and stores the Instagram account with the Page's token.
- **Page tokens are derived from a long-lived user token**, so they do not expire while access is
  granted. A revoked token is caught on publish and flips the account to `expired` with a message
  telling the user to reconnect, instead of retrying into the same wall.
- **Instagram video is published as a Reel** and polled until Instagram finishes processing it.
  Running out of patience is reported as retryable on purpose: nothing has been published at that
  point, so another attempt costs a wasted container rather than a duplicate post.
- **Mixed photo-and-video Instagram carousels are refused** with a reason rather than silently
  dropping the video.

Both also answer Meta's `deauthorize` and `data-deletion` callbacks, verifying the
`signed_request` signature before deleting anything. Without them a revoked app leaves dead tokens
behind that every scheduled post retries against, and Meta checks both during app review.

Analytics and inbox are still unimplemented everywhere, so both show empty states rather than
invented numbers. The remaining five providers have their environment variables declared and
nothing behind them; the UI says "Not implemented" rather than pretending otherwise.
