// Codex release 5 (Owner console 2026-10-29 night, decisions 7 + 8, L-22): automatic emails (grey, the persisted reply ban, the
// classification view, the Rubik template) and support conversations (references, suggestions only, one acknowledgement per
// conversation, outbound records). SYNTHETIC data only: the model, the mail provider and the database are fakes.
import { describe, it, expect } from 'vitest';
import { classifyAutomation, classificationView, acknowledgementOnly, referenceIds, subjectNorm, isNoReplyAddress, normalizeHeaders, parseModelTriage } from './triage.ts';
import { sendMail, textToHtml } from './mail.ts';
import { processInquiry, ownerSend, placeInConversation, retryOwnerAlert, replyAllowed, sortInquiry } from './process.ts';
import { buildInboundRow } from './inbound.ts';
import { buildDigest } from './digest.ts';

const MS_FOOTER = 'Your sign-in code is 123456.\n\nMicrosoft respects your privacy. To learn more, please read our Privacy Statement.\nMicrosoft Corporation, One Microsoft Way, Redmond, WA 98052';
const DELETE_REQUEST = 'Please delete my data and close my account under the privacy law.\n\nThanks, Dana';

describe('decision 7: the automation verdict that is stored', () => {
  it('no-reply at a local-part boundary - prefixed, case, dots, plus and do-not-reply - is POSSIBLY automatic (grey), never answered', () => {
    for (const a of ['noreply@shop.test', 'NoReply@Shop.test', 'microsoft-noreply@microsoft.com', 'info.noreply@x.test', 'donotreply+42@x.test', 'do-not-reply@x.test', 'no_reply@x.test']) {
      const v = classifyAutomation({}, a, 'Your code', 'Your code is 1234');
      expect(v, a).toMatchObject({ automation_class: 'possible_automatic', reply_allowed: false, automation_version: 'support-auto-2026-10-30' });
      expect(isNoReplyAddress(a), a).toBe(true);
    }
    expect(isNoReplyAddress('noreplyanna@x.test')).toBe(false);
    expect(classifyAutomation({}, 'noreplyanna@x.test', 'q', 'hi').automation_class).toBe('human');
  });
  it('an exact known system sender with a passing provider authentication is CONFIRMED; the same address without it stays uncertain', () => {
    expect(classifyAutomation({}, 'microsoft-noreply@microsoft.com', 'code', MS_FOOTER, { spf: 'pass', dkim: 'pass', dmarc: 'pass' }))
      .toMatchObject({ automation_class: 'confirmed_automatic', automation_evidence: 'known_system_sender', reply_allowed: false });
    expect(classifyAutomation({}, 'microsoft-noreply@microsoft.com', 'code', MS_FOOTER, { spf: 'fail', dkim: 'fail', dmarc: 'fail' }).automation_class).toBe('possible_automatic');
    // never a domain substring
    expect(classifyAutomation({}, 'dana@microsoft.com.evil.test', 'q', 'hi', { dkim: 'pass' }).automation_class).toBe('human');
  });
  it('header evidence (any provider shape / case / spacing) confirms routine automatic mail; a footer "Privacy Statement" does not stop it', () => {
    expect(normalizeHeaders([{ name: 'List-Unsubscribe', value: '  <mailto:u@x>  ' }])).toEqual({ 'list-unsubscribe': '<mailto:u@x>' });
    expect(classifyAutomation([{ name: 'AUTO-SUBMITTED', value: ' Auto-Generated ' }], 'news@x.test', 'Weekly', MS_FOOTER))
      .toMatchObject({ automation_class: 'confirmed_automatic', automation_evidence: 'header:auto-submitted' });
    expect(classifyAutomation({ 'List-Id': '<l.x>' }, 'news@x.test', 'Weekly', 'Our news\n\nUnsubscribe | Privacy policy').automation_class).toBe('confirmed_automatic');
    expect(classifyAutomation({ 'Auto-Submitted': 'no' }, 'dana@x.test', 'q', 'hi').automation_class).toBe('human');
  });
  it('forged automatic headers cannot make an authored privacy / deletion request disappear: it stays visible as possibly automatic', () => {
    const v = classifyAutomation({ Precedence: 'bulk' }, 'dana@customer.test', 'Delete my data', DELETE_REQUEST);
    expect(v.automation_class).toBe('possible_automatic');
    expect(v.automation_evidence).toMatch(/^header:precedence\+word:/);
  });
  it('a genuine mail-authentication report stays BLACK (confirmed), even with "privacy" in its footer; bounces and our own domains too', () => {
    expect(classifyAutomation({}, 'dmarcreport@microsoft.com', 'Report Domain: tekango.com Submitter: protection.outlook.com Report-ID: 1', MS_FOOTER).automation_evidence).toBe('auth_report');
    expect(classifyAutomation({}, 'MAILER-DAEMON@x.test', 'Undelivered', 'x').automation_class).toBe('confirmed_automatic');
    expect(classifyAutomation({}, 'support@tekango.com', 'x', 'x').automation_evidence).toBe('own_domain');
  });
  it('the model never chooses grey', () => {
    expect(parseModelTriage({ bin: 'grey', confidence: 1 })).toMatchObject({ bin: 'red', reason: 'model_unknown_bin' });
  });
});

