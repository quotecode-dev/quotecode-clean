// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-09, L-11, L-14, L-15, L-17, L-22, L-23, L-25 לפי התוכנית לתיקון 17 ממצאי קודקס על
// בקשת מיזוג 113, כולל ארבע ההחלטות שהוצעו"): the browser side of N03, N06, N11, N12, N14, N15 (docs/CODEX_REVIEW_CODEXFIX_2026-10-28.md).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { marketCalendarDate } from './utils/recurringExpense';
import { fetchPublishedArticles } from './shared/siteArticlesApi';
import { loadDatabaseGuides } from '../scripts/prerender-public-routes.mjs';
import { billingParams, BILLING_PROOF_ACTIONS } from './domain/admin/adminBilling';

const src = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('N15: a new expense is dated by the account market calendar (IRON-DATE-001)', () => {
  it('the same instant on any device: Israel = Jerusalem, International = UTC, across day / month / year ends', () => {
    // 2026-11-01T00:30Z: Jerusalem and UTC are both November 1 (a Los Angeles device would say October 31)
    expect(marketCalendarDate(new Date('2026-11-01T00:30:00Z'), 'Local')).toBe('2026-11-01');
    expect(marketCalendarDate(new Date('2026-11-01T00:30:00Z'), 'International')).toBe('2026-11-01');
    // 22:30Z on December 31: Jerusalem is already January 1 of the next year, UTC is not
    expect(marketCalendarDate(new Date('2026-12-31T22:30:00Z'), 'Local')).toBe('2027-01-01');
    expect(marketCalendarDate(new Date('2026-12-31T22:30:00Z'), 'International')).toBe('2026-12-31');
    expect(marketCalendarDate(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
    const before = process.env.TZ;
    try {
      for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Jerusalem']) {
        process.env.TZ = tz;
        expect(marketCalendarDate(new Date('2026-10-31T22:30:00Z'), 'Local')).toBe('2026-11-01');
        expect(marketCalendarDate(new Date('2026-10-31T22:30:00Z'), 'International')).toBe('2026-10-31');
      }
    } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
  });
});

describe('N14: the finance totals are in the saved business currency', () => {
  it('FinancesTab gets the account currency, never the currency of the quote opened last', () => {
    const d = src('src/pages/Dashboard.jsx');
    expect(d).toContain("const accountCurrency = isLocalIsraeliBusiness ? 'ILS' : (businessCurrency || currency);");
    expect(d).toContain('sym={accountSym}\n              formatMoneyDisplay={formatAccountMoney}');
  });
});

describe('N12 (Owner decision 4): an invalid published guide stops the production build by name', () => {
  const reply = (rows) => vi.fn(async () => ({ ok: true, json: async () => rows }));
  it('strict names it; the browser just leaves it out; a static slug is skipped on purpose', async () => {
    const rows = [{ slug: 'broken-guide', market: 'intl', he: {}, en: {}, published_at: '2026-10-28T10:00:00Z' }];
    await expect(fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl: reply(rows), strict: true })).rejects.toThrow('articles_invalid:broken-guide');
    expect(await fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl: reply(rows) })).toEqual([]);
  });
  it('the build stops at once (an invalid guide is not fixed by trying again), and the live site keeps serving', async () => {
    const prod = { VERCEL_ENV: 'production', VITE_SUPABASE_URL: 'https://s.co', VITE_SUPABASE_ANON_KEY: 'k' };
    const entry = { fetchPublishedArticles: vi.fn(async () => { throw new Error('articles_invalid:broken-guide'); }) };
    await expect(loadDatabaseGuides(entry, () => {}, prod, async () => {})).rejects.toThrow(/a published guide is invalid.*articles_invalid:broken-guide/);
    expect(entry.fetchPublishedArticles).toHaveBeenCalledTimes(1);
    const p = src('scripts/prerender-public-routes.mjs');
    expect(p).toContain('failures.push(`database guide ${row.slug}: ');
    expect(p).not.toContain('database guide ${row.slug} skipped');
  });
});

describe('N03 (Owner decision 1): "Done in PayPlus" for an owed removal refund', () => {
  it('the password proof is bound to the removal and the PayPlus transaction number', () => {
    expect(BILLING_PROOF_ACTIONS.settle_removal_refund).toBe('billing_settle_refund');
    expect(billingParams('settle_removal_refund', { reason: ' made in PayPlus ', removalId: 'r1', refundRef: ' 778899 ' }))
      .toEqual({ reason: 'made in PayPlus', removalId: 'r1', refundRef: '778899' });
  });
  it('the reconciliation screen: the button on an open owed refund, the number and the password, in both languages', () => {
    const s = src('src/components/AdminBillingReconcile.jsx');
    expect(s).toContain("{isOpen && f.code === 'REFUND_OWED' && f.detail?.removalId && f.detail?.userId && (");
    expect(s).toContain("{isHebrew ? 'בוצע בפיי פלוס' : 'Done in PayPlus'}");
    expect(s).toContain("action: 'settle_removal_refund', targetUserId: f.detail.userId");
    expect(s).toContain('type="password" autoComplete="current-password"');
    expect(s).toContain("disabled={state === 'busy' || ref.trim().length < 3 || !password}");
  });
});

describe('N06 (Owner decision 2): the Owner decides an unknown expense', () => {
  it('three buttons on an unknown row only, in both languages; nothing goes back to sending by itself', () => {
    const s = src('src/components/AdminExpenseInvoices.jsx');
    expect(s).toContain("{r.status === 'unknown' && (");
    for (const [decision, he, en] of [['found', 'נמצאה בפיי פלוס', 'Found in PayPlus'], ['duplicate', 'כפולה, לסגור', 'Duplicate, close it'], ['not_created', 'לא נקלטה, לשלוח שוב', 'Not received, send again']]) {
      expect(s).toContain(`onClick={() => resolve(r.id, '${decision}')}`);
      expect(s).toContain(`{isHebrew ? '${he}' : '${en}'}`);
    }
    expect(s).toContain("const r = await call({ action: 'resolve', ids: [id], decision });");
  });
});

describe('N11 (Owner decision 3): an article page not found on the site', () => {
  it('the agents room says it plainly in both languages and offers the rebuild', () => {
    const s = src('src/components/AdminAgentsRoom.jsx');
    expect(s).toContain("a.result.deploy === 'unverified' ? (isHebrew ? 'המאמר אושר, אבל הדף שלו עדיין לא נמצא באתר שעתיים אחרי האישור, ולכן גוגל לא רואה אותו. לחצו \"בנייה מחדש\".'");
  });
});
