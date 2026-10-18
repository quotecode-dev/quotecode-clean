// OD-02: ONE output-authority gate for Send / Public share / final PDF / final Print. The phase is the SERVER output phase.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  outputGate, OUTPUT_ACTIVATION_PHASE, OUTPUT_CHANNELS, requestOutputAuthorization, outputIdempotencyKey, authorizeWithNotice, consumptionNoticeText,
  capabilityTokenFromPath, outputBlockedMessage,
} from './outputAuthority';

const src = (f) => readFileSync(join(cwd(), f), 'utf8');
const TOKEN = 'A'.repeat(20) + '_-' + 'b'.repeat(21); // 43 chars, base64url
const Q = '11111111-1111-4111-8111-111111111111';
const D = 'd'.repeat(64);

describe('output gate', () => {
  it('defaults to off by a code constant (never env-derived)', () => {
    expect(OUTPUT_ACTIVATION_PHASE).toBe('off');
    expect(src('src/domain/subscriptions/outputAuthority.js').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/import\.meta\.env|VITE_|process\.env/);
  });
  it.each(['off', 'prepared', 'shadow'])('server phase %s: every channel proceeds synchronously on the unchanged legacy path', (phase) => {
    for (const c of OUTPUT_CHANNELS) {
      const g = outputGate(c, phase);
      expect(g).toEqual({ proceed: true, mode: 'legacy' });
      expect(g).not.toBeInstanceOf(Promise);
    }
  });
  it('enforced: every channel requires the server authority (all four together, no partial cutover)', () => {
    for (const c of OUTPUT_CHANNELS) expect(outputGate(c, 'enforced')).toEqual({ proceed: false, mode: 'authority_required' });
  });
  it.each([null, 'ON', 'enforce', 42])('unknown phase %s fails closed', (phase) => {
    for (const c of OUTPUT_CHANNELS) expect(outputGate(c, phase)).toMatchObject({ proceed: false, mode: 'blocked' });
  });
  it('an unknown channel is refused in every phase (no preview/draft channel can reach final output)', () => {
    for (const phase of ['off', 'enforced']) {
      for (const c of ['download_draft', 'preview', 'final', 'reveal']) expect(outputGate(c, phase)).toMatchObject({ proceed: false, code: 'unknown_output_channel' });
    }
  });
});

describe('requestOutputAuthorization (server authority client)', () => {
  it('sends only quoteId, channel and a stable idempotency key (no plan/market/account fields)', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true, channel: 'send', publicPath: `/public-quote/c/${TOKEN}` } }));
    const r = await requestOutputAuthorization({ channel: 'send', quoteId: Q, invoke, expectedDigest: D });
    expect(r).toEqual({ proceed: true, mode: 'authorized', publicPath: `/public-quote/c/${TOKEN}` });
    expect(invoke).toHaveBeenCalledWith('subscription-authority', { body: { action: 'authorize_output', quoteId: Q, channel: 'send', idempotencyKey: outputIdempotencyKey(Q, 'send', D), expectedDigest: D } });
    expect(outputIdempotencyKey(Q, 'send', D)).toBe(outputIdempotencyKey(Q, 'send', D));
    expect(outputIdempotencyKey(Q, 'send', D)).not.toBe(outputIdempotencyKey(Q, 'final_pdf', D));
    // Task 30: one key per VERSION - another digest (changed customer / recipient / content) gets another key, within the 200-char limit
    expect(outputIdempotencyKey(Q, 'send', D)).not.toBe(outputIdempotencyKey(Q, 'send', 'b'.repeat(64)));
    expect(outputIdempotencyKey(Q, 'final_print', D).length).toBeLessThanOrEqual(200);
  });
  it('rejects an id-based or malformed public path (the quote id alone is never an access link)', async () => {
    for (const publicPath of [`/public-quote/${Q}`, '/public-quote/c/short', `https://evil.example/public-quote/c/${TOKEN}`, null]) {
      const r = await requestOutputAuthorization({ channel: 'public_share', quoteId: Q, expectedDigest: D, invoke: async () => ({ data: { ok: true, channel: 'public_share', publicPath } }) });
      expect(r).toMatchObject({ proceed: false, code: 'final_response_invalid' });
    }
  });
  it('PDF/Print need a grant; a mismatched channel or refusal blocks', async () => {
    expect(await requestOutputAuthorization({ channel: 'final_pdf', quoteId: Q, expectedDigest: D, invoke: async () => ({ data: { ok: true, channel: 'final_pdf', grant: 'g'.repeat(43), expiresAt: '2026-10-07T12:00:00Z' } }) }))
      .toMatchObject({ proceed: true, grant: 'g'.repeat(43) });
    expect(await requestOutputAuthorization({ channel: 'final_print', quoteId: Q, expectedDigest: D, invoke: async () => ({ data: { ok: true, channel: 'final_pdf', grant: 'g'.repeat(43), expiresAt: 'x' } }) }))
      .toMatchObject({ proceed: false });
    expect(await requestOutputAuthorization({ channel: 'send', quoteId: Q, expectedDigest: D, invoke: async () => ({ data: { ok: false, code: 'free_issue_limit_reached' } }) }))
      .toEqual({ proceed: false, mode: 'blocked', code: 'free_issue_limit_reached' });
    expect(await requestOutputAuthorization({ channel: 'send', quoteId: Q, expectedDigest: D, invoke: async () => { throw new Error('net'); } }))
      .toMatchObject({ proceed: false, code: 'authority_unreachable' });
  });
  it('extracts the token only from a valid capability path; messages name no legacy plan', () => {
    expect(capabilityTokenFromPath(`/en/public-quote/c/${TOKEN}`)).toBe(TOKEN);
    expect(capabilityTokenFromPath(`/public-quote/${Q}`)).toBeNull();
    for (const code of ['free_issue_limit_reached', 'account_not_provisioned', 'x']) {
      for (const he of [true, false]) expect(outputBlockedMessage(code, he)).not.toMatch(/Pro|Basic|trial|ניסיון|\d+\s*\/\s*\d+/);
    }
  });
});


