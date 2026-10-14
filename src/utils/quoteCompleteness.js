// SMART-QUOTE-01: an empty/partial quote may be saved only as a clearly labelled UNFINISHED draft, and it must never masquerade as a
// customer-ready quote (preview, public page, print/PDF, send/share). One definition, used by the editor, the quote list and the
// public quote page. It never changes a stored value.
import { isUntouchedPlaceholderItem } from './structuredQuoteItemPersistence';

// items that carry real content (the untouched default placeholder row and nameless rows are not items yet)
export function countRealQuoteItems(items) {
  return (Array.isArray(items) ? items : []).filter((it) => !isUntouchedPlaceholderItem(it) && String(it?.description || '').trim() !== '').length;
}

// editor: unfinished while there is no real item or nothing to charge
export function isUnfinishedQuoteForm({ items, totalAmount }) {
  return countRealQuoteItems(items) === 0 || !(Number(totalAmount) > 0);
}

// saved quote (list / public page / print): unfinished when there is nothing to charge, or (when items are known) no items
export function isUnfinishedSavedQuote(quote, items = null) {
  if (!quote) return false;
  const status = String(quote.status || '').toLowerCase();
  if (status === 'approved' || status === 'paid' || (quote.signature && String(quote.signature) !== '')) return false; // history
  if (!(Number(quote.total) > 0)) return true;
  return Array.isArray(items) ? items.length === 0 : false;
}
