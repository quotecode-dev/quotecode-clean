// LANDING FIRST-LIVE TRUTH GATE (Phase J, 2026-09-22). Owner decisions: PRICING DISPLAY KEEP · ANNUAL PLAN KEEP · 14-DAY FREE TRIAL KEEP.
// Unsupported claims stay removed: timed guarantees, statistical popularity, current invoicing, card processing, broad International
// tax compliance, instant notifications, autonomous AI. The in-app plan comparison uses the same canonical price catalog.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
// visible copy only: strip // and {/* */} comments so historical notes about removed claims do not count
const visible = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const he = visible(read('src/pages/LandingLocal.jsx'));
const en = visible(read('src/pages/LandingGlobal.jsx'));
const modal = visible(read('src/components/PricingModal.jsx'));
const html = read('index.html');

const FORBIDDEN = [
  [/תוך דקה|בדקה\b|משלוש דקות|מוכנה תוך דקות/, 'HE timed guarantee'],
  [/in a minute|in minutes|Quotes in Minutes/i, 'EN timed guarantee'],
  [/הפופולרי ביותר|Most Popular|'POPULAR'/, 'statistical popularity badge'],
  [/עדכון מיידי|notified instantly|Instant digital signature/i, 'instant notification / instant approval promise'],
  [/automated tax handling|automate tax calculations|Taxes calculated automatically|international standards with clear tax/i, 'broad International tax claim'],
  [/מע"מ 18% כחוק/, 'legal-compliance assertion'],
  [/invoic|חשבונית|קבלה דיגיטלית/i, 'current invoicing capability'],
  [/accept card|card payments|get paid online|סליקה|תשלום באשראי זמין/i, 'card processing'],
  [/AI (sends|writes|negotiates|collects)|ה-AI (שולח|כותב|גובה)/i, 'autonomous AI action'],
];

describe('landing truth gate', () => {
  for (const [name, src] of [['HE landing', he], ['EN landing', en], ['in-app PricingModal', modal]]) {
    for (const [re, what] of FORBIDDEN) {
      it(`${name}: no ${what}`, () => { expect(src.match(re)?.[0] ?? null).toBeNull(); });
    }
  }
  it('static index.html fallback claims no invoicing', () => {
    expect(html).not.toMatch(/Invoicing/i);
  });

  it('KEEP: plan prices, the annual plan and the 14-day no-card trial stay visible (HE + EN)', () => {
    expect(he).toMatch(/מסלול שנתי/);
    expect(he).toMatch(/14 יום ניסיון PRO מלא, ללא כרטיס אשראי/);
    expect(he).toMatch(/basicPricing\.monthlyRate/);
    expect(en).toMatch(/Annual Billing/);
    expect(en).toMatch(/14-day full PRO trial, no credit card required/);
    expect(en).toMatch(/Paid upgrades and online checkout are not currently available/);
    expect(he).toMatch(/שדרוג למסלול בתשלום ותשלום מקוון אינם זמינים כרגע/);
  });

  it('signup CTAs start the free trial (no pay-now path)', () => {
    expect(he).toMatch(/\/dashboard\?signup=true&lang=he/);
    expect(en).toMatch(/\/dashboard\?signup=true&lang=en/);
    expect(`${he}${en}`).not.toMatch(/Pay now|Buy now|Subscribe now|שלם עכשיו|קנה עכשיו|לתשלום עכשיו/i);
  });

  it('the in-app comparison uses the canonical price catalog (no second, contradicting price list)', () => {
    expect(modal).toMatch(/PRICING_CATALOG\.global\.usd/);
    expect(modal).not.toMatch(/\? 39\)|: 89\)|upperCurr === 'EUR' \? 35/);
  });
});
