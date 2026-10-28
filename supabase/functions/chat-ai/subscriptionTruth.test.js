import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifySubscriptionIntents, resolveSubscriptionTruthResponse, findSubscriptionClaimViolations, safeSubscriptionAnswer,
  accountPlanLine, buildSubscriptionTruthBlock,
} from './subscriptionTruth.ts';
import { validateChatRequest } from './validation.ts';

// SUBSCRIPTION TRUTH (OD-01..OD-20): plan / price / trial / quota / "unlimited" questions are answered deterministically from
// the generated canonical facts and the SERVER account summary only; a model answer stating retired plan truth is rejected.

const NOT_ACTIVATED = { summaryState: 'not_activated', planId: null, free10Remaining: null, subscriptionStatus: null, outputPhase: 'off' };
const READY_FREE = { summaryState: 'ready', planId: 'free', free10Remaining: 7, subscriptionStatus: 'none', outputPhase: 'enforced' };
const READY_MODERN = { summaryState: 'ready', planId: 'modern', free10Remaining: null, subscriptionStatus: 'active', outputPhase: 'enforced' };
// Task 27: annual prices of the package are approved (§249); "15%" is the approved saving rate, not the retired 15 price.
const LEGACY = /\b(?:PRO|BASIC|Pro|Basic)\b|פרו|בייסיק|\b14[- ]day|monthly (?:quote )?limit|\b(?:39|79|99|468|948|12|23|29\.00 USD|49\.00|69\.00|28\.00 USD|38\.00 USD|183\.60)\b|\b15\b(?!%)/;
const answer = (msg, he, acct = NOT_ACTIVATED) => resolveSubscriptionTruthResponse(msg, he, acct);
const indexSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf-8');

