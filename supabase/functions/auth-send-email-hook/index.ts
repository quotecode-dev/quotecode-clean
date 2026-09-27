/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildEmailContent, buildVerifyUrl, isHebrewMarket, senderAddressFor, type EmailActionType } from "./emailContent.ts";

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
// Post-LIVE Wave 1 (2026-09-27): NOT deployed / NOT enabled on Production;
// enabling it there is an Owner decision (hook + SEND_EMAIL_HOOK_SECRET).
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
//
// Content (subject / HTML / text / sender) lives in ./emailContent.ts
// (pure, unit-tested by emailContent.test.js).
// ==========================================

// Per Supabase's own documented Send Email Hook payload
// (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
// `email_data.site_url` is Auth's own configured Site URL, not necessarily
// this project's canonical GoTrue host - the verify endpoint itself always
// lives under the Auth API's own base URL, so this function builds it from
// SUPABASE_URL (a value every Edge Function already receives) rather than
// trusting a payload field that could point elsewhere.
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

    const isHebrew = isHebrewMarket(payload.user?.user_metadata);
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
