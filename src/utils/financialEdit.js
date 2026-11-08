// The ONE "is this a financial edit of a saved quote?" decision (Codex review 2026-10-23 R-07): the save (Dashboard handleSaveQuote) and
// the editor preview use the same rule, so the preview never shows the old amounts of a quote that the save is about to recalculate
// (or the other way round). Moved verbatim from Dashboard.jsx (SQ-F01 / Task 35): the active quantity (a measured line's calculated
// quantity), the unit price and the "price missing" flag of every line, as a multiset; the discount; the client type.
import { getActiveQuantity, sectionRepeatOf } from './professionalQuoteItem';
import { isItemPriceMissing } from './quoteCompleteness';

const numKey = (v) => Number(v || 0).toFixed(6);
const normType = (v) => v || '';

// Owner console 2026-11-08 (stage 3 of the one quote builder, typed incl. L-09 / L-17): the unit count of each row is part of its key (form rows join their unit
// by section_key / key, saved rows by section_id / id); without sections every row counts once, as before.
export function isFinancialChange({ items, discount, clientType, savedItems, savedDiscount, savedClientType, sections, savedSections }) {
  // Task 35 (F4): a missing price and an intentional 0 are different financial states (the flag is part of the pair)
  const current = (items || []).map((it) => `${numKey(getActiveQuantity(it))}|${numKey(it.unit_price)}|${isItemPriceMissing(it) ? 1 : 0}|${sectionRepeatOf(it, sections)}`).sort();
  const saved = (savedItems || []).map((it) => `${numKey(getActiveQuantity(it))}|${numKey(it.unit_price)}|${it.price_missing === true ? 1 : 0}|${sectionRepeatOf(it, savedSections, { itemKeyField: 'section_id', sectionKeyField: 'id' })}`).sort();
  const itemsChanged = current.length !== saved.length || current.some((v, i) => v !== saved[i]);
  const discountChanged = numKey(discount) !== numKey(savedDiscount);
  const clientTypeChanged = normType(clientType) !== normType(savedClientType);
  return { changed: itemsChanged || discountChanged || clientTypeChanged, clientTypeChanged };
}