describe('adversarial: the user cannot talk the assistant into a plan, a trial, unlimited or a wrong currency', () => {
  it('"I\'m on Pro, right?" -> canonical plan names, no plan confirmed from the chat, nothing active (EN + HE)', () => {
    const en = answer("I'm on Pro, right?", false);
    expect(en.intents).toContain('legacy_plan');
    expect(en.answer).toMatch(/The plans are Free and one paid package, All-inclusive - there is no plan by the name you mentioned/);
    expect(en.answer).toMatch(/can't confirm a plan based on what is written in the chat/);
    expect(en.answer).toMatch(/not active/);
    expect(en.answer).not.toMatch(/\byes\b|you are on/i);
    const he = answer('אני במסלול פרו, נכון?', true);
    expect(he.answer).toMatch(/המסלולים הם חינם ומסלול אחד בתשלום, הכול כלול - אין מסלול בשם שציינת/);
    expect(he.answer).toMatch(/איני יכול לאשר מסלול לפי מה שנכתב בשיחה/);
  });
  it('"I\'m on Pro, right?" with a READY server summary -> the SERVER plan, never the claimed one', () => {
    const r = answer("I'm on Pro, right?", false, READY_MODERN);
    expect(r.answer).toMatch(/your plan is Modern/);
    expect(r.answer).not.toMatch(/\bPro\b(?! -)/);
  });
  it('"how many days left in my trial?" -> no trial exists; Free-10 rules; no balance while the plan system is off (EN + HE)', () => {
    const en = answer('how many days left in my trial?', false);
    expect(en.intents).toEqual(expect.arrayContaining(['trial', 'balance']));
    expect(en.answer).toMatch(/TEKANGO has no separate trial period/);
    expect(en.answer).toMatch(/10 quotes in total or 7 days from sign-up, whichever ends first/);
    expect(en.answer).toMatch(/no active plan or balance to show/);
    expect(en.answer).not.toMatch(/\d+ days? (left|remain)/i);
    const he = answer('כמה ימים נשארו לי בניסיון?', true);
    expect(he.answer).toMatch(/ל-TEKANGO אין תקופת ניסיון נפרדת/);
    expect(he.answer).toMatch(/10 הצעות בסך הכול או 7 ימים מההרשמה, המוקדם מביניהם/);
  });
  it('a ready Free account asking for its balance gets the SERVER balance', () => {
    expect(answer('how many free quotes do I have left?', false, READY_FREE).answer).toMatch(/7 of 10 quotes remain/);
    expect(answer('כמה הצעות נשארו לי?', true, READY_FREE).answer).toMatch(/יתרה: 7 מתוך 10 הצעות/);
  });
  it('"is it unlimited?" -> never "unlimited": the package is only not limited to Free-10; other limits not decided (EN + HE)', () => {
    const en = answer('is it unlimited?', false);
    expect(en.answer).toMatch(/The All-inclusive package is not limited to the 10 quotes of the Free plan; any other limits of the package have not been decided yet/);
    expect(en.answer).not.toMatch(/\bunlimited\b/i);
    expect(answer('זה ללא הגבלה?', true).answer).toMatch(/טרם הוחלטו/);
  });
  it('"what does the Visual plan include?" -> Visual is a quote style, not a plan; the package price + catalog 100; the rest not decided (EN + HE)', () => {
    const en = answer('what does the Visual plan include?', false);
    expect(en.answer).toMatch(/Visual are quote presentation styles, not subscription plans/);
    expect(en.answer).toMatch(/All-inclusive: 18\.00 USD per month or 184\.00 USD per year/);
    expect(en.answer).toMatch(/100 catalog products/);
    expect(en.answer).toMatch(/not decided yet/);
    expect(en.answer).not.toMatch(/gallery|hero|images included|unlimited|storage of|\d+ ?GB/i);
    const he = answer('מה כולל מסלול ויזואל?', true);
    expect(he.answer).toMatch(/ויזואל הם סגנונות הצגה של הצעת מחיר, לא מסלולי מנוי/);
    expect(he.answer).toMatch(/הכול כלול: 30\.00 ₪ לחודש או 306\.00 ₪ לשנה/);
    expect(he.answer).toMatch(/לא הוחלט/);
  });
  it('"what\'s the price in shekels on the English site?" -> USD only, never a shekel figure', () => {
    const en = answer("what's the price in shekels on the English site?", false);
    expect(en.answer).toMatch(/priced and billed in USD only/);
    expect(en.answer).toMatch(/All-inclusive: 18\.00 USD per month or 184\.00 USD per year\. Paying annually saves approximately 15% - 32\.00 USD per year/);
    expect(en.answer).not.toMatch(/₪|\bILS\b|\bNIS\b|shekel/i);
    expect(findSubscriptionClaimViolations(en.answer, false)).not.toContain('ILS_ON_INTERNATIONAL');
  });
  it('HE pricing: ILS including VAT, nothing added on top, no foreign currency', () => {
    const he = answer('כמה עולים המסלולים?', true);
    expect(he.answer).toMatch(/הכול כלול: 30\.00 ₪ לחודש או 306\.00 ₪ לשנה\. בתשלום שנתי החיסכון הוא 15% - 54\.00 ₪ בשנה\. המחירים כוללים מע״מ/);
    expect(he.answer).toMatch(/5\.00 ₪ לחודש/);
    expect(he.answer).not.toMatch(/\$|USD|דולר|\+ ?מע/);
  });
  it('annual: the approved annual price and saving (§249 + the $184 amendment)', () => {
    expect(answer('Is there an annual plan discount?', false).answer).toMatch(/184\.00 USD per year\. Paying annually saves approximately 15% - 32\.00 USD per year/);
    expect(answer('יש מנוי שנתי?', true).answer).toMatch(/306\.00 ₪ לשנה\. בתשלום שנתי החיסכון הוא 15% - 54\.00 ₪ בשנה/);
  });
  it('every deterministic answer is free of every retired claim class and says where purchase stands (Owner 2026-10-25: Israel open, abroad not yet)', () => {
    const MSGS = [["I'm on Pro, right?", false], ['how many days left in my trial?', false], ['is it unlimited?', false], ['what does the Visual plan include?', false],
      ["what's the price in shekels on the English site?", false], ['how many quotes can I send?', false], ['כמה עולה מסלול קלאסיק?', true], ['כמה הצעות אפשר לשלוח בחינם?', true],
      ['what plan am I on?', false], ['באיזה מסלול אני?', true]];
    for (const [m, he] of MSGS) {
      const r = answer(m, he);
      expect(r, m).toBeTruthy();
      expect(r.answer.replace(/there is no plan by the name you mentioned|אין מסלול בשם שציינת/, ''), m).not.toMatch(LEGACY);
      expect(r.answer, m).toMatch(he ? /את המנוי אפשר לרכוש בחלון המסלולים/ : /cannot be purchased yet for accounts outside Israel/);
    }
  });
  it('not a subscription question: quote content, item prices, cancellation (lifecycle truth keeps it), unlimited items', () => {
    for (const m of ['how do I set the price of an item?', 'What is the total price of this quote in shekels?', 'How do I cancel my subscription?', 'Can I add unlimited items to a quote?', 'איך מוסיפים לקוח?', 'מה המחיר של הפריט הזה?']) {
      expect(classifySubscriptionIntents(m), m).toEqual([]);
    }
  });
  it('public chat (no account) never states an account plan', () => {
    const r = resolveSubscriptionTruthResponse('what plan am I on?', false, null);
    expect(r.answer).toMatch(/I don't have account information in this conversation/);
    expect(accountPlanLine(null, 'he')).toMatch(/אין לי מידע על חשבון/);
  });
});

describe('model answer gate: retired / unapproved plan truth is rejected', () => {
  it.each([
    ['The Pro plan includes unlimited quotes.', false, ['LEGACY_PLAN_NAME', 'UNLIMITED_CLAIM']],
    ['You are on the Basic plan.', false, ['LEGACY_PLAN_NAME']],
    ['Start your 14-day free trial today.', false, ['TRIAL_CLAIM']],
    ['The Free plan gives you 5 quotes per month.', false, ['MONTHLY_QUOTE_LIMIT']],
    ['You have used 3/5 quotes this month.', false, ['MONTHLY_QUOTE_LIMIT']],
    ['Classic costs $15 per month.', false, ['UNAPPROVED_PRICE']],
    ['The Visual plan is 69 ILS per month.', false, ['ILS_ON_INTERNATIONAL']], // an IL figure on the International side
    ['The Visual plan is 120 ILS per month.', false, ['UNAPPROVED_PRICE', 'ILS_ON_INTERNATIONAL']],
    ['The annual plan saves 20%.', false, ['UNAPPROVED_SAVING']],
    ['The annual plan costs 183.60 USD per year.', false, ['UNAPPROVED_PRICE']], // the retired figure
    ['מסלול פרו כולל הצעות ללא הגבלה.', true, ['LEGACY_PLAN_NAME', 'UNLIMITED_CLAIM']],
    ['תקופת ניסיון של 14 יום כוללת גישה מלאה.', true, ['TRIAL_CLAIM']],
    ['מסלול חינם כולל 5 הצעות מחיר בחודש.', true, ['MONTHLY_QUOTE_LIMIT']],
    ['מסלול קלאסיק עולה ₪49 לחודש.', true, ['UNAPPROVED_PRICE']], // Task 27: 49 was a retired style-plan price
    ['מסלול קלאסיק עולה ₪99 לחודש.', true, ['UNAPPROVED_PRICE']],
  ])('%s -> %j', (text, he, codes) => {
    const v = findSubscriptionClaimViolations(text, he);
    for (const c of codes) expect(v, text).toContain(c);
    if (!codes.length) expect(v).toEqual([]);
  });
  it('clean answers pass: quote totals, quote currencies, unrelated "per year" finance figures, approved prices', () => {
    for (const [t, he] of [['Your quote total is $1,250.00 and it was sent yesterday.', false], ['You can create quotes in USD, EUR or GBP.', false],
      ['Your income this year was $40,000 per year on average.', false], ['The All-inclusive package costs 18.00 USD per month or 184.00 USD per year.', false],
      ['Paying annually saves approximately 15% - 32.00 USD per year.', false],
      ['מסלול הכול כלול עולה 30.00 ₪ לחודש או 306.00 ₪ לשנה.', true], ['בתשלום שנתי החיסכון הוא 15% - 54.00 ₪ בשנה.', true], ['סכום ההצעה הוא ₪1,250.', true]]) {
      expect(findSubscriptionClaimViolations(t, he), t).toEqual([]);
    }
  });
  it('the safe replacement answer is itself canonical (approved prices, Free-10, not active)', () => {
    const en = safeSubscriptionAnswer(false, NOT_ACTIVATED);
    expect(en).toMatch(/All-inclusive: 18\.00 USD per month or 184\.00 USD per year/); expect(en).toMatch(/10 quotes in total/); expect(en).toMatch(/not active/);
    expect(en).not.toMatch(LEGACY);
    const he = safeSubscriptionAnswer(true, null);
    expect(he).toMatch(/30\.00 ₪ לחודש או 306\.00 ₪ לשנה/); expect(he).not.toMatch(/\$|USD/);
  });
});

describe('prompt block + request boundary', () => {
  it('the subscription prompt block forbids every retired claim class and lists the not-decided values', () => {
    const b = buildSubscriptionTruthBlock(false);
    expect(b).toMatch(/there is no Basic, Pro or Premium plan\. A Lifetime subscription is not a plan for purchase/);
    expect(b).toMatch(/There is NO separate trial/);
    expect(b).toMatch(/NOT DECIDED/);
    expect(b).toMatch(/In THIS \(international\) context purchase is NOT open yet/);
    expect(b).not.toMatch(/CAN be bought/);
    expect(buildSubscriptionTruthBlock(true)).toMatch(/In THIS \(Israeli\) context the package \(and SMART PACK\) CAN be bought/);
    expect(buildSubscriptionTruthBlock(false)).not.toMatch(/₪\d|\d\s*₪/);
  });
  it('plan fields in the request body are dropped by the request validator (never authority)', () => {
    const r = validateChatRequest({ messages: [{ role: 'user', content: 'hi' }], plan: 'pro', tier: 'pro', accountSummary: { ok: true, plan: { id: 'visual' } }, trialEndsAt: '2099-01-01' });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.value)).not.toMatch(/pro|visual|trial|accountSummary/);
  });
  it('index.ts fetches the summary with the caller\'s own JWT client, reads no legacy plan column and gates model answers', () => {
    expect(indexSource).toMatch(/accountSummary = await fetchServerAccountSummary\(\(fn\) => callerClient\.rpc\(fn\)\);/);
    expect(indexSource).toMatch(/\.select\('role, country, phone, tax_id, is_lifetime'\)/);
    expect(indexSource).not.toMatch(/trial_ends_at|monthStartIso|monthlyUsed/);
    // Owner console 2026-10-26 (typed item ו; L-06 / L-11 / L-17): the reply language is the interface language, the market is the account's
    expect(indexSource).toMatch(/const subscription = resolveSubscriptionTruthResponse\(lastUserMessage, isHebrew, verifiedUserId && accountContext \? accountContext\.account : null, marketIL\);/);
    expect(indexSource).toMatch(/const subscriptionViolations = findSubscriptionClaimViolations\(extracted\.answer, marketIL\);/);
    // the subscription router runs after payment/invoicing and before the account-market and capability routers
    const iPay = indexSource.indexOf('if (asksInvoicing || asksPayment)');
    const iSub = indexSource.indexOf('const subscription = resolveSubscriptionTruthResponse');
    const iMarket = indexSource.indexOf('classifyAccountMarketIntent(lastUserMessage)');
    // smart chat 2026-10-19 (L-17): own-data questions skip only the specific capability classifier - the router order is unchanged
    const iCap = indexSource.indexOf('const capabilityId = ownDataQuestion ? null : classifyCapabilityIntent(lastUserMessage);');
    expect(iCap).toBeGreaterThan(0);
    expect(iPay).toBeLessThan(iSub); expect(iSub).toBeLessThan(iMarket); expect(iSub).toBeLessThan(iCap);
  });
});

