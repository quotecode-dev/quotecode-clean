// One Resend send for one planned message slot, with the Resend idempotency lifecycle made explicit (Codex Option C delta
// review blocker P1, 2026-09-28). Runtime-independent (vitest: resendSend.test.js).
//
// Provider semantics (verified 2026-09-28 - resend.com/docs/dashboard/emails/idempotency-keys, resend.com/docs/api-reference/
// errors, resend-node src/interfaces.ts `ErrorResponse = { message, statusCode, name }`):
// - same key + same body              -> the original response, the email is NOT sent again;
// - 409 `invalid_idempotent_request`  -> "this idempotency key has already been used on a request that had a different payload";
// - 409 `concurrent_idempotent_requests` -> "another request with the same idempotency key is in progress ... it is safe to
//   retry this request later";
// - keys are kept 24 h. The docs do NOT state whether a key is kept when the original request failed.
//
// Lifecycle policy (Owner-accepted stable-key policy):
// - A: `invalid_idempotent_request` -> the stable per-slot key was already consumed by an earlier attempt of this same
//   webhook-id/slot (e.g. accepted, response lost, and the redelivery resolved a different market). Acknowledged as
//   ALREADY_CONSUMED: nothing is sent again, no other key is ever used, and Auth is not falsely failed.
//   Residual (documented, not invented): if Resend were to keep a key for an original request that it REJECTED, this
//   acknowledgement would hide that rejection. The docs are silent on that case.
// - B: `concurrent_idempotent_requests` -> NOT "already sent". Bounded retries with the SAME key and the byte-identical
//   body, only while they fit the hook budget. Still unresolved -> 503: a retry-able status, so Supabase Auth itself
//   redelivers the SAME webhook-id later (docs: "429 or 503 ... up to three retries with a back-off of two seconds"). The
//   same key is reused, so no duplicate is possible.
// - C: any other / unparseable 409 -> explicit failure, never "already sent", never another key.
// - non-409 failures: unchanged (failure). Only the status and the provider's error `name` are logged, never raw bodies.

export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'already_consumed' }
  | { kind: 'concurrent_unresolved' }
  | { kind: 'conflict_unknown' }
  | { kind: 'provider_error'; status: number; name: string }
  | { kind: 'retry_aborted' };

export type SendDeps = {
  fetch: typeof fetch;
  clockMs: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (...args: unknown[]) => void;
};

// Hook budget: Supabase "HTTP Hooks should complete in 5 seconds". Concurrent-conflict retries must END (including their own
// request) by RETRY_DEADLINE_MS after the hook started, leaving >= 1 s margin for the remaining work and the response.
export const HOOK_TIMEOUT_MS = 5000;
export const RETRY_DEADLINE_MS = 4000;
export const CONCURRENT_RETRY_DELAYS_MS = [250, 500] as const;
export const MIN_RETRY_REQUEST_WINDOW_MS = 700;

const KNOWN_NAME = /^[a-z_]{1,64}$/;

// Reads only the documented discriminator. Anything unexpected -> '' (treated as unknown, fail closed).
export async function providerErrorName(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const name = body && typeof body === 'object' ? (body as Record<string, unknown>).name : undefined;
    return typeof name === 'string' && KNOWN_NAME.test(name) ? name : '';
  } catch {
    return '';
  }
}

export async function sendWithIdempotency(
  args: { apiKey: string; idempotencyKey: string; body: string; slot: string; hookStartedAtMs: number },
  deps: SendDeps,
): Promise<SendOutcome> {
  const request = (signal?: AbortSignal) => deps.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': args.idempotencyKey, // never changed, never regenerated
    },
    body: args.body, // the byte-identical body on every retry
    signal,
  });

  let res = await request();
  for (let attempt = 0; ; attempt += 1) {
    if (res.ok) return { kind: 'sent' };
    const name = await providerErrorName(res);
    if (res.status !== 409) {
      deps.log(`auth-send-email-hook: Resend error (slot ${args.slot}, status ${res.status}, name ${name || 'unknown'}).`);
      return { kind: 'provider_error', status: res.status, name };
    }
    if (name === 'invalid_idempotent_request') {
      deps.log(`auth-send-email-hook: Resend idempotency key already consumed (slot ${args.slot}); acknowledged, not re-sent.`);
      return { kind: 'already_consumed' };
    }
    if (name !== 'concurrent_idempotent_requests') {
      deps.log(`auth-send-email-hook: Resend 409 with unknown discriminator (slot ${args.slot}); not treated as sent, not re-sent.`);
      return { kind: 'conflict_unknown' };
    }
    // B: concurrent - bounded same-key / same-body retry inside the hook budget.
    const delay = CONCURRENT_RETRY_DELAYS_MS[attempt];
    const elapsed = deps.clockMs() - args.hookStartedAtMs;
    if (delay === undefined || elapsed + delay + MIN_RETRY_REQUEST_WINDOW_MS > RETRY_DEADLINE_MS) {
      deps.log(`auth-send-email-hook: Resend concurrent idempotent request still in progress (slot ${args.slot}); returning retry-able 503.`);
      return { kind: 'concurrent_unresolved' };
    }
    await deps.sleep(delay);
    const remaining = RETRY_DEADLINE_MS - (deps.clockMs() - args.hookStartedAtMs);
    if (remaining < MIN_RETRY_REQUEST_WINDOW_MS) return { kind: 'concurrent_unresolved' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      res = await request(controller.signal);
    } catch {
      // The retry did not complete inside the budget (or the network failed): the outcome is unknown -> never "sent".
      deps.log(`auth-send-email-hook: Resend concurrent retry did not complete in budget (slot ${args.slot}); retry-able 503.`);
      return { kind: 'retry_aborted' };
    } finally {
      clearTimeout(timer);
    }
  }
}
