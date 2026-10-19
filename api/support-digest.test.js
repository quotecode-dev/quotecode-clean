// Owner console 2026-10-20 (smart support email stage 2): the site cron that triggers the evening summary - synthetic env, fake fetch.
import { describe, it, expect } from 'vitest';
import handler, { runSupportDigest } from './support-digest.js';

const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('api/support-digest', () => {
  it('calls the support-digest function with the shared cron secret only', async () => {
    const calls = [];
    const out = await runSupportDigest({ env: { VITE_SUPABASE_URL: 'https://synthetic.supabase.co/', CRON_SECRET: 'synthetic-cron-secret' }, fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, skipped: 'not_digest_hour' }) }; } });
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('https://synthetic.supabase.co/functions/v1/support-digest');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'x-cron-secret': 'synthetic-cron-secret' });
  });
  it('refuses without the Vercel cron authorization, and reports a missing configuration', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const r = res();
    await handler({ headers: { authorization: 'Bearer wrong' } }, r);
    expect(r.code).toBe(401);
    expect((await runSupportDigest({ env: {}, fetchImpl: async () => { throw new Error('no call'); } })).ok).toBe(false);
    delete process.env.CRON_SECRET;
  });
});
