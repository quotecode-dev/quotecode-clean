// IRON-ILS-001 STATIC GATE - Local/ILS whole-shekel money display law.
// Every displayed money amount on a protected Local surface must go through the ONE canonical
// currency-keyed presentation path (utils/money.js: formatMoneyDisplay / formatMoneyForCurrency /
// formatWholeMoney). A protected file that formats money through the market-agnostic full-precision
// helpers (formatNum / formatMoney / formatNumberLocal / toLocaleString / toFixed) next to a currency
// symbol is a BYPASS and fails this gate. Quantity formatting via formatNum stays allowed (it is not money).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');

// Protected Local/ILS money surfaces (International-only files are deliberately absent).
export const PROTECTED_LOCAL_MONEY_FILES = [
  'src/components/QuoteForm.jsx', 'src/components/QuotesTab.jsx', 'src/components/FinancesTab.jsx',
  'src/components/ServicesCatalog.jsx', 'src/components/AddItemWizard.jsx', 'src/pages/PublicQuote.jsx',
  'src/pages/ProfessionalPublicPreview.jsx', 'src/components/CustomerQuoteItemRow.jsx',
  'src/components/ProfessionalItemComparisonCard.jsx', 'src/pages/Dashboard.jsx',
  // Task 17: the Statistics screen renders quote amounts and per-currency value totals
  'src/components/StatisticsTab.jsx',
  // Task 16 - Quote Experience V2 document surfaces (the sample route renders the real ILS document).
  'src/pages/SampleQuote.jsx', 'src/components/PublicQuoteHeader.jsx', 'src/quoteDocument/sampleQuotes.js',
];

