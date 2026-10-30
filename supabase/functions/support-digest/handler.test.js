// Owner console 2026-10-20 (smart support email stage 2): the evening summary function, in-process with SYNTHETIC data.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    from: (table) => {
      const q = { table, ops: [] };
      const chain = (name) => (...args) => { q.ops.push([name, ...args]); return q; };
      for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit', 'delete']) q[m] = chain(m);
      q.upsert = (row) => { q.ops.push(['upsert', row]); return q; };
      q.update = (patch) => { q.ops.push(['update', patch]); return q; };
      q.then = (ok, bad) => {
        const op = q.ops[0]?.[0];
        let res = { data: [], error: null };
        if (table === 'support_digest_runs' && op === 'upsert') { const fresh = !h.state.claimed; h.state.claimed = true; res = { data: fresh ? [{ day: q.ops[0][1].day }] : [], error: null }; }
        else if (table === 'support_inbound_messages' && op === 'select' && q.ops.some((o) => o[0] === 'in')) res = { data: [{ from_address: 'a@x.test', subject: 's', bin: 'red', status: 'waiting', summary: 'wants a refund', reply_sent_by: null, stored_at: '2026-10-20T08:00:00Z' }], error: null };
        return Promise.resolve(res).then(ok, bad);
      };
      return q;
    },
  }),
}));

let provider;
beforeEach(async () => {
  h.state = { claimed: false };
  provider = [];
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 're_x', CRON_SECRET: 'synthetic-cron-secret', SUPPORT_OWNER_NOTIFY_ADDRESS: 'owner@gmail.test' })[k] } };
  globalThis.fetch = vi.fn(async (url, init) => { provider.push({ url, body: JSON.parse(init.body), headers: init.headers }); return new Response('{}', { status: 200 }); });
  if (!h.handler) await import('./index.ts');
});
afterEach(() => { vi.useRealTimers(); });
const call = (secret = 'synthetic-cron-secret') => h.handler(new Request('https://synthetic.supabase.co/functions/v1/support-digest', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {}, body: '{}' }));

describe('support-digest (evening summary)', () => {
  it('only the cron secret opens it', async () => {
    expect((await call('wrong')).status).toBe(401);
    expect((await call(null)).status).toBe(401);
  });
  it('outside 20:00 Israel time it sends nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-12-01T17:00:00Z'));
    expect(await (await call()).json()).toMatchObject({ ok: true, skipped: 'not_digest_hour', hour: 19 });
    expect(provider).toHaveLength(0);
  });
  it('at 20:00 Israel time it sends ONE summary to the Owner per day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T17:00:00Z'));
    expect(await (await call()).json()).toMatchObject({ ok: true, sent: true, day: '2026-10-20' });
    expect(provider).toHaveLength(1);
    expect(provider[0].body.to).toEqual(['owner@gmail.test']);
    expect(provider[0].body.subject).toBe('סיכום הפניות של היום: 1 ממתינות לך');
    expect(provider[0].headers['Idempotency-Key']).toBe('tekango-support/v1/digest/2026-10-20');
    expect(await (await call()).json()).toMatchObject({ ok: true, skipped: 'already_sent' });
    expect(provider).toHaveLength(1);
  });
});
