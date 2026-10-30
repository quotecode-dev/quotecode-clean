// Codex release 5 (Owner console 2026-10-29 night, decisions 7 + 8, L-22): the support-admin side - the persisted reply ban on send and
// redraft, the conversation read (inquiries.view) and the Owner-only link / unlink. In-process with SYNTHETIC data; nothing leaves the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (_url, key) => ({
    rpc: async (fn, args) => {
      h.state.rpcCalls.push({ fn, args, key });
      if (fn === 'has_admin_permission') return { data: (h.state.perms || []).includes(args.p_permission), error: null };
      if (fn === 'support_conversation_relink') return h.state.relinkError ? { data: null, error: { message: h.state.relinkError } } : { data: args.p_target || 'conv-own', error: null };
      return { data: null, error: { message: 'unknown' } };
    },
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
    from: (table) => {
      const q = { table, ops: [] };
      const chain = (name) => (...args) => { q.ops.push([name, ...args]); return q; };
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) q[m] = chain(m);
      q.update = (patch) => { h.state.writes.push({ table, patch }); q.ops.push(['update', patch]); return q; };
      q.maybeSingle = () => Promise.resolve(table === 'business_settings' ? { data: { role: h.state.role }, error: null }
        : table === 'support_conversations' ? { data: { id: 'conv-1', mailbox: 'support', participant: 'dana@customer.test' }, error: null }
        : { data: h.state.row, error: null });
      q.then = (ok, bad) => {
        let res = { data: [], error: null };
        if (table === 'support_inbound_messages' && q.ops.some((o) => o[0] === 'eq' && o[1] === 'conversation_id')) res = { data: h.state.thread.in, error: null };
        else if (table === 'support_outbound_messages') res = { data: h.state.thread.out, error: null };
        else if (q.ops.some((o) => o[0] === 'update')) res = { data: [{ id: h.state.row?.id }], error: null };
        return Promise.resolve(res).then(ok, bad);
      };
      return q;
    },
  }),
}));

const ID = '33333333-3333-4333-8333-333333333333';
const CONV = '44444444-4444-4444-8444-444444444444';
let provider;
const GREY = { id: ID, status: 'waiting', from_address: 'info.noreply@bank.test', to_addresses: ['support@abc.resend.app'], subject: 'Notice', text_body: 'x', attachments: [], message_id: '<m@b>', is_automated: true, mailbox: 'support', reply_language: 'en', bin: 'grey', draft_reply: null, automation_class: 'possible_automatic', reply_allowed: false, conversation_id: 'conv-1' };
function setup({ role = 'super_admin', perms = [], row = GREY, thread = { in: [], out: [] }, relinkError = null } = {}) {
  h.state = { role, perms, row, thread, relinkError, rpcCalls: [], writes: [] };
  provider = [];
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 're_x', OPENAI_API_KEY: 'sk-x' })[k] } };
  globalThis.fetch = vi.fn(async (url, init) => { provider.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello,\nA draft.' } }] }), { status: 200 }); });
}
const call = async (body) => h.handler(new Request('https://synthetic.supabase.co/functions/v1/support-admin', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer user-jwt' }, body: JSON.stringify(body) }));

beforeEach(async () => { setup(); if (!h.handler) await import('./index.ts'); });

describe('support-admin - Codex release 5', () => {
  it('decision 7: send and redraft are refused for a sender that may not be answered - no model call, no email, no write', async () => {
    const send = await call({ action: 'send', id: ID, text: 'Hello, an answer.' });
    expect(send.status).toBe(409);
    expect(await send.json()).toEqual({ ok: false, code: 'reply_not_allowed' });
    const redraft = await call({ action: 'redraft', id: ID });
    expect(redraft.status).toBe(409);
    expect(provider).toHaveLength(0);
    expect(h.state.writes).toHaveLength(0);
    // dismissing a grey email is still possible (nothing is sent)
    expect(await (await call({ action: 'dismiss', id: ID })).json()).toEqual({ ok: true, status: 'dismissed' });
  });
  it('decision 8: the conversation is read with inquiries.view - received emails and every email we sent, oldest first', async () => {
    setup({ role: 'user', perms: ['inquiries.view'], thread: {
      in: [{ id: 'b', received_at: '2026-10-30T09:00:00Z' }, { id: 'a', received_at: '2026-10-30T08:00:00Z' }],
      out: [{ id: 'o1', kind: 'ack', state: 'sent', created_at: '2026-10-30T08:01:00Z' }],
    } });
    const r = await call({ action: 'conversation', id: ID });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.messages.map((m) => m.id)).toEqual(['a', 'b']);
    expect(body.outbound).toHaveLength(1);
    expect(body.truncated).toBe(false);
    expect(h.state.rpcCalls[0].args.p_permission).toBe('inquiries.view');
    setup({ role: 'user', perms: [] });
    expect((await call({ action: 'conversation', id: ID })).status).toBe(403);
  });
  it('decision 8: link / unlink are the Owner\'s alone - a supervisor with every permission is refused', async () => {
    setup({ role: 'user', perms: ['inquiries.view', 'inquiries.reply', 'inquiries.settings'] });
    expect((await call({ action: 'link', id: ID, target: CONV })).status).toBe(403);
    expect((await call({ action: 'unlink', id: ID })).status).toBe(403);
    expect(h.state.rpcCalls.filter((c) => c.fn === 'support_conversation_relink')).toHaveLength(0);
    setup();
    expect(await (await call({ action: 'link', id: ID, target: CONV })).json()).toEqual({ ok: true, conversation_id: CONV });
    expect(h.state.rpcCalls.at(-1)).toMatchObject({ fn: 'support_conversation_relink', args: { p_inbound: ID, p_target: CONV, p_actor: 'owner-1' }, key: 'service' });
    expect(await (await call({ action: 'unlink', id: ID })).json()).toEqual({ ok: true, conversation_id: 'conv-own' });
    expect((await call({ action: 'link', id: ID, target: 'not-a-uuid' })).status).toBe(400);
    setup({ relinkError: 'support_conversation_mismatch' });
    expect(await (await call({ action: 'link', id: ID, target: CONV })).json()).toEqual({ ok: false, code: 'conversation_mismatch' });
  });
});
