import { describe, it, expect } from 'vitest';
import { classifyQuoteEmailError } from './quoteEmailErrorClassification';
import { PRICE_MISSING_REFUSAL, PRICE_UNVERIFIED_REFUSAL } from '../../supabase/functions/send-quote-email/priceGate.ts';

// Task 38 (Owner D1 = block, server side): the server refusal of send-quote-email is shown as what it is - the prices must be completed /
// the prices could not be verified - never as "the email service rejected this message, contact support".
describe('classifyQuoteEmailError - the server price gate', () => {
  it('a missing price -> "price_missing" with how to complete it (HE / EN)', () => {
    const he = classifyQuoteEmailError(PRICE_MISSING_REFUSAL, true);
    const en = classifyQuoteEmailError(PRICE_MISSING_REFUSAL, false);
    expect(he.category).toBe('price_missing');
    expect(en.category).toBe('price_missing');
    expect(he.userMessage).toContain('ערוך מחיר');
    expect(he.userMessage).toContain('מחיר 0 מכוון מותר');
    expect(en.userMessage).toContain('Edit price');
    expect(en.userMessage).toContain('An intentional 0 is allowed');
  });
  it('an unverifiable price state -> "price_unverified" (retry), not a configuration problem', () => {
    const { category, userMessage } = classifyQuoteEmailError(PRICE_UNVERIFIED_REFUSAL, true);
    expect(category).toBe('price_unverified');
    expect(userMessage).toMatch(/לא נשלח/);
  });
  it('the old generic fallback is not used for these refusals', () => {
    for (const m of [PRICE_MISSING_REFUSAL, PRICE_UNVERIFIED_REFUSAL]) expect(classifyQuoteEmailError(m, false).category).not.toBe('resend_rejected');
  });
});
