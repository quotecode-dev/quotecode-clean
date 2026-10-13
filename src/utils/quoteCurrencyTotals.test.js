// IRON-MARKET-004 contract of the ONE quote-aggregate helper: totals per persisted quote currency, no conversion, no mixing,
// no relabelling with the account currency (which only decides display order), missing/invalid currency never assigned.
import { describe, it, expect } from 'vitest';
import { totalsByQuoteCurrency, normalizeQuoteCurrency, quoteCurrencyDisplayOrder, QUOTE_CURRENCY_SYMBOLS, formatMoneyForCurrency } from './money';

const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const HISTORY = deepFreeze([
  { id: 'u1', currency: 'USD', total: 100.25, status: 'approved' },
  { id: 'u2', currency: 'USD', total: 50.75, status: 'sent' },
  { id: 'e1', currency: 'EUR', total: 200.4, status: 'paid' },
  { id: 'g1', currency: 'GBP', total: 80.1, status: 'draft' },
]);
const shown = (r) => r.groups.map((g) => `${g.symbol}${formatMoneyForCurrency(g.total, g.currency)}`);
const isRevenue = (q) => ['approved', 'paid'].includes(String(q.status).toLowerCase());

describe('totalsByQuoteCurrency (IRON-MARKET-004)', () => {
  it('International account in EUR: USD 100.25 + 50.75, EUR 200.40, GBP 80.10 -> $151.00, €200.40, £80.10 - never €431.50', () => {
    const r = totalsByQuoteCurrency(HISTORY, { accountCurrency: 'EUR' });
    expect(shown(r)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(r.groups.map((g) => g.count)).toEqual([1, 2, 1]);
    expect(r.unknownCount).toBe(0);
    expect(shown(r)).not.toContain('€431.50');
    expect(r.groups.every((g) => g.total !== 431.5)).toBe(true);
  });

  it('changing the account currency EUR -> GBP changes ONLY the display order (same groups, symbols and totals)', () => {
    const eur = totalsByQuoteCurrency(HISTORY, { accountCurrency: 'EUR' });
    const gbp = totalsByQuoteCurrency(HISTORY, { accountCurrency: 'GBP' });
    expect(gbp.groups.map((g) => g.currency)).toEqual(['GBP', 'USD', 'EUR']);
    expect(shown(gbp)).toEqual(['£80.10', '$151.00', '€200.40']);
    const byCurrency = (r) => Object.fromEntries(r.groups.map((g) => [g.currency, [g.symbol, g.total, g.count]]));
    expect(byCurrency(gbp)).toEqual(byCurrency(eur));
  });

  it('revenue = approved/paid only, still grouped per currency', () => {
    const r = totalsByQuoteCurrency(HISTORY, { include: isRevenue, accountCurrency: 'EUR' });
    expect(shown(r)).toEqual(['€200.40', '$100.25']);
  });

  it('the overview population (all quotes) is grouped the same way', () => {
    const all = totalsByQuoteCurrency(HISTORY);
    expect(all.groups.reduce((n, g) => n + g.count, 0)).toBe(HISTORY.length);
    expect(all.groups.map((g) => g.currency)).toEqual(['USD', 'EUR', 'GBP']); // no account currency: canonical ILS, USD, EUR, GBP
  });

  it('Local/ILS totals still follow IRON-ILS-001: raw 1227.50 shows ₪1,228.00', () => {
    const r = totalsByQuoteCurrency([{ currency: 'ILS', total: 1227.5 }], { accountCurrency: 'ILS' });
    expect(shown(r)).toEqual(['₪1,228.00']);
  });

  it('a missing or invalid currency is never assigned to the account currency nor added to another currency', () => {
    const quotes = [...HISTORY, { currency: null, total: 999 }, { currency: '', total: 5 }, { currency: 'XYZ', total: 7 }, { total: 11 }];
    const r = totalsByQuoteCurrency(quotes, { accountCurrency: 'EUR' });
    expect(r.unknownCount).toBe(4);
    expect(shown(r)).toEqual(['€200.40', '$151.00', '£80.10']);
  });

  it('pure: neither the quotes nor their raw totals are changed (frozen input)', () => {
    const before = JSON.stringify(HISTORY);
    totalsByQuoteCurrency(HISTORY, { include: isRevenue, accountCurrency: 'GBP' });
    expect(JSON.stringify(HISTORY)).toBe(before);
  });

  it('normalizes only ILS/USD/EUR/GBP (codes in any case, or their symbols); the display order never duplicates', () => {
    expect(['ils', ' Usd ', '€', '£', '₪', '$'].map(normalizeQuoteCurrency)).toEqual(['ILS', 'USD', 'EUR', 'GBP', 'ILS', 'USD']);
    expect(['JPY', '', null, undefined, 'shekel'].map(normalizeQuoteCurrency)).toEqual([null, null, null, null, null]);
    expect(quoteCurrencyDisplayOrder('GBP')).toEqual(['GBP', 'ILS', 'USD', 'EUR']);
    expect(quoteCurrencyDisplayOrder('bogus')).toEqual(['ILS', 'USD', 'EUR', 'GBP']);
    expect(QUOTE_CURRENCY_SYMBOLS).toEqual({ ILS: '₪', USD: '$', EUR: '€', GBP: '£' });
  });
});
