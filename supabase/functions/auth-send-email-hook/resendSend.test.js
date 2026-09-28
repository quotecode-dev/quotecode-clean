import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  CONCURRENT_RETRY_DELAYS_MS, INVOCATION_BUDGET_MS, MIN_PROVIDER_REQUEST_WINDOW_MS, SUPABASE_HOOK_TIMEOUT_MS, deriveIdempotencyKey, providerErrorName,
  sendWithIdempotency,
} from './resendSend.ts';

// Codex Auth 409 delta RE-review blockers A + B (2026-09-28): logical-event key derivation, the Resend 409 lifecycle and the
// ONE invocation deadline. Synthetic values only.
const SECRET = new Uint8Array(Buffer.from('synthetic-hook-secret-for-tests-only-0123456789'));
const RAW = JSON.stringify({ metadata: { uuid: '0f5a8a52-3c1e-4c55-9a55-000000000001' }, user: { id: 'u', email: 'a@example.test' }, email_data: { email_action_type: 'recovery', token_hash: 'th_1' } });
const KEY = 'tekango-auth/v1/primary/unit';
const BODY = JSON.stringify({ from: 'TEKANGO <info@tekango.com>', to: ['a@example.test'], subject: 's', html: 'h', text: 't' });
const concurrent = () => new Response(JSON.stringify({ statusCode: 409, name: 'concurrent_idempotent_requests', message: 'in progress' }), { status: 409 });
const invalid = () => new Response(JSON.stringify({ statusCode: 409, name: 'invalid_idempotent_request' }), { status: 409 });

function fake({ responses, clock = { t: 0 }, budget = INVOCATION_BUDGET_MS }) {
  const calls = []; const sleeps = []; const timers = []; const logs = [];
  const deadline = { deadlineAtMs: clock.t + budget, clockMs: () => clock.t };
  return {
    calls, sleeps, timers, logs, clock,
    deps: {
      fetch: async (url, init) => { calls.push({ key: init.headers['Idempotency-Key'], body: init.body, signal: init.signal }); const r = responses.shift(); return typeof r === 'function' ? r(init) : r; },
      deadline,
      sleep: async (ms) => { sleeps.push(ms); clock.t += ms; },
      setTimer: (ms, fn) => { timers.push(ms); const t = setTimeout(fn, ms); return () => clearTimeout(t); },
      log: (...a) => logs.push(a.join(' ')),
    },
  };
}
const send = (deps) => sendWithIdempotency({ apiKey: 're_synthetic', idempotencyKey: KEY, body: BODY, slot: 'primary' }, deps);

describe('deriveIdempotencyKey - logical-event identity', () => {
  it('deterministic, matches an independent node:crypto derivation, no webhook-id / market input', async () => {
    const k = await deriveIdempotencyKey(SECRET, RAW, 'primary');
    const mac = createHmac('sha256', Buffer.from(SECRET)).update(`tekango-auth-email-idempotency/v1\nprimary\n${RAW}`).digest('base64url');
    expect(k).toBe(`tekango-auth/v1/primary/${mac}`);
    expect(await deriveIdempotencyKey(SECRET, RAW, 'primary')).toBe(k);
  });
  it('slot, body and secret each change the key; the key never contains payload material', async () => {
    const k = await deriveIdempotencyKey(SECRET, RAW, 'primary');
    expect(await deriveIdempotencyKey(SECRET, RAW, 'current')).not.toBe(k);
    expect(await deriveIdempotencyKey(SECRET, RAW.replace('th_1', 'th_2'), 'primary')).not.toBe(k);
    expect(await deriveIdempotencyKey(SECRET, RAW.replace('000000000001', '000000000002'), 'primary')).not.toBe(k);
    expect(await deriveIdempotencyKey(new Uint8Array([1, 2, 3]), RAW, 'primary')).not.toBe(k);
    for (const s of ['a@example.test', 'th_1', '0f5a8a52', 'recovery']) expect(k).not.toContain(s);
    expect(k.length).toBeLessThanOrEqual(256);
  });
  it('missing / malformed identity input -> explicit error (never a guessed key)', async () => {
    for (const [secret, raw, slot] of [[new Uint8Array(), RAW, 'primary'], [null, RAW, 'primary'], [SECRET, '', 'primary'], [SECRET, null, 'primary'], [SECRET, RAW, ''], [SECRET, RAW, 'Primary/../x']]) {
      await expect(deriveIdempotencyKey(secret, raw, slot)).rejects.toThrow(/idempotency identity/);
    }
  });
});

describe('providerErrorName - documented discriminator only', () => {
  it('reads `name`; anything unexpected is "" (unknown)', async () => {
    const r = (b) => new Response(b, { status: 409 });
    expect(await providerErrorName(r('{"name":"invalid_idempotent_request"}'))).toBe('invalid_idempotent_request');
    for (const b of ['', 'x', 'null', '[]', '{"name":42}', '{"name":"Bad Name!"}', JSON.stringify({ name: 'a'.repeat(65) })]) expect(await providerErrorName(r(b)), b).toBe('');
  });
});

