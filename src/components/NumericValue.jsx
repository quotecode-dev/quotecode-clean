
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
