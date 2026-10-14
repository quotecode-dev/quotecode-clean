// Task 39: the Production chat plan truth - numbers pinned to the approved catalog, intent routing (plan questions only; a quote-pricing
// question stays with the model), the retired Basic / Pro price guard, the prompt block, and the wiring in index.ts / validation.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_DISPLAY, publicPlanTruthAnswer, classifyPublicPlanIntent, hasRetiredPlanPriceClaim } from './publicPlanTruth.ts';
import { buildSystemPrompt } from './validation.ts';
import { packagePrice, annualSavingMinor, ANNUAL_DISCOUNT_PERCENT } from '../../../src/domain/subscriptions/packageCatalog.js';
import { AI_FACTS } from './aiFacts.generated.ts';

const here = (f) => readFileSync(join(import.meta.dirname, f), 'utf8');

describe('numbers = the approved package catalog (no drift)', () => {
  it.each([['IL'], ['INTERNATIONAL']])('%s', (market) => {
    const d = PACKAGE_DISPLAY[market];
    expect(d.month).toBe(packagePrice(market, 'month').amountMinor / 100);
    expect(d.year).toBe(packagePrice(market, 'year').amountMinor / 100);
    expect(d.saving).toBe(annualSavingMinor(market) / 100);
    expect(d.savingPercent).toBe(ANNUAL_DISCOUNT_PERCENT);
  });
});

describe('the answer', () => {
  it('HE: package, VAT, information only, no purchase / payment, Free-10 not active, terms at sign-up, rights unchanged', () => {
    const a = publicPlanTruthAnswer(true);
    for (const s of ['₪30 לחודש', '₪306 לשנה', 'כוללים מע״מ', '₪54', 'לידיעה בלבד', 'אי אפשר לרכוש מנוי או לשלם', 'מסלול 10 ההצעות החינמיות עדיין לא הופעל', 'מוצגים בתהליך ההרשמה', 'זכויות קיימות']) expect(a).toContain(s);
    expect(a).not.toMatch(/\$|Basic|Pro\b|בסיסי|פרו\b/);
  });
  it('EN: $18 / $184, no shekel, no Basic / Pro', () => {
    const a = publicPlanTruthAnswer(false);
    for (const s of ['$18 per month', '$184 per year', '$32', 'information only', 'cannot be purchased', 'not active yet', 'when you sign up', 'existing account rights']) expect(a).toContain(s);
    expect(a).not.toMatch(/₪|NIS|Basic|\bPro\b/);
  });
});

describe('intent routing', () => {
  it.each([
    'כמה עולה המנוי?', 'מה המחירים של המסלולים?', 'איך אני משדרג לפרו?', 'אפשר לקנות מנוי שנתי?', 'איך עובדות 10 ההצעות החינמיות?', 'יש תקופת ניסיון חינם?',
    'How much is the subscription?', 'What are your plans and prices?', 'Can I buy the Pro plan?', 'How do the 10 free quotes work?', 'Is there a free trial?', 'How much does TEKANGO cost?',
  ])('plan question -> truth: %s', (q) => expect(classifyPublicPlanIntent(q)).toBe(true));
  it.each([
    'איך מוסיפים מחיר לפריט בהצעה?', 'how do I set the price of an item?', 'what should I charge per square meter?', 'איך שולחים הצעה ללקוח?', 'How do I add my logo?', '',
  ])('not a plan question -> model: %s', (q) => expect(classifyPublicPlanIntent(q)).toBe(false));
});

describe('retired Basic / Pro price guard', () => {
  const il = AI_FACTS.pricing.il.plans; const usd = AI_FACTS.pricing.usd.plans;
  it('a retired price is caught (derived from AI_FACTS, both markets)', () => {
    expect(hasRetiredPlanPriceClaim(`המסלול הבסיסי עולה ₪${il.basic.monthly} לחודש`)).toBe(true);
    expect(hasRetiredPlanPriceClaim(`Pro is $${usd.pro.monthly}/mo`)).toBe(true);
    expect(hasRetiredPlanPriceClaim(`${il.pro.monthly} ש"ח`)).toBe(true);
  });
  it('the approved prices, quote amounts and plan-free text pass', () => {
    expect(hasRetiredPlanPriceClaim(publicPlanTruthAnswer(true))).toBe(false);
    expect(hasRetiredPlanPriceClaim(publicPlanTruthAnswer(false))).toBe(false);
    expect(hasRetiredPlanPriceClaim('Your quote total is $1,250.00 including the tiles.')).toBe(false);
    expect(hasRetiredPlanPriceClaim('להוספת פריט לחצו על הוספת מוצר או עבודה.')).toBe(false);
  });
});

describe('wiring', () => {
  it('the prompt carries the package truth (both markets) and none of the retired Basic / Pro / trial lines', () => {
    const he = buildSystemPrompt({ isHebrew: true }); const en = buildSystemPrompt({ isHebrew: false });
    expect(he).toContain(publicPlanTruthAnswer(true)); expect(en).toContain(publicPlanTruthAnswer(false));
    expect(he).not.toContain(`₪${AI_FACTS.pricing.il.plans.basic.monthly} לחודש`); expect(en).not.toMatch(/Basic: \$/);
    expect(en).not.toMatch(/day free trial gives full PRO access/);
  });
  it('index.ts: the plan truth runs after payment / invoicing and before the model; the model answer passes the guard', () => {
    const s = here('index.ts');
    expect(s.indexOf('classifyPublicPlanIntent(lastUserMessage)')).toBeGreaterThan(s.indexOf('resolvePaymentTruthResponse(isHebrew'));
    expect(s.indexOf('classifyPublicPlanIntent(lastUserMessage)')).toBeLessThan(s.indexOf("fetch('https://api.openai.com/v1/chat/completions'"));
    expect(s).toContain('const answer = hasRetiredPlanPriceClaim(extracted.answer) ? publicPlanTruthAnswer(isHebrew) : extracted.answer;');
  });
});