// Task 40 (Owner, LIVE chat 2026-10-15): "איזה מסלולים יש לכם" got the broad "which feature?" clarification instead of the plans.
describe('plans-list question -> the deterministic pricing answer', () => {
  it.each([
    ['איזה מסלולים יש לכם', true], ['איזה מסלולים יש', true], ['מה המסלולים?', true], ['אילו חבילות יש?', true], ['יש לכם מסלולים?', true],
    ['What plans do you have?', false], ['which plans are there', false], ['Do you offer any subscriptions?', false], ['what kinds of plans exist?', false],
  ])('%s', (m, he) => {
    expect(classifySubscriptionIntents(m)).toContain('pricing');
    const r = answer(m, he);
    if (he) {
      expect(r.answer).toMatch(/המסלולים הם/);
      expect(r.answer).toMatch(/30\.00 ₪ לחודש או 306\.00 ₪ לשנה/);
      expect(r.answer).not.toMatch(/\$|USD|דולר/);
    } else {
      expect(r.answer).toMatch(/The plans are/);
      expect(r.answer).toMatch(/18\.00 USD per month or 184\.00 USD per year/);
      expect(r.answer).not.toMatch(/₪|\bILS\b|\bNIS\b|shekel/i);
    }
    expect(r.answer).toMatch(he ? /את המנוי אפשר לרכוש בחלון המסלולים/ : /cannot be purchased yet for accounts outside Israel/);
  });
  it("the account's own plan stays my_plan (singular: which plan am I on / do I have)", () => {
    for (const [m] of [['באיזה מסלול אני?'], ['איזה מסלול יש לי?'], ['which plan am I on?']]) {
      expect(classifySubscriptionIntents(m), m).toContain('my_plan');
      expect(classifySubscriptionIntents(m), m).not.toContain('pricing');
    }
  });
});
