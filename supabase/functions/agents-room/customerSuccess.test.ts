// Codex release 9, topic 9 (Owner console 2026-10-30): Maya. The spec's fixed texts with the server's numbers, drafts only for consent,
// one case per account and signal, at most 20 a day, and an approved draft is checked again, claimed once and sent once.
import { describe, it, expect, vi } from 'vitest';
import { draftText, scanAndDraft, sendApproved, unsubscribeFooter, outreachAction, DAILY_DRAFTS, type CsDeps, type SignalRow } from './customerSuccess.ts';
import { decide, type StageDeps, type Action } from './manager.ts';

const NOW = new Date('2026-10-30T09:00:00Z');
const row = (over: Partial<SignalRow> = {}): SignalRow => ({ account_id: 'a1000000-0000-4000-8000-000000000001', signal_code: 'no_quote_onboarding', evidence: { asOf: NOW.toISOString() },
  market: 'IL', email: 'owner@biz.example', consent: true, suppressed: false, has_case: false, ...over });

function cs(rows: SignalRow[], over: Partial<CsDeps> = {}) {
  const cases = new Map<string, { status: string; user: string; signal: string }>();
  const mails: { to: string; from: string; subject: string; text: string; key: string }[] = [];
  let n = 0;
  const d: CsDeps = {
    now: () => NOW,
    csSignals: async (user) => rows.filter((r) => !user || r.account_id === user),
    csCountSince: async () => [...cases.values()].length,
    csInsertCase: async (r) => {
      if ([...cases.values()].some((c) => c.user === r.user_id && c.signal === r.signal_code)) return null;
      n += 1; const id = `c${n}`; cases.set(id, { status: 'draft', user: r.user_id, signal: r.signal_code }); return id;
    },
    csUpdateCase: async (id, patch, whenStatus) => {
      const c = cases.get(id);
      if (!c || (whenStatus && c.status !== whenStatus)) return false;
      if (typeof patch.status === 'string') c.status = patch.status;
      return true;
    },
    csClaim: async (id) => { const c = cases.get(id); if (!c || c.status !== 'draft') return false; c.status = 'sending'; return true; },
    csIssueToken: async () => 'f'.repeat(64),
    mailCustomer: vi.fn(async (m) => { mails.push(m); return { ok: true, status: 200, id: 'em_1' }; }),
    ...over,
  };
  return { d, cases, mails };
}

describe('the spec texts, in the account language, with the server numbers', () => {
  it('onboarding, awaiting and inactivity are the fixed sentences', () => {
    expect(draftText(row())!.text).toContain('אפשר לעזור לכם להכין הצעת מחיר ראשונה ב-TEKANGO? אפשר להשיב להודעה ולספר במה נתקעתם.');
    expect(draftText(row({ market: 'INTERNATIONAL' }))!.text).toContain('Would help preparing your first TEKANGO quote be useful? Reply and tell us where you got stuck.');
    expect(draftText(row({ signal_code: 'quote_awaiting_response' }))!.text).toContain('יש בחשבון הצעה שעדיין ממתינה לאישור.');
    expect(draftText(row({ signal_code: 'paid_inactive', market: 'INTERNATIONAL' }))!.text).toContain('If anything is getting in the way of using TEKANGO, we can help.');
    expect(draftText(row())!.lang).toBe('he');
    expect(draftText(row({ market: 'INTERNATIONAL' }))!.lang).toBe('en');
  });
  it('the Free plan ending names the remaining quotes and dates; a missing fact = no draft (never invented)', () => {
    const t = draftText(row({ signal_code: 'free_ending', evidence: { remaining: 2, endsAt: '2026-10-31T10:00:00Z', asOf: NOW.toISOString() } }))!.text;
    expect(t).toContain('נותרו 2 הצעות במסלול החינם');
    expect(t).toContain('31.10.2026');
    const en = draftText(row({ signal_code: 'free_ending', market: 'INTERNATIONAL', evidence: { remaining: 1, endsAt: '2026-10-31T10:00:00Z', asOf: NOW.toISOString() } }))!.text;
    expect(en).toMatch(/your Free plan has 1 quotes remaining and ends at Oct 31, 2026\./);
    expect(draftText(row({ signal_code: 'free_ending', evidence: { remaining: 0, endsAt: '2026-10-31T10:00:00Z', asOf: NOW.toISOString() } }))).toBeNull();
    expect(draftText(row({ signal_code: 'renewal_failed_grace', evidence: { asOf: NOW.toISOString() } }))).toBeNull();
  });
  it('the grace notice says only verified facts and the grace end', () => {
    const t = draftText(row({ signal_code: 'renewal_failed_grace', evidence: { asOf: NOW.toISOString(), graceEndsAt: '2026-11-02T09:00:00Z' } }))!.text;
    expect(t).toMatch(/^שלום,\n\nנכון ל-30\.10\.2026, 11:00, החיוב האחרון של המנוי לא הושלם\. תקופת החסד מסתיימת ב-02\.11\.2026\./);
  });
  it('every sent email ends with the unsubscribe link of its language', () => {
    expect(unsubscribeFooter('he', 'a'.repeat(64))).toContain(`https://www.tekango.com/he/unsubscribe?t=${'a'.repeat(64)}`);
    expect(unsubscribeFooter('en', 'b'.repeat(64))).toContain('To stop them: https://www.tekango.com/en/unsubscribe?t=');
  });
});

