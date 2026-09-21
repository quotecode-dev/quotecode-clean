import { describe, it, expect } from 'vitest';
import { formatMoney, formatWholeMoney } from './money';

describe('formatMoney - International/general full-precision formatter (unchanged)', () => {
  it('always shows exactly two decimal places without rounding to a whole unit', () => {
    expect(formatMoney(7658.82)).toBe('7,658.82');
    expect(formatMoney(12091.82)).toBe('12,091.82');
    expect(formatMoney(4433)).toBe('4,433.00');
  });
});

// Final Smart Quote Merge + Rounding Remediation task, CORRECTED by the
// "Urgent Money Format Correction" task - the required HE/ILS law is
// ROUND TO WHOLE SHEKEL, THEN DISPLAY WITH EXACTLY TWO DECIMAL PLACES
// (always ".00" - never a bare integer, never non-zero agorot). These are
// the exact canonical examples from that correction task's own prompt.
describe('formatWholeMoney - Local/ILS whole-shekel display law (round then always .00)', () => {
  it('7658.82 rounds to the nearest whole shekel and displays with .00', () => {
    expect(formatWholeMoney(7658.82)).toBe('7,659.00');
  });

  it('12091.82 rounds to the nearest whole shekel and displays with .00', () => {
    expect(formatWholeMoney(12091.82)).toBe('12,092.00');
  });

  it('4433 (already whole) still displays with .00', () => {
    expect(formatWholeMoney(4433)).toBe('4,433.00');
  });

  it('1980.00 (already whole) still displays with .00', () => {
    expect(formatWholeMoney(1980.00)).toBe('1,980.00');
  });

  it('never returns a bare integer string with no decimal point', () => {
    const result = formatWholeMoney(7658.82);
    expect(result).toContain('.00');
    expect(result).not.toBe('7,659');
  });

  it('does not mutate or round the value it is given - display-only', () => {
    const original = 7658.82;
    formatWholeMoney(original);
    expect(original).toBe(7658.82);
  });

  it('rounds .50 up (Math.round, matching the existing finalTotalRounded convention)', () => {
    expect(formatWholeMoney(2505.50)).toBe('2,506.00');
    expect(formatWholeMoney(2505.49)).toBe('2,505.00');
  });
});

// IRON-ILS-001 boundary matrix (Owner-locked examples + .00/.01/.49/.50/.51, negatives, large values).
import { roundHalfUpWhole, formatMoneyForCurrency } from './money';

describe('IRON-ILS-001 whole-shekel half-up boundary matrix', () => {
  const cases = [
    [100.0, '100.00'], [100.01, '100.00'], [100.49, '100.00'], [100.5, '101.00'], [100.51, '101.00'],
    [191.16, '191.00'], [324.5, '325.00'], [6532.48, '6,532.00'], [28346.16, '28,346.00'],
    [0, '0.00'], [0.49, '0.00'], [0.5, '1.00'],
    [1234567890.5, '1,234,567,891.00'], [999999999999.49, '999,999,999,999.00'],
    // negatives: half away from zero, never "-0.00"
    [-100.49, '-100.00'], [-100.5, '-101.00'], [-100.51, '-101.00'], [-0.49, '0.00'], [-0.5, '-1.00'],
    // degenerate inputs never leak NaN / -0
    [null, '0.00'], [undefined, '0.00'], ['', '0.00'], [NaN, '0.00'], ['191.16', '191.00'],
  ];
  it.each(cases)('formatWholeMoney(%s) -> %s', (input, expected) => {
    expect(formatWholeMoney(input)).toBe(expected);
  });

  it('always renders exactly two decimals, and the decimals are always 00', () => {
    for (const v of [0.01, 1.4999, 2.5, 99.995, 12345.678, -3.3]) {
      expect(formatWholeMoney(v)).toMatch(/\.00$/);
    }
  });

  it('roundHalfUpWhole is exact at the double boundary (0.49999999999999994 stays 0)', () => {
    expect(roundHalfUpWhole(0.49999999999999994)).toBe(0);
    expect(Object.is(roundHalfUpWhole(-0.2), -0)).toBe(false);
  });

  it('formatMoneyForCurrency: ILS is whole-shekel; USD/EUR/GBP keep full precision (market isolation)', () => {
    expect(formatMoneyForCurrency(191.16, 'ILS')).toBe('191.00');
    expect(formatMoneyForCurrency(191.16, 'ils')).toBe('191.00');
    expect(formatMoneyForCurrency(191.16, 'USD')).toBe('191.16');
    expect(formatMoneyForCurrency(191.16, 'EUR')).toBe('191.16');
    expect(formatMoneyForCurrency(191.16, 'GBP')).toBe('191.16');
    expect(formatMoneyForCurrency(191.16, undefined)).toBe('191.16');
  });

  it('does not mutate its input', () => {
    const v = 100.5; formatMoneyForCurrency(v, 'ILS'); expect(v).toBe(100.5);
  });
});
