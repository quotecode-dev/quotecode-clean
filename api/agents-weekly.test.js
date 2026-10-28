// The agents room weekly run (Owner console 2026-10-27): the Sunday site cron that starts the three agents - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { runAgentsWeekly } from './agents-weekly.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/agents-weekly', () => {
  it('calls agents-room with the run-all action and the shared cron secret only', async () => {
    const calls = [];
    const out = await runAgentsWeekly({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, mailed: true, results: [{ agent: 'seo', status: 'done' }] }) }; } });
    expect(out.ok).toBe(true);
    expect(out.outcome).toBe('completed');
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/agents-room');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ action: 'run', agent: 'all' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runAgentsWeekly({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
  // 20261029000000 (Codex F12): the body decides - a failed agent or an unmailed report is a failure, a second call with nothing to do is skipped
  it('a failed agent or a report not mailed fails; nothing left to do is skipped', async () => {
    const env = { VITE_SUPABASE_URL: 'https://synthetic.supabase.co', CRON_SECRET: 's' };
    const answer = (body) => runAgentsWeekly({ env, fetchImpl: async () => ({ ok: true, status: 200, json: async () => body }) });
    expect((await answer({ ok: true, mailed: false, results: [{ agent: 'seo', status: 'done' }] })).outcome).toBe('failed');
    expect((await answer({ ok: true, mailed: true, results: [{ agent: 'seo', status: 'failed' }] })).outcome).toBe('failed');
    expect((await answer({ ok: true, mailed: false, results: [{ agent: 'seo', status: 'already_ran' }] })).outcome).toBe('skipped');
    // Codex N10: the retry of an earlier unmailed report was tried and failed again - a failure, never "skipped"
    expect((await answer({ ok: true, mailed: false, mailAttempted: true, results: [{ agent: 'seo', status: 'already_ran' }] })).outcome).toBe('failed');
    expect((await answer({ ok: true, mailed: true, mailAttempted: true, results: [{ agent: 'seo', status: 'already_ran' }] })).outcome).not.toBe('failed');
    expect((await answer({ ok: false })).ok).toBe(false);
  });
  it('runs on Sundays at 05:00 and 06:00 UTC (the morning in Israel)', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons;
    expect(crons).toContainEqual({ path: '/api/agents-weekly', schedule: '0 5,6 * * 0' });
  });
});
