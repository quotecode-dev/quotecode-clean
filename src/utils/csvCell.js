// Codex SEC-FE-04 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ממצאי האבטחה ... כולל שינוי ב-L-22, L-23, L-26 ..."):
// one CSV cell. RFC 4180 quoting (a quote is doubled, line breaks stay inside the quoted cell) instead of JSON escaping, and a text that a
// spreadsheet would run as a formula (= + - @, tab, carriage return) gets a leading apostrophe. Numbers - and plain numeric text such as
// "-50" or "12.5" - are left as numbers, so sums and the column layout of the export do not change.
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;

export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""';
  if (typeof value === 'boolean') return value ? '"true"' : '"false"';
  let s = String(value);
  if (!NUMERIC_TEXT.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values) {
  return values.map(csvCell).join(',');
}
