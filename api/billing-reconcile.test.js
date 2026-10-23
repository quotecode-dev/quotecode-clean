// The daily payment reconciliation (Owner console 2026-10-23): the site cron that starts it - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runBillingReconcile } from './billing-reconcile.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/billing-reconcile', () => {
  it('calls billing-reconcile with the run action and the shared cron secret only', async () => {
    const calls = [];
    const out = await runBillingReconcile({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, status: 'ok' }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/billing-reconcile');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ action: 'run' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runBillingReconcile({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  it('runs every day at 04:00 and 05:00 UTC (the function runs once per Israel day)', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons).toContainEqual({ path: '/api/billing-reconcile', schedule: '0 4,5 * * *' });
  });
});

// Codex review 2026-10-23 R-02: a 200 with a failed body is a failure for the cron (Vercel shows it), never "success"
describe('api/billing-reconcile - the outcome comes from the body', () => {
  const run = (status, body) => runBillingReconcile({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co', CRON_SECRET: 's' },
    fetchImpl: async () => ({ ok: status < 400, status, json: async () => { if (body === 'bad') throw new Error('not json'); return body; } }) });
  it.each([
    [200, { ok: true, status: 'ok' }, true, 'completed'],
    [200, { ok: true, status: 'already_ran_today' }, true, 'skipped'],
    [200, { ok: false, status: 'failed', code: 'provider_403' }, false, 'failed'],
    [200, { ok: true, status: 'not_configured' }, false, 'not_configured'],
    [200, 'bad', false, 'failed'],
    [500, { ok: false, code: 'failed' }, false, 'failed'],
  ])('%i %j -> ok %s (%s)', async (status, body, ok, outcome) => {
    const r = await run(status, body);
    expect(r.ok).toBe(ok);
    expect(r.outcome).toBe(outcome);
  });
});
