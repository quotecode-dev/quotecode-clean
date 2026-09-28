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
// Idempotency + deadline (Codex Auth 409 delta RE-review blockers A + B, 2026-09-28 - see resendSend.ts for the verified
// Supabase / Resend contracts):
// - A: the provider Idempotency-Key is a LOGICAL-EVENT key derived from the verified raw request body (byte-identical across
//   Supabase retries, which carry a NEW webhook-id each time) + the slot, HMAC-keyed with the hook secret. It does not depend
//   on the webhook-id or on the resolved market, so a Supabase retry or a changed-market redelivery can never send twice.
// - B: ONE invocation deadline (INVOCATION_BUDGET_MS from entry) bounds the market lookup, every provider request, every
//   error-body read, the concurrent-conflict retries and BOTH secure-email-change slots. No platform retry is requested.
// Resend 409 by provider error `name`: invalid_idempotent_request -> already consumed (acknowledged, not re-sent);
// concurrent_idempotent_requests -> bounded same-key / same-body retries inside the remaining budget; any other 409 -> failure.

import { verifyStandardWebhook, parseHookSecret } from './webhookVerify.ts';
import { planAuthEmails, type SendEmailHookPayload } from './emailPlan.ts';
import { buildEmailContent, senderAddressFor } from './emailContent.ts';
import { MARKET_LOOKUP_TIMEOUT_MS, resolveAuthEmailMarket, runMarketLookupWithTimeout } from './marketResolver.ts';
import { INVOCATION_BUDGET_MS, MIN_PROVIDER_REQUEST_WINDOW_MS, deriveIdempotencyKey, remainingMs, sendWithIdempotency, type Deadline } from './resendSend.ts';

export type HookDeps = {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  nowMs: () => number;
  log?: (...args: unknown[]) => void;
  // Canonical market read (marketLookup.ts makeBusinessMarketLookup). Missing -> fail closed to International.
  lookupMarketRows?: (userId: string, signal: AbortSignal) => Promise<ReadonlyArray<{ country?: unknown }>>;
  marketLookupTimeoutMs?: number;
  // Elapsed-time clock, sleep and timer for the one invocation deadline (defaults: Date.now / setTimeout); injectable for tests.
  clockMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
  setTimer?: (ms: number, fn: () => void) => () => void;
  invocationBudgetMs?: number;
};

const LOOKUP_SLACK_MS = 100;

// Every non-completed provider outcome -> explicit 500 (no 429/503 + Retry-After: Supabase would re-invoke inside the same
// 5 s context; duplicate prevention never relies on it).
const FAILURE_MESSAGES: Record<string, string> = {
  not_started: 'Email not sent: hook time budget exhausted before the provider request',
  ambiguous: 'Email delivery outcome unknown within the hook time budget',
  concurrent_unresolved: 'Email send for this Auth event is still in progress; not completed within the hook time budget',
  conflict_unknown: 'Email not sent: unrecognized idempotency conflict',
  provider_error: 'Failed to send email via Resend',
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
  const clockMs = deps.clockMs ?? (() => Date.now());
  // ONE invocation deadline, created at entry; every downstream step consumes the same remaining budget.
  const deadline: Deadline = { deadlineAtMs: clockMs() + (deps.invocationBudgetMs ?? INVOCATION_BUDGET_MS), clockMs };

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

    // Logical-event identity material: the decoded hook secret (already required for verification) + the verified raw body.
    const secretBytes = parseHookSecret(hookSecret);
    if (!secretBytes) return hookError(500, 'Hook not configured');
    log(`auth-send-email-hook: idempotency identity = verified-body digest (metadata.uuid ${typeof (payload as { metadata?: { uuid?: unknown } }).metadata?.uuid === 'string' ? 'present' : 'absent'}).`);

    // Only after verification + a sendable plan: one bounded canonical lookup by the VERIFIED payload's user.id. Its time
    // comes out of the SAME invocation budget and always leaves room for one provider request.
    // (+ LOOKUP_SLACK_MS so the elapsed-time jitter of the lookup itself can never eat into that one request window)
    const lookupBudgetMs = Math.min(deps.marketLookupTimeoutMs ?? MARKET_LOOKUP_TIMEOUT_MS, remainingMs(deadline) - MIN_PROVIDER_REQUEST_WINDOW_MS - LOOKUP_SLACK_MS);
    const lookup = lookupBudgetMs > 0
      ? await runMarketLookupWithTimeout(deps.lookupMarketRows, payload.user?.id, lookupBudgetMs)
      : { ok: false as const, reason: 'timeout' as const };
    const market = resolveAuthEmailMarket(lookup, payload.user?.user_metadata ?? null);
    if (market.source === 'fail_closed') log(`auth-send-email-hook: market fail-closed to International (${market.classification}).`);
    const isHebrew = market.market === 'Local';
    // Secure email change sends two messages, in order (current, then new), each with its OWN logical-event key and under the
    // SAME deadline. A consumed slot does not block the next; an unfinished slot stops the invocation before the next starts.
    const sendDeps = {
      fetch: deps.fetch,
      deadline,
      sleep: deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
      setTimer: deps.setTimer ?? ((ms: number, fn: () => void) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); }),
      log,
    };
    for (const { slot, message } of plan.messages) {
      const { subject, html, text } = buildEmailContent(message, isHebrew);
      const outcome = await sendWithIdempotency({
        apiKey: resendApiKey,
        idempotencyKey: await deriveIdempotencyKey(secretBytes, rawBody, slot), // logical event + slot; never webhook-id / market
        body: JSON.stringify({ from: senderAddressFor(isHebrew), to: [message.to], subject, html, text }),
        slot,
      }, sendDeps);
      if (outcome.kind === 'sent' || outcome.kind === 'already_consumed') continue;
      return hookError(500, FAILURE_MESSAGES[outcome.kind] ?? FAILURE_MESSAGES.provider_error);
    }

    return jsonResponse({}, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('auth-send-email-hook error:', message);
    return hookError(500, message);
  }
}
