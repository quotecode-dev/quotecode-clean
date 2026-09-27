import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import handler, { runCron } from './cron.js';

// Codex Post-LIVE Wave 1 blocker 4 - the daily cron must never mark a quote reminder as sent (no quote reminder delivery
// exists), and every remaining write / step result must be checked. Supabase and the rates API are local fakes.

function fakeSupabase({ upsertError = null, trial = { data: { success: true, sent3d: 0, sent24h: 0, errors: [] } }, sub = { data: { success: true, sent3d: 0, sent24h: 0 } } } = {}) {
  const calls = { from: [], upserts: [], updates: [], invokes: [] };
  const table = (name) => {
    calls.from.push(name);
    return {
      select() { throw new Error(`unexpected select on ${name}`); },
      update(v) { calls.updates.push({ name, v }); throw new Error(`unexpected update on ${name}`); },
      upsert: async (v, o) => { calls.upserts.push({ name, v, o }); return { error: upsertError }; },
    };
  };
  return {
    calls,
    from: table,
    functions: {
      invoke: async (fn, opts) => {
        calls.invokes.push({ fn, opts });
        return fn === 'send-trial-expiration-email' ? { error: null, ...trial } : { error: null, ...sub };
      },
    },
  };
}
const ratesOk = async () => ({ json: async () => ({ rates: { ILS: 3.7, EUR: 0.9 } }) });
const ENV = { CRON_SECRET: 'synthetic-cron-secret' };

describe('api/cron - quote reminder false-sent removed', () => {
  it('a full run never touches the quotes table (no select, no expiration_reminder_sent write)', async () => {
    const sb = fakeSupabase();
    const r = await runCron({ supabase: sb, env: ENV, fetchImpl: ratesOk });
    expect(r.ok).toBe(true);
    expect(sb.calls.from).not.toContain('quotes');
    expect(sb.calls.updates).toHaveLength(0);
    expect(sb.calls.from).toEqual(['app_settings']);
  });

  it('source: no quotes query and no expiration_reminder_sent mutation remain in the activation path', () => {
    const src = readFileSync(resolve(process.cwd(), 'api/cron.js'), 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/from\(\s*['"]quotes['"]\s*\)/);
    expect(code).not.toMatch(/expiration_reminder_sent/);
  });
});

describe('api/cron - write results are verified', () => {
  it('exchange-rates upsert error -> run fails (not "updated successfully")', async () => {
    const sb = fakeSupabase({ upsertError: { message: 'permission denied for table app_settings' } });
    const r = await runCron({ supabase: sb, env: ENV, fetchImpl: ratesOk });
    expect(r.ok).toBe(false);
    expect(r.failures.join()).toMatch(/exchange_rates upsert failed/);
    expect(r.logs.join()).not.toMatch(/Exchange rates updated successfully/);
  });

  it('rates API outage -> run fails, reminders still run', async () => {
    const sb = fakeSupabase();
    const r = await runCron({ supabase: sb, env: ENV, fetchImpl: async () => { throw new Error('network'); } });
    expect(r.ok).toBe(false);
    expect(sb.calls.invokes.map((i) => i.fn)).toEqual(['send-trial-expiration-email', 'send-subscription-expiration-email']);
  });

  it('trial reminder function error -> run fails', async () => {
    const sb = fakeSupabase({ trial: { data: { error: 'Unauthorized' } } });
    const r = await runCron({ supabase: sb, env: ENV, fetchImpl: ratesOk });
    expect(r.ok).toBe(false);
    expect(r.failures.join()).toMatch(/trial reminders: Unauthorized/);
  });

  for (const field of ['claimErrors', 'completionErrors', 'sentUnrecorded', 'sendFailed', 'sendUnknown']) {
    it(`trial reminder summary with ${field} > 0 -> run fails (not reported as clean success)`, async () => {
      const sb = fakeSupabase({ trial: { data: { success: true, sent3d: 1, sent24h: 0, [field]: 1, errors: ['u/3d: synthetic'] } } });
      const r = await runCron({ supabase: sb, env: ENV, fetchImpl: ratesOk });
      expect(r.ok).toBe(false);
    });
  }

  it('market-unresolved skips are logged but are not a failure (deliberate fail-closed)', async () => {
    const sb = fakeSupabase({ trial: { data: { success: true, sent3d: 2, sent24h: 0, skippedMarketUnresolved: 1, errors: ['u/3d: market not exactly Local/International - not sent'] } } });
    const r = await runCron({ supabase: sb, env: ENV, fetchImpl: ratesOk });
    expect(r.ok).toBe(true);
    expect(r.logs.join()).toMatch(/market unresolved \(not sent\) 1/);
  });

  it('no CRON_SECRET: reminders are skipped (not invoked), not a failure', async () => {
    const sb = fakeSupabase();
    const r = await runCron({ supabase: sb, env: {}, fetchImpl: ratesOk });
    expect(r.ok).toBe(true);
    expect(sb.calls.invokes).toHaveLength(0);
  });

  it('handler: unauthorized request is rejected before any work', async () => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    try {
      await handler({ headers: { authorization: 'Bearer wrong' } }, res);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
    }
    expect(res.code).toBe(401);
  });
});
