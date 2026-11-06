// Owner console 2026-11-06 (typed L-09 / L-14 / L-17 / L-24 / L-27 approval, release A): a quantity is not money. A count shows only the
// decimals it has (1, 2.5 - never "1.00"); an area / length keeps at least 2 decimals (3.40 m2, 36.00 m2); every stored decimal is kept.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatQuantity } from './utils/professionalQuoteItem';
import { parseQuantityInput } from './utils/itemPrice';

describe('formatQuantity', () => {
  it.each([
    [1, undefined, '1'], [1, 'unit', '1'], [2.5, 'hour', '2.5'], [3.4, 'kg', '3.4'], [10, 'day', '10'], [1234, null, '1,234'], ['7', 'unit', '7'],
    [3.4, 'm2', '3.40'], [36, 'm2', '36.00'], [3.375, 'm2', '3.375'], [12, 'linear_meter', '12.00'], [900, 'sq_ft', '900.00'], [4.5, 'linear_ft', '4.50'],
    [0.123456789, 'unit', '0.123457'], [null, 'unit', '0'],
  ])('%s %s -> %s', (value, unit, expected) => {
    expect(formatQuantity(value, unit)).toBe(expected);
  });
});

describe('every quantity display uses the shared format (no local money-style copy left)', () => {
  it.each(['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'])('%s', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/const formatQty\b/);
    expect(src.match(/formatQuantity\(activeQty, item\.pricing_unit\)/g)).toHaveLength(3);
  });
  it('the quote editor card', () => {
    const src = readFileSync('src/components/QuoteForm.jsx', 'utf8');
    expect(src).toContain('const qtyText = formatQuantity(activeQty, item.pricing_unit);');
    expect(src).not.toMatch(/formatNum\(activeQty\)/);
  });
});

describe('parseQuantityInput (the quick dialog quantity)', () => {
  it('accepts a whole or decimal number above 0, up to 6 decimals and 100,000; refuses everything else', () => {
    for (const [raw, value] of [['3', 3], [' 3 ', 3], ['007', 7], ['2.5', 2.5], ['1.123456', 1.123456], ['100000', 100000]]) expect(parseQuantityInput(raw)).toEqual({ ok: true, value });
    for (const bad of ['0', '0.0', '-3', '+3', '.5', '1.', '1e3', '2,5', '1,000', '1.1234567', '100000.5', 'abc', '', null, undefined]) expect(parseQuantityInput(bad).ok, String(bad)).toBe(false);
  });
});
