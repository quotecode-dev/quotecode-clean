// Codex review 2026-10-23 R-07: the save and the editor preview share ONE financial-change decision; an edit that happens to keep the
// old total is still a change (Codex's example: quantity 1 x 100.50 -> quantity 2 x 50.25).
import { describe, it, expect } from 'vitest';
import { isFinancialChange } from './financialEdit';
import { financialsMatchingStored } from './storedQuoteFinancials';
import { calculateQuoteFinancials } from './regionConfig';

const saved = [{ quantity: 1, unit_price: 100.5 }];
describe('isFinancialChange', () => {
  it('the same lines, discount and client type -> unchanged', () => {
    expect(isFinancialChange({ items: [{ quantity: '1', unit_price: '100.50' }], discount: 0, clientType: 'private', savedItems: saved, savedDiscount: 0, savedClientType: 'private' }).changed).toBe(false);
  });
  it('an equal total from different lines is a change', () => {
    expect(isFinancialChange({ items: [{ quantity: '2', unit_price: '50.25' }], discount: 0, clientType: 'private', savedItems: saved, savedDiscount: 0, savedClientType: 'private' }).changed).toBe(true);
  });
  it('a discount, a client type or a missing price is a change; a measured line counts by its active quantity', () => {
    const base = { items: [{ quantity: '1', unit_price: '100.50' }], discount: 0, clientType: 'private', savedItems: saved, savedDiscount: 0, savedClientType: 'private' };
    expect(isFinancialChange({ ...base, discount: 5 }).changed).toBe(true);
    expect(isFinancialChange({ ...base, clientType: 'business' })).toEqual({ changed: true, clientTypeChanged: true });
    expect(isFinancialChange({ ...base, items: [{ quantity: '1', unit_price: '', price_missing: true }] }).changed).toBe(true);
    expect(isFinancialChange({ ...base, items: [{ quantity: '1', unit_price: '100.50', pricing_unit: 'sqm', calculated_quantity: 2 }] }).changed).toBe(true);
  });
  it('the preview of that edit shows the amounts the save will store (rounded), not the old ones', () => {
    const args = { country: 'Local', currency: 'ILS', clientType: 'private', items: [{ quantity: 2, unit_price: 50.25 }], discount: 0, taxRateOverride: 0.18 };
    const changed = isFinancialChange({ items: [{ quantity: '2', unit_price: '50.25' }], discount: 0, clientType: 'private', savedItems: saved, savedDiscount: 0, savedClientType: 'private' }).changed;
    const preview = financialsMatchingStored(args, changed ? undefined : 100.5, { editing: true });
    expect(preview.total).toBe(calculateQuoteFinancials(args).total);
    expect(preview.total).toBe(100);
  });
});
