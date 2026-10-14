import { QUOTE_CURRENCY_SYMBOLS, normalizeQuoteCurrency } from '../utils/money';

// Iron Numeric Typography Law primitives. They only add the shared CSS
// contract (see .pf-num / .pf-money / .pf-money-slot in index.css) - the text
// is ALWAYS produced by the caller from the canonical formatters
// (formatNum / formatNumberLocal / formatWholeMoney / formatShortDate), so no
// calculation, rounding or currency rule lives here.

export function NumericValue({ children, className = '', style, as: Tag = 'span', ...rest }) {
  return <Tag className={`pf-num ${className}`.trim()} style={style} {...rest}>{children}</Tag>;
}

// symbol + already-formatted amount text. `slot` puts the atom in the
// protected physical-axis slot; `hero` is the Grand Total hierarchy variant.
export function MoneyValue({ symbol = '', text, slot = false, hero = false, className = '', style, ...rest }) {
  const cls = ['pf-money', slot ? 'pf-money-slot' : '', hero ? 'pf-money--hero' : '', className].filter(Boolean).join(' ');
  return <span className={cls} style={style} {...rest}>{symbol}{text}</span>;
}

export const DateValue = NumericValue;
export const QuoteNumber = NumericValue;

// IRON-MARKET-004: renders a quote aggregate from totalsByQuoteCurrency() - one money token per persisted quote currency, never
// one mixed number. Exactly one currency renders the SAME single MoneyValue as before (unchanged look); several currencies render
// separate tokens ("$151.00 · €200.40 · £80.10") that may wrap; quotes without a valid currency show a missing-data note instead
// of being assigned to any currency. Every token goes through the canonical formatMoneyDisplay(total, ITS currency) (IRON-ILS-001)
// and is a .pf-money atom (LTR, bidi-isolated, tabular numerals).
export function CurrencyTotals({ totals, formatMoneyDisplay, emptyCurrency, isHebrew, className = '', style }) {
  const { groups = [], unknownCount = 0 } = totals || {};
  const unknown = unknownCount > 0 ? (
    <span className="pf-currency-unknown" data-currency-unknown={unknownCount}>
      {isHebrew ? 'ללא מטבע תקין: ' : 'No valid currency: '}<bdi className="pf-num" dir="ltr">{unknownCount}</bdi>
    </span>
  ) : null;
  if (groups.length <= 1 && !unknown) {
    // zero quotes: a zero amount in the account currency (no quote amount is relabelled - there is none)
    const g = groups[0] || { currency: normalizeQuoteCurrency(emptyCurrency), total: 0 };
    return (
      <MoneyValue className={className} style={style} data-currency={g.currency || undefined}
        symbol={QUOTE_CURRENCY_SYMBOLS[g.currency] || ''} text={formatMoneyDisplay(g.total, g.currency || undefined)} />
    );
  }
  return (
    <span className={`pf-currency-totals ${className}`.trim()} style={style} data-currency-count={groups.length}>
      {groups.map((g, i) => (
        <span key={g.currency} className="pf-currency-token">
          {i > 0 && <span className="pf-currency-sep" aria-hidden="true">·</span>}
          <MoneyValue data-currency={g.currency} symbol={g.symbol} text={formatMoneyDisplay(g.total, g.currency)} />
        </span>
      ))}
      {unknown}
    </span>
  );
}
