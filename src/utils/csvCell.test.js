// Codex SEC-FE-04 (Owner 2026-10-30, L-23 / L-26): CSV cells - standard quoting, formula-safe text, numbers unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { csvCell, csvRow } from './csvCell';

describe('csvCell', () => {
  it('a text a spreadsheet would run as a formula gets a leading apostrophe', () => {
    for (const t of ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\tx', '\rx']) expect(csvCell(t).startsWith(`"'`)).toBe(true);
  });
  it('numbers and plain numeric text stay numbers; quotes are doubled; line breaks stay inside the cell', () => {
    expect(csvCell(120.5)).toBe('120.5');
    expect(csvCell(-50)).toBe('-50');
    expect(csvCell('-50')).toBe('"-50"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell('דלק לרכב')).toBe('"דלק לרכב"');
    expect(csvRow(['x', 1, '=1+1'])).toBe(`"x",1,"'=1+1"`);
  });
  it('the expense export uses it', () => {
    expect(readFileSync('src/pages/Dashboard.jsx', 'utf8')).toContain("csvRow(keys.map(key => row[key] ?? ''))");
  });
});
