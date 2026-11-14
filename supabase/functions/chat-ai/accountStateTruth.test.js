// 2026-11-13 (Owner approved part 2 - the chat knowledge scan of 12/11, section א 1-2 and section ג "language vs market")
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { asksSmartPackUsage, smartPackUsageAnswer, asksBillingProblem, billingProblemAnswer } from './accountStateTruth.ts';
import { howToText, howToStepsForCapability } from './howToTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

describe('SMART PACK usage left', () => {
  it('a usage question is recognised in both languages; price / buy / cancel questions are not', () => {
    for (const q of ['כמה נשאר לי מחכם פלוס החודש?', 'כמה אחוז ניצלתי מחכם פלוס', 'How much SMART PACK usage do I have left this month?', 'smart pack remaining']) expect(asksSmartPackUsage(q)).toBe(true);
    for (const q of ['כמה עולה חכם פלוס?', 'איך מבטלים את חכם פלוס?', 'How much does SMART PACK cost?', 'how do I cancel smart pack']) expect(asksSmartPackUsage(q)).toBe(false);
  });
  it('the answer is the server percent (the words of the SMART PACK windows), never the price list', () => {
    expect(smartPackUsageAnswer({ percentLeft: 63, unlimited: false }, true)).toBe('נשארו לכם 63% משימוש חכם פלוס החודש. אותו אחוז מופיע גם בחלון הצ׳אט ובחלון ההצעה החכמה.');
    expect(smartPackUsageAnswer({ percentLeft: 63, unlimited: false }, false)).toContain('You have 63% of your SMART PACK usage left this month.');
    expect(smartPackUsageAnswer({ percentLeft: 0, unlimited: true }, true)).toContain('בלי הגבלת שימוש');
    expect(smartPackUsageAnswer(null, true)).toBeNull();
  });
});

describe('the billing state of the account', () => {
  const now = Date.parse('2026-11-13T10:00:00Z');
  const ready = (billing, status = 'active') => ({ state: 'ready', planId: 'package', subscriptionStatus: status, billing });
  it('recognises a failed payment / limited account question in both languages', () => {
    for (const q of ['התשלום על המנוי לא עבר, מה עושים?', 'החיוב נכשל', 'למה החשבון מוגבל?', 'My subscription payment failed - what do I do?', 'my card was declined', 'why is my account limited']) expect(asksBillingProblem(q)).toBe(true);
    for (const q of ['איך משלמים על המנוי?', 'How do I pay for the subscription?']) expect(asksBillingProblem(q)).toBe(false);
  });
  it('grace days: the words of the red bar, the time left and "עדכון כרטיס" (the service mailbox of the market)', () => {
    const a = billingProblemAnswer(ready({ inGrace: true, limited: false, graceEndsAt: '2026-11-15T12:00:00Z', renewalStopped: false }, 'past_due'), true, true, now);
    expect(a).toBe('החיוב של המנוי לא עבר. החשבון יוגבל בעוד יומיים ושעתיים. כדי לעדכן כרטיס לוחצים "עדכון כרטיס" בפס האדום שבראש המסך, ונפתח מייל לשירות הלקוחות. אחרי שהתשלום עובר, החשבון ממשיך כרגיל.');
    expect(billingProblemAnswer(ready({ inGrace: true, limited: false, graceEndsAt: '2026-11-14T10:00:00Z', renewalStopped: false }, 'past_due'), false, false, now)).toContain('an email to customer service opens');
  });
  it('limited: view only, pay with "לתשלום"; no problem: says so and how it works; a stopped renewal is not a failure', () => {
    expect(billingProblemAnswer(ready({ inGrace: false, limited: true, limitedReason: 'payment_failed', graceEndsAt: '2026-11-10T00:00:00Z', renewalStopped: false }), true, true, now))
      .toBe('החשבון מוגבל: החיוב של המנוי לא עבר. אפשר לצפות בהצעות קיימות, אבל לא להוציא הצעות חדשות. כדי לשלם לוחצים "לתשלום" בפס האדום שבראש המסך.');
    expect(billingProblemAnswer(ready({ inGrace: false, limited: false, graceEndsAt: null, renewalStopped: false }), true, true, now)).toMatch(/^לפי החשבון שלכם בשרת, אין כרגע תשלום שנכשל\./);
    expect(billingProblemAnswer(ready({ inGrace: true, limited: false, graceEndsAt: '2026-11-15T12:00:00Z', renewalStopped: true }), false, false, now)).toMatch(/^According to your account on the server, no payment has failed/);
  });
  // 2026-11-14 (Owner approved, scope-security finding 1): an account that could not be read is never told "no payment failed"
  it('an account that could not be read gets no billing answer (null) - the regular path answers', () => {
    for (const s of [{ state: 'unavailable' }, { state: 'loading' }, null, undefined]) {
      expect(billingProblemAnswer(s, true, true, now)).toBeNull();
      expect(billingProblemAnswer(s, false, false, now)).toBeNull();
    }
    const src = fs.readFileSync('supabase/functions/chat-ai/index.ts', 'utf8');
    expect(src).toMatch(/const billingAnswer = billingProblemAnswer\([^\n]*\n[^\n]*\n\s*if \(billingAnswer\) \{/);
  });
});

describe('the how-to steps follow the market (the language stays the user\'s)', () => {
  const entry = AI_FACTS.howTo.find((e) => e.id === 'business_currency');
  it('an Israeli account reading in English is never told to choose USD; an international account in Hebrew gets the currency list', () => {
    expect(howToText(entry, false, true).steps.join(' ')).toContain('always in shekels');
    expect(howToText(entry, false, false).steps.join(' ')).toContain('USD, EUR or GBP');
    expect(howToText(entry, true, false).steps.join(' ')).toContain('USD, EUR או GBP');
    expect(howToText(entry, true, true).steps.join(' ')).toContain('בשקלים');
    expect(howToStepsForCapability('business_settings', 'which currency are my quotes in', false, AI_FACTS.howTo, true)).not.toContain('USD, EUR or GBP');
  });
});
