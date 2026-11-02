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
  // Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, ... L-22"): SMART PACK is bought abroad too (the card box,
  // the add-on offer) - the item ד information line is gone in every market and language; abroad the renewing total is in USD
  it('item ד retired: no abroad SMART PACK line; the USD add-on rows carry their renewing total (HE + EN)', () => {
    for (const isHebrew of [true, false]) {
      for (const [accountCurrency, estimateRate] of [['GBP', rate()], ['USD', null], ['EUR', null]]) {
        expect(pricingModalModel({ isHebrew, market: 'INTERNATIONAL', accountCurrency, estimateRate }).smartPackAbroad).toBeNull();
      }
    }
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'USD' }).plans[1].addOn.perPeriod.month.total).toBe('Including SMART PACK: $23.00 / month');
    expect(pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'USD' }).plans[1].addOn.perPeriod.year.total).toBe('כולל חכם פלוס: $235.00 לשנה');
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
