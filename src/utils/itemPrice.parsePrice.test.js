// Task 34 extension / Task 35 (Codex F3): the one price grammar. It moved with the quote screen's price editing from the former quick
// "Edit price" window into the row editor (Owner console 2026-11-08, stage 2 of the one quote builder, typed incl. L-09); the row tests are in
// src/quoteRowsEditor20261108.test.jsx.
import { describe, it, expect } from 'vitest';
import { parsePriceInput } from './itemPrice';

describe('parsePriceInput', () => {
  it('empty = missing, 0 = intentional, decimals up to 2 with a point, a comma only as thousands groups, anything else refused', () => {
    expect(parsePriceInput('')).toEqual({ ok: true, value: '' });
    expect(parsePriceInput('0')).toEqual({ ok: true, value: '0' });
    // Task 35 (Codex F3): '.' is the only decimal point (<= 2 places); ',' is accepted ONLY as complete thousands groups - nothing is guessed
    for (const [raw, value] of [['1,200', '1200'], ['1,234,567.5', '1234567.5'], ['12.50', '12.5'], [' 450 ', '450'], ['0.99', '0.99'], ['10000000', '10000000']]) {
      expect(parsePriceInput(raw)).toEqual({ ok: true, value });
    }
    for (const bad of ['-5', 'abc', '1.234', '1e3', '1,,2', '1,2,3', '99,5', '1,20', '12,3456', ',5', '5,', '1.', '.5', '1 200', '₪100', '100₪', '$5',
      '+5', 'NaN', 'Infinity', '0x10', '1,2.5', '10000000.01', '99999999']) expect(parsePriceInput(bad).ok, bad).toBe(false);
  });
});