describe('decision 7: the classification view (the original stays intact)', () => {
  it('drops a trailing footer block (privacy statement, postal address) and quoted history; keeps a real request', () => {
    expect(classificationView(MS_FOOTER)).toBe('Your sign-in code is 123456.');
    expect(classificationView(`${DELETE_REQUEST}\n\nPrivacy policy | Unsubscribe`)).toContain('delete my data');
    expect(classificationView('New question\n\nOn Mon, Oct 19 Dana wrote:\n> please refund')).toBe('New question');
  });
  it('a human email whose only "privacy" is a footer is not red by the word list (it goes to the model)', async () => {
    const calls = [];
    const model = { apiKey: 'sk', fetch: async (u, i) => { calls.push(JSON.parse(i.body)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ bin: 'green', confidence: 0.9, summary: 'logo' }) } }] }) }; } };
    const t = await sortInquiry({ id: 'x', status: 'new', from_address: 'dana@customer.test', to_addresses: [], subject: 'Logo', text_body: 'How do I add a logo?\n\nPrivacy Statement | Terms of use', attachments: [], message_id: null, automation_class: 'human', reply_allowed: true }, model);
    expect(t.bin).toBe('green');
    expect(calls).toHaveLength(1);
  });
});

describe('decision 7: the stored row (support-inbound)', () => {
  it('stores the class, version, evidence, reply ban and the bounded references; both automatic classes count as automated', () => {
    const row = buildInboundRow({ eventId: 'evt_1', webhookData: {}, email: {
      id: 'em_1', from: 'Shop <microsoft-noreply@microsoft.com>', to: ['support@abc.resend.app'], subject: 'Code', text: 'Your code 1',
      created_at: '2026-10-30T08:00:00Z', headers: { 'In-Reply-To': '<a@x>', References: '<root@x> <a@x> not-an-id <b@x>' },
    } });
    expect(row).toMatchObject({ automation_class: 'possible_automatic', reply_allowed: false, is_automated: true, automation_evidence: 'local_part:no-reply', reference_ids: ['<a@x>', '<b@x>', '<root@x>'] });
    const human = buildInboundRow({ eventId: 'evt_2', webhookData: {}, email: { id: 'em_2', from: 'dana@customer.test', to: ['support@abc.resend.app'], subject: 'Q', text: 'Hi', created_at: '2026-10-30T08:00:00Z' } });
    expect(human).toMatchObject({ automation_class: 'human', reply_allowed: true, is_automated: false, reference_ids: [] });
  });
  it('reference ids are bounded (20 at most, malformed ones dropped, nearest first)', () => {
    const many = Array.from({ length: 40 }, (_, i) => `<id${i}@x>`).join(' ');
    const ids = referenceIds('<id39@x>', `${many} <bad id> <>`);
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe('<id39@x>');
    expect(subjectNorm('RE: Fwd: re: Payment 2')).toBe('payment 2');
    expect(subjectNorm('')).toBeNull();
  });
});