describe('the daily scan: drafts only for consent, once per account and signal, at most 20 a day', () => {
  it('no consent / suppressed / handled before = no draft; consent = one waiting system action', async () => {
    const rows = [row(), row({ account_id: 'a2', consent: false }), row({ account_id: 'a3', suppressed: true }), row({ account_id: 'a4', has_case: true })];
    const { d, cases } = cs(rows);
    const inserted: ReturnType<typeof outreachAction>[] = [];
    const r = await scanAndDraft(d, 'daily:2026-10-30', async (a) => { inserted.push(a); return 'act1'; });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ kind: 'system', action_type: 'outreach_draft', source: 'customer_success', dedupe_key: `outreach:${rows[0].account_id}:no_quote_onboarding` });
    expect(inserted[0].payload).toMatchObject({ recipient: 'owner@biz.example', market: 'IL', lang: 'he', signal: 'no_quote_onboarding' });
    // review 30/10: the address is never in a title (titles reach the manager's AI prompt)
    expect(`${inserted[0].title_he} ${inserted[0].title_en} ${inserted[0].detail_he}`).not.toContain('owner@biz.example');
    expect(cases.size).toBe(1);
    expect(r.result.costUsd).toBe(0); // no AI
    expect(r.result.findings[0].he).toContain('בלי הסכמה לפניות יזומות: 1');
  });
  it('a second scan never writes the same case again (the database key wins)', async () => {
    const { d } = cs([row()]);
    const ins = vi.fn(async () => 'act');
    await scanAndDraft(d, 'k1', ins);
    await scanAndDraft(d, 'k2', ins);
    expect(ins).toHaveBeenCalledTimes(1);
  });
  it(`at most ${DAILY_DRAFTS} drafts a day; the rest wait for tomorrow`, async () => {
    const rows = Array.from({ length: 25 }, (_, i) => row({ account_id: `acc-${i}` }));
    const { d } = cs(rows);
    const ins = vi.fn(async () => 'act');
    const r = await scanAndDraft(d, 'k', ins);
    expect(ins).toHaveBeenCalledTimes(DAILY_DRAFTS);
    expect(r.result.findings.some((f) => f.he.includes('5 טיוטות יחכו למחר'))).toBe(true);
  });
});

