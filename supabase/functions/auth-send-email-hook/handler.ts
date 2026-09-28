// Request handler of the Auth Send Email Hook, runtime-independent (no Deno globals, no URL imports) so the full
// request -> verification -> plan -> Resend path is exercised by vitest with realistic signed payloads (handler.test.js).
// index.ts only wires Deno.serve / Deno.env / fetch into it.
//
// Codex Post-LIVE Wave 1 blockers 1 + 2 (2026-09-27):
// - verification: webhookVerify.ts (timestamp tolerance, v1 only, constant-time comparison);
// - messages: emailPlan.ts (documented `email_change` contract incl. the two-message secure flow, notification actions
//   without verification CTA, `reauthentication` as a code);
// - duplicate delivery: every Resend request carries `Idempotency-Key: auth-hook/<webhook-id>/<slot>`. Standard Webhooks
//   keeps the same webhook-id on a redelivery, and Resend keeps idempotency keys for 24 hours (longer than the 5-minute
//   timestamp tolerance), so a replayed or retried hook call inside the accepted window cannot produce a second email.
//   This is provider-side durable state; no in-memory "seen ids" set is used (it would not survive isolates).
// Error responses use the documented hook error shape `{ error: { http_code, message } }`; any non-2xx makes Auth report
// the email as not sent.
//
// Auth market identity gap F1 - Option C (2026-09-28): the market comes from the CANONICAL business_settings.country row of
// the verified user (one narrow service-role read, marketLookup.ts), with user_metadata.signup_market used ONLY while no row
// exists; unresolved / failed lookups fail closed to International and the email is still sent (marketResolver.ts).
// A redelivery keeps the SAME Idempotency-Key per slot even if the market resolves differently this time: Resend then refuses
// the different body with 409 invalid_idempotent_request, so a retry can never produce a second email. That 409 is NOT
// treated as success (Resend does not document whether a failed original request stores the key, so "already sent" cannot
// be assumed) - the hook reports failure and never retries under a new key.

import { verifyStandardWebhook } from './webhookVerify.ts';
import { planAuthEmails, type SendEmailHookPayload } from './emailPlan.ts';
import { buildEmailContent, senderAddressFor } from './emailContent.ts';
import { MARKET_LOOKUP_TIMEOUT_MS, resolveAuthEmailMarket, runMarketLookupWithTimeout } from './marketResolver.ts';

export type HookDeps = {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  nowMs: () => number;
  log?: (...args: unknown[]) => void;
  // Canonical market read (marketLookup.ts makeBusinessMarketLookup). Missing -> fail closed to International.
  lookupMarketRows?: (userId: string, signal: AbortSignal) => Promise<ReadonlyArray<{ country?: unknown }>>;
  marketLookupTimeoutMs?: number;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  // Explicit JSON content type: Auth's hook client rejects text/plain ("Invalid JSON response", TEST 2026-09-16).
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function hookError(status: number, message: string) {
  return jsonResponse({ error: { http_code: status, message } }, status);
}

export async function handleSendEmailHook(req: Request, deps: HookDeps): Promise<Response> {
  const log = deps.log ?? console.error;

  if (req.method !== 'POST') return hookError(405, 'Method not allowed');

  try {
    const rawBody = await req.text();
    const hookSecret = deps.env('SEND_EMAIL_HOOK_SECRET') ?? '';
    if (!hookSecret) {
      // Fail closed: never send from an unverifiable caller, never silently no-op.
      log('auth-send-email-hook: SEND_EMAIL_HOOK_SECRET is not configured.');
      return hookError(500, 'Hook not configured');
    }

    const webhookId = req.headers.get('webhook-id');
    const verification = await verifyStandardWebhook({
      id: webhookId,
      timestamp: req.headers.get('webhook-timestamp'),
      signatureHeader: req.headers.get('webhook-signature'),
      rawBody,
      secret: hookSecret,
      nowSeconds: Math.floor(deps.nowMs() / 1000),
    });
    if (!verification.ok) {
      if (verification.reason === 'invalid_secret_format') {
        log('auth-send-email-hook: SEND_EMAIL_HOOK_SECRET is not in the "v1,whsec_<base64>" format.');
        return hookError(500, 'Hook not configured');
      }
      log(`auth-send-email-hook: rejected request (${verification.reason}).`);
      return hookError(401, 'Invalid webhook signature');
    }

    let payload: SendEmailHookPayload;
    try {
      payload = JSON.parse(rawBody) as SendEmailHookPayload;
    } catch {
      return hookError(400, 'Malformed payload');
    }

    const resendApiKey = deps.env('RESEND_API_KEY') ?? '';
    const supabaseUrl = deps.env('SUPABASE_URL') ?? '';
    if (!resendApiKey || !supabaseUrl) {
      return hookError(500, 'RESEND_API_KEY or SUPABASE_URL is not configured.');
    }

    const plan = planAuthEmails(payload, supabaseUrl);
    if (!plan.ok) {
      log(`auth-send-email-hook: no email sent (${plan.reason}).`);
      return hookError(400, `Unsupported or incomplete hook payload (${plan.reason})`);
    }

    // Only after verification + a sendable plan: one bounded canonical lookup by the VERIFIED payload's user.id.
    const lookup = await runMarketLookupWithTimeout(deps.lookupMarketRows, payload.user?.id, deps.marketLookupTimeoutMs ?? MARKET_LOOKUP_TIMEOUT_MS);
    const market = resolveAuthEmailMarket(lookup, payload.user?.user_metadata ?? null);
    if (market.source === 'fail_closed') log(`auth-send-email-hook: market fail-closed to International (${market.classification}).`);
    const isHebrew = market.market === 'Local';
    // Secure email change sends two messages; each is sent (and idempotency-keyed) separately. If one fails the hook
    // fails, Auth reports the change request as failed, and a retry of the same webhook-id cannot duplicate the one
    // that already went out (same idempotency key, same payload).
    for (const { slot, message } of plan.messages) {
      const { subject, html, text } = buildEmailContent(message, isHebrew);
      const resendRes = await deps.fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `auth-hook/${webhookId}/${slot}`,
        },
        body: JSON.stringify({ from: senderAddressFor(isHebrew), to: [message.to], subject, html, text }),
      });
      if (!resendRes.ok) {
        const errData = await resendRes.json().catch(() => ({}));
        if (resendRes.status === 409) {
          // Same webhook-id/slot key already used (different body, e.g. the market resolved differently on a redelivery) or
          // still in flight: Resend sent nothing for THIS request. Never retried under another key -> no second email.
          const name = errData && typeof errData === 'object' ? String((errData as Record<string, unknown>).name ?? '') : '';
          log(`auth-send-email-hook: Resend idempotency conflict (${name === 'invalid_idempotent_request' || name === 'concurrent_idempotent_requests' ? name : 'unknown_409'}); not re-sent.`);
          return hookError(500, 'Email not sent: idempotency conflict for this request');
        }
        log('auth-send-email-hook: Resend API error', resendRes.status, errData);
        return hookError(500, 'Failed to send email via Resend');
      }
    }

    return jsonResponse({}, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('auth-send-email-hook error:', message);
    return hookError(500, message);
  }
}
