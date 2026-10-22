// Owner console 2026-10-22 (typed L-22, the expense-invoice tool): the monthly site cron that starts the mailbox scan - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runExpenseScan } from './expense-scan.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/expense-scan', () => {
  it('calls expense-invoices with the scan action and the shared cron secret only', async () => {
    const calls = [];
    const out = await runExpenseScan({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 202, json: async () => ({ ok: true, started: true }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/expense-invoices');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ action: 'scan' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runExpenseScan({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  it('runs on the 1st of every month', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons).toContainEqual({ path: '/api/expense-scan', schedule: '0 5 1 * *' });
  });
});