describe('the approved draft: checked again, claimed once, sent once with the case key', () => {
  const p = { caseId: 'c1', userId: row().account_id, signal: 'no_quote_onboarding' as const, market: 'IL' as const, lang: 'he' as const, recipient: 'owner@biz.example', subject: 'עזרה בשימוש ב-TEKANGO', text: 'שלום,\n\nטקסט מאושר' };
  const opened = async (rows: SignalRow[], over: Partial<CsDeps> = {}) => { const x = cs(rows, over); await x.d.csInsertCase({ user_id: p.userId, signal_code: p.signal, evidence: {} }); return x; };
  it('sent: the support sender, the approved text + the unsubscribe line, the case-based provider key', async () => {
    const { d, mails, cases } = await opened([row()]);
    expect(await sendApproved(d, p)).toEqual({ ok: true, status: 'sent' });
    expect(mails[0]).toMatchObject({ to: 'owner@biz.example', from: 'TEKANGO Support <support@tekango.com>', key: 'tekango-outreach/v1/c1' });
    expect(mails[0].text.startsWith(p.text)).toBe(true);
    expect(mails[0].text).toContain('/he/unsubscribe?t=');
    expect(cases.get('c1')!.status).toBe('sent');
  });
  it('the international account gets the info sender', async () => {
    const { d, mails } = await opened([row({ market: 'INTERNATIONAL' })]);
    await sendApproved(d, { ...p, market: 'INTERNATIONAL', lang: 'en' });
    expect(mails[0].from).toBe('TEKANGO <info@tekango.com>');
  });
  it('the signal is gone (payment recovered / quote approved) = stale, nothing sent', async () => {
    const { d, mails, cases } = await opened([]);
    expect(await sendApproved(d, p)).toEqual({ ok: false, code: 'outreach_stale' });
    expect(mails).toHaveLength(0);
    expect(cases.get('c1')!.status).toBe('stale');
  });
  it('consent withdrawn / suppressed / another address = refused, nothing sent', async () => {
    for (const [r, code] of [[row({ consent: false }), 'outreach_no_consent'], [row({ suppressed: true }), 'outreach_no_consent'], [row({ email: 'new@biz.example' }), 'outreach_recipient_changed']] as const) {
      const { d, mails } = await opened([r]);
      expect(await sendApproved(d, p)).toEqual({ ok: false, code });
      expect(mails).toHaveLength(0);
    }
  });
  it('a second approval of the same case sends nothing (the claim is taken)', async () => {
    const { d, mails } = await opened([row()]);
    await sendApproved(d, p);
    expect(await sendApproved(d, p)).toEqual({ ok: false, code: 'not_pending' });
    expect(mails).toHaveLength(1);
  });
  it('a timeout is unknown - kept, never resent by itself', async () => {
    const { d, cases } = await opened([row()], { mailCustomer: async () => ({ ok: false, status: 0, unknown: true }) });
    expect(await sendApproved(d, p)).toEqual({ ok: true, status: 'unknown' });
    expect(cases.get('c1')!.status).toBe('unknown');
  });
});

describe('the Owner decision in the agents room (manager.decide)', () => {
  const action = (): Action => ({ id: 'a9', created_at: NOW.toISOString(), run_key: 'k', source: 'customer_success', kind: 'system', action_type: 'outreach_draft', title_he: 't', title_en: 't',
    detail_he: null, detail_en: null, status: 'proposed', decided_at: null, done_at: null, result: {}, error: null,
    payload: { caseId: 'c1', userId: row().account_id, signal: 'no_quote_onboarding', market: 'IL', lang: 'he', recipient: 'owner@biz.example', subject: 's', text: 'שלום,\n\nהטקסט המקורי' } });
  function room(rows: SignalRow[]) {
    const x = cs(rows);
    let a = action();
    const d = { ...x.d, now: () => NOW,
      getAction: async () => a,
      updateAction: async (_id: string, patch: Record<string, unknown>, whenStatus?: string) => {
        if (whenStatus && a.status !== whenStatus) return;
        const dbPatch = typeof patch.decided_at === 'string' ? { ...patch, decided_at: patch.decided_at.replace('Z', '+00:00') } : patch;
        a = { ...a, ...dbPatch } as Action;
      },
    } as unknown as StageDeps;
    return { d, x, get: () => a };
  }
  it('"Approve this message" sends the Owner\'s edited text and closes the action', async () => {
    const { d, x, get } = room([row()]);
    await x.d.csInsertCase({ user_id: row().account_id, signal_code: 'no_quote_onboarding', evidence: {} });
    const r = await decide(d, { id: 'a9', decision: 'approve', text: 'שלום,\n\nנוסח שהבעלים ערך' }, []);
    expect(r.body).toMatchObject({ ok: true, status: 'sent' });
    expect(x.mails[0].text.startsWith('שלום,\n\nנוסח שהבעלים ערך')).toBe(true);
    expect(get()).toMatchObject({ status: 'done', result: { delivery: 'sent' } });
  });
  it('"Reject" closes the action and the case - no email', async () => {
    const { d, x, get } = room([row()]);
    await x.d.csInsertCase({ user_id: row().account_id, signal_code: 'no_quote_onboarding', evidence: {} });
    const r = await decide(d, { id: 'a9', decision: 'reject' }, []);
    expect(r.body).toMatchObject({ ok: true, status: 'rejected' });
    expect(get().status).toBe('rejected');
    expect(x.cases.get('c1')!.status).toBe('rejected');
    expect(x.mails).toHaveLength(0);
  });
  it('a withdrawn consent at approval time = refused with its reason, the action failed', async () => {
    const { d, x, get } = room([row({ consent: false })]);
    await x.d.csInsertCase({ user_id: row().account_id, signal_code: 'no_quote_onboarding', evidence: {} });
    const r = await decide(d, { id: 'a9', decision: 'approve' }, []);
    expect(r.body).toMatchObject({ ok: false, code: 'outreach_no_consent' });
    expect(get().status).toBe('failed');
    expect(x.mails).toHaveLength(0);
  });
});
