import { describe, it, expect } from 'vitest';
import {
  CONCURRENT_RETRY_DELAYS_MS, HOOK_TIMEOUT_MS, MIN_RETRY_REQUEST_WINDOW_MS, RETRY_DEADLINE_MS, providerErrorName, sendWithIdempotency,
} from './resendSend.ts';

// Codex Option C delta review blocker P1 (2026-09-28): Resend 409 lifecycle by provider error name + hook time budget.
const KEY = 'auth-hook/msg_unit/primary';
const BODY = JSON.stringify({ from: 'TEKANGO <info@tekango.com>', to: ['a@example.test'], subject: 's', html: 'h', text: 't' });
const concurrent = () => new Response(JSON.stringify({ statusCode: 409, name: 'concurrent_idempotent_requests', message: 'in progress' }), { status: 409 });
const args = (hookStartedAtMs) => ({ apiKey: 're_synthetic', idempotencyKey: KEY, body: BODY, slot: 'primary', hookStartedAtMs });

function fakeDeps({ responses, clock = { t: 0 } }) {
  const calls = [];
  const sleeps = [];
  const logs = [];
  return {
    calls, sleeps, logs, clock,
    deps: {
      fetch: async (url, init) => { calls.push({ key: init.headers['Idempotency-Key'], body: init.body, hasSignal: !!init.signal }); const r = responses.shift(); return typeof r === 'function' ? r(init) : r; },
      clockMs: () => clock.t,
      sleep: async (ms) => { sleeps.push(ms); clock.t += ms; },
      log: (...a) => logs.push(a.join(' ')),
    },
  };
}

describe('providerErrorName - documented discriminator only', () => {
  it('reads `name`; anything unexpected is "" (unknown)', async () => {
    const r = (b) => new Response(b, { status: 409 });
    expect(await providerErrorName(r(JSON.stringify({ name: 'invalid_idempotent_request' })))).toBe('invalid_idempotent_request');
    expect(await providerErrorName(r(JSON.stringify({ name: 'concurrent_idempotent_requests', statusCode: 409 })))).toBe('concurrent_idempotent_requests');
    for (const b of ['', 'x', 'null', '[]', JSON.stringify({ name: 42 }), JSON.stringify({ name: 'Bad Name!' }), JSON.stringify({ name: 'a'.repeat(65) }), JSON.stringify({ error: 'x' })]) {
      expect(await providerErrorName(r(b)), b).toBe('');
    }
  });
});

describe('sendWithIdempotency - lifecycle', () => {
  it('invalid_idempotent_request -> already_consumed, one request, no sleep', async () => {
    const f = fakeDeps({ responses: [new Response(JSON.stringify({ name: 'invalid_idempotent_request' }), { status: 409 })] });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'already_consumed' });
    expect(f.calls).toHaveLength(1);
    expect(f.sleeps).toEqual([]);
  });

  it('concurrent -> retries use the SAME key and the byte-identical body; resolves -> sent', async () => {
    const f = fakeDeps({ responses: [concurrent(), concurrent(), new Response('{"id":"e1"}', { status: 200 })] });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'sent' });
    expect(f.calls.map((c) => c.key)).toEqual([KEY, KEY, KEY]);
    expect(new Set(f.calls.map((c) => c.body))).toEqual(new Set([BODY]));
    expect(f.sleeps).toEqual([...CONCURRENT_RETRY_DELAYS_MS]);
    expect(f.calls.slice(1).every((c) => c.hasSignal)).toBe(true); // every retry is deadline-bounded
  });

  it('concurrent, then the in-flight original finished with a different body -> already_consumed', async () => {
    const f = fakeDeps({ responses: [concurrent(), new Response(JSON.stringify({ name: 'invalid_idempotent_request' }), { status: 409 })] });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'already_consumed' });
  });

  it('concurrent that never resolves -> concurrent_unresolved after exactly the bounded retries', async () => {
    const f = fakeDeps({ responses: [concurrent(), concurrent(), concurrent(), concurrent()] });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'concurrent_unresolved' });
    expect(f.calls).toHaveLength(1 + CONCURRENT_RETRY_DELAYS_MS.length);
  });

  it('budget gate: a retry is started only if it can finish by RETRY_DEADLINE_MS', async () => {
    // started 2800 ms ago: 2800 + 250 + 700 <= 4000 -> one retry; then 3050 + 500 + 700 > 4000 -> stop
    const f = fakeDeps({ responses: [concurrent(), concurrent()], clock: { t: 2800 } });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'concurrent_unresolved' });
    expect(f.sleeps).toEqual([250]);
    // started 3100 ms ago: no retry at all
    const g = fakeDeps({ responses: [concurrent()], clock: { t: 3100 } });
    expect(await sendWithIdempotency(args(0), g.deps)).toEqual({ kind: 'concurrent_unresolved' });
    expect(g.sleeps).toEqual([]);
  });

  it('a retry request that fails / is aborted -> retry_aborted (outcome unknown, never "sent")', async () => {
    const f = fakeDeps({ responses: [concurrent(), () => Promise.reject(new Error('network'))] });
    expect(await sendWithIdempotency(args(0), f.deps)).toEqual({ kind: 'retry_aborted' });
  });

  it('unknown 409 and non-409 errors: no retry; only status + name are logged', async () => {
    const u = fakeDeps({ responses: [new Response('{"name":"brand_new_409"}', { status: 409 })] });
    expect(await sendWithIdempotency(args(0), u.deps)).toEqual({ kind: 'conflict_unknown' });
    const p = fakeDeps({ responses: [new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'a@example.test' }), { status: 429 })] });
    expect(await sendWithIdempotency(args(0), p.deps)).toEqual({ kind: 'provider_error', status: 429, name: 'rate_limit_exceeded' });
    expect(p.calls).toHaveLength(1);
    expect(p.logs.join('\n')).not.toContain('a@example.test');
  });
});

describe('hook time budget (real clock and timers)', () => {
  it('constants keep >= 1 s margin inside the documented 5 s hook limit', () => {
    expect(HOOK_TIMEOUT_MS).toBe(5000);
    expect(RETRY_DEADLINE_MS).toBeLessThanOrEqual(HOOK_TIMEOUT_MS - 1000);
    expect(CONCURRENT_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeLessThan(RETRY_DEADLINE_MS);
    expect(MIN_RETRY_REQUEST_WINDOW_MS).toBeGreaterThan(0);
  });

  it('worst case with an immediately-answering provider: total retry logic < 1 s', async () => {
    const t0 = Date.now();
    const out = await sendWithIdempotency(args(t0), { fetch: async () => concurrent(), clockMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log: () => {} });
    const took = Date.now() - t0;
    expect(out).toEqual({ kind: 'concurrent_unresolved' });
    expect(took).toBeLessThan(1000);
  });

  it('worst case with a hanging retry: the retry is aborted so the whole send ends by RETRY_DEADLINE_MS after hook start', async () => {
    const hookStartedAtMs = Date.now() - 3000; // lookup + first send already used 3 s
    let n = 0;
    const fetch = (url, init) => {
      n += 1;
      if (n === 1) return Promise.resolve(concurrent());
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    const out = await sendWithIdempotency(args(hookStartedAtMs), { fetch, clockMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log: () => {} });
    const endedAfterHookStart = Date.now() - hookStartedAtMs;
    expect(out).toEqual({ kind: 'retry_aborted' });
    expect(endedAfterHookStart).toBeLessThanOrEqual(RETRY_DEADLINE_MS + 150);
  });
});
