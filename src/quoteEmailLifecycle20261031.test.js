// Codex review 2026-10-31 group 1 (Owner console, typed: "מאשר את שש הקבוצות של קודקס ... החלטות א-ח והנוסחים כמומלץ"):
// F02 / F03 - an earlier send that was never confirmed is answered only by the user's explicit "send anyway" (decisions a + b);
// F05 - the browser no longer clears the bounce mark after a send (the server does it when it records the send) and reads it back.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyQuoteEmailError, SEND_ANYWAY_CATEGORIES } from './utils/quoteEmailErrorClassification';

describe('the three unconfirmed-send answers, Hebrew and English', () => {
  it.each([
    ['QUOTE_EMAIL_UNRESOLVED: x', 'send_unresolved', 'ועברו יותר מ־23 שעות', 'more than 23 hours have passed'],
    ['QUOTE_EMAIL_CHANGED: x', 'send_changed', 'ההצעה השתנתה מאז שליחה קודמת', 'The quote changed since an earlier send'],
    ['QUOTE_EMAIL_RECEIVED: x', 'send_received', 'שירות המייל כבר קיבל שליחה קודמת', 'already received an earlier send'],
  ])('%s -> %s', (raw, category, he, en) => {
    const h = classifyQuoteEmailError(raw, true);
    const e = classifyQuoteEmailError(raw, false);
    expect(h.category).toBe(category);
    expect(e.category).toBe(category);
    expect(h.userMessage).toContain(he);
    expect(h.userMessage).toContain('ייתכן ש');
    expect(e.userMessage).toContain(en);
    expect(SEND_ANYWAY_CATEGORIES.has(category)).toBe(true);
  });
  it('no other refusal offers "send anyway"', () => {
    for (const raw of ['QUOTE_EMAIL_IN_PROGRESS: x', 'QUOTE_EMAIL_COOLDOWN: x', 'QUOTE_EMAIL_LIMIT: x', 'QUOTE_EMAIL_UNKNOWN: x', 'QUOTE_EMAIL_UNVERIFIED: x', 'QUOTE_EMAIL_TEST_RECIPIENT: x', 'QUOTE_PRICE_MISSING: x']) {
      expect(SEND_ANYWAY_CATEGORIES.has(classifyQuoteEmailError(raw, true).category)).toBe(false);
    }
  });
});

describe('Dashboard.jsx executeEmailSend', () => {
  const src = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  const start = src.indexOf('const executeEmailSend = async (quote, { newSend = false } = {}) => {');
  const body = src.slice(start, src.indexOf('const handleProtectedAction', start));
  it('a new send only after the explicit question, once (never in a loop), and the flag reaches the server only then', () => {
    expect(start).toBeGreaterThan(0);
    expect(body).toContain("...(newSend ? { newSend: true } : {})");
    expect(body).toMatch(/if \(!newSend && SEND_ANYWAY_CATEGORIES\.has\(category\)\) \{/);
    expect(body).toContain("isHebrew ? 'לשלוח בכל זאת' : 'Send anyway'");
    expect(body).toContain('if (again) { await executeEmailSend(quote, { newSend: true }); return; }');
  });
  it('the browser never clears the bounce mark after a send; it reads the mark back', () => {
    expect(body).not.toMatch(/from\('quotes'\)\.update\(\{ email_bounced: false/);
    expect(body).toContain(".from('quotes').select('email_bounced, email_bounce_reason, email_bounced_at').eq('id', quote.id).maybeSingle()");
  });
  it('L-13 order unchanged: the success message, then the quote is marked sent', () => {
    expect(body.indexOf("'📧 המייל נשלח בהצלחה!'")).toBeGreaterThan(0);
    expect(body.indexOf('markSentAfterShare(quote)')).toBeGreaterThan(body.indexOf("'📧 המייל נשלח בהצלחה!'"));
  });
});
