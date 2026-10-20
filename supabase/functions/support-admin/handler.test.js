// Owner console 2026-10-20 (smart support email stage 2, L-22): the Owner's actions from the admin "פניות" tab, in-process with SYNTHETIC
// data - the Deno serve, the Supabase clients and the providers are replaced; nothing leaves the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (_url, key) => ({
    rpc: async (fn, args) => { h.state.rpcCalls.push({ fn, args, key }); return fn === 'has_admin_permission' ? { data: (h.state.perms || []).includes(args.p_permission), error: null } : { data: null, error: { message: 'unknown' } }; },
    auth: { getUser: async () => (h.state.user ? { data: { user: h.state.user }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } }) },
    from: (table) => {
      const q = { table, key, ops: [] };
      const chain = (name) => (...args) => { q.ops.push([name, ...args]); return q; };
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) q[m] = chain(m);
      q.update = (patch) => { h.state.writes.push({ table, patch, key }); q.ops.push(['update', patch]); return q; };
      q.maybeSingle = () => Promise.resolve(table === 'business_settings' ? { data: { role: h.state.role }, error: null } : { data: h.state.row, error: null });
      q.then = (ok, bad) => {
        const update = q.ops.find((o) => o[0] === 'update');
        const inFilter = q.ops.find((o) => o[0] === 'in');
        let res = { data: [], error: null };
        if (update && table === 'support_assistant_settings') res = { data: [{ auto_send_green: true, auto_send_yellow: false, paused: false, ...update[1] }], error: null };
        else if (update) res = { data: !inFilter || inFilter[2].includes(h.state.row?.status) ? [{ id: h.state.row?.id }] : [], error: null };
        return Promise.resolve(res).then(ok, bad);
      };
      return q;
    },
  }),
}));

const ID = '33333333-3333-4333-8333-333333333333';
let provider;
function setup({ role = 'super_admin', user = { id: 'owner-1' }, row = null, perms = [] } = {}) {
  h.state = { role, user, perms, rpcCalls: [], writes: [], row: row ?? { id: ID, status: 'draft', from_address: 'dana@customer.test', to_addresses: ['info@abc.resend.app'], subject: 'Logo', text_body: 'How do I add a logo?', attachments: [], message_id: '<m@c.test>', is_automated: false, mailbox: 'info', reply_language: 'en', bin: 'green', draft_reply: 'Hello,\nGo to Business settings.' } };
  provider = [];
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 're_x', OPENAI_API_KEY: 'sk-x' })[k] } };
  globalThis.fetch = vi.fn(async (url, init) => {
    provider.push({ url, body: JSON.parse(init.body) });
    if (String(url).includes('openai')) return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello,\nOpen Business settings and upload your logo.' } }] }), { status: 200 });
    return new Response('{}', { status: 200 });
  });
}
const call = async (body, { auth = 'Bearer user-jwt' } = {}) => h.handler(new Request('https://synthetic.supabase.co/functions/v1/support-admin', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify(body) }));

beforeEach(async () => { setup(); if (!h.handler) await import('./index.ts'); });

describe('support-admin (Owner 2026-10-20, L-22 stage 2)', () => {
  it('only a signed-in super admin; nothing is read or written otherwise', async () => {
    expect((await call({ action: 'dismiss', id: ID }, { auth: null })).status).toBe(401);
    setup({ user: null });
    expect((await call({ action: 'dismiss', id: ID })).status).toBe(401);
    setup({ role: 'user' });
    expect((await call({ action: 'dismiss', id: ID })).status).toBe(403);
    expect(h.state.writes).toHaveLength(0);
    expect(provider).toHaveLength(0);
  });
  it('send: the Owner\'s text goes to the customer from the mailbox they wrote to, and the inquiry is answered by the Owner', async () => {
    const r = await call({ action: 'send', id: ID, text: 'Hello,\nYour answer.' });
    expect(await r.json()).toEqual({ ok: true, status: 'answered' });
    expect(provider[0].url).toBe('https://api.resend.com/emails');
    expect(provider[0].body).toMatchObject({ to: ['dana@customer.test'], from: 'TEKANGO <info@tekango.com>', text: 'Hello,\nYour answer.' });
    expect(h.state.writes[0]).toMatchObject({ table: 'support_inbound_messages', key: 'service', patch: { status: 'answered', reply_sent_by: 'owner' } });
  });
  it('send on an already answered inquiry is refused without an email; a bad id is refused', async () => {
    setup({ row: { id: ID, status: 'answered', from_address: 'dana@customer.test', to_addresses: [], subject: 'x', text_body: 'x', attachments: [], message_id: null } });
    expect((await call({ action: 'send', id: ID, text: 'again' })).status).toBe(409);
    expect((await call({ action: 'send', id: 'not-a-uuid', text: 'x' })).status).toBe(400);
    expect(provider).toHaveLength(0);
  });
  it('redraft writes a new draft from the facts and sends nothing; dismiss sends nothing', async () => {
    const r = await call({ action: 'redraft', id: ID });
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.draft).toContain('Open Business settings');
    expect(body.draft).toContain('The TEKANGO Support Team');
    expect(provider.every((c) => c.url.includes('openai'))).toBe(true);
    expect(await (await call({ action: 'dismiss', id: ID })).json()).toEqual({ ok: true, status: 'dismissed' });
  });
  it('settings: only booleans for the three switches are accepted', async () => {
    const r = await call({ action: 'settings', paused: true });
    expect((await r.json()).settings).toMatchObject({ paused: true });
    expect(h.state.writes[0]).toMatchObject({ table: 'support_assistant_settings', patch: { paused: true, updated_by: 'owner-1' } });
    expect((await call({ action: 'settings', paused: 'yes' })).status).toBe(400);
  });
  it('a supervisor (L-22, Owner 2026-10-20): reply actions only with inquiries.reply, settings only with inquiries.settings, asked as the caller', async () => {
    setup({ role: 'user', perms: ['inquiries.view'] });
    expect((await call({ action: 'dismiss', id: ID })).status).toBe(403);
    expect((await call({ action: 'settings', paused: true })).status).toBe(403);
    expect(h.state.writes).toHaveLength(0);
    expect(h.state.rpcCalls.map((c) => [c.args.p_permission, c.key])).toEqual([['inquiries.reply', 'anon'], ['inquiries.settings', 'anon']]);
    setup({ role: 'user', perms: ['inquiries.view', 'inquiries.reply'] });
    expect(await (await call({ action: 'dismiss', id: ID })).json()).toEqual({ ok: true, status: 'dismissed' });
    expect((await call({ action: 'settings', paused: true })).status).toBe(403);
    setup({ role: 'user', perms: ['inquiries.settings'] });
    expect((await call({ action: 'settings', paused: true })).status).toBe(200);
    expect((await call({ action: 'send', id: ID, text: 'Hello, your answer.' })).status).toBe(403);
    expect(provider).toHaveLength(0);
  });
  it('the Owner never needs a permission row (no permission question is asked)', async () => {
    setup();
    expect((await call({ action: 'dismiss', id: ID })).status).toBe(200);
    expect(h.state.rpcCalls).toHaveLength(0);
  });
});
