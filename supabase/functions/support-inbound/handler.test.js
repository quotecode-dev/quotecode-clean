// Owner console 2026-10-19 (smart support email stage 1, docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md): the support-inbound webhook,
// in-process with SYNTHETIC data - the Deno serve, the Supabase client and the provider API are replaced; nothing leaves the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { parseAddress, htmlToText, parseAllowedAddresses, recipientAllowed, buildInboundRow, addressList } from './inbound.ts';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  // a chainable fake of the few queries the function makes; every call is recorded, the answer comes from h.state
  createClient: (_url, key) => ({
    from: (table) => {
      const q = { table, key, ops: [] };
      const chain = (name) => (...args) => { q.ops.push([name, ...args]); return q; };
      for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit']) q[m] = chain(m);
      q.upsert = (row, opts) => { h.state.upserts.push({ table, row, opts, key }); q.ops.push(['upsert']); return q; };
      q.update = (patch) => { h.state.updates.push({ table, patch }); q.ops.push(['update', patch]); return q; };
      q.maybeSingle = () => Promise.resolve(table === 'support_assistant_settings' ? { data: h.state.settings, error: null } : { data: h.state.existing, error: null });
      q.then = (ok, bad) => {
        const op = q.ops[0]?.[0];
        let res;
        if (op === 'upsert') res = h.state.storeResult.error ? h.state.storeResult : { data: h.state.inserted, error: null };
        else if (op === 'update') res = { data: [{ id: 'row-1' }], error: null };
        else res = { data: [], error: null };
        return Promise.resolve(res).then(ok, bad);
      };
      return q;
    },
  }),
}));

const SECRET_BYTES = new Uint8Array(32).map((_, i) => i + 1);
const SECRET = `whsec_${Buffer.from(SECRET_BYTES).toString('base64')}`;
const sign = async (id, ts, body) => {
  const key = await webcrypto.subtle.importKey('raw', SECRET_BYTES, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return `v1,${Buffer.from(sig).toString('base64')}`;
};
const EVENT = (over = {}) => ({ type: 'email.received', created_at: '2026-10-19T18:00:00Z', data: { email_id: 'em-123', created_at: '2026-10-19T18:00:00Z', from: 'Noa Cohen <noa@customer.test>', to: ['support@inbound.tekango.test'], received_for: [], cc: [], message_id: '<m1@customer.test>', subject: 'איך מוסיפים לוגו?', attachments: [], ...over } });
const EMAIL = { id: 'em-123', from: 'Noa Cohen <noa@customer.test>', to: ['support@inbound.tekango.test'], subject: 'איך מוסיפים לוגו?', created_at: '2026-10-19T18:00:00Z', html: '<div>שלום,<br>איך מוסיפים <b>לוגו</b> להצעה?</div><script>alert(1)</script>', text: null, headers: { 'In-Reply-To': '<prev@tekango.test>' }, message_id: '<m1@customer.test>', authentication: { spf: 'pass', dkim: 'pass', dmarc: 'fail' }, attachments: [{ id: 'a1', filename: 'shot.png', content_type: 'image/png', size: 2048 }] };

let provider;
function setup({ env = {}, fetchImpl = null, storeResult = { error: null } } = {}) {
  h.state = { upserts: [], updates: [], storeResult, inserted: [{ id: '11111111-1111-4111-8111-111111111111', status: 'new', from_address: 'noa@customer.test', to_addresses: ['support@inbound.tekango.test'], subject: 'איך מוסיפים לוגו?', text_body: 'איך מוסיפים לוגו?', attachments: [], message_id: '<m1@customer.test>', is_automated: false, mailbox: 'support' }], existing: null, settings: { auto_send_green: false, auto_send_yellow: false, paused: false } };
  provider = [];
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-placeholder', RESEND_API_KEY: 're_placeholder', RESEND_INBOUND_WEBHOOK_SECRET: SECRET, SUPPORT_INBOUND_ADDRESSES: 'support@inbound.tekango.test, info@inbound.tekango.test', ...env })[k] } };
  globalThis.fetch = vi.fn(async (url, init) => { provider.push({ url, init }); return fetchImpl ? fetchImpl(url) : new Response(JSON.stringify(EMAIL), { status: 200 }); });
}
const post = async (event, { id = 'msg_1', ts = String(Math.floor(Date.now() / 1000)), badSig = false } = {}) => {
  const body = JSON.stringify(event);
  const sig = badSig ? 'v1,AAAA' : await sign(id, ts, body);
  return new Request('https://synthetic.supabase.co/functions/v1/support-inbound', { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sig }, body });
};

beforeEach(async () => { setup(); if (!h.handler) await import('./index.ts'); });

