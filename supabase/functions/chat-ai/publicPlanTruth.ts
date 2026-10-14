// Task 39 (Owner, 2026-10-13): the public / app chat on Production answers plans, prices, purchase, Free-10 and trial questions with the
// Owner-approved state of the product - one all-inclusive package, shown for information only (IL ₪30 / month or ₪306 / year incl. VAT,
// saving ₪54 = 15%; International $18 / month or $184 / year, saving $32 ≈ 15%), not purchasable yet, no online payment, Free-10 not
// active, the account terms available today are shown at sign-up, existing account rights unchanged. No subscription / billing / Free-10 /
// enforcement is activated by this file and no AI capability is added (Task 39 final scope: the same meaning as the landing / plans window -
// USD billing with a GBP / EUR figure only as an estimate, and the email cancellation-request path): it only answers truthfully and stops the model from quoting the
// retired Basic / Pro display prices. The package numbers are pinned to src/domain/subscriptions/packageCatalog.js by
// publicPlanTruth.test.js (a drift fails the test); the retired numbers are derived from AI_FACTS (never typed here).
import { AI_FACTS } from "./aiFacts.generated.ts";

export const PACKAGE_DISPLAY = Object.freeze({
  IL: Object.freeze({ month: 30, year: 306, saving: 54, savingPercent: 15, symbol: '₪' }),
  INTERNATIONAL: Object.freeze({ month: 18, year: 184, saving: 32, savingPercent: 15, symbol: '$' }),
});

export function publicPlanTruthAnswer(isHebrew: boolean): string {
  if (isHebrew) {
    const p = PACKAGE_DISPLAY.IL;
    return `המסלולים החדשים של TEKANGO עדיין לא הופעלו. החבילה החדשה היא חבילה אחת שכוללת הכול: ${p.symbol}${p.month} לחודש או ${p.symbol}${p.year} לשנה (המחירים כוללים מע״מ; בתשלום שנתי חוסכים ${p.symbol}${p.saving}, ${p.savingPercent}%). המחירים מוצגים לידיעה בלבד: עדיין אי אפשר לרכוש מנוי או לשלם באתר. מסלול 10 ההצעות החינמיות עדיין לא הופעל. תנאי החשבון הזמינים כעת מוצגים בתהליך ההרשמה, וזכויות קיימות של חשבונות אינן משתנות. כשהרכישה תיפתח, אפשר יהיה לבקש ביטול מנוי בכל עת במייל, לפי תנאי הביטול וההחזרים שבתנאי השימוש.`;
  }
  const p = PACKAGE_DISPLAY.INTERNATIONAL;
  return `The new TEKANGO plans are not active yet. The new offer is one all-inclusive package: ${p.symbol}${p.month} per month or ${p.symbol}${p.year} per year (paying yearly saves ${p.symbol}${p.saving}, about ${p.savingPercent}%). Prices are shown for information only: subscriptions cannot be purchased and there is no online payment yet. The 10-free-quotes plan is not active yet. The account terms available today are shown when you sign up, and existing account rights do not change. Billing is in US dollars; where the website shows pounds or euros, that figure is only an estimate. Once purchase opens, you will be able to ask to cancel a subscription at any time by email, under the cancellation and refund terms in the Terms of Service.`;
}

