// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ...", item ו; L-06 / L-11 / L-17): the chat answers in the
// INTERFACE language; prices, currency, purchase and the service mailbox follow the ACCOUNT market. All four combinations.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSubscriptionTruthResponse, findSubscriptionClaimViolations, buildSubscriptionTruthBlock } from './subscriptionTruth.ts';
import { resolvePaymentTruthResponse, subscriptionPurchaseOpen } from './paymentTruth.ts';
import { buildAddOnTruthBlock } from './addOnTruth.ts';
import { buildSystemPrompt } from './validation.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const HEBREW = /[֐-׿]/;

describe('subscription answer: language from the interface, prices from the market', () => {
  const ask = (isHebrew, marketIL) => resolveSubscriptionTruthResponse(isHebrew ? 'כמה עולה המנוי?' : 'How much is the subscription?', isHebrew, null, marketIL).answer;
  it('Israeli account in English: English words, shekel prices, purchase open', () => {
    const a = ask(false, true);
    expect(HEBREW.test(a)).toBe(false);
    expect(a).toMatch(/30\.00 ₪ per month or 306\.00 ₪ per year/);
    expect(a).not.toMatch(/USD/);
    expect(a).toMatch(/You can buy the package in the plans window/);
  });
  it('account abroad in Hebrew: Hebrew words, USD prices, purchase not open yet', () => {
    const a = ask(true, false);
    expect(HEBREW.test(a)).toBe(true);
    expect(a).toMatch(/18\.00 USD לחודש/);
    expect(a).not.toMatch(/₪/);
    expect(a).toMatch(/רכישת מנוי עדיין לא פתוחה בחשבונות מחוץ לישראל/);
  });
  it('the matching combinations are unchanged (HE + IL, EN + abroad)', () => {
    expect(ask(true, true)).toBe(resolveSubscriptionTruthResponse('כמה עולה המנוי?', true, null).answer);
    expect(ask(false, false)).toBe(resolveSubscriptionTruthResponse('How much is the subscription?', false, null).answer);
  });
  it('a shekel price is a violation only for an account abroad', () => {
    expect(findSubscriptionClaimViolations('The subscription is 30 ₪ per month.', true)).not.toContain('ILS_ON_INTERNATIONAL');
    expect(findSubscriptionClaimViolations('The subscription is 30 ₪ per month.', false)).toContain('ILS_ON_INTERNATIONAL');
  });
});

describe('payment answer and prompt blocks follow the market', () => {
  it('Israeli account in English: the subscription can be bought (English, no Hebrew)', () => {
    const a = resolvePaymentTruthResponse(false, AI_FACTS.billing, undefined, true).answer;
    expect(HEBREW.test(a)).toBe(false);
    expect(a).toMatch(/You can buy the TEKANGO subscription by card/);
  });
  it('account abroad in Hebrew: no purchase claim', () => {
    const a = resolvePaymentTruthResponse(true, AI_FACTS.billing, undefined, false).answer;
    expect(a).toMatch(/כרגע אין ב-TEKANGO סליקה/);
    expect(subscriptionPurchaseOpen(false, AI_FACTS.billing)).toBe(false);
    expect(subscriptionPurchaseOpen(true, AI_FACTS.billing)).toBe(true);
  });
  it('the SMART PACK block: market prices, and abroad active only when the account section says so', () => {
    expect(buildAddOnTruthBlock(false, AI_FACTS.addOns, true)).toMatch(/Israel: ₪10(\.00)? per month/);
    expect(buildAddOnTruthBlock(true, AI_FACTS.addOns, false)).toMatch(/International: \$5(\.00)? per month/);
    expect(buildAddOnTruthBlock(true, AI_FACTS.addOns, false)).toMatch(/ONLY when the verified account section says so \(e\.g\. during the 7 free days\)/);
    expect(buildSubscriptionTruthBlock(false, false, true)).toMatch(/ISRAEL\/HEBREW CONTEXT ONLY/);
    expect(buildSubscriptionTruthBlock(true, false, false)).toMatch(/INTERNATIONAL\/ENGLISH CONTEXT ONLY/);
  });
  it('the system prompt takes the market from the verified account, the language from the interface', () => {
    const account = { summaryState: 'not_activated', planId: null, free10Remaining: null, subscriptionStatus: null, outputPhase: 'off' };
    const il = buildSystemPrompt({ isHebrew: false, accountContext: { market: 'Local', account, currentArea: null } });
    expect(il).toMatch(/ISRAEL\/HEBREW CONTEXT ONLY/);
    const intl = buildSystemPrompt({ isHebrew: true, accountContext: { market: 'International', account, currentArea: null } });
    expect(intl).toMatch(/INTERNATIONAL\/ENGLISH CONTEXT ONLY/);
  });
});

describe('index.ts: language from the interface, market from the verified account', () => {
  const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
  it('isHebrew stays the caller language; marketIL is the verified account market', () => {
    expect(src).toMatch(/let marketIL = clientIsHebrew;/);
    expect(src).toMatch(/marketIL = isHebrewFromMarket\(accountContext\.market, clientIsHebrew\);/);
    expect(src).not.toMatch(/isHebrew = isHebrewFromMarket\(/);
    expect(src).toMatch(/if \(!marketIL\) \{\s*\n?\s*aiReply = aiReply\.replace\(\/support@tekango/);
  });
});
