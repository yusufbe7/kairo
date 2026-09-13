# Getting the social platform credentials

How to obtain every `*_CLIENT_ID` / `*_CLIENT_SECRET` in `.env.example`, per platform.

**Read this first.** Credentials are necessary but not sufficient. Each provider also needs its
integration module (`lib/integrations/<platform>/`), and none of them are written yet — see
[`lib/integrations/README.md`](../lib/integrations/README.md). Until that module exists the account
shows "Not configured" and publishing returns `NOT_IMPLEMENTED`, however many keys you add. Adding
the keys first is still worth it: app review takes days to weeks, so start the paperwork early.

## What every provider will ask you for

Have these ready before you start — they are the part that actually blocks approval:

| Requirement | Detail |
|---|---|
| **A live HTTPS site** | `https://kairohub.pro` — a custom domain, which some reviewers require over `*.vercel.app`. |
| **Privacy policy URL** | A real page at a stable URL. Every single platform requires it. |
| **Terms of service URL** | Required by Meta, TikTok and X. |
| **Data deletion instructions URL** | Required by Meta. A page explaining how a user removes their data. |
| **A demo video** | Meta and TikTok want a screen recording of the actual connect-and-publish flow. |
| **A business entity** | Meta and TikTok verify businesses for the permissions that matter. |

Kairo has none of these pages yet. They are the first thing to build if you intend to apply.

## Redirect URI

Every provider needs the callback registered. Kairo's is always:

```
https://kairohub.pro/api/accounts/<platform>/callback
```

So `https://kairohub.pro/api/accounts/instagram/callback`, `.../tiktok/callback`, and so on.
Add the `http://localhost:3000/...` variant too where the provider allows it.

## Meta's other two URLs

Facebook and Instagram also want two callbacks, and app review checks them. Both are built:

| Meta field | URL |
|---|---|
| Deauthorize callback URL | `https://kairohub.pro/api/accounts/facebook/deauthorize` |
| Data deletion **callback** URL | `https://kairohub.pro/api/accounts/facebook/data-deletion` |

Swap `facebook` for `instagram` on that app. Both verify Meta's `signed_request` signature and
delete the person's connected accounts and stored tokens; the deletion endpoint answers with a
confirmation code and a status URL, as Meta requires.

Because the callback endpoint exists, you no longer need the "data deletion instructions URL"
alternative — though `https://kairohub.pro/data-deletion` remains a valid answer for it.

---

## Instagram — `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET`

Publishing to Instagram goes through the **Instagram Graph API**, not the old Basic Display API
(which Meta shut down). It only works for **Business or Creator** accounts linked to a Facebook
Page — personal Instagram accounts cannot be published to by any tool, including this one.

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create app**.
2. Pick use case **Other** → type **Business**.
3. Add the **Instagram** product to the app.
4. Under **App settings → Basic**, copy **App ID** → `INSTAGRAM_CLIENT_ID` and
   **App secret** → `INSTAGRAM_CLIENT_SECRET`.
5. Add the redirect URI under the Instagram product's OAuth settings.
6. Request these permissions in **App review**: `instagram_basic`,
   `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.

In development mode the app works only for people with a role on it — admin, developer or tester.
**This is what limits a Meta app to its own developers, and no amount of code changes it.** To let
anyone connect you need, in this order:

1. **Business verification** — Meta verifies your company's legal existence with documents.
2. **App review** for each advanced permission: `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `business_management`, and for Instagram `instagram_basic` and
   `instagram_content_publish`. Each one needs a screencast showing a real person connecting an
   account and publishing through your product.
3. **Switch the app to Live** once both are granted.

Budget weeks, and expect at least one rejection asking for a clearer video.

## Facebook — `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`

The same Meta app can serve both, but a separate app keeps permissions and review scope cleaner.

1. Same console, **Create app** → use case **Other** → **Business**.
2. Add the **Facebook Login** product.
3. **App settings → Basic** → App ID and App secret.
4. **Facebook Login → Settings** → add the redirect URI to *Valid OAuth Redirect URIs*.
5. Request `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` and
   `business_management` in app review.

Only Facebook **Pages** can be posted to programmatically, not personal profiles.

## TikTok — `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`

Note the variable name: TikTok calls it a *client key*, not a client id.

1. Register at [developers.tiktok.com](https://developers.tiktok.com) and create an app.
2. Add the **Login Kit** and **Content Posting API** products.
3. **Manage apps → your app** → copy **Client key** and **Client secret**.
4. Add the redirect URI under Login Kit.
5. Request the `video.publish` scope, and verify your domain by hosting the file TikTok gives you.

TikTok audits the Content Posting API individually and asks for a demo video. Until you pass it,
posts are created as private drafts in the user's account.

## LinkedIn — `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`

1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**.
2. A LinkedIn **Page** for your company is required, and you must verify the app from that Page —
   you cannot create an app without one.
3. **Auth** tab → copy **Client ID** and **Primary Client Secret**, and add the redirect URI.
4. **Products** tab → request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID
   Connect**. For company pages, also request **Advertising API** or **Community Management API**.

Personal-profile posting is granted quickly; posting to company pages takes a review.

## X (Twitter) — `X_CLIENT_ID` / `X_CLIENT_SECRET`

**X's API is paid.** The free tier cannot read, and its write allowance is far too small for a
scheduling tool. Basic is $200/month at the time of writing. Budget for this before you build it.

1. Go to [developer.x.com](https://developer.x.com) → sign up for a developer account.
2. Create a **Project**, then an **App** inside it.
3. **User authentication settings** → enable **OAuth 2.0**, app type **Web App**, add the
   callback URL, and set your website URL.
4. Copy the **OAuth 2.0 Client ID** and **Client Secret** — not the API key/secret, which are the
   older OAuth 1.0a pair.
5. Scopes needed: `tweet.read`, `tweet.write`, `users.read`, `offline.access`.

## YouTube — `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`

This is a Google Cloud OAuth client, the same kind as Google sign-in but a separate one.

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **OAuth consent screen** → External. Fill in the app name, support email, privacy policy and
   terms URLs, and the authorized domain.
4. **Credentials → Create credentials → OAuth client ID** → **Web application**. Add the redirect
   URI. Copy the client ID and secret.
5. Scope: `https://www.googleapis.com/auth/youtube.upload`.

That scope is **restricted**, so Google requires a security assessment and a demo video before you
can serve more than 100 test users. Note that uploads from an unverified app are locked to private.

## Telegram — `TELEGRAM_BOT_TOKEN`

By far the easiest, and there is no OAuth at all — one bot token covers everything.

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. Copy the token it replies with (`123456789:AA...`) → `TELEGRAM_BOT_TOKEN`.
4. To post to a channel, add the bot to it as an **administrator** with "Post messages" allowed.

No review, no business verification, no fees. If you want something working end to end soonest,
build the Telegram integration first.

---

## Google sign-in is not on this list

`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` is about signing in **to Kairo**, and its credentials live in
Supabase rather than in `.env`. See section 5 of the [README](../README.md).

## Suggested order

1. **Telegram** — works today, no approval.
2. **LinkedIn** — personal posting is approved quickly.
3. **Facebook + Instagram** — one Meta review covers the pair, but expect weeks.
4. **TikTok** — its own audit and demo video.
5. **YouTube** — restricted scope, security assessment.
6. **X** — only once you are ready to pay for the API.