describe('support-inbound helpers', () => {
  it('addresses, HTML to text (no script), allowed recipients', () => {
    expect(parseAddress('"Noa Cohen" <Noa@Customer.Test>')).toEqual({ address: 'noa@customer.test', name: 'Noa Cohen' });
    expect(parseAddress('not-an-address')).toBeNull();
    expect(htmlToText('<p>שלום</p><style>x{}</style><p>a &amp; b</p><script>evil()</script>')).toBe('שלום\na & b');
    const allowed = parseAllowedAddresses('Support@Inbound.Tekango.Test,bad');
    expect([...allowed]).toEqual(['support@inbound.tekango.test']);
    expect(recipientAllowed(addressList(['x@y.test', 'support@inbound.tekango.test']), allowed)).toBe(true);
    expect(recipientAllowed(['x@y.test'], allowed)).toBe(false);
  });
  it('the stored row: plain text only, metadata attachments, auth results, In-Reply-To', () => {
    const row = buildInboundRow({ eventId: 'msg_1', webhookData: EVENT().data, email: EMAIL });
    expect(row).toMatchObject({ provider: 'resend', provider_event_id: 'msg_1', provider_email_id: 'em-123', from_address: 'noa@customer.test', from_name: 'Noa Cohen', to_addresses: ['support@inbound.tekango.test'], subject: 'איך מוסיפים לוגו?', in_reply_to: '<prev@tekango.test>', auth_results: { spf: 'pass', dkim: 'pass', dmarc: 'fail' }, attachments: [{ filename: 'shot.png', content_type: 'image/png', size: 2048 }] });
    expect(row.text_body).toBe('שלום,\nאיך מוסיפים לוגו להצעה?');
    expect(row.text_body).not.toMatch(/alert|<script/);
  });
});

describe('support-inbound handler (synthetic) - Owner 2026-10-19', () => {
  it('a signed email.received to the support address is fetched and stored ONCE with the service role', async () => {
    const r = await h.handler(await post(EVENT()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, stored: true });
    expect(provider[0].url).toBe('https://api.resend.com/emails/receiving/em-123');
    expect(provider[0].init.headers.Authorization).toBe('Bearer re_placeholder');
    expect(h.state.upserts).toHaveLength(1);
    expect(h.state.upserts[0]).toMatchObject({ table: 'support_inbound_messages', key: 'service-placeholder', opts: { onConflict: 'provider,provider_email_id', ignoreDuplicates: true } });
  });
  it('refuses a bad / stale signature and a missing configuration before reading anything', async () => {
    expect((await h.handler(await post(EVENT(), { badSig: true }))).status).toBe(401);
    expect((await h.handler(await post(EVENT(), { ts: String(Math.floor(Date.now() / 1000) - 3600) }))).status).toBe(401);
    setup({ env: { RESEND_INBOUND_WEBHOOK_SECRET: '' } });
    expect((await h.handler(await post(EVENT()))).status).toBe(500);
    setup({ env: { SUPPORT_INBOUND_ADDRESSES: '' } });
    expect((await h.handler(await post(EVENT()))).status).toBe(500);
    expect(provider).toHaveLength(0);
    expect(h.state.upserts).toHaveLength(0);
  });
  it('another event type / another recipient is acknowledged and dropped; a provider failure asks for a retry', async () => {
    expect(await (await h.handler(await post({ type: 'email.sent', data: {} }))).json()).toEqual({ ok: true, ignored: 'event_type' });
    expect(await (await h.handler(await post(EVENT({ to: ['sales@inbound.tekango.test'] })))).json()).toEqual({ ok: true, ignored: 'recipient' });
    expect(provider).toHaveLength(0);
    setup({ fetchImpl: () => new Response('down', { status: 503 }) });
    expect((await h.handler(await post(EVENT()))).status).toBe(502);
    setup({ storeResult: { error: { message: 'db down' } } });
    expect((await h.handler(await post(EVENT()))).status).toBe(500);
  });
  it('reads received mail with the dedicated receiving key when it is set (the sending key may be sending-only)', async () => {
    setup({ env: { RESEND_RECEIVING_API_KEY: 're_receiving_placeholder' } });
    await h.handler(await post(EVENT()));
    expect(provider[0].init.headers.Authorization).toBe('Bearer re_receiving_placeholder');
  });
  it('stage 2 (Owner 2026-10-20): a NEW email is handled right after it is stored - without a model key it is RED and the fixed acknowledgement goes to the sender through the one mail gate', async () => {
    const r = await h.handler(await post(EVENT()));
    expect(await r.json()).toEqual({ ok: true, stored: true });
    const send = provider.find((c) => c.url === 'https://api.resend.com/emails');
    expect(send).toBeTruthy();
    const body = JSON.parse(send.init.body);
    expect(body.to).toEqual(['noa@customer.test']);
    expect(body.text).toContain('קיבלנו את פנייתך');
    expect(send.init.headers['Idempotency-Key']).toBe('tekango-support/v1/11111111-1111-4111-8111-111111111111/ack');
    expect(h.state.updates[0].patch).toMatchObject({ bin: 'red', bin_reason: 'model_not_configured', status: 'waiting' });
    expect(provider.some((c) => c.url.includes('openai'))).toBe(false);
  });
  it('a redelivered email is handled again only when it is still new after two minutes (a crash); otherwise nothing happens', async () => {
    h.state.inserted = [];
    h.state.existing = { id: '22222222-2222-4222-8222-222222222222', status: 'new', stored_at: new Date(Date.now() - 60000).toISOString(), from_address: 'noa@customer.test', to_addresses: [], subject: 'x', text_body: 'cancel please', attachments: [], message_id: null, is_automated: false };
    expect(await (await h.handler(await post(EVENT()))).json()).toEqual({ ok: true, stored: false });
    expect(h.state.updates).toHaveLength(0);
    setup();
    h.state.inserted = [];
    h.state.existing = { id: '22222222-2222-4222-8222-222222222222', status: 'new', stored_at: new Date(Date.now() - 600000).toISOString(), from_address: 'noa@customer.test', to_addresses: [], subject: 'x', text_body: 'cancel please', attachments: [], message_id: null, is_automated: false };
    await h.handler(await post(EVENT()));
    expect(h.state.updates[0].patch).toMatchObject({ bin: 'red', bin_reason: 'word:cancel' });
  });
});