// Questions about plans / prices / purchase / Free-10 / trial. A quote-pricing question ("how do I price this item") is NOT one:
// a price word alone never qualifies - it needs a plan / subscription word, a purchase word, a Free-10 or a trial phrase.
const PLAN_WORD = /(מסלול|מסלולים|מנוי|חבילה|חבילות|תוכנית|תכנית|\bplans?\b|subscription|\bpackages?\b|\btiers?\b)/i;
const PRICE_WORD = /(מחיר|מחירים|עולה|עולים|עלות|תשלום|לשלם|price|prices|pricing|cost|costs|how much|\bpay\b)/i;
const BUY_WORD = /(לקנות|קונה|לרכוש|רוכש|רכישה|לשדרג|משדרג|שדרוג|להירשם למנוי|\bbuy\b|purchase|upgrade|subscribe)/i;
const FREE10 = /(10 ה?הצעות|עשר ה?הצעות|הצעות (מחיר )?חינם|ה?הצעות ה?חינמיות|מסלול חינם|free[- ]?10|10 free|free quotes|free plan)/i;
const TRIAL = /(ניסיון|trial)/i;
const NAMED_TIER = /(\bbasic\b|\bpro\b|בייסיק|בסיסי|(^|[^א-ת])[לבה]?פרו([^א-ת]|$))/i;
export function classifyPublicPlanIntent(message: unknown): boolean {
  const m = typeof message === 'string' ? message : '';
  if (!m.trim()) return false;
  if (FREE10.test(m)) return true;
  if (PLAN_WORD.test(m) && (PRICE_WORD.test(m) || BUY_WORD.test(m) || TRIAL.test(m))) return true;
  if (BUY_WORD.test(m) && (PLAN_WORD.test(m) || NAMED_TIER.test(m) || /(tekango|טקנגו)/i.test(m))) return true;
  if (NAMED_TIER.test(m) && (PRICE_WORD.test(m) || PLAN_WORD.test(m))) return true;
  if (TRIAL.test(m) && /(חינם|free|tekango|טקנגו|חשבון|account)/i.test(m)) return true;
  return /(כמה (עולה|עולים|זה עולה)|how much (is|does|for)) ?(tekango|טקנגו|the app|האפליקציה|המערכת|the service|השירות)/i.test(m);
}

// The retired Basic / Pro display numbers, per currency, from AI_FACTS (what the model was taught before) - minus every approved number.
function retiredNumbers(): { ils: Set<number>; usd: Set<number> } {
  const pick = (market: { plans?: Record<string, Record<string, unknown>> } | undefined) => {
    const out = new Set<number>();
    for (const plan of ['basic', 'pro']) for (const v of Object.values(market?.plans?.[plan] ?? {})) if (typeof v === 'number' && v > 0) out.add(v);
    return out;
  };
  // deno-lint-ignore no-explicit-any
  const pricing = (AI_FACTS as any).pricing ?? {};
  const ils = pick(pricing.il); const usd = pick(pricing.usd);
  for (const n of Object.values(PACKAGE_DISPLAY.IL)) if (typeof n === 'number') ils.delete(n);
  for (const n of Object.values(PACKAGE_DISPLAY.INTERNATIONAL)) if (typeof n === 'number') usd.delete(n);
  return { ils, usd };
}
const RETIRED = retiredNumbers();

// Does a model answer present a retired plan price or a Basic / Pro plan as purchasable at a price? (then the truth answer replaces it)
export function hasRetiredPlanPriceClaim(answer: unknown): boolean {
  const a = typeof answer === 'string' ? answer : '';
  for (const m of a.matchAll(/(₪|\$|USD|NIS)\s?(\d+(?:\.\d+)?)/g)) {
    const n = Number(m[2]); if ((m[1] === '₪' || m[1] === 'NIS') ? RETIRED.ils.has(n) : RETIRED.usd.has(n)) return true;
  }
  for (const m of a.matchAll(/(\d+(?:\.\d+)?)\s?(₪|ש"ח|ש״ח|שקל|NIS|USD|dollars?)/g)) {
    const n = Number(m[1]); if (/^(₪|ש"ח|ש״ח|שקל|NIS)$/.test(m[2]) ? RETIRED.ils.has(n) : RETIRED.usd.has(n)) return true;
  }
  return /(\bbasic\b|\bpro\b)[^.\n]{0,40}(\$|₪|\/mo|per month|a month)/i.test(a) || /(בסיסי|בייסיק|(^|[^א-ת])[לבה]?פרו([^א-ת]|$))[^.\n]{0,40}(₪|לחודש)/.test(a);
}
