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

// Task 35 (Codex F4): a line whose price was never entered. Editor: unit_price '' / null; saved row: quote_items.price_missing === true
// (forward-only column - a historical 0 is never reinterpreted as missing). An intentional 0 is a free line, never "missing".
export function isItemPriceMissing(item) {
  if (!item) return false;
  return item.price_missing === true || item.unit_price === '' || item.unit_price == null;
}

// the real lines (not the untouched default row, not nameless rows) that have no price
export function missingPriceItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => !isUntouchedPlaceholderItem(it) && String(it?.description || '').trim() !== '' && isItemPriceMissing(it));
}

// Before ANY customer output (copy message / WhatsApp / email / public share / final PDF / final print) a quote with missing prices
// shows ONE specific notice: which lines, how many, and that the total is partial. What happens next is ONE explicit Owner decision:
//   'confirm' - the owner must explicitly confirm (cancel = nothing is sent / copied / printed);   'block' - output is refused.
// Owner decision 2026-10-12 (Task 37, D1): 'block' - a draft with gaps may be saved, viewed, edited and priced, but no customer output
// leaves until every required price is entered (an intentional 0 is a price). The notice says how to complete the prices.
// The public quote DTO (get-public-quote) carries 'price' (not unit_price) and price_missing only when true: there ONLY the explicit flag
// counts (a historical / intentional 0 is never reinterpreted as missing).
export function publicItemsForNotice(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({ description: it?.description, unit_price: it?.price ?? it?.unit_price ?? 0, price_missing: it?.price_missing === true }));
}

export const MISSING_PRICE_OUTPUT_POLICY = 'block';
export function missingPriceOutputNotice(quote, { isHebrew = true, policy = MISSING_PRICE_OUTPUT_POLICY, items = null } = {}) {
  const missing = missingPriceItems(Array.isArray(items) ? items : quote?.quote_items);
  if (!missing.length) return null;
  const names = missing.slice(0, 3).map((it) => (isHebrew ? `„${String(it.description).trim()}”` : `"${String(it.description).trim()}"`));
  const more = missing.length - names.length;
  const blocked = policy === 'block';
  const list = names.join(', ') + (more > 0 ? (isHebrew ? ` ועוד ${more}` : ` and ${more} more`) : '');
  const text = isHebrew
    ? `בהצעה יש ${missing.length === 1 ? 'פריט אחד' : `${missing.length} פריטים`} ללא מחיר: ${list}. הסכום הכולל בהצעה חלקי — הוא לא כולל את הפריטים האלה.${blocked ? ' כדי לשלוח ללקוח, השלימו קודם את המחירים: פתחו את ההצעה לעריכה ולחצו „ערוך מחיר” בכל פריט שמסומן „יש להזין מחיר”. מחיר 0 מכוון מותר.' : ' להמשיך בכל זאת?'}`
    : `This quote has ${missing.length === 1 ? '1 item' : `${missing.length} items`} without a price: ${list}. The quote total is partial - it does not include these items.${blocked ? ' To send it to a customer, first complete the prices: open the quote for editing and use "Edit price" on every item marked "Enter a price". An intentional 0 is allowed.' : ' Continue anyway?'}`;
  return { count: missing.length, blocked, text };
}

// Task 36 (Owner, section A): a customer message (copy / WhatsApp) of a quote with unpriced lines says the total is partial - one line in
// the QUOTE's language after the message (never inside the LTR-isolated {total} value). Only flagged lines count (historical 0 = free).
export function appendPartialTotalNote(message, quote, isLocalQuote) {
  if (!missingPriceItems(quote?.quote_items).length) return message;
  return `${message}\n\n${isLocalQuote ? 'שימו לב: הסכום בהצעה חלקי - יש בה פריטים שטרם תומחרו.' : 'Please note: the quote total is partial - some items are not priced yet.'}`;
}
