// IRON-ILS-001 STATIC GATE - Local/ILS whole-shekel money display law.
// Every displayed money amount on a protected Local surface must go through the ONE canonical
// currency-keyed presentation path (utils/money.js: formatMoneyDisplay / formatMoneyForCurrency /
// formatWholeMoney). A protected file that formats money through the market-agnostic full-precision
// helpers (formatNum / formatMoney / formatNumberLocal / toLocaleString / toFixed) next to a currency
// symbol is a BYPASS and fails this gate. Quantity formatting via formatNum stays allowed (it is not money).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');

// Protected Local/ILS money surfaces (International-only files are deliberately absent).
export const PROTECTED_LOCAL_MONEY_FILES = [
  'src/components/QuoteForm.jsx', 'src/components/QuotesTab.jsx', 'src/components/FinancesTab.jsx',
  'src/components/ServicesCatalog.jsx', 'src/components/AddItemWizard.jsx', 'src/pages/PublicQuote.jsx',
  'src/pages/ProfessionalPublicPreview.jsx', 'src/components/CustomerQuoteItemRow.jsx',
  'src/components/ProfessionalItemComparisonCard.jsx', 'src/pages/Dashboard.jsx',
];

// A money expression = currency symbol token immediately followed by a full-precision formatter call.
const MONEY_BYPASS = [
  /(?:\bsym|\bquoteSym|\bcurrencySymbol|\bproposalSym|₪)\}?\$?\{?\s*(?:\{|\$\{)?\s*(?:formatNum|formatMoney|formatNumberLocal)\(/,
  /(?:₪|\bsym\}|\bquoteSym\})\s*\{?\s*[A-Za-z_.]+\.toFixed\(2\)/,
  /symbol=\{[^}]*\}\s+text=\{(?:formatNum|formatMoney|formatNumberLocal)\(/,
  /text=\{(?:formatNum|formatMoney|formatNumberLocal)\(/,
];

describe('IRON-ILS-001 static gate: protected Local money surfaces have no formatter bypass', () => {
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

  it('PublicQuoteEn (International) never uses the whole-shekel formatter', () => {
    const en = read('src/pages/PublicQuoteEn.jsx');
    expect(en).not.toMatch(/formatWholeMoney\(|formatMoneyForCurrency\(/);
  });

  it('server surfaces (email, AI directFacts) implement the same ILS whole-shekel rule', () => {
    expect(read('supabase/functions/send-quote-email/index.ts')).toMatch(/IRON-ILS-001/);
    expect(read('supabase/functions/chat-ai/directFacts.ts')).toMatch(/IRON-ILS-001/);
  });
});
