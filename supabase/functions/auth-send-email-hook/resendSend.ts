// Provider delivery for the Auth Send Email Hook: stable LOGICAL-EVENT idempotency keys + ONE shared invocation deadline.
// Runtime-independent (Web Crypto, fetch, AbortController, setTimeout only - no Node / Deno specifics; vitest:
// resendSend.test.js). Codex Auth 409 delta RE-review FAIL (2026-09-28) blockers A + B.
//
// Verified external contracts (2026-09-28):
// - supabase/auth master internal/hooks/hookshttp/hookshttp.go runHTTPHook:
//     * `inputPayload, err := json.Marshal(input)` BEFORE the retry loop -> the request body is byte-identical on every attempt;
//     * `msgID := uuid.Must(uuid.NewV4())` INSIDE the loop -> every attempt has a NEW webhook-id (so webhook-id is NOT a
//       logical-event identity - blocker A);
//     * ONE `context.WithTimeout(ctx, 5s)` spans ALL attempts (defaultHTTPHookTimeout = 5s; client timeout 5s);
//     * 429 / 503 are retried ONLY when a `retry-after` header is present, immediately (`continue`, no back-off), inside the
//       same 5 s context; client network errors are retried after a 2 s back-off; anything else is a hard error.
// - supabase/auth master internal/hooks/v0hooks/v0hooks.go: SendEmailInput = { metadata: { uuid (uuid.NewV4 per logical
//   event), time, name, ip_address }, user, email_data } built once per sendEmail call; internal/api/mail.go generates a fresh
//   OTP + token hash for every legitimate signup / invite / magic-link / recovery / email-change / reauthentication send, and
//   updates the user's *_sent_at only AFTER the send.
// - Resend: same key + same body -> original response, no new email; 409 invalid_idempotent_request (key used with a
//   different body); 409 concurrent_idempotent_requests (in progress, "safe to retry later"); keys kept 24 h; error body
//   { message, statusCode, name } (resend-node ErrorResponse). A client-side abort does NOT prove the provider did not
//   process the request -> an aborted / failed request is an AMBIGUOUS outcome.
//
// Blocker A - logical-event identity: Idempotency-Key = `tekango-auth/v1/<slot>/<b64url HMAC-SHA256(hook secret,
//   "tekango-auth-email-idempotency/v1\n<slot>\n<verified raw body>")>`. The raw body is identical across Supabase
//   retries (marshaled once) and differs between legitimate events (metadata.uuid per event + fresh token hashes / user
//   state). The market / language is NOT an input, so a redelivery that resolves another market keeps the key. Keyed with the
//   hook secret: nothing in the key reveals the payload, tokens or addresses. No webhook-id input.
// Blocker B - one deadline: every provider request starts only if >= MIN_PROVIDER_REQUEST_WINDOW_MS remain, and the request
//   AND its response-body read are bounded by the SAME invocation deadline (abort + race). Retries / sleeps and the second
//   secure-email-change slot consume the same remaining budget.
// Platform retry is deliberately NOT requested (no 429/503 + Retry-After): Supabase would re-invoke inside the same 5 s
//   context with little budget left; duplicate prevention never depends on it. Every non-completed outcome is an explicit 500.

export const SUPABASE_HOOK_TIMEOUT_MS = 5000;
// Our whole invocation, measured from handler entry. The remaining 1.5 s cover Auth -> function transit, cold start and the
// response path inside Supabase's single 5 s context.
export const INVOCATION_BUDGET_MS = 3500;
export const MIN_PROVIDER_REQUEST_WINDOW_MS = 600;
export const CONCURRENT_RETRY_DELAYS_MS = [250, 500] as const;
const IDEMPOTENCY_DOMAIN = 'tekango-auth-email-idempotency/v1';

export type Deadline = { deadlineAtMs: number; clockMs: () => number };
export const remainingMs = (d: Deadline) => d.deadlineAtMs - d.clockMs();

export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'already_consumed' }
  | { kind: 'concurrent_unresolved' }
  | { kind: 'conflict_unknown' }
  | { kind: 'provider_error'; status: number; name: string }
  | { kind: 'ambiguous' } // request failed / aborted at the deadline: the provider may or may not have accepted it
  | { kind: 'not_started' }; // not enough budget left to start a provider request safely

