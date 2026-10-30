// Codex SEC-EF-03 / SEC-LOG-02 (Owner 2026-10-30): the email-provider webhook - signature, 5-minute freshness, one event once, a bounce
// marks the quote only for its current send, fixed error codes. In-process with SYNTHETIC data; nothing leaves the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    rpc: async (fn, args) => { h.state.rpc.push({ fn, args }); return h.state.verdict; },
  }),
}));

const SECRET_BYTES = Buffer.from('synthetic-webhook-secret-bytes!!');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;
const QUOTE = '11111111-1111-4111-8111-111111111111';
const sign = (id, ts, body) => `v1,${createHmac('sha256', SECRET_BYTES).update(`${id}.${ts}.${body}`).digest('base64')}`;
const call = (event, { id = 'msg_1', ts = Math.floor(Date.now() / 1000), badSig = false } = {}) => {
  const body = JSON.stringify(event);
  return h.handler(new Request('https://synthetic.supabase.co/functions/v1/resend-email-webhook', { method: 'POST', body,
    headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': badSig ? 'v1,AAAA' : sign(id, ts, body) } }));
};
const bounce = (quote = QUOTE) => ({ type: 'email.bounced', data: { email_id: 'em_1', tags: [{ name: 'quote_id', value: quote }], bounce: { message: 'mailbox does not exist' } } });

let mod;
beforeEach(async () => {
  h.state = { rpc: [], verdict: { data: { accept: true, reason: 'current' }, error: null } };
  globalThis.Deno = { env: { get: (k) => ({ RESEND_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SECRET_KEYS: '{"default":"service"}' })[k] } };
  if (!h.handler) mod = await import('./index.ts');
});

describe('resend-email-webhook (SEC-EF-03)', () => {
  it('a valid fresh bounce is recorded and marked in ONE database call (event + mark in one transaction)', async () => {
    const r = await call(bounce());
    expect(await r.json()).toMatchObject({ received: true, marked: 'bounced' });
    expect(h.state.rpc).toHaveLength(1);
    expect(h.state.rpc[0]).toMatchObject({ fn: 'resend_webhook_accept', args: { p_event_id: 'msg_1', p_email_id: 'em_1', p_quote: QUOTE, p_reason: 'mailbox does not exist' } });
  });
  it('a stale or future signature is refused before anything is recorded', async () => {
    expect((await call(bounce(), { ts: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(401);
    expect((await call(bounce(), { ts: Math.floor(Date.now() / 1000) + 3600 })).status).toBe(401);
    expect(h.state.rpc).toHaveLength(0);
    expect(mod.timestampFresh('abc', 0)).toBe(false);
  });
  it('a bad signature is refused', async () => {
    expect((await call(bounce(), { badSig: true })).status).toBe(401);
  });
  it('a replayed event or an old send never changes the quote', async () => {
    h.state.verdict = { data: { accept: false, reason: 'duplicate' }, error: null };
    expect(await (await call(bounce())).json()).toMatchObject({ skipped: 'duplicate' });
    h.state.verdict = { data: { accept: false, reason: 'not_current' }, error: null };
    expect(await (await call(bounce())).json()).toMatchObject({ skipped: 'not_current' });
  });
  it('a tag that is not a quote id is skipped; database errors answer a fixed code (no internal message)', async () => {
    expect(await (await call(bounce('not-a-uuid'))).json()).toMatchObject({ skipped: 'no quote_id tag' });
    h.state.verdict = { data: null, error: { message: 'relation "x" does not exist' } };
    const r = await call(bounce());
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'store_failed' });
  });
});
