import { describe, it, expect } from 'vitest';
import { financialsMatchingStored } from './storedQuoteFinancials';
import { calculateQuoteFinancials } from './regionConfig';

// The morning-report example: one item 11,014, 10% discount, business client, 18% VAT.
const base = { country: 'Local', clientType: 'business', items: [{ quantity: 1, unit_price: 11014 }], discount: 10, taxRateOverride: 0.18 };

describe('financialsMatchingStored (Owner 2026-10-23: one shekel rounding on every screen)', () => {
  const editor = calculateQuoteFinancials({ ...base, currency: 'ILS' });

  it('a shekel quote saved with the rounding shows the editor amounts', () => {
    const f = financialsMatchingStored({ ...base, currency: 'ILS' }, editor.total);
    expect(f.discountAmount).toBe(editor.discountAmount);
    expect(f.netAmount).toBe(9912);
    expect(f.taxAmount).toBe(editor.taxAmount);
    expect(f.total).toBe(editor.total);
  });

  it('a shekel quote saved before the amendment keeps its own amounts', () => {
    const old = calculateQuoteFinancials(base);
    expect(old.total).not.toBe(editor.total); // the example really differs
    const f = financialsMatchingStored({ ...base, currency: 'ILS' }, old.total);
    expect(f.total).toBe(old.total);
    expect(f.discountAmount).toBe(old.discountAmount);
  });

  it('a saved quote that neither calculation reproduces keeps the calculation it always had', () => {
    const old = calculateQuoteFinancials(base);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, 1).total).toBe(old.total);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, undefined).total).toBe(old.total);
  });

  it('the editor preview: a new or changed quote gets the rounding the save will store; an unchanged old quote keeps its amounts', () => {
    const old = calculateQuoteFinancials(base);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, undefined, { editing: true }).total).toBe(editor.total);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, 1, { editing: true }).total).toBe(editor.total);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, old.total, { editing: true }).total).toBe(old.total);
    expect(financialsMatchingStored({ ...base, currency: 'ILS' }, editor.total, { editing: true }).total).toBe(editor.total);
  });

  it('dollars, euros and pounds are calculated exactly as before', () => {
    for (const currency of ['USD', 'EUR', 'GBP', undefined]) {
      const args = { ...base, country: 'International', taxRateOverride: 0, currency };
      expect(financialsMatchingStored(args, 123)).toEqual(calculateQuoteFinancials({ ...args, currency: undefined }));
    }
  });

  it('a private client: the VAT-inclusive total is a whole shekel', () => {
    const args = { ...base, clientType: 'private', currency: 'ILS' };
    const f = financialsMatchingStored(args, calculateQuoteFinancials(args).total);
    expect(Number.isInteger(f.total)).toBe(true);
  });
});
