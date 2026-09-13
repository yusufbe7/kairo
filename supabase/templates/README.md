# Auth emails

Every email Supabase sends on Kairo's behalf. Edit `scripts/build-emails.ts`, then:

```bash
npm run emails
```

That regenerates every file here plus `_preview.html` — open that one in a browser to check
the design without sending anything. Never edit the `.html` files directly; they are generated.

## 1. Paste the templates

Supabase dashboard → **Authentication → Emails**. For each row below, set the subject and
replace the message body with the contents of the file.

| Supabase template | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirm your email · Kairo` |
| Reset password | `reset-password.html` | `Reset your password · Kairo` |
| Magic Link | `magic-link.html` | `Your sign-in link · Kairo` |
| Invite user | `invite.html` | `You've been invited to a Kairo workspace` |
| Change email address | `change-email.html` | `Confirm your new email · Kairo` |
| Reauthentication | `reauthentication.html` | `Your verification code · Kairo` |

## 2. Point Supabase at the right URLs

Still in the dashboard, under **Authentication → URL Configuration**:

- **Site URL** — your production origin, e.g. `https://kairo.vercel.app`. The templates build
  their links from `{{ .SiteURL }}`, so if this is wrong every email links to the wrong place.
- **Redirect URLs** — add all of these:

```
https://<your-domain>/auth/confirm
https://<your-domain>/auth/callback
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
```

Set `NEXT_PUBLIC_APP_URL` to the same production origin in the Vercel project settings.

## 3. Set up custom SMTP — this is not optional in production

Supabase's built-in email service is a **development convenience only**. It is rate limited to a
handful of messages per hour and Supabase does not guarantee delivery. Left as-is, most of your
signups will simply never receive their confirmation email.

Under **Project Settings → Authentication → SMTP Settings**, enable custom SMTP with any
transactional provider ([Resend](https://resend.com), Postmark, SendGrid, Amazon SES). You will
need to verify a sending domain with SPF, DKIM and DMARC records — without those, a dark HTML
email from a new domain lands in spam.

Set the sender name to `Kairo` and the sender address to something on your own domain, such as
`no-reply@your-domain.com`.

## Why the links point at `/auth/confirm`

The templates use `{{ .TokenHash }}` against `/auth/confirm`, which calls `verifyOtp`, instead of
`{{ .ConfirmationURL }}`, which uses the PKCE `code` flow against `/auth/callback`.

PKCE requires the code verifier cookie set in the browser that *started* the signup. People
routinely sign up on a phone and open the email on a laptop — with PKCE that fails and looks to
them like a broken link. `verifyOtp` carries everything it needs in the URL, so it works from
any device.

`/auth/callback` is still wired up for OAuth sign-in and for any link that was already sitting in
someone's inbox before the templates were switched over.

## Design notes

- Dark, matching the product: `#060709` page, `#0F1115` card, `#93ABFF` brand accent.
- Table-based layout with inline styles, plus a VML button so Outlook renders it as a button.
- No external images — the logo is drawn with a styled table cell, so it survives the image
  blocking that most clients apply by default.
- Every font stack uses single quotes. A double quote inside a `style="…"` attribute terminates
  it early and silently drops every declaration after it.
