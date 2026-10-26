// Task 39 (Owner final scope): the plans window uses the same rate source + meaning as the landing - an International account whose
// identified currency is GBP / EUR sees a labelled estimate (or the true "not available" notice); billing / shown package amounts stay USD;
// Local accounts never fetch a rate. The cancellation-request path is a mailto to the market's service mailbox, never an automatic action.
import { describe, it, expect } from 'vitest';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';

const rate = (over = {}) => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(Date.now() - 3600 * 1000).toISOString(), source: 'ExchangeRate-API', ...over });

describe('plans window estimate + cancellation path', () => {
  it('International GBP account: USD package amounts + a labelled GBP estimate with source and date', () => {
    const m = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
    expect(m.plans[1].prices.map((p) => p.amount)).toEqual(['$18.00', '$184.00']);
    expect(m.estimateNote).toMatch(/^Estimate in GBP only: about £13\.63 per month or £139\.29 per year at the ExchangeRate-API rate of \d{4}-\d{2}-\d{2}\. Charged in USD\.$/);
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