describe('authorizeWithNotice (pre-consumption notice, OD-02)', () => {
  const notice = (over = {}) => ({ data: { ok: true, quoteId: Q, contentDigest: D, wouldConsume: true, remaining: 4, alreadyFinalized: false, ...over } });
  it('shows the Owner notice with the real balance; cancelling authorizes nothing', async () => {
    const invoke = vi.fn(async (_n, { body }) => (body.action === 'output_notice' ? notice() : { data: { ok: true, channel: 'send', publicPath: '/public-quote/c/' + TOKEN } }));
    const confirm = vi.fn(() => false);
    const r = await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke, confirm, isHebrew: true });
    expect(confirm).toHaveBeenCalledWith('פעולה זו תנצל הצעה אחת מתוך 10 ההצעות החינמיות שלכם (נותרו 4): זו הפעם הראשונה שגרסה זו יוצאת ללקוח הזה. שליחה חוזרת של אותה גרסה לאותו לקוח לא תיספר שוב. להמשיך?');
    expect(r).toMatchObject({ proceed: false, mode: 'cancelled' });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('confirmed: authorization is bound to the notice digest; reuse (no consumption) needs no confirmation', async () => {
    const bodies = [];
    const invoke = async (_n, { body }) => { bodies.push(body); return body.action === 'output_notice' ? notice({ wouldConsume: false, alreadyFinalized: true }) : { data: { ok: true, channel: 'send', publicPath: '/public-quote/c/' + TOKEN } }; };
    const confirm = vi.fn(() => true);
    const r = await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke, confirm, isHebrew: false });
    expect(confirm).not.toHaveBeenCalled();
    expect(r.proceed).toBe(true);
    expect(bodies[1]).toMatchObject({ action: 'authorize_output', expectedDigest: D });
  });
  it('a malformed notice fails closed; EN wording', async () => {
    expect(await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke: async () => notice({ contentDigest: 'x' }), confirm: () => true, isHebrew: false })).toMatchObject({ proceed: false, code: 'final_response_invalid' });
    expect(consumptionNoticeText(null, false)).toBe('This action will use 1 of your 10 free quotes: this version has not reached this client before. Sending the same version to the same client again will not count again. Continue?');
    expect(consumptionNoticeText(7, true)).toBe('פעולה זו תנצל הצעה אחת מתוך 10 ההצעות החינמיות שלכם (נותרו 7): זו הפעם הראשונה שגרסה זו יוצאת ללקוח הזה. שליחה חוזרת של אותה גרסה לאותו לקוח לא תיספר שוב. להמשיך?');
  });
});

// Integration (static): each real output action is preceded by the gate inside the same handler.
describe('the four channels call the ONE gate before their output action', () => {
  const sliceFn = (text, startMarker, endMarker) => { const a = text.indexOf(startMarker); const b = text.indexOf(endMarker, a + startMarker.length); expect(a).toBeGreaterThan(-1); return text.slice(a, b > a ? b : undefined); };
  it('Send via WhatsApp (Dashboard.sendWhatsApp): server-phase gate before window.open; enforced -> authority first', () => {
    const d = src('src/pages/Dashboard.jsx');
    const fn = sliceFn(d, 'const sendWhatsApp = (proposal, authorized = null) => {', 'const authorizeAndSendWhatsApp');
    expect(fn.indexOf("outputGate('send', outputPhase)")).toBeGreaterThan(-1);
    expect(fn.indexOf("outputGate('send', outputPhase)")).toBeLessThan(fn.indexOf('window.open('));
    const auth = sliceFn(d, 'const authorizeAndSendWhatsApp = async (proposal) => {', 'const requestEmailSend');
    expect(auth.indexOf("authorizeWithNotice({ channel: 'send'")).toBeLessThan(auth.indexOf('sendWhatsApp(proposal, {'));
  });
  it('Send via email (Dashboard.executeEmailSend): gate + authority before invoking send-quote-email', () => {
    const fn = sliceFn(src('src/pages/Dashboard.jsx'), 'const executeEmailSend = async (quote) => {', "invoke('send-quote-email'");
    expect(fn).toContain("outputGate('send', outputPhase)");
    expect(fn).toContain("authorizeWithNotice({ channel: 'send'");
  });
  it.each(['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'])('%s: final Print / final PDF gate before window.print and generateQuotePdf', (f) => {
    const fn = sliceFn(src(f), 'const handleChooseOutputMode = async (mode) => {', 'generateQuotePdf({');
    const gate = fn.indexOf('outputGate(finalChannel, serverPhase)');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(fn.indexOf('window.print()'));
    expect(fn.indexOf('authorizeWithNotice(')).toBeLessThan(fn.indexOf('window.print()'));
    // the phase is the server's (get-public-quote), never a client flag
    expect(fn).toContain("quoteData.viewerIsOwner === true ? (quoteData.outputPhase || 'off') : 'off'");
  });
  it('the dashboard output phase is the server account summary phase', () => {
    expect(src('src/pages/Dashboard.jsx')).toContain('const outputPhase = outputPhaseOf(accountSummary);');
  });
});