// ---- fakes ----
const okFetch = (log, answer = { ok: true, status: 200 }) => async (url, init) => { log.push({ url, init, body: JSON.parse(init.body) }); return { ...answer, json: async () => ({ id: 'resend-1' }) }; };
function fakeStore({ settings = { auto_send_green: false, auto_send_yellow: false, paused: false }, claim = true, conversations = null } = {}) {
  const updates = [];
  return { updates, settings: async () => settings, recentFromSender: async () => [], update: async (id, patch, from) => { updates.push({ id, patch, from }); return from && from.includes('new') ? claim : true; }, ...(conversations ? { conversations } : {}) };
}
function fakeConversations({ found = [], suggested = null } = {}) {
  const c = { acks: new Set(), assigned: [], outbound: [], released: [] };
  c.byReferences = async () => found;
  c.bySubject = async () => suggested;
  c.assign = async (inboundId, parent, sug, association) => { c.assigned.push({ inboundId, parent, sug, association }); return parent || 'conv-new'; };
  c.claimAck = async (conv) => { if (c.acks.has(conv)) return false; c.acks.add(conv); return true; };
  c.releaseAck = async (conv, claim) => { c.released.push(claim); c.acks.delete(conv); };
  c.recordOutbound = async (rec) => { c.outbound.push(rec); };
  return c;
}
function fakeModel({ triage = { bin: 'green', confidence: 0.9, summary: 'how to add a logo' }, draft = 'Hello,\nOpen Business settings.' } = {}) {
  const calls = [];
  return { calls, deps: { apiKey: 'sk-x', fetch: async (url, init) => { const b = JSON.parse(init.body); calls.push(b); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: b.response_format ? JSON.stringify(triage) : draft } }] }) }; } } };
}
const ROW = (over = {}) => ({ id: '11111111-1111-4111-8111-111111111111', status: 'new', from_address: 'dana@customer.test', to_addresses: ['support@abc.resend.app'], subject: 'Logo', text_body: 'How do I add a logo?', attachments: [], message_id: '<m1@customer.test>', is_automated: false, automation_class: 'human', reply_allowed: true, mailbox: 'support', ...over });
const run = async (row, { store = fakeStore(), model = fakeModel(), answer } = {}) => {
  const mails = [];
  const res = await processInquiry(row, { store, model: model.deps, mail: { apiKey: 're_x', fetch: okFetch(mails, answer) }, ownerAddress: 'owner@gmail.test', now: () => new Date('2026-10-30T10:00:00Z') });
  return { res, mails, store, model };
};
const GREY = (over = {}) => ROW({ from_address: 'info.noreply@bank.test', is_automated: true, automation_class: 'possible_automatic', reply_allowed: false, subject: 'Privacy notice', text_body: 'Please delete my data', ...over });

