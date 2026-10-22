// The weekly support review (Owner console 2026-10-23, typed L-22): the Sunday site cron that starts the review - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runWeeklyReview } from './support-weekly-review.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/support-weekly-review', () => {
  it('calls support-weekly-review with the scan action and the shared cron secret only', async () => {
    const calls = [];
    const out = await runWeeklyReview({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 202, json: async () => ({ ok: true, started: true }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/support-weekly-review');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ action: 'run' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runWeeklyReview({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  it('runs on Sundays at 17:00 and 18:00 UTC (20:00 Israel in winter and summer)', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons).toContainEqual({ path: '/api/support-weekly-review', schedule: '0 17,18 * * 0' });
  });
});