describe('sendWithIdempotency - lifecycle under the invocation deadline (fake clock)', () => {
  it('2xx -> sent; one request bounded by the whole remaining budget', async () => {
    const f = fake({ responses: [new Response('{"id":"e"}', { status: 200 })] });
    expect(await send(f.deps)).toEqual({ kind: 'sent' });
    expect(f.timers).toEqual([INVOCATION_BUDGET_MS]);
    expect(f.calls[0].signal).toBeInstanceOf(AbortSignal);
  });
  it('invalid_idempotent_request -> already_consumed; no retry', async () => {
    const f = fake({ responses: [invalid()] });
    expect(await send(f.deps)).toEqual({ kind: 'already_consumed' });
    expect(f.calls).toHaveLength(1);
  });
  it('concurrent -> same key + identical body retries within budget; resolves -> sent', async () => {
    const f = fake({ responses: [concurrent(), concurrent(), new Response('{"id":"e"}', { status: 200 })] });
    expect(await send(f.deps)).toEqual({ kind: 'sent' });
    expect(f.calls.map((c) => c.key)).toEqual([KEY, KEY, KEY]);
    expect(new Set(f.calls.map((c) => c.body)).size).toBe(1);
    expect(f.sleeps).toEqual([...CONCURRENT_RETRY_DELAYS_MS]);
  });
  it('concurrent, then the original finished with another body -> already_consumed', async () => {
    const f = fake({ responses: [concurrent(), invalid()] });
    expect(await send(f.deps)).toEqual({ kind: 'already_consumed' });
  });
  it('concurrent never resolving -> concurrent_unresolved after the bounded retries', async () => {
    const f = fake({ responses: [concurrent(), concurrent(), concurrent()] });
    expect(await send(f.deps)).toEqual({ kind: 'concurrent_unresolved' });
    expect(f.calls).toHaveLength(3);
  });
  it('retries are gated by the REMAINING budget (not a private budget)', async () => {
    const f = fake({ responses: [concurrent(), concurrent()], clock: { t: 0 }, budget: 1000 });
    expect(await send(f.deps)).toEqual({ kind: 'concurrent_unresolved' });
    expect(f.sleeps).toEqual([250]); // 1000 >= 250 + 600; then 750 < 500 + 600
    expect(f.timers.every((ms) => ms <= 1000)).toBe(true);
  });
  it('less than one request window left -> not_started (no request at all)', async () => {
    const f = fake({ responses: [], budget: MIN_PROVIDER_REQUEST_WINDOW_MS - 1 });
    expect(await send(f.deps)).toEqual({ kind: 'not_started' });
    expect(f.calls).toHaveLength(0);
  });
  it('request failure -> ambiguous (never "sent"); unknown 409 -> conflict_unknown; non-409 -> provider_error (name only logged)', async () => {
    const a = fake({ responses: [() => Promise.reject(new Error('reset a@example.test'))] });
    expect(await send(a.deps)).toEqual({ kind: 'ambiguous' });
    expect(a.logs.join('\n')).not.toContain('a@example.test');
    const u = fake({ responses: [new Response('{"name":"brand_new_409"}', { status: 409 })] });
    expect(await send(u.deps)).toEqual({ kind: 'conflict_unknown' });
    const p = fake({ responses: [new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'a@example.test' }), { status: 429 })] });
    expect(await send(p.deps)).toEqual({ kind: 'provider_error', status: 429, name: 'rate_limit_exceeded' });
    expect(p.logs.join('\n')).not.toContain('a@example.test');
  });
});

describe('sendWithIdempotency - real clock bounds', () => {
  const realDeps = (fetch, budget) => ({
    fetch,
    deadline: { deadlineAtMs: Date.now() + budget, clockMs: () => Date.now() },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    setTimer: (ms, fn) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
    log: () => {},
  });
  it('constants: invocation budget leaves >= 1.5 s under the documented 5 s Supabase limit', () => {
    expect(SUPABASE_HOOK_TIMEOUT_MS).toBe(5000);
    expect(INVOCATION_BUDGET_MS).toBeLessThanOrEqual(SUPABASE_HOOK_TIMEOUT_MS - 1500);
  });
  it('a hanging request (even one ignoring the abort signal) ends at the deadline -> ambiguous', async () => {
    const t0 = Date.now();
    const out = await send(realDeps(() => new Promise(() => {}), 800));
    expect(out).toEqual({ kind: 'ambiguous' });
    expect(Date.now() - t0).toBeLessThan(800 + 200);
  });
  it('a stalled error body ends at the deadline', async () => {
    const t0 = Date.now();
    const out = await send(realDeps(async () => new Response(new ReadableStream({ start() {} }), { status: 409 }), 800));
    expect(out).toEqual({ kind: 'conflict_unknown' });
    expect(Date.now() - t0).toBeLessThan(800 + 200);
  });
  it('concurrent forever with an instant provider: all retries finish well inside the budget', async () => {
    const t0 = Date.now();
    const out = await send(realDeps(async () => concurrent(), INVOCATION_BUDGET_MS));
    expect(out).toEqual({ kind: 'concurrent_unresolved' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
