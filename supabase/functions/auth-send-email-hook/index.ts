/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ==========================================
// Post-LIVE Priority 1 (Auth email localization + TEKANGO rebrand +
// sender separation), TEST-only preparation, 2026-09-16.
//
// This is a Supabase Auth "Send Email" Hook target: Supabase Auth itself
// (not this repo) calls this function synchronously, once, right before
// it would otherwise send its own built-in confirmation/recovery/magic-
// link/email-change email - the *only* architecture that lets a single
// account send a correctly-localized, correctly-branded, market-separated
// email for every Auth email type without duplicating Auth's own token/
// link-generation logic into a second, drifting pipeline (the alternative
// this task's own instruction explicitly rejects: "do not duplicate
// unrelated mail pipelines").
//
// ENABLED on the hosted TEST project (ljfizgrdyzxddswcedwr) as of the
// "Enable Auth Send Email Hook (TEST only)" continuation task, 2026-09-16,
// after the Owner added the missing RESEND_API_KEY secret this function
// depends on (see this file's own git history for the prior task's own
// deploy-but-do-not-activate decision and its exact reasoning). Activated
// via `supabase config push --project-ref ljfizgrdyzxddswcedwr`, explicit
// project-ref every time - never Production (ixabnzhjeqevtbhdfswv).
//
// Market signal: reuses Dashboard.jsx's own existing, already-live
// `signup_market` value ('Local'/'International'), written into
// `user.user_metadata` at the real `supabase.auth.signUp()` call
// (src/pages/Dashboard.jsx, handleSignUp) - the same authoritative,
// already-shipped source of truth the app itself already trusts for
// legal-region purposes, not a new signal invented for this task. This
// value persists on the user record for its whole lifetime, so it is
// available identically for signup, recovery, magic-link, and
// email-change hook calls - one shared mechanism, not a signup-only one.
// Fails closed to English/International if the field is ever missing or
// not exactly 'Local' - matches this codebase's own established
// "no guessing, fail closed" convention (see the identical fail-closed
// comment on bundleIsHebrew in Dashboard.jsx's handleSignUp) rather than
// inventing a browser/geo/header-based fallback.
// ==========================================

const HEADER_BG = '#111112';
const FLOW_PURPLE = '#d8b4fe';
const ACCENT_VIOLET = '#8b5cf6';

function senderAddressFor(isHebrew: boolean) {
  // Matches the already-shipped convention in send-trial-expiration-email
  // and send-subscription-expiration-email - not a new split invented here.
  return isHebrew ? 'TEKANGO Support <support@tekango.com>' : 'TEKANGO <info@tekango.com>';
}

function wrapEmail(isHebrew: boolean, bodyHtml: string) {
  return `<!DOCTYPE html>
<html dir="${isHebrew ? 'rtl' : 'ltr'}" lang="${isHebrew ? 'he' : 'en'}">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${HEADER_BG};padding:20px 28px;">
              <span style="color:${FLOW_PURPLE};font-size:1.2rem;font-weight:800;letter-spacing:0.5px;font-family:Arial,Segoe UI,sans-serif;">TEKANGO</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:${isHebrew ? 'right' : 'left'};color:#1e293b;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${ACCENT_VIOLET};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${label}</a>`;
}

type EmailActionType =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'invite'
  | 'email_change_current'
  | 'email_change_new'
  | 'reauthentication';

// Per Supabase's own documented Send Email Hook payload
// (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook -
// verified against that public documentation, NOT against a live
// invocation, since this hook is not yet enabled - see the file-header
// disclosure). `email_data.site_url` is Auth's own configured Site URL,
// not necessarily this project's canonical GoTrue host - the verify
// endpoint itself always lives under the Auth API's own base URL, so this
// function builds it from SUPABASE_URL (a value every Edge Function
// already receives, confirmed via the sibling send-trial-expiration-email
// function's own identical `Deno.env.get('SUPABASE_URL')` usage) rather
// than trusting a payload field that could point elsewhere.
interface SendEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildVerifyUrl(supabaseUrl: string, tokenHash: string, actionType: string, redirectTo: string) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', actionType);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