describe('decision 7: GREY - one Owner alert, nothing else', () => {
  it('stored as waiting with no draft; zero model calls; zero mails to the sender; ONE alert to the Owner in Hebrew', async () => {
    const { res, mails, store, model } = await run(GREY());
    expect(res).toMatchObject({ bin: 'grey', status: 'waiting', sent: ['owner'] });
    expect(model.calls).toHaveLength(0);
    expect(mails).toHaveLength(1);
    expect(mails[0].body.to).toEqual(['owner@gmail.test']);
    expect(mails[0].body.text.split('\n')[0]).toBe('ייתכן שזו הודעה אוטומטית. היא נשמרה לבדיקה ולא נשלחה תשובה לשולח.');
    expect(mails[0].init.headers['Idempotency-Key']).toBe('tekango-support/v1/11111111-1111-4111-8111-111111111111/owner');
    expect(store.updates[0].patch).toMatchObject({ bin: 'grey', status: 'waiting', draft_reply: null });
  });
  it('a replayed webhook (the row is no longer new) sends no second alert', async () => {
    const { res, mails } = await run(GREY(), { store: fakeStore({ claim: false }) });
    expect(res.status).toBe('already_processed');
    expect(mails).toHaveLength(0);
  });
  it('a CONFIRMED automatic email is black: no acknowledgement, no alert, no model', async () => {
    const { res, mails, model } = await run(ROW({ is_automated: true, automation_class: 'confirmed_automatic', reply_allowed: false, text_body: 'refund policy' }));
    expect(res).toMatchObject({ bin: 'black', status: 'ignored', sent: [] });
    expect(mails).toHaveLength(0);
    expect(model.calls).toHaveLength(0);
  });
  it('a failed Owner alert is retried later with the SAME slot, once', async () => {
    const mails = []; const store = fakeStore();
    const row = { ...GREY(), status: 'waiting', bin: 'grey', owner_notified_at: null };
    expect(await retryOwnerAlert(row, { store, mail: { apiKey: 're_x', fetch: okFetch(mails) }, ownerAddress: 'owner@gmail.test', now: () => new Date() })).toBe(true);
    expect(mails[0].init.headers['Idempotency-Key']).toBe('tekango-support/v1/11111111-1111-4111-8111-111111111111/owner');
    expect(await retryOwnerAlert({ ...row, owner_notified_at: '2026-10-30T10:00:00Z' }, { store, mail: { apiKey: 're_x', fetch: okFetch(mails) }, ownerAddress: 'owner@gmail.test', now: () => new Date() })).toBe(false);
    expect(await retryOwnerAlert({ ...row, bin: 'green' }, { store, mail: { apiKey: 're_x', fetch: okFetch(mails) }, ownerAddress: 'owner@gmail.test', now: () => new Date() })).toBe(false);
    expect(mails).toHaveLength(1);
  });
});

