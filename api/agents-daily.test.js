// The agents room daily run (Owner console 2026-10-27, stage 2 decision 3): the daily site cron of the security agent - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runAgentsDaily } from './agents-daily.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/agents-daily', () => {
  it('calls agents-room with the daily action and the shared cron secret only', async () => {
    const calls = [];
    const out = await runAgentsDaily({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/agents-room');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ action: 'daily' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runAgentsDaily({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  it('runs every day at 04:30 UTC (the morning in Israel)', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons).toContainEqual({ path: '/api/agents-daily', schedule: '30 4 * * *' });
  });
});
