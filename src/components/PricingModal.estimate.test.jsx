// Task 39 (Owner final scope): the plans window uses the same rate source + meaning as the landing - an International account whose
// identified currency is GBP / EUR sees a labelled estimate (or the true "not available" notice); billing / shown package amounts stay USD;
// Local accounts never fetch a rate. The cancellation-request path is a mailto to the market's service mailbox, never an automatic action.
import { describe, it, expect } from 'vitest';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';

const rate = (over = {}) => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(Date.now() - 3600 * 1000).toISOString(), source: 'ExchangeRate-API', ...over });

describe('plans window estimate + cancellation path', () => {
  // Owner console 2026-10-26 (typed L-01 / L-22, item ג): the card's main price is the account currency (estimate) + the USD amount charged
  it('International GBP account: the card price in GBP (estimate) with the USD charge on the row + the labelled estimate line', () => {
    const m = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
    expect(m.plans[1].prices.map((p) => p.amount)).toEqual(['≈£13.63', '≈£139.29']);
    expect(m.plans[1].prices.map((p) => p.per)).toEqual(['GBP / month · estimate', 'GBP / year · estimate']);
    expect(m.plans[1].prices[0].note).toBe('Charged in USD: $18.00 per month');
    expect(m.plans[1].prices[1].note).toMatch(/^Charged in USD: \$184\.00 per year\. Save /);
    expect(m.priceNote).toBe('Prices on the card are an estimate in GBP. Charged in USD.');
    const he = pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
    expect(he.plans[1].prices[0]).toMatchObject({ amount: '≈£13.63', per: 'GBP / חודש · הערכה', note: 'החיוב בדולר ארה״ב: $18.00 לחודש' });
    expect(he.priceNote).toBe('המחירים בכרטיס הם הערכה ב-GBP. החיוב בדולר ארה״ב.');
    expect(m.estimateNote).toMatch(/^Estimate in GBP only: about £13\.63 per month or £139\.29 per year at the ExchangeRate-API rate of \d{4}-\d{2}-\d{2}\. Charged in USD\.$/);
  });
  it('item ד: abroad SMART PACK is an information line in the same currency (no box, no button); none in Israel (HE + EN)', () => {
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() }).smartPackAbroad)
      .toBe('SMART PACK: ≈£3.79 a month or ≈£38.61 a year on top of your plan (estimate; charged in USD: $5.00 / $51.00). Buying it outside Israel opens soon.');
    expect(pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() }).smartPackAbroad)
      .toBe('חכם פלוס: ≈£3.79 לחודש או ≈£38.61 לשנה בתוספת למנוי (הערכה; החיוב בדולר ארה״ב: $5.00 / $51.00). הרכישה מחוץ לישראל תיפתח בקרוב.');
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'USD' }).smartPackAbroad)
      .toBe('SMART PACK: $5.00 a month or $51.00 a year on top of your plan, in USD. Buying it outside Israel opens soon.');
    expect(pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'EUR', estimateRate: null }).smartPackAbroad)
      .toBe('חכם פלוס: $5.00 לחודש או $51.00 לשנה בתוספת למנוי, בדולר ארה״ב. הרכישה מחוץ לישראל תיפתח בקרוב.');
    expect(pricingModalModel({ isHebrew: true, market: 'IL' }).smartPackAbroad).toBeNull();
    // the account card stays USD without a valid rate
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'EUR', estimateRate: null }).plans[1].prices.map((p) => p.amount)).toEqual(['$18.00', '$184.00']);
  });
  it('a missing / stale / other-currency rate -> the true notice, never a converted figure', () => {
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'EUR', estimateRate: null }).estimateNote).toBe('A EUR estimate is not available right now, so prices are shown in US dollars.');
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'EUR', estimateRate: rate() }).estimateNote).toMatch(/not available/);
    expect(pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate({ asOf: '2020-01-01T00:00:00Z' }) }).estimateNote).toMatch(/אינה זמינה כרגע/);
  });
  it('USD / Local accounts: no estimate line at all', () => {
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'USD', estimateRate: rate() }).estimateNote).toBeNull();
    expect(pricingModalModel({ isHebrew: true, market: 'IL', accountCurrency: 'GBP', estimateRate: rate() }).estimateNote).toBeNull();
  });
  it('cancellation request: the market mailbox, a request (not automatic), and the terms anchor', () => {
    const il = pricingModalModel({ isHebrew: true, market: 'IL' }).cancellation;
    const intl = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL' }).cancellation;
    expect(il.href).toMatch(/^mailto:support@tekango\.com\?subject=/); expect(il.termsHref).toBe('/he/terms#cancellation'); expect(il.text).toMatch(/אינו ביטול אוטומטי/);
    expect(intl.href).toMatch(/^mailto:info@tekango\.com\?subject=/); expect(intl.termsHref).toBe('/en/terms#cancellation'); expect(intl.text).toMatch(/not an automatic cancellation/);
  });
});
