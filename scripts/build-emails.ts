/**
 * Builds the Supabase auth email templates from one shared layout.
 *
 *   npm run emails
 *
 * Output: supabase/templates/*.html — paste each into the Supabase dashboard under
 * Authentication → Emails. `_preview.html` renders all of them with sample data so the
 * design can be checked in a browser without sending anything.
 *
 * Go template variables ({{ .TokenHash }} etc.) are filled in by Supabase at send time.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "templates");

// Kairo tokens as flat hex — email clients don't support rgba() reliably.
const C = {
  page: "#060709",
  card: "#0F1115",
  border: "#1C1F26",
  text: "#ECEDEF",
  muted: "#9096A0",
  dim: "#5E636C",
  brand: "#93ABFF",
  brandTint: "#151A2B",
  white: "#FFFFFF",
  ink: "#08090B",
};

// Single quotes only: this string is interpolated inside double-quoted style="" attributes,
// and a double quote here would terminate the attribute and drop every declaration after it.
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

/** Bulletproof CTA: a padded table for every client, VML for Outlook. */
function button(label: string, href: string) {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
                <tr>
                  <td align="center" bgcolor="${C.text}" style="border-radius:10px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="22%" stroke="f" fillcolor="${C.text}">
                      <w:anchorlock/>
                      <center style="color:${C.ink};font-family:${FONT};font-size:15px;font-weight:600;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:600;line-height:18px;color:${C.ink};text-decoration:none;border-radius:10px;background-color:${C.text};">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

interface Template {
  id: string;
  /** Subject line to set in the Supabase dashboard. */
  subject: string;
  /** Inbox preview text. */
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  cta?: { label: string; href: string };
  /** Shown instead of a button, for codes the user types in. */
  code?: string;
  expiry: string;
  /** Why this person is receiving the email. */
  reason: string;
}

function render(t: Template) {
  const link = t.cta?.href;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${t.subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { color:${C.brand}; }
  @media screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .pad { padding-left:24px !important; padding-right:24px !important; }
    .outer { padding:24px 12px !important; }
    .h1 { font-size:23px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${t.preheader}&#8203;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.page};">
  <tr>
    <td align="center" class="outer" style="padding:44px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="wrap" style="width:560px;max-width:560px;">

        <!-- Brand -->
        <tr>
          <td style="padding:0 4px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="38" height="38" align="center" valign="middle" bgcolor="#14161C" style="width:38px;height:38px;border-radius:11px;font-family:${FONT};font-size:18px;font-weight:700;color:${C.text};letter-spacing:-0.02em;">K</td>
                <td style="padding-left:11px;font-family:${FONT};font-size:17px;font-weight:600;color:${C.text};letter-spacing:-0.02em;">Kairo</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-radius:18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="pad" style="padding:38px 38px 34px;">

                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="${C.brandTint}" style="background-color:${C.brandTint};border-radius:7px;padding:5px 11px;font-family:${FONT};font-size:11.5px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.brand};">${t.eyebrow}</td>
                    </tr>
                  </table>

                  <h1 class="h1" style="margin:20px 0 0;font-family:${FONT};font-size:27px;line-height:1.2;font-weight:600;letter-spacing:-0.03em;color:${C.text};">${t.heading}</h1>

                  <p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.62;color:${C.muted};">${t.intro}</p>
${t.cta ? button(t.cta.label, t.cta.href) : ""}
${
  t.code
    ? `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
                    <tr>
                      <td align="center" bgcolor="#0A0B0F" style="background-color:#0A0B0F;border:1px solid ${C.border};border-radius:12px;padding:22px 16px;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:31px;font-weight:600;letter-spacing:0.22em;color:${C.text};">${t.code}</td>
                    </tr>
                  </table>`
    : ""
}
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0 0;">
                    <tr><td height="1" bgcolor="${C.border}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
                  </table>

                  <p style="margin:22px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.dim};">${t.expiry}</p>
${
  link
    ? `
                  <p style="margin:14px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.dim};">Button not working? Copy this link into your browser:</p>
                  <p style="margin:7px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:${C.brand};text-decoration:none;">${link}</a></p>`
    : ""
}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 8px 0;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.65;color:${C.dim};">${t.reason}</p>
            <p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:1.65;color:${C.dim};">Kairo — plan, create, schedule and analyze your social content from one workspace.<br />&copy; Kairo Labs · Tashkent</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

/** Cross-device safe: verifyOtp works from any browser, unlike the PKCE code flow. */
const confirmUrl = (type: string, next: string) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${encodeURIComponent(next)}`;

const TEMPLATES: Template[] = [
  {
    id: "confirm-signup",
    subject: "Confirm your email · Kairo",
    preheader: "One tap and your Kairo workspace is ready.",
    eyebrow: "Confirm your email",
    heading: "You're one click from<br />your workspace.",
    intro:
      "Welcome to Kairo. Confirm this address and we'll finish setting up your workspace — calendar, drafts and analytics included.",
    cta: { label: "Confirm my email", href: confirmUrl("signup", "/dashboard") },
    expiry: "This link expires in 24 hours and can only be used once.",
    reason: "You received this because someone signed up for Kairo with this address. If that wasn't you, just ignore this email — no account will be activated.",
  },
  {
    id: "reset-password",
    subject: "Reset your password · Kairo",
    preheader: "Choose a new password for your Kairo account.",
    eyebrow: "Password reset",
    heading: "Let's get you back in.",
    intro: "Click below to choose a new password. Your current password stays active until you set a new one.",
    cta: { label: "Choose a new password", href: confirmUrl("recovery", "/reset-password") },
    expiry: "This link expires in 1 hour and can only be used once.",
    reason: "You received this because a password reset was requested for this address. If it wasn't you, ignore this email — your password hasn't changed.",
  },
  {
    id: "magic-link",
    subject: "Your sign-in link · Kairo",
    preheader: "Tap to sign in to Kairo — no password needed.",
    eyebrow: "Sign in",
    heading: "Your sign-in link.",
    intro: "Use the button below to sign in to Kairo. No password required.",
    cta: { label: "Sign in to Kairo", href: confirmUrl("magiclink", "/dashboard") },
    expiry: "This link expires in 1 hour and can only be used once.",
    reason: "You received this because a sign-in link was requested for this address. If it wasn't you, ignore this email.",
  },
  {
    id: "invite",
    subject: "You've been invited to a Kairo workspace",
    preheader: "Accept your invitation and start planning content together.",
    eyebrow: "Workspace invitation",
    heading: "You've been invited<br />to collaborate.",
    intro:
      "Someone invited you to their Kairo workspace. Accept below to set your password and start planning, drafting and scheduling together.",
    cta: { label: "Accept invitation", href: confirmUrl("invite", "/onboarding") },
    expiry: "This invitation expires in 7 days.",
    reason: "You received this because someone invited this address to a Kairo workspace. If you weren't expecting it, you can safely ignore this email.",
  },
  {
    id: "change-email",
    subject: "Confirm your new email · Kairo",
    preheader: "Confirm the change to your Kairo sign-in address.",
    eyebrow: "Email change",
    heading: "Confirm your<br />new address.",
    intro:
      "You asked to change your Kairo sign-in address to <strong style=\"color:#ECEDEF;font-weight:600;\">{{ .NewEmail }}</strong>. Confirm below to make it official.",
    cta: { label: "Confirm new address", href: confirmUrl("email_change", "/settings") },
    expiry: "This link expires in 24 hours and can only be used once.",
    reason: "You received this because an email change was requested on a Kairo account. If it wasn't you, ignore this email and the address stays unchanged.",
  },
  {
    id: "reauthentication",
    subject: "Your verification code · Kairo",
    preheader: "Enter this code to confirm it's you.",
    eyebrow: "Verification code",
    heading: "Confirm it's you.",
    intro: "Enter this code in Kairo to finish the action you started.",
    code: "{{ .Token }}",
    expiry: "This code expires in 10 minutes. Never share it with anyone — Kairo will never ask you for it.",
    reason: "You received this because a sensitive action was started on a Kairo account with this address.",
  },
];

mkdirSync(OUT, { recursive: true });
for (const t of TEMPLATES) {
  writeFileSync(join(OUT, `${t.id}.html`), render(t), "utf8");
}

// --- Local preview: every template with sample values in place of the Go variables ---
const SAMPLE: Record<string, string> = {
  "{{ .SiteURL }}": "https://kairohub.pro",
  "{{ .TokenHash }}": "8f2c1ad4e7b9036a5cf1d82be4470913",
  "{{ .Token }}": "418 205",
  "{{ .NewEmail }}": "you@example.com",
  "{{ .Email }}": "you@example.com",
  "{{ .ConfirmationURL }}": "https://kairohub.pro/auth/confirm?token_hash=8f2c1ad4",
};
const fill = (html: string) =>
  Object.entries(SAMPLE).reduce((acc, [k, v]) => acc.split(k).join(v), html);

const preview = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Kairo email templates — preview</title>
<style>
  body { margin:0; background:#050608; color:#ECEDEF; font-family:${FONT}; }
  header { padding:32px 24px 8px; max-width:1200px; margin:0 auto; }
  h1 { font-size:22px; font-weight:600; letter-spacing:-0.02em; margin:0; }
  p.note { color:#5E636C; font-size:13px; margin:8px 0 0; }
  .grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fill,minmax(600px,1fr)); padding:24px; max-width:1200px; margin:0 auto; }
  figure { margin:0; }
  figcaption { font-size:12.5px; color:#9096A0; padding:0 0 8px; }
  iframe { width:100%; height:760px; border:1px solid #1C1F26; border-radius:14px; background:#060709; }
</style></head>
<body>
<header><h1>Kairo email templates</h1><p class="note">Generated by <code>npm run emails</code>. Sample values stand in for the Supabase variables.</p></header>
<div class="grid">
${TEMPLATES.map((t) => `  <figure><figcaption>${t.id}.html — “${t.subject}”</figcaption><iframe srcdoc="${fill(render(t)).replace(/"/g, "&quot;")}" title="${t.id}"></iframe></figure>`).join("\n")}
</div>
</body></html>
`;
writeFileSync(join(OUT, "_preview.html"), preview, "utf8");

console.log(`Wrote ${TEMPLATES.length} templates + _preview.html to supabase/templates/`);
