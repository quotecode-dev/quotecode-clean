// Night task 2026-10-16 (Owner-approved doc 31eae0a7): R-01 ordinary questions were answered with plan / Free-10 text; R-02 correct
// model answers were thrown away for the plan statement; R-16 a Lifetime account was told it has no plan.
import { describe, it, expect } from 'vitest';
import { classifySubscriptionIntents, findSubscriptionClaimViolations, accountPlanLine, formatSubscriptionAnswer } from './subscriptionTruth.ts';
import { NO_ACCOUNT_PLAN } from './accountContext.ts';

describe('R-01: ordinary questions are not plan questions', () => {
  it.each([
    'כמה הצעות שלחתי החודש?', 'כמה הצעות אושרו בשבוע שעבר?', 'כמה הצעות נחתמו עד היום?',
    'How many quotes did I send this month?', 'How many quotes were approved last week?', 'How many quotes have I created so far?',
    'אפשר לתת להצעה תוקף של 14 יום?', 'תוקף הצעה ל-14 יום', 'Can I make a quote valid for 14 days?', 'Payment terms of 14 days - where do I set them?',
    'How do I set prices in euros?', 'Can I price in GBP?', 'How much VAT is charged?', 'איך מגדירים מחירים ביורו?', 'איך משנים את המע"מ בהצעה?',
  ])('%s -> no subscription intent', (q) => {
    expect(classifySubscriptionIntents(q)).toEqual([]);
  });
  it.each([
    ['Is there a free trial?', 'trial'], ['Do I get 14 days free?', 'trial'], ['יש תקופת ניסיון?', 'trial'], ['האם יש 14 יום חינם?', 'trial'],
    ['How much does TEKANGO cost?', 'pricing'], ['How much does it cost?', 'pricing'], ['כמה עולה המערכת?', 'pricing'], ['כמה זה עולה?', 'pricing'],
    ["what's the price in shekels on the English site?", 'pricing'], ['What plans do you have?', 'pricing'], ['כמה עולה המנוי?', 'pricing'],
    ['How many quotes can I send on the free plan?', 'quota'], ['כמה הצעות אפשר לשלוח בחינם?', 'quota'], ['What is the quote limit?', 'quota'],
    ['How many free quotes do I have left?', 'balance'],
  ])('%s -> still the %s answer', (q, intent) => {
    expect(classifySubscriptionIntents(q)).toContain(intent);
  });
});

describe('R-02: correct model answers are kept', () => {
  it.each([
    ['ההצעה תקפה ל-14 יום מיום ההנפקה. אפשר לשנות את התוקף בהגדרות העסק.', true],
    ['Your quote is valid until 3/20/2027.', false],
    ['The payment terms on this quote are 14 days from approval.', false],
    ['בחודש האחרון שלחת 12 הצעות מחיר בחודש בממוצע, ו-4 מהן אושרו.', true],
    ['You sent 12 quotes a month on average over the last quarter.', false],
    ['Your account is set up as a Lifetime subscription, so every capability is open.', false],
  ])('%s -> no violation', (a, he) => {
    expect(findSubscriptionClaimViolations(a, he)).toEqual([]);
  });
  it.each([
    ['Enjoy a 14-day free trial when you sign up.', false, 'TRIAL_CLAIM'],
    ['בהרשמה מקבלים 14 יום חינם.', true, 'TRIAL_CLAIM'],
    ['You can send up to 20 quotes a month on the free plan.', false, 'MONTHLY_QUOTE_LIMIT'],
    ['במסלול החינם אפשר לשלוח עד 5 הצעות מחיר בחודש.', true, 'MONTHLY_QUOTE_LIMIT'],
    ['You have used 3/5 quotes.', false, 'MONTHLY_QUOTE_LIMIT'],
    ['Upgrade to the Pro plan for more.', false, 'LEGACY_PLAN_NAME'],
  ])('%s -> %s', (a, he, code) => {
    expect(findSubscriptionClaimViolations(a, he)).toContain(code);
  });
});

describe('R-16: a Lifetime account is told it is Lifetime', () => {
  const lifetime = { ...NO_ACCOUNT_PLAN, isLifetime: true };
  it('the account line', () => {
    expect(accountPlanLine(lifetime, 'he')).toBe('החשבון שלך מוגדר כמנוי לכל החיים: כל היכולות פתוחות בו, ללא חיוב.');
    expect(accountPlanLine(lifetime, 'en')).toBe('Your account is set up as a Lifetime subscription: every capability is open, with no charge.');
    expect(accountPlanLine(NO_ACCOUNT_PLAN, 'en')).not.toMatch(/Lifetime/);
  });
  it('"do I have a lifetime plan?" never answers "there is no plan by the name you mentioned"', () => {
    const q = 'Do I have a lifetime plan?';
    const intents = classifySubscriptionIntents(q);
    expect(intents).toContain('legacy_plan');
    const forLifetime = formatSubscriptionAnswer(intents, q, false, lifetime);
    expect(forLifetime).toMatch(/Your account is set up as a Lifetime subscription/);
    expect(forLifetime).not.toMatch(/no plan by the name/);
    const forOther = formatSubscriptionAnswer(intents, q, false, NO_ACCOUNT_PLAN);
    expect(forOther).toMatch(/A Lifetime subscription is not a plan you can buy/);
    expect(forOther).not.toMatch(/no plan by the name/);
  });
  it('a retired plan name is still answered as retired', () => {
    const q = 'Am I on the Pro plan?';
    expect(formatSubscriptionAnswer(classifySubscriptionIntents(q), q, false, lifetime)).toMatch(/there is no plan by the name you mentioned/);
  });
});
