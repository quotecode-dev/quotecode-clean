// Owner 2026-10-15: signed-in Edge Function calls always carry a fresh user session; one refresh + retry on 401; never anonymous.
import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: { auth: {}, functions: {} } }));
const { makeInvokeWithFreshSession } = await import('./invokeWithFreshSession');

const err401 = () => Object.assign(new Error('x'), { context: { status: 401 } });
function client({ session = 'T1', refreshTo = 'T2', answers = [{ data: { ok: 1 }, error: null }] } = {}) {
  const calls = [];
  let n = 0;
  return {
    calls,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: session ? { access_token: session } : null } })),
      refreshSession: vi.fn(async () => ({ data: { session: refreshTo ? { access_token: refreshTo } : null } })),
    },
    functions: { invoke: vi.fn(async (name, opts) => { calls.push([name, opts.headers.Authorization, opts.body]); return answers[Math.min(n++, answers.length - 1)]; }) },
  };
}

describe('invokeWithFreshSession', () => {
  it('uses the current session token explicitly and keeps the body', async () => {
    const c = client();
    const r = await makeInvokeWithFreshSession(c)('send-quote-email', { body: { a: 1 } });
    expect(r.data).toEqual({ ok: 1 });
    expect(c.calls).toEqual([['send-quote-email', 'Bearer T1', { a: 1 }]]);
    expect(c.auth.refreshSession).not.toHaveBeenCalled();
  });
  it('no session in memory: refreshes first; never sends an anonymous call', async () => {
    const c = client({ session: null });
    await makeInvokeWithFreshSession(c)('quote-presentation', { body: { action: 'context' } });
    expect(c.calls[0][1]).toBe('Bearer T2');
  });
  it('a 401 answer: one refresh, one retry with the new token', async () => {
    const c = client({ answers: [{ data: null, error: err401() }, { data: { ok: 2 }, error: null }] });
    const r = await makeInvokeWithFreshSession(c)('send-quote-email', { body: {} });
    expect(r.data).toEqual({ ok: 2 });
    expect(c.calls.map((x) => x[1])).toEqual(['Bearer T1', 'Bearer T2']);
  });
  it('signed out for real: no call at all, a typed signed_out error', async () => {
    const c = client({ session: null, refreshTo: null });
    const r = await makeInvokeWithFreshSession(c)('send-quote-email', { body: {} });
    expect(c.calls).toEqual([]);
    expect(r.error.code).toBe('signed_out');
    expect(r.error.message).toBe('Invalid or expired session');
  });
  it('a non-401 error is returned as is (no retry loop)', async () => {
    const e = Object.assign(new Error('boom'), { context: { status: 500 } });
    const c = client({ answers: [{ data: null, error: e }] });
    const r = await makeInvokeWithFreshSession(c)('x', { body: {} });
    expect(r.error).toBe(e); expect(c.calls).toHaveLength(1);
  });
});
