import { describe, it, expect } from 'vitest';
import { formatEmailTotal } from './emailMoney.ts';
import { formatMoneyForCurrency } from '../../../src/utils/money.js';

describe('IRON-ILS-001 quote email total', () => {
  it.each([
    [100.49, '100.00'], [100.5, '101.00'], [191.16, '191.00'], [324.5, '325.00'],
    [6532.48, '6,532.00'], [28346.16, '28,346.00'], [-100.5, '-101.00'], [0.49999999999999994, '0.00'],
  ])('ILS %s -> ₪%s', (total, expected) => {
    expect(formatEmailTotal(total, '₪')).toBe(expected);
  });

  it.each([['$', 191.16, '191.16'], ['€', 6532.48, '6,532.48'], ['£', 100.5, '100.50']])('International %s keeps cents', (sym, total, expected) => {
    expect(formatEmailTotal(total, sym)).toBe(expected);
  });

  it('matches the canonical client formatter for every sample (no server/client drift)', () => {
    for (const v of [0, 1.5, 99.995, 100.49, 100.5, 191.16, 324.5, 6532.48, 28346.16, 9999999.5, -0.5, -100.49]) {
      expect(formatEmailTotal(v, '₪')).toBe(formatMoneyForCurrency(v, 'ILS'));
      expect(formatEmailTotal(v, '$')).toBe(formatMoneyForCurrency(v, 'USD'));
    }
  });

  it('non-numeric totals render 0.00 instead of NaN', () => {
    expect(formatEmailTotal(null, '₪')).toBe('0.00');
    expect(formatEmailTotal('abc', '$')).toBe('0.00');
  });
});
