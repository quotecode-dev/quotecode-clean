// Owner console 2026-11-02 (stage 1): the site cron that triggers the failed-renewal emails - synthetic env and fetch only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runCustomerNotices } from './customer-notices.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/customer-notices', () => {
  it('calls the function with the shared cron secret only', async () => {
    const calls = [];
    const out = await runCustomerNotices({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' }, fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/customer-notices');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runCustomerNotices({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  it('runs every hour', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons.find((c) => c.path === '/api/customer-notices')?.schedule).toBe('5 * * * *');
  });
});
