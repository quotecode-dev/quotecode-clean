// IRON-ILS-001 amendment (Owner console 2026-10-23, typed): in a quote in shekels the agorot after the discount go to the discount -
// the amount after the discount is a whole shekel, and the items total minus the discount always equals the total. Other currencies,
// and a call without a currency (a saved quote that is not recalculated), are unchanged.
import { describe, it, expect } from 'vitest';
import { calculateQuoteFinancials } from './regionConfig';

const levi = { country: 'Local', clientType: 'private', taxRateOverride: 0.18, discount: 5,
  items: [{ quantity: 1, unit_price: 1350 }, { quantity: 6.58, unit_price: 180 }, { quantity: 1, unit_price: 4200 }, { quantity: 2, unit_price: 650 }, { quantity: 1, unit_price: 2400 }] };
const shown = (n) => Math.round(n);

describe('ILS: the rounding difference goes to the discount', () => {
  it('the Levi quote (private, 5%): 10,434.40 - 522.40 = 9,912 - and the shown 10,434 - 522 = 9,912', () => {
    const r = calculateQuoteFinancials({ ...levi, currency: 'ILS' });
    expect(r.enteredSubtotal).toBe(10434.4);
    expect(r.discountAmount).toBe(522.4);
    expect(r.roundingAdjustment).toBe(0.68);
    expect(r.total).toBe(9912);
    expect(shown(r.enteredSubtotal) - shown(r.discountAmount)).toBe(shown(r.total));
  });
  it('business: the amount BEFORE VAT is whole; VAT is computed on it', () => {
    const r = calculateQuoteFinancials({ country: 'Local', clientType: 'business', taxRateOverride: 0.18, discount: 5, currency: 'ILS', items: [{ quantity: 1, unit_price: 10430 }] });
    expect(r.netAmount).toBe(9908); // 9,908.50 -> 9,908
    expect(r.discountAmount).toBe(522);
    expect(r.taxAmount).toBe(1783.44);
    expect(r.total).toBe(11691.44);
    expect(shown(r.enteredSubtotal) - shown(r.discountAmount)).toBe(r.netAmount);
  });
  it('no discount: the agorot are a rounding discount (shown only once it changes the shown sum)', () => {
    const a = calculateQuoteFinancials({ country: 'Local', clientType: 'private', taxRateOverride: 0.18, discount: 0, currency: 'ILS', items: [{ quantity: 6.58, unit_price: 180 }] });
    expect(a).toMatchObject({ enteredSubtotal: 1184.4, discountAmount: 0.4, total: 1184 });
    const b = calculateQuoteFinancials({ country: 'Local', clientType: 'private', taxRateOverride: 0.18, discount: 0, currency: 'ILS', items: [{ quantity: 6.59, unit_price: 180 }] });
    expect(b).toMatchObject({ enteredSubtotal: 1186.2, discountAmount: 0.2, total: 1186 });
    const c = calculateQuoteFinancials({ country: 'Local', clientType: 'private', taxRateOverride: 0.18, discount: 0, currency: 'ILS', items: [{ quantity: 1, unit_price: 99.6 }] });
    expect(c).toMatchObject({ discountAmount: 0.6, total: 99 });
    expect(shown(c.enteredSubtotal) - shown(c.discountAmount)).toBe(c.total); // 100 - 1 = 99
  });
  it('a whole amount is untouched', () => {
    expect(calculateQuoteFinancials({ ...levi, discount: 0, currency: 'ILS', items: [{ quantity: 2, unit_price: 650 }] })).toMatchObject({ discountAmount: 0, roundingAdjustment: 0, total: 1300 });
  });
  it('International and calls without a currency are exactly as before', () => {
    const usd = calculateQuoteFinancials({ country: 'International', clientType: 'business', discount: 5, currency: 'USD', items: [{ quantity: 6.58, unit_price: 180 }] });
    expect(usd).toMatchObject({ enteredSubtotal: 1184.4, discountAmount: 59.22, total: 1125.18, roundingAdjustment: 0 });
    const legacy = calculateQuoteFinancials(levi);
    expect(legacy).toMatchObject({ discountAmount: 521.72, total: 9912.68, roundingAdjustment: 0 });
  });
});
