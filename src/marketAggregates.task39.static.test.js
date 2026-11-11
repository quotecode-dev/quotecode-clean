// IRON-MARKET-004 STATIC GATE (Task 39 release line) - quote aggregates never mix currencies.
// Every sum over several quotes goes through utils/money.totalsByQuoteCurrency (grouped by each quote's persisted currency).
// A single `quotes.reduce(sum + quote.total)` shown under the account currency is the bypass this gate rejects. The release
// QuotesTab has no cross-quote aggregate at all (its rows / cards are single-quote amounts keyed on the quote currency).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8').split(String.fromCharCode(13)).join('');
const sourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(cwd(), dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
    }
  };
  walk('src');
  return out;
};
// a running sum of quote totals: reduce((acc, q) => acc + Number(q.total ...)) or acc += Number(q.total ...)
const MIXED_QUOTE_SUM = [
  /reduce\(\s*\(\s*\w+\s*,\s*(?:q|quote|qt|row)\s*\)\s*=>\s*\w+\s*\+\s*(?:Number\(\s*)?(?:q|quote|qt|row)\.total\b/,
  /\+=\s*(?:Number\(\s*)?(?:q|quote|qt|row)\.total\b/,
];
const HELPER = 'src/utils/money.js'; // totalsByQuoteCurrency lives in the canonical money utility

describe('IRON-MARKET-004 static gate: no mixed-currency quote aggregate', () => {
  it('no product file outside the helper sums quote totals into one number', () => {
    const offenders = [];
    for (const f of sourceFiles()) {
      if (f === HELPER) continue;
      read(f).split('\n').forEach((l, i) => { if (!/^\s*(\/\/|\*)/.test(l) && MIXED_QUOTE_SUM.some((re) => re.test(l))) offenders.push(`${f}:${i + 1}`); });
    }
    expect(offenders).toEqual([]);
  });

  it('the rule catches the historical mixed aggregates of this line (header revenue, Finances report, annual chart)', () => {
    for (const line of [
      'const overviewTotal = overviewQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);',
      "const totalRevenue = quotes.filter(q => q.status?.toLowerCase() === 'approved' || q.status?.toLowerCase() === 'paid').reduce((sum, q) => sum + Number(q.total || 0), 0);",
      'const adminTotalRevenue = filteredQuotesForReport.reduce((sum, q) => sum + Number(q.total || 0), 0);',
      '          income += Number(q.total || 0);',
    ]) expect(MIXED_QUOTE_SUM.some((re) => re.test(line)), line).toBe(true);
  });

  it('the helper groups by the persisted quote currency and never falls back to the account currency', () => {
    const h = read(HELPER);
    expect(h).toMatch(/const currency = normalizeQuoteCurrency\(quote\.currency\);/);
    expect(h).toMatch(/if \(!currency\) \{ unknownCount \+= 1; continue; \}/);
    expect(h).not.toMatch(/accountCurrency\)?\s*\|\|/); // no `quote.currency || accountCurrency` style fallback
  });

  it('every aggregate consumer uses the helper and renders per-currency tokens; QuotesTab has no aggregate and keys every amount on the quote currency', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toMatch(/const isRevenueQuote = \(q\) => q\.status\?\.toLowerCase\(\) === 'approved' \|\| q\.status\?\.toLowerCase\(\) === 'paid';/);
    expect(d).toMatch(/const revenueTotals = totalsByQuoteCurrency\(quotes, \{ include: isRevenueQuote, accountCurrency \}\);/);
    expect(d).toMatch(/const adminRevenueTotals = totalsByQuoteCurrency\(filteredQuotesForReport, \{ accountCurrency \}\);/);
    expect(d).toMatch(/totals=\{revenueTotals\}/);
    expect(d).toMatch(/\[`Income_\$\{g\.currency\}`, g\.total\]/);
    expect(d).not.toMatch(/formatMoneyDisplay\((totalRevenue|adminTotalRevenue)\)/);
    expect(d).not.toMatch(/adminTotalRevenue=|Income: income/);

    const f = read('src/components/FinancesTab.jsx');
    expect(f).toMatch(/<CurrencyTotals [^>]*totals=\{adminRevenueTotals\}/);
    expect(f).not.toMatch(/dataKey="Income"/);
    expect(f).toMatch(/chartIncomeCurrencies\.map\(\(cur, i\) => \(/);
    expect(f).toMatch(/QUOTE_CURRENCY_SYMBOLS\[cur\]\}\$\{formatMoneyDisplay\(value, cur\)\}/); // tooltip in the bar's own currency
    expect(f).toMatch(/data-net-profit="not-computable"/);

    const quotesTab = read('src/components/QuotesTab.jsx');
    // the ONE cross-quote aggregate of the list is the overview row (Owner console approval 2026-10-13), grouped per currency
    expect(quotesTab).toMatch(/const overviewTotals = totalsByQuoteCurrency\(overviewQuotes, \{ accountCurrency: currency \}\);/);
    expect(quotesTab).toMatch(/<CurrencyTotals className="quote-overview-value"[^>]*totals=\{overviewTotals\}/);
    expect(quotesTab).not.toMatch(/\boverviewTotal\b/);
    expect(quotesTab).not.toMatch(/\.reduce\(/); // no other running sum in the list
    expect((quotesTab.match(/formatMoneyDisplay\(quote\.total, quote\.currency\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(quotesTab).not.toMatch(/formatMoneyDisplay\(quote\.total, currency\)/);
  });

  it('every per-currency token goes through the canonical formatter of ITS currency (IRON-ILS-001)', () => {
    const nv = read('src/components/NumericValue.jsx');
    const c = nv.slice(nv.indexOf('export function CurrencyTotals('));
    expect(c.length).toBeGreaterThan(100);
    expect(c).toMatch(/text=\{formatMoneyDisplay\(g\.total, g\.currency\)\}/);
    expect(c).toMatch(/symbol=\{g\.symbol\}/);
    expect(c).not.toMatch(/formatMoney\(|toFixed\(/);
  });
});