export type SendDeps = {
  fetch: typeof fetch;
  deadline: Deadline;
  sleep: (ms: number) => Promise<void>;
  setTimer: (ms: number, fn: () => void) => () => void; // returns cancel
  log: (...args: unknown[]) => void;
};

const toB64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Deterministic per logical Auth event + slot. `secretBytes` = the decoded hook secret (already required to verify the
// request); `rawBody` = the exact verified request body.
export async function deriveIdempotencyKey(secretBytes: Uint8Array, rawBody: string, slot: string): Promise<string> {
  if (!(secretBytes instanceof Uint8Array) || secretBytes.length === 0) throw new Error('idempotency identity: no key material');
  if (typeof rawBody !== 'string' || rawBody.length === 0) throw new Error('idempotency identity: empty body');
  if (!/^[a-z]{1,16}$/.test(slot)) throw new Error('idempotency identity: invalid slot');
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${IDEMPOTENCY_DOMAIN}\n${slot}\n${rawBody}`)));
  return `tekango-auth/v1/${slot}/${toB64Url(mac)}`;
}

const KNOWN_NAME = /^[a-z_]{1,64}$/;
// Reads only the documented discriminator; anything unexpected -> '' (unknown, fail closed).
export async function providerErrorName(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const name = body && typeof body === 'object' ? (body as Record<string, unknown>).name : undefined;
    return typeof name === 'string' && KNOWN_NAME.test(name) ? name : '';
  } catch {
    return '';
  }
}

const TIMED_OUT = Symbol('timed_out');
// Races `work` against the remaining budget; on expiry aborts `controller` and yields TIMED_OUT. Never throws.
async function boundBy<T>(work: Promise<T>, ms: number, controller: AbortController, setTimer: SendDeps['setTimer']): Promise<T | typeof TIMED_OUT | Error> {
  let cancel = () => {};
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    cancel = setTimer(Math.max(0, ms), () => { controller.abort(); resolve(TIMED_OUT); });
  });
  try {
    return await Promise.race([work.catch((e) => (e instanceof Error ? e : new Error('request failed'))), expiry]);
  } finally {
    cancel();
  }
}

export async function sendWithIdempotency(
  args: { apiKey: string; idempotencyKey: string; body: string; slot: string },
  deps: SendDeps,
): Promise<SendOutcome> {
  for (let attempt = 0; ; attempt += 1) {
    const left = remainingMs(deps.deadline);
    if (left < MIN_PROVIDER_REQUEST_WINDOW_MS) {
      deps.log(`auth-send-email-hook: not enough hook budget to ${attempt === 0 ? 'start' : 'retry'} the provider request (slot ${args.slot}).`);
      return attempt === 0 ? { kind: 'not_started' } : { kind: 'concurrent_unresolved' };
    }
    const controller = new AbortController();
    const res = await boundBy(deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey, // logical-event key: identical on every retry and every re-invocation
      },
      body: args.body, // byte-identical on every retry inside this invocation
      signal: controller.signal,
    }), left, controller, deps.setTimer);
    if (res === TIMED_OUT || res instanceof Error || !(res instanceof Response)) {
      deps.log(`auth-send-email-hook: provider request ${res === TIMED_OUT ? 'hit the hook deadline' : 'failed'} (slot ${args.slot}); outcome unknown, not re-sent.`);
      return { kind: 'ambiguous' };
    }
    if (res.ok) return { kind: 'sent' };

    // Error body read is bounded by the same deadline (a stalled body cannot hold the hook).
    const nameOrTimeout = await boundBy(providerErrorName(res), remainingMs(deps.deadline), controller, deps.setTimer);
    const name = typeof nameOrTimeout === 'string' ? nameOrTimeout : '';
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
    const delay = CONCURRENT_RETRY_DELAYS_MS[attempt];
    if (delay === undefined || remainingMs(deps.deadline) < delay + MIN_PROVIDER_REQUEST_WINDOW_MS) {
      deps.log(`auth-send-email-hook: Resend concurrent idempotent request still in progress (slot ${args.slot}); not completed in budget.`);
      return { kind: 'concurrent_unresolved' };
    }
    await deps.sleep(delay);
  }
}