// Owner 2026-10-18 (Free-10 activation): an old (not yet imported) logo is imported once and the authorization retried once.
describe('authorizeWithNotice: an old logo is imported once and the output retried', () => {
  const notice = (over = {}) => ({ data: { ok: true, quoteId: Q, contentDigest: D, wouldConsume: false, remaining: 4, alreadyFinalized: false, ...over } });
  const ok = { data: { ok: true, channel: 'send', publicPath: '/public-quote/c/' + TOKEN } };
  const logoRefused = { data: { ok: false, code: 'logo_snapshot_policy_pending' } };
  it('logo refused -> importLogo -> the SAME authorization (same digest) succeeds', async () => {
    const bodies = [];
    let calls = 0;
    const invoke = async (_n, { body }) => { bodies.push(body); if (body.action === 'output_notice') return notice(); calls += 1; return calls === 1 ? logoRefused : ok; };
    const importLogo = vi.fn(async () => true);
    const r = await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke, confirm: () => true, isHebrew: false, importLogo });
    expect(r).toMatchObject({ proceed: true, mode: 'authorized' });
    expect(importLogo).toHaveBeenCalledTimes(1);
    const auths = bodies.filter((b) => b.action === 'authorize_output');
    expect(auths).toHaveLength(2);
    expect(auths[0].expectedDigest).toBe(D);
    expect(auths[1]).toEqual(auths[0]);
  });
  it('an import failure (false or a throw) keeps the original refusal and never retries', async () => {
    for (const importLogo of [async () => false, async () => { throw new Error('x'); }]) {
      let auths = 0;
      const invoke = async (_n, { body }) => (body.action === 'output_notice' ? notice() : (auths += 1, logoRefused));
      expect(await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke, confirm: () => true, isHebrew: false, importLogo })).toMatchObject({ proceed: false, code: 'logo_snapshot_policy_pending' });
      expect(auths).toBe(1);
    }
  });
  it('any other refusal never imports; without importLogo the refusal stays as it was', async () => {
    const importLogo = vi.fn(async () => true);
    const invoke = async (_n, { body }) => (body.action === 'output_notice' ? notice() : { data: { ok: false, code: 'free_issue_limit_reached' } });
    expect(await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke, confirm: () => true, isHebrew: false, importLogo })).toMatchObject({ code: 'free_issue_limit_reached' });
    expect(importLogo).not.toHaveBeenCalled();
    const inv2 = async (_n, { body }) => (body.action === 'output_notice' ? notice() : logoRefused);
    expect(await authorizeWithNotice({ channel: 'send', quoteId: Q, invoke: inv2, confirm: () => true, isHebrew: false })).toMatchObject({ code: 'logo_snapshot_policy_pending' });
  });
  it('every dashboard output path passes the logo import; the editor save leaves Draft only through the authority', () => {
    const d = src('src/pages/Dashboard.jsx');
    const calls = d.split('authorizeWithNotice({').slice(1);
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const c of calls) expect(c.slice(0, c.indexOf('});'))).toContain('importLogo: importLogoForOutput');
    const save = d.slice(d.indexOf('async function handleSaveQuote(e) {'), d.indexOf('const filteredQuotes = sortQuotes('));
    expect(save).toContain("const persistedStatus = editingQuoteId ? quoteStatus.toLowerCase() : 'draft';"); // SMART-QUOTE-03 line unchanged
    expect(save).toContain("const leaveDraftViaAuthority = outputPhase === 'enforced' && !!editingQuoteId && storedStatus === 'draft' && persistedStatus !== 'draft';");
    expect(save).toContain("const writtenStatus = leaveDraftViaAuthority ? 'draft' : persistedStatus;");
    expect(save).toContain('status: writtenStatus,');
    expect(save).not.toMatch(/supabase\.from\('quotes'\)\.update\(/); // IRON-QUOTE-001: no inline quote write in the save
    expect(save.indexOf('if (leaveDraftViaAuthority) {')).toBeGreaterThan(save.indexOf('const scheduleNote = await syncServiceSchedule(quoteId);'));
  });
});
