// Unified quote (Owner console 2026-11-11, spec section 5): how a catalog item's price is calculated - one optional value per item,
// stored in services.price_basis (CHECK in migration 20261112100000). NULL = per item (every existing item).
// Israel shows metres; an international business shows feet (the same rule as the quote rows).
export const PRICE_BASES_LOCAL = Object.freeze(['unit', 'm2', 'linear_meter', 'hour', 'day', 'kg', 'fixed']);
export const PRICE_BASES_INTL = Object.freeze(['unit', 'sq_ft', 'linear_ft', 'hour', 'day', 'kg', 'fixed']);
const LABELS = {
  unit: ['ליחידה', 'Per item'], m2: ['למ״ר', 'Per m²'], sq_ft: ['לרגל רבועה', 'Per sq ft'], linear_meter: ['למטר', 'Per metre'],
  linear_ft: ['לרגל', 'Per ft'], hour: ['לשעה', 'Per hour'], day: ['ליום', 'Per day'], kg: ['לק״ג', 'Per kg'],
  fixed: ['מחיר אחד לכל העבודה', 'One price for all the work'],
};
export const priceBasisLabel = (basis, isHebrew) => (LABELS[basis] ? LABELS[basis][isHebrew ? 0 : 1] : '');
export const priceBasesFor = (international) => (international ? PRICE_BASES_INTL : PRICE_BASES_LOCAL);
// the value written to the database: '' / 'unit' / unknown = NULL (per item, as every existing item)
export const priceBasisForSave = (v) => (v && v !== 'unit' && LABELS[v] ? v : null);