describe('decision 7: the reply ban is enforced on the server, at every send', () => {
  it('ownerSend refuses a grey / banned / automatic sender before claiming or sending', async () => {
    for (const row of [GREY({ status: 'waiting', bin: 'grey' }), ROW({ status: 'waiting', reply_allowed: false }), ROW({ status: 'waiting', automation_class: 'possible_automatic' }), ROW({ status: 'waiting', is_automated: true })]) {
      const store = fakeStore(); const mails = [];
      expect(await ownerSend(row, 'Hello there', { store, mail: { apiKey: 're_x', fetch: okFetch(mails) }, now: () => new Date() })).toBe('reply_not_allowed');
      expect(store.updates).toHaveLength(0);
      expect(mails).toHaveLength(0);
    }
    expect(replyAllowed(ROW({ bin: 'red' }))).toBe(true);
  });
  it('the mail gate itself refuses a customer email without permission or to a no-reply address', async () => {
    const log = [];
    const base = { from: 'f', replyTo: 'r', subject: 's', text: 't', idempotencyKey: 'tekango-support/v1/x/reply' };
    expect((await sendMail({ fetch: okFetch(log), apiKey: 're_x' }, { ...base, to: 'dana@customer.test', customer: { replyAllowed: false, automatic: true } })).ok).toBe(false);
    expect((await sendMail({ fetch: okFetch(log), apiKey: 're_x' }, { ...base, to: 'microsoft-noreply@microsoft.com', customer: { replyAllowed: true, automatic: true } })).ok).toBe(false);
    expect(log).toHaveLength(0);
    // the Owner's own alerts are not customer mail
    expect((await sendMail({ fetch: okFetch(log), apiKey: 're_x' }, { ...base, to: 'owner@gmail.test' })).ok).toBe(true);
  });
  it('an automatic send carries the loop-suppression headers; the Owner\'s reply does not', async () => {
    const { mails } = await run(ROW({ subject: 'ביטול', text_body: 'אני רוצה לבטל' }));
    const ack = mails.find((m) => m.body.to[0] === 'dana@customer.test');
    expect(ack.body.headers).toMatchObject({ 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' });
    const log = [];
    await ownerSend(ROW({ status: 'waiting' }), 'Hello there', { store: fakeStore(), mail: { apiKey: 're_x', fetch: okFetch(log) }, now: () => new Date() });
    expect(log[0].body.headers['Auto-Submitted']).toBeUndefined();
  });
  it('the shared template is Rubik, never Arial; the old ok / status result is kept and the provider id is added', async () => {
    const html = textToHtml('שלום');
    expect(html).toContain('font-family:Rubik,sans-serif');
    expect(html).not.toMatch(/arial/i);
    const log = [];
    const r = await sendMail({ fetch: okFetch(log), apiKey: 're_x' }, { from: 'f', replyTo: 'r', to: 'owner@gmail.test', subject: 's', text: 't', idempotencyKey: 'tekango-support/v1/x/owner' });
    expect(r).toMatchObject({ ok: true, status: 200, id: 'resend-1' });
    const thrown = await sendMail({ fetch: async () => { throw new Error('timeout'); }, apiKey: 're_x' }, { from: 'f', replyTo: 'r', to: 'owner@gmail.test', subject: 's', text: 't', idempotencyKey: 'tekango-support/v1/x/owner' });
    expect(thrown).toMatchObject({ ok: false, status: 0, unknown: true });
  });
});

describe('decision 8: conversations', () => {
  it('one compatible referenced conversation = the same conversation; another sender or mailbox = ambiguous (never merged)', async () => {
    const same = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'dana@customer.test', mailbox: 'support' }] });
    expect(await placeInConversation(ROW({ reference_ids: ['<m0@x>'] }), same, new Date())).toEqual({ id: 'conv-1', association: 'reference' });
    const cross = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'dana@customer.test', mailbox: 'support' }, { conversation_id: 'conv-2', participant: 'eve@x.test', mailbox: 'support' }] });
    expect(await placeInConversation(ROW({ reference_ids: ['<m0@x>', '<e@x>'] }), cross, new Date())).toEqual({ id: 'conv-new', association: 'ambiguous' });
    const otherBox = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'dana@customer.test', mailbox: 'info' }] });
    expect((await placeInConversation(ROW({ reference_ids: ['<m0@x>'] }), otherBox, new Date())).association).toBe('ambiguous');
    // a copied reference from an address that failed DKIM and DMARC never joins the customer's conversation
    expect((await placeInConversation(ROW({ reference_ids: ['<m0@x>'], auth_results: { spf: 'fail', dkim: 'fail', dmarc: 'fail' } }), same, new Date())).association).toBe('ambiguous');
    expect((await placeInConversation(ROW({ reference_ids: ['<m0@x>'], auth_results: { spf: 'pass', dkim: 'pass', dmarc: 'pass' } }), same, new Date())).association).toBe('reference');
    // a reference with quotes / commas is not an id at all
    expect(referenceIds('<a",b@x>', null)).toEqual([]);
  });
  it('no reference: a same sender + subject conversation is only a SUGGESTION (a new conversation is still opened)', async () => {
    const c = fakeConversations({ suggested: 'conv-9' });
    expect(await placeInConversation(ROW({ subject: 'Re: Payment' }), c, new Date())).toEqual({ id: 'conv-new', association: 'suggested' });
    expect(c.assigned[0]).toMatchObject({ parent: null, sug: 'conv-9', association: 'suggested' });
  });
  it('ONE generic acknowledgement per conversation: a second red email in it alerts the Owner but is not acknowledged again', async () => {
    const conv = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'dana@customer.test', mailbox: 'support' }] });
    const store = fakeStore({ conversations: conv });
    const first = await run(ROW({ subject: 'Refund', text_body: 'I want a refund', reference_ids: ['<m0@x>'] }), { store });
    expect(first.res.sent).toEqual(['ack', 'owner']);
    const second = await run(ROW({ id: '22222222-2222-4222-8222-222222222222', subject: 'Refund', text_body: 'Still waiting for the refund', reference_ids: ['<m0@x>'] }), { store });
    expect(second.res.sent).toEqual(['owner']);
    expect(second.mails.map((m) => m.body.to[0])).toEqual(['owner@gmail.test']);
    expect(conv.outbound).toHaveLength(1);
    expect(conv.outbound[0]).toMatchObject({ conversation_id: 'conv-1', kind: 'ack', actor: 'system', state: 'sent', provider_id: 'resend-1' });
  });
  it('a refused acknowledgement releases the claim; an unknown outcome keeps it and is recorded as unknown', async () => {
    const refused = fakeConversations();
    await run(ROW({ subject: 'Refund', text_body: 'refund' }), { store: fakeStore({ conversations: refused }), answer: { ok: false, status: 422 } });
    expect(refused.released).toHaveLength(1);
    expect(refused.outbound[0].state).toBe('failed');
    const unknown = fakeConversations();
    await run(ROW({ subject: 'Refund', text_body: 'refund' }), { store: fakeStore({ conversations: unknown }), answer: { ok: false, status: 503 } });
    expect(unknown.released).toHaveLength(0);
    expect(unknown.outbound[0].state).toBe('unknown');
  });
  it('a substantive green follow-up still gets its own guarded answer (keyed to that email); a thanks-only follow-up gets none and no model call', async () => {
    const conv = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'dana@customer.test', mailbox: 'support' }] });
    const store = fakeStore({ settings: { auto_send_green: true, auto_send_yellow: false, paused: false }, conversations: conv });
    const follow = await run(ROW({ id: '33333333-3333-4333-8333-333333333333', reference_ids: ['<m0@x>'], text_body: 'And how do I change the colours?' }), { store });
    expect(follow.res).toMatchObject({ bin: 'green', status: 'answered', sent: ['reply'] });
    expect(follow.mails[0].init.headers['Idempotency-Key']).toBe('tekango-support/v1/33333333-3333-4333-8333-333333333333/reply');
    expect(conv.outbound.at(-1)).toMatchObject({ kind: 'assistant', state: 'sent' });
    const thanks = await run(ROW({ id: '44444444-4444-4444-8444-444444444444', reference_ids: ['<m0@x>'], text_body: 'Thanks a lot!\n\nOn Mon Dana wrote:\n> old' }), { store });
    expect(thanks.res).toMatchObject({ status: 'ignored', sent: [] });
    expect(thanks.model.calls).toHaveLength(0);
    expect(thanks.mails).toHaveLength(0);
    expect(acknowledgementOnly('תודה רבה!')).toBe(true);
    expect(acknowledgementOnly('Thanks, but the logo still does not show')).toBe(false);
  });
  it('a grey follow-up in a conversation still gets no reply and no acknowledgement', async () => {
    const conv = fakeConversations({ found: [{ conversation_id: 'conv-1', participant: 'info.noreply@bank.test', mailbox: 'support' }] });
    const { res, mails } = await run(GREY({ reference_ids: ['<m0@x>'] }), { store: fakeStore({ conversations: conv }) });
    expect(res).toMatchObject({ bin: 'grey', sent: ['owner'] });
    expect(mails.every((m) => m.body.to[0] === 'owner@gmail.test')).toBe(true);
    expect(conv.acks.size).toBe(0);
  });
  it('the conversation store failing = the email is handled alone, as before', async () => {
    const broken = { ...fakeConversations(), assign: async () => { throw new Error('db'); } };
    const { res } = await run(ROW({ subject: 'Refund', text_body: 'refund' }), { store: fakeStore({ conversations: broken }) });
    expect(res.sent).toEqual(['ack', 'owner']);
  });
});

describe('decision 8: the evening summary counts conversations', () => {
  it('two waiting emails of one conversation = one conversation; a grey follow-up never lowers a red request', () => {
    const r = (o) => ({ from_address: 'dana@customer.test', subject: 'Refund', bin: 'red', status: 'waiting', bin_reason: null, summary: 'wants a refund', reply_sent_by: null, stored_at: '2026-10-30T08:00:00Z', conversation_id: 'conv-1', ...o });
    const d = buildDigest('2026-10-30', [r({}), r({ bin: 'grey' })], [r({}), r({ bin: 'grey', summary: null, subject: 'auto' }), r({ conversation_id: 'conv-2', bin: 'grey', from_address: 'x.noreply@bank.test', summary: null, subject: 'Notice' })]);
    expect(d.subject).toBe('סיכום הפניות של היום - שיחות שממתינות לך: 2');
    const lines = d.text.split('\n');
    expect(lines).toEqual(expect.arrayContaining(['הודעות שממתינות לך: 3', 'אדום - צריך אותך', 'הודעות ממתינות בשיחה: 2', 'אפור - ייתכן שזו הודעה אוטומטית']));
    expect(d.text).toContain('אפור: 1');
  });
});
