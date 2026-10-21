// Owner console 2026-10-19, typed L-17 approval: the chat answers "how many quotes / their amounts" from the account's own quotes.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyQuoteStatsIntent, computeQuoteStats, formatQuoteStatsAnswer } from './quoteStatsTruth.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('quote statistics truth (Owner 2026-10-19)', () => {
  it('recognises questions about the existing quotes and their amounts (HE / EN)', () => {
    for (const q of [
      'כמה הצעות מחיר יש לי, ומה הסכום הכולל שלהן?',
      'מה הסכום הכולל של ההצעות שאושרו?',
      'כמה הצעות ממתינות לחתימה?',
      'כמה הצעות נשלחו החודש',
      'How many quotes do I have, and what is their total value?',
      'What is the total value of my approved quotes?',
      'how many quotes are pending',
    ]) expect(classifyQuoteStatsIntent(q), q).toBe(true);
  });

  it('never takes the plan-balance question or unrelated questions', () => {
    for (const q of [
      'כמה הצעות נשארו לי?',
      'כמה הצעות חינם יש לי במסלול',
      'מה המכסה שלי',
      'How many quotes do I have left?',
      'How many free quotes does my plan include?',
      'איך שולחים הצעה בוואטסאפ?',
      'מה זה הצעה חמה',
      'מה הסטטוס של ההצעה A100700',
      '',
    ]) expect(classifyQuoteStatsIntent(q), q).toBe(false);
  });

  it('counts exactly like the quote list overview; amounts per currency, never mixed', () => {
    const s = computeQuoteStats([
      { status: 'approved', total: 1100, currency: 'ILS' },
      { status: 'paid', total: 100, currency: 'ILS' },
      { status: 'sent', total: 500, currency: 'ILS', view_count: 0 },
      { status: 'draft', total: 300, currency: 'ILS', view_count: 2 },
      { status: 'draft', total: 50, currency: 'USD', view_count: 0 },
      { status: 'draft', total: 70, currency: null, view_count: 0 },
    ], 'ILS');
    expect(s.all).toEqual({ count: 6, sums: { ILS: 2070, USD: 50 } });
    expect(s.approved).toEqual({ count: 2, sums: { ILS: 1200 } });
    expect(s.awaiting).toEqual({ count: 2, sums: { ILS: 800 } });
    expect(s.drafts).toEqual({ count: 2, sums: { USD: 50, ILS: 70 } });
  });

  it('formats in the account language; the account currency first; an empty account says so', () => {
    const s = computeQuoteStats([{ status: 'approved', total: 1100, currency: 'ILS' }, { status: 'draft', total: 50, currency: 'USD' }], 'ILS');
    const he = formatQuoteStatsAnswer(s, 'ILS', true);
    expect(he).toContain('• סך הכול: 2, בסך ₪1,150.00'.replace('₪1,150.00', '₪1,100.00 ו-$50.00'));
    expect(he).toContain('• אושרו (כולל ששולמו): 1, בסך ₪1,100.00');
    expect(he).toContain('• ממתינות לחתימה (נשלחו או נצפו): 0');
    expect(he).toContain('סטטיסטיקה');
    const en = formatQuoteStatsAnswer(computeQuoteStats([{ status: 'sent', total: 702, currency: 'USD' }], 'USD'), 'USD', false);
    expect(en).toContain('• Awaiting signature (sent or viewed): 1, totalling $702.00');
    expect(formatQuoteStatsAnswer(computeQuoteStats([], 'ILS'), 'ILS', true)).toMatch(/^עדיין אין הצעות מחיר בחשבון שלך/);
  });

  it('index.ts: runs for a verified dashboard user only, reads quotes with the caller JWT and user_id, before the subscription truth', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    const at = src.indexOf('classifyQuoteStatsIntent(lastUserMessage)');
    expect(at).toBeGreaterThan(0);
    // smart chat (Owner LIVE check 2026-10-19): a question narrowed to a client / period / state goes to the data tools instead
    expect(src).toMatch(/if \(verifiedUserId && isDashboard && accountContext && classifyQuoteStatsIntent\(lastUserMessage\) && !\(ownDataQuestion && hasDataQualifier\(lastUserMessage\)\)\)/);
    expect(src).toMatch(/statsClient\.from\('quotes'\)\.select\('status, total, currency, view_count'\)\.eq\('user_id', verifiedUserId\)/);
    expect(at).toBeLessThan(src.indexOf('resolveSubscriptionTruthResponse(lastUserMessage'));
  });
});