// A money expression = currency symbol token immediately followed by a full-precision formatter call.
const MONEY_BYPASS = [
  /(?:\bsym|\bquoteSym|\bcurrencySymbol|\bproposalSym|₪)\}?\$?\{?\s*(?:\{|\$\{)?\s*(?:formatNum|formatMoney|formatNumberLocal)\(/,
  /(?:₪|\bsym\}|\bquoteSym\})\s*\{?\s*[A-Za-z_.]+\.toFixed\(2\)/,
  /symbol=\{[^}]*\}\s+text=\{(?:formatNum|formatMoney|formatNumberLocal)\(/,
  /text=\{(?:formatNum|formatMoney|formatNumberLocal)\(/,
];

// A currency symbol immediately followed by ANY interpolated expression that is not a canonical formatter call
// (e.g. `{sym}{unitPrice || 0}` - the AddItemWizard review-line bypass found 2026-09-22) is a raw money render.
const SYMBOL_THEN_EXPR = /(?:\{|\$\{)(sym|quoteSym|currencySymbol|proposalSym)\}\s*(?:\{|\$\{)([^}]{0,80})\}/g;
const CANONICAL_CALL = /^(?:money|fmtMoney|formatMoneyDisplay|formatMoneyForCurrency|formatWholeMoney|moneyFmt)\(/;

describe('IRON-ILS-001 static gate: protected Local money surfaces have no formatter bypass', () => {
  for (const file of PROTECTED_LOCAL_MONEY_FILES) {
    it(`${file}: every currency symbol is followed by a canonical formatter call (no raw amount)`, () => {
      const offenders = [];
      read(file).split('\n').forEach((l, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
        for (const m of l.matchAll(SYMBOL_THEN_EXPR)) if (!CANONICAL_CALL.test(m[2].trim())) offenders.push(`${i + 1}: ${m[0]}`);
      });
      expect(offenders).toEqual([]);
    });
  }

  it('the symbol rule itself catches the historical raw review-line render', () => {
    const line = '<div>{quantity} × {sym}{unitPrice || 0}</div>';
    const hits = [...line.matchAll(SYMBOL_THEN_EXPR)].filter((m) => !CANONICAL_CALL.test(m[2].trim()));
    expect(hits).toHaveLength(1);
  });

  it('AddItemWizard has no raw-number fallback when the formatter is not injected', () => {
    const w = read('src/components/AddItemWizard.jsx');
    expect(w).not.toMatch(/formatMoneyDisplay \? formatMoneyDisplay\([^)]*\) : /);
    expect(w).toMatch(/const money = formatMoneyDisplay \|\| \(\(v\) => formatMoneyForCurrency\(/);
  });

  it('the quote email total goes through the tested emailMoney module (no inline rounding)', () => {
    const e = read('supabase/functions/send-quote-email/index.ts');
    expect(e).toMatch(/const displayTotal = formatEmailTotal\(quoteRow\.total, resolvedSym\)/);
    expect(e).not.toMatch(/wholeAbs/);
  });

  for (const file of PROTECTED_LOCAL_MONEY_FILES) {
    it(`${file} has no money bypass`, () => {
      const lines = read(file).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      const offenders = lines.filter((l) => MONEY_BYPASS.some((re) => re.test(l)));
      expect(offenders.map((l) => l.trim().slice(0, 140))).toEqual([]);
    });
  }

  it('Dashboard injects the canonical money path into every money-rendering child', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect((d.match(/formatMoneyDisplay=\{formatMoneyDisplay\}/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(d).toMatch(/const formatMoneyDisplay = \(val, cur\) => formatMoneyForCurrency\(/);
  });

  it('QuotesTab keys row money on the quote\'s OWN currency (historical currency preserved)', () => {
    const q = read('src/components/QuotesTab.jsx');
    expect(q).toMatch(/formatMoneyDisplay\(quote\.total, quote\.currency\)/);
  });

  // 2026-10-09 independent review: an injected exact-cent formatter (Dashboard formatExactMoney -> QuotesTab listMoney) rendered
  // non-zero agorot on the HE/Local quote rows + overview, and the rules above missed it (`text={listMoney(...)}` matched none).
  it('Dashboard/QuotesTab carry no exact-cent bypass (formatExactMoney, listMoney, injected list formatter)', () => {
    for (const file of ['src/pages/Dashboard.jsx', 'src/components/QuotesTab.jsx']) {
      const src = read(file);
      expect(src, file).not.toMatch(/formatExactMoney|listMoney/);
      expect(src, file).not.toMatch(/formatMoney\(\s*(quote|q|r|row)\.(total|subtotal)/);
      expect(src, file).not.toMatch(/\.(total|subtotal)\)?\.toFixed\(2\)/);
    }
    // QuotesTab receives exactly ONE money formatter prop: the canonical formatMoneyDisplay
    const q = read('src/components/QuotesTab.jsx');
    const params = q.slice(q.indexOf('export default function QuotesTab({'), q.indexOf('}) {', q.indexOf('export default function QuotesTab({')));
    expect(params.match(/\b\w*(?:Money|money)\w*\b/g)).toEqual(['formatMoneyDisplay']);
    // ...and Dashboard hands it nothing else
    const d = read('src/pages/Dashboard.jsx');
    const call = d.slice(d.indexOf('<QuotesTab'), d.indexOf('/>', d.indexOf('<QuotesTab')));
    expect(call.match(/\b\w*(?:Money|money)\w*=/g)).toEqual(['formatMoneyDisplay=']);
  });

  it('every QuotesTab amount (rows, overview, cards, Quote History) goes through formatMoneyDisplay / formatMoneyForCurrency', () => {
    const q = read('src/components/QuotesTab.jsx');
    const texts = [...q.matchAll(/<MoneyValue[\s\S]*?text=\{([^}]*)\}/g)].map((m) => m[1].trim());
    // EXACT surface set (stricter than a minimum count): rows, Quote History table, Quote History cards; the 4th surface - the
    // overview total - renders through CurrencyTotals (asserted below), one canonical token per persisted currency
    expect(texts).toEqual(['amountText', 'formatMoneyDisplay(quote.total, quote.currency)', 'formatMoneyDisplay(quote.total, quote.currency)']);
    const canonicalIdentifiers = [...q.matchAll(/const (\w+) = formatMoneyDisplay\(/g)].map((m) => m[1]);
    for (const t of texts) expect(t.startsWith('formatMoneyDisplay(') || canonicalIdentifiers.includes(t), t).toBe(true);
    // overview total: per persisted currency (IRON-MARKET-004), each token through formatMoneyDisplay(total, ITS currency)
    expect(q).toMatch(/<CurrencyTotals className="quote-overview-value"[^>]*formatMoneyDisplay=\{formatMoneyDisplay\}/);
    expect(read('src/components/NumericValue.jsx')).toMatch(/text=\{formatMoneyDisplay\(g\.total, g\.currency\)\}/);
    expect(q).toMatch(/const amountText = formatMoneyDisplay\(quote\.total, quote\.currency\);/);
    expect(q).toMatch(/text=\{amountText\}/);
    // the is-long geometry decision uses the same canonical text, never a second formatter
    expect(q).toMatch(/\(quoteSym \+ amountText\)\.length >= 13/);
  });

  it('no test expects non-zero agorot for a ₪ amount (a test may never legitimize an IRON-ILS-001 violation)', () => {
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(join(cwd(), dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p); else if (/\.test\.[jt]sx?$/.test(e.name)) files.push(p);
      }
    };
    walk('src');
    const EXPECT_AGOROT = /\.(?:toBe|toEqual|toContain|toHaveTextContent|toStrictEqual)\(\s*['"`]₪\s?-?[\d,]+\.(?!00)\d\d/;
    const offenders = files.flatMap((f) => read(f).split('\n').map((l, i) => [f, i + 1, l])
      .filter(([, , l]) => EXPECT_AGOROT.test(l) && !l.includes('EXPECT_AGOROT.test('))); // the rule's own self-check below
    expect(offenders.map(([f, n]) => `${f}:${n}`)).toEqual([]);
    expect(EXPECT_AGOROT.test("expect(x).toBe('₪1,227.20');")).toBe(true); // the rule catches the removed legitimizing test
    expect(EXPECT_AGOROT.test("expect(x).toBe('₪1,227.00');")).toBe(false);
  });

  it('PublicQuoteEn (International) never uses the whole-shekel formatter', () => {
    const en = read('src/pages/PublicQuoteEn.jsx');
    expect(en).not.toMatch(/formatWholeMoney\(|formatMoneyForCurrency\(/);
  });

  it('server surfaces (email, AI directFacts) implement the same ILS whole-shekel rule', () => {
    expect(read('supabase/functions/send-quote-email/index.ts')).toMatch(/IRON-ILS-001/);
    expect(read('supabase/functions/chat-ai/directFacts.ts')).toMatch(/IRON-ILS-001/);
  });
});
