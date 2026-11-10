// Owner console 2026-11-10 ("למה אתה לא מתקן הכל ביחד"): the plans window abroad with a local-currency estimate and the SMART PACK box
// ticked showed "$23.00 GBP / month · estimate" and "Charged in USD: $18.00 per month". Ticked, the main price is the ESTIMATE of the
// total (package + add-on) under the same estimate label, and the charged line is the USD total with SMART PACK - Hebrew and English alike.
import { describe, it, expect } from 'vitest';
import { pricingModalModel } from './domain/subscriptions/pricingModalModel';

const rate = () => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(Date.now() - 3600 * 1000).toISOString(), source: 'ExchangeRate-API' });

describe.each([[false], [true]])('isHebrew=%s', (isHebrew) => {
  const m = pricingModalModel({ isHebrew, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
  const pkg = m.plans.find((p) => p.id === 'all_inclusive');
  it('ticked: the main price is the GBP estimate of package + SMART PACK (never a USD figure under the GBP label)', () => {
    expect(pkg.addOn.perPeriod.month.amount).toBe('≈£17.41');
    expect(pkg.addOn.perPeriod.year.amount).toBe('≈£177.90');
    for (const p of ['month', 'year']) expect(pkg.addOn.perPeriod[p].amount).not.toMatch(/\$/);
  });
  it('ticked: the charged line is the USD total WITH SMART PACK; unticked rows are unchanged', () => {
    expect(pkg.addOn.perPeriod.month.note).toBe(isHebrew ? 'החיוב בדולר ארה״ב: $23.00 לחודש' : 'Charged in USD: $23.00 per month');
    expect(pkg.addOn.perPeriod.year.note).toMatch(isHebrew ? /^החיוב בדולר ארה״ב: \$235\.00 לשנה/ : /^Charged in USD: \$235\.00 per year/);
    expect(pkg.prices.find((r) => r.period === 'month').note).toBe(isHebrew ? 'החיוב בדולר ארה״ב: $18.00 לחודש' : 'Charged in USD: $18.00 per month');
    expect(pkg.prices.find((r) => r.period === 'month').amount).toBe('≈£13.63');
  });
});

describe('no estimate (USD account, Israel): the add-on keeps its own amounts and no charged-line override', () => {
  it('USD account: ticked shows the USD total, no note override', () => {
    const pkg = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'USD', estimateRate: rate() }).plans.find((p) => p.id === 'all_inclusive');
    expect(pkg.addOn.perPeriod.month.amount).toBe('$23.00');
    expect(pkg.addOn.perPeriod.month.note).toBeUndefined();
  });
  it('Israel: no override', () => {
    const pkg = pricingModalModel({ isHebrew: true, market: 'IL', accountCurrency: 'ILS', estimateRate: null }).plans.find((p) => p.id === 'all_inclusive');
    expect(pkg.addOn.perPeriod.month.note).toBeUndefined();
  });
});
