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
