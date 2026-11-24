// Owner console 2026-11-24, typed: "מאשר את שלב 4 בתוכנית הצ׳אט: תיקון עשר הבעיות מהדוח, כולל שינוי ב-L-14 ו-L-17, ובדיקה חוזרת של 60
// השאלות" (the chat audit of 24/11: 60 real questions asked on LIVE, C:/tekango-ops/chat-audit-1124 - docs/OWNER_REPORT_CHAT_VIDEOS_DIRECTORIES_2026-11-24.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyCapabilityIntent, WHY_QUESTION, HOW_QUESTION, quoteFromFileAnswer } from './capabilityTruth.ts';
import { howToStepsForCapability, tokensOf } from './howToTruth.ts';
import { computeQuoteStats, formatQuoteStatsAnswer, isStatRowExpired } from './quoteStatsTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const index = readFileSync('supabase/functions/chat-ai/index.ts', 'utf8');
const firstLine = (s) => String(s || '').split('\n')[0];
const stepsFor = (q, he, marketIL = he) => { const c = classifyCapabilityIntent(q); return { c, title: firstLine(howToStepsForCapability(c, q, he, AI_FACTS.howTo, marketIL)) }; };

describe('the audit questions reach the right verified steps', () => {
  it.each([
    ['How do I create a quote?', false, 'quote_create', 'Creating a quote'],
    ['איך שולחים הצעה בוואטסאפ?', true, 'owner_whatsapp_share', 'שליחת הצעה ללקוח'],
    ['איך שולחים הצעה במייל?', true, 'quote_email', 'שליחת הצעה ללקוח'],
    ['למה אי אפשר לערוך הצעה חתומה?', true, 'quote_edit', 'למה אי אפשר לערוך הצעה חתומה'],
    ['איך מוסיפים לקטלוג פריט במחיר למ״ר?', true, 'catalog', 'הוספת פריט לקטלוג'],
    ['Can I build a quote from a supplier PDF?', false, 'smart_quote', 'A quote from a file'],
    ['How do I price per square foot?', false, 'measured_quote', 'Choosing how a row is priced'],
    ['איפה רושמים פנייה של מישהו שהתקשר?', true, 'clients', 'רישום פנייה'],
    ['Where do I log a new inquiry from a customer?', false, 'clients', 'Logging an inquiry'],
    ['How does my client sign the quote?', false, 'public_quote_sign', 'How the client signs the quote'],
  ])('%s', (q, he, cap, title) => {
    const r = stepsFor(q, he);
    expect(r.c).toBe(cap);
    expect(r.title).toContain(title);
  });
  it('a "why" question is a steps question too; the matcher uses whole words ("how" is not inside "shows")', () => {
    expect(WHY_QUESTION.test('למה אי אפשר לערוך הצעה חתומה?')).toBe(true);
    expect(WHY_QUESTION.test('Why is no VAT added?')).toBe(true);
    expect(HOW_QUESTION.test('Why is no VAT added?')).toBe(false);
    expect(tokensOf('The rounding discount shows')).not.toContain('how');
    expect(tokensOf('שולחים')).toContain('שלח');
    expect(tokensOf('שליחת הצעה')).toContain('שלח');
  });
  it('an Israeli account in English prices per m², an international one in Hebrew per sq ft', () => {
    expect(howToStepsForCapability('measured_quote', 'How do I price per square metre?', false, AI_FACTS.howTo, true)).toContain('"Per m²"');
    expect(howToStepsForCapability('measured_quote', 'How do I price per square metre?', false, AI_FACTS.howTo, true)).not.toContain('Per sq ft');
    expect(howToStepsForCapability('measured_quote', 'איך מתמחרים לפי רגל רבועה?', true, AI_FACTS.howTo, false)).toContain('"לרגל רבועה"');
  });
  it('the quote-from-file answer uses the label on screen', () => {
    expect(quoteFromFileAnswer(true)).toContain('„מעלים קובץ”');
    expect(quoteFromFileAnswer(false)).toContain('"Upload a file"');
  });
});

describe('index.ts answers', () => {
  it('a how / why question with steps = the steps (no "yes - X exists" opener); plan-locked keeps its answer; SMART PACK one line', () => {
    expect(index).toContain('const capabilityAnswer = shortFile || stepsAnswer || describeOnly || capabilityTruth.answer;');
    expect(index).toContain("['AVAILABLE', 'PLAN_NOT_DECIDED', 'PLAN_LOCKED', 'SMART_PACK'].includes(truthStatus)");
    expect(index).toContain("const smartPackLine = isHebrew ? 'זה חלק מחכם פלוס.' : 'This is part of SMART PACK.';");
  });
  it('"how do I change the currency" gets the business currency steps before the market answer', () => {
    const a = index.indexOf("e.id === 'business_currency'");
    const b = index.indexOf('// ACCOUNT MARKET / CURRENCY TRUTH');
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
  });
  it('a "how" export question gets the quote export steps (the data_export answer is backed by quote_csv)', () => {
    expect(index).toContain("const stepsCapabilityId = capabilityId === 'data_export' ? 'quote_csv' : capabilityId;");
    expect(howToStepsForCapability('quote_csv', 'How do I export my quotes?', false, AI_FACTS.howTo)).toContain('download icon beside the "Quotes" title');
  });
});

describe('the awaiting count matches the list (expired quotes are not awaiting)', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  it('a sent quote whose validity passed is expired, not awaiting', () => {
    const rows = [
      { status: 'sent', total: 100, currency: 'ILS', view_count: 0, valid_until: '2026-11-01', tax_rate: 18 },
      { status: 'sent', total: 200, currency: 'ILS', view_count: 0, valid_until: '2026-12-31', tax_rate: 18 },
      { status: 'approved', total: 300, currency: 'ILS', view_count: 2, valid_until: '2026-11-01', tax_rate: 18 },
    ];
    expect(isStatRowExpired(rows[0], now)).toBe(true);
    const s = computeQuoteStats(rows, 'ILS', now);
    expect(s.awaiting.count).toBe(1);
    expect(s.expired.count).toBe(1);
    expect(s.approved.count).toBe(1);
    const he = formatQuoteStatsAnswer(s, true, 'ILS');
    expect(he).toContain('לפי ההצעות בחשבון שלכם:');
    expect(he).toContain('• פג תוקפן (לא נספרות כממתינות): 1');
  });
});

describe('the fixed texts and the prompt address the user in the plural', () => {
  it('no singular "שלך" in the market, invoicing, subscription and stats texts', () => {
    for (const f of ['marketTruth.ts', 'invoicingTruth.ts', 'subscriptionTruth.ts', 'quoteStatsTruth.ts']) {
      expect(readFileSync(`supabase/functions/chat-ai/${f}`, 'utf8'), f).not.toMatch(/(החשבון|בחשבון|לחשבון) שלך|סימון ידני שלך/);
    }
    expect(readFileSync('supabase/functions/chat-ai/validation.ts', 'utf8')).toContain('Speak to the user in the PLURAL');
  });
});

describe('the price answer names the SMART PACK price of the market', () => {
  it('Israel ₪10 / ₪102, abroad $5 / $51', () => {
    const src = readFileSync('supabase/functions/chat-ai/subscriptionTruth.ts', 'utf8');
    expect(src).toContain('function smartPackPriceLine(');
    const sp = AI_FACTS.addOns.find((a) => a.id === 'smart_pack');
    expect(sp.prices.IL).toMatchObject({ month: '10.00', year: '102.00' });
    expect(sp.prices.INTERNATIONAL).toMatchObject({ month: '5.00', year: '51.00' });
  });
});