function buildEmailContent(
  actionType: EmailActionType,
  isHebrew: boolean,
  verifyUrl: string,
  toEmail: string,
): { subject: string; html: string; text: string } {
  const greeting = isHebrew ? 'שלום,' : 'Hello,';
  const signature = isHebrew ? 'בברכה,<br>צוות TEKANGO' : 'Best regards,<br>The TEKANGO Team';

  switch (actionType) {
    case 'signup': {
      const subject = isHebrew ? 'אישור הרשמה ל-TEKANGO' : 'Confirm your TEKANGO signup';
      const bodyCopy = isHebrew
        ? 'תודה שנרשמת למערכת הניהול והצעות המחיר <strong>TEKANGO</strong>. לחצו על הכפתור למטה כדי לאשר את כתובת האימייל ולהפעיל את החשבון שלכם.'
        : 'Thank you for signing up for <strong>TEKANGO</strong>, the business & quoting platform. Click the button below to confirm your email address and activate your account.';
      const cta = ctaButton(verifyUrl, isHebrew ? 'אישור כתובת האימייל' : 'Confirm Email Address');
      return {
        subject,
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${cta}<p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${isHebrew ? 'לאישור ההרשמה' : 'Confirm your signup'}: ${verifyUrl}`,
      };
    }
    case 'recovery': {
      const subject = isHebrew ? 'איפוס סיסמה ל-TEKANGO' : 'Reset your TEKANGO password';
      const bodyCopy = isHebrew
        ? `קיבלנו בקשה לאיפוס הסיסמה עבור החשבון <strong>${toEmail}</strong>. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.`
        : `We received a request to reset the password for <strong>${toEmail}</strong>. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.`;
      const cta = ctaButton(verifyUrl, isHebrew ? 'איפוס סיסמה' : 'Reset Password');
      return {
        subject,
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${cta}<p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${isHebrew ? 'לאיפוס הסיסמה' : 'Reset your password'}: ${verifyUrl}`,
      };
    }
    case 'magiclink': {
      const subject = isHebrew ? 'קישור כניסה ל-TEKANGO' : 'Your TEKANGO sign-in link';
      const bodyCopy = isHebrew
        ? 'לחצו על הכפתור למטה כדי להתחבר ל-TEKANGO ללא סיסמה.'
        : 'Click the button below to sign in to TEKANGO without a password.';
      const cta = ctaButton(verifyUrl, isHebrew ? 'התחברות' : 'Sign In');
      return {
        subject,
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${cta}<p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${isHebrew ? 'קישור כניסה' : 'Sign-in link'}: ${verifyUrl}`,
      };
    }
    case 'email_change_current':
    case 'email_change_new': {
      const subject = isHebrew ? 'אישור שינוי כתובת אימייל ב-TEKANGO' : 'Confirm your TEKANGO email change';
      const bodyCopy = isHebrew
        ? `קיבלנו בקשה לשנות את כתובת האימייל בחשבון TEKANGO שלכם. לחצו על הכפתור למטה כדי לאשר את השינוי. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.`
        : `We received a request to change the email address on your TEKANGO account. Click the button below to confirm the change. If you didn't request this, you can safely ignore this email.`;
      const cta = ctaButton(verifyUrl, isHebrew ? 'אישור שינוי כתובת' : 'Confirm Email Change');
      return {
        subject,
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${cta}<p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${isHebrew ? 'לאישור שינוי הכתובת' : 'Confirm the email change'}: ${verifyUrl}`,
      };
    }
    default: {
      // reauthentication/invite or any future action type Supabase adds -
      // fail-safe to a generic-but-still-branded, still-correctly-localized
      // template rather than silently dropping the email (which would
      // block the real Auth action the user is waiting on).
      const subject = isHebrew ? 'פעולה נדרשת בחשבון TEKANGO שלך' : 'Action required on your TEKANGO account';
      const bodyCopy = isHebrew
        ? 'לחצו על הכפתור למטה כדי להשלים את הפעולה המבוקשת בחשבון TEKANGO שלכם.'
        : 'Click the button below to complete the requested action on your TEKANGO account.';
      const cta = ctaButton(verifyUrl, isHebrew ? 'המשך' : 'Continue');
      return {
        subject,
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${cta}<p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${verifyUrl}`,
      };
    }
  }
}

// Supabase signs Send Email Hook requests using the Svix-compatible
// "Standard Webhooks" scheme: HMAC-SHA256 over `${id}.${timestamp}.${body}`
// using the base64 portion of the shared secret, compared against one or
// more space-separated `v1,<base64>` values in the webhook-signature
// header. Implemented directly against Web Crypto rather than an external
// esm.sh package, since correctness here is security-critical and must not
// depend on an unreviewed third-party module resolving correctly at
// deploy time.
//
// Secret format correction (Enable Auth Send Email Hook task, 2026-09-16):
// Supabase's own `config push` rejected a plain `whsec_<base64>` secret
// with "Auth Hook Secret must follow the Standard Webhooks format
// \"v1,whsec_<base64_encoded_secret>\"" - a real, live validation error,
// not documentation guesswork. The stored secret therefore carries BOTH a
// `v1,` version marker and a `whsec_` type marker before the actual
// base64 key material, distinct from the bare `whsec_...` format
// Resend's own webhooks use (see the sibling resend-email-webhook
// function, which correctly does not need this extra strip - a different
// provider, a different exact secret string shape, same underlying
// Standard Webhooks HMAC algorithm).
async function verifyWebhookSignature(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signatureHeader = req.headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const secretBase64 = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const secretBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  return signatureHeader
    .split(' ')
    .some((part) => part.split(',')[1] === expected);
}

// Real-signup live testing (Enable Auth Send Email Hook task, 2026-09-16)
// caught a genuine bug here: every Response below was constructed without
// an explicit Content-Type, so Deno's default (`text/plain;charset=UTF-8`)
// was sent back to Supabase Auth's own hook-calling client, which failed
// to parse it as JSON and surfaced "Invalid JSON response" to the actual
// signUp() call in the app - a real defect a prior task's source-only
// review could not have caught, exactly the gap live testing exists to
// close. Fixed with one shared JSON-response helper used everywhere.
function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
      },
    });
  }

  try {
    const rawBody = await req.text();
    const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '';
    if (!hookSecret) {
      // Fail closed: never send an email from an unverifiable caller, and
      // never silently no-op either - a missing secret means this hook was
      // deployed but not yet wired up in the Dashboard, which is a
      // configuration error worth surfacing loudly in the function logs.
      console.error('auth-send-email-hook: SEND_EMAIL_HOOK_SECRET is not configured.');
      return jsonResponse({ error: 'Hook not configured' }, 500);
    }

    const validSignature = await verifyWebhookSignature(req, rawBody, hookSecret);
    if (!validSignature) {
      return jsonResponse({ error: 'Invalid webhook signature' }, 401);
    }

    const payload = JSON.parse(rawBody) as SendEmailHookPayload;
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (!resendApiKey || !supabaseUrl) {
      return jsonResponse({ error: 'RESEND_API_KEY or SUPABASE_URL is not configured.' }, 500);
    }

    const isHebrew = payload.user?.user_metadata?.signup_market === 'Local';
    const actionType = payload.email_data.email_action_type;
    const tokenHash = actionType === 'email_change_new' && payload.email_data.token_hash_new
      ? payload.email_data.token_hash_new
      : payload.email_data.token_hash;
    const verifyUrl = buildVerifyUrl(supabaseUrl, tokenHash, actionType, payload.email_data.redirect_to);

    const { subject, html, text } = buildEmailContent(actionType, isHebrew, verifyUrl, payload.user.email);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderAddressFor(isHebrew),
        to: [payload.user.email],
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json().catch(() => ({}));
      console.error('auth-send-email-hook: Resend API error', errData);
      // Supabase Auth Hooks require a non-2xx response to be interpreted
      // as "email failed to send" - it will surface this to the caller of
      // the Auth API (e.g. the signUp()/resetPasswordForEmail() call) as
      // an error, exactly matching what its own built-in mailer failing
      // would do, rather than silently pretending success.
      return jsonResponse({ error: 'Failed to send email via Resend' }, 500);
    }

    return jsonResponse({}, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('auth-send-email-hook error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
