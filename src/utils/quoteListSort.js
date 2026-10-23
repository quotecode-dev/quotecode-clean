import { isQuoteImmutable } from './quoteLock';
import { isUnfinishedSavedQuote } from './quoteCompleteness';
import { getQuoteOrderSortKey } from './quoteNumber';
import { isOpenQuoteExpired } from './quoteValidity';

// Quote list sorting (one pure source for the desktop header buttons, the toolbar Sort button, the mobile sort select and the
// CSV export order). Every column sorts by its OWN typed key, never by a display string:
//   id      numeric + prefix aware (getQuoteOrderSortKey: A100739 > A100738; legacy rows without a number sort first)
//   client / subject   localized collation (Intl.Collator, numeric: true, so "Client 2" < "Client 10")
//   status  the logical STATUS_ORDER below (the same status the row shows, not the raw database string)
//   views   number
//   created_at  timestamp
//   total   number in the quote's own business currency (never a formatted string)
//   action  the ACTION_ORDER below (the same action the row button performs)
// Ties always keep the incoming order in BOTH directions (decorated-index stable sort).

// Logical lifecycle, first to last: unfinished draft -> needs sending (complete draft) -> sent -> viewed/hot -> approved -> paid.
// Owner 2026-10-23: an open quote whose validity has passed sorts after the hot ones, before the closed ones.
export const STATUS_ORDER = ['unfinished', 'needs-sending', 'sent', 'hot', 'expired', 'approved', 'paid'];
// Priority of the contextual row action, most urgent first: Open & track (hot), Continue editing (unfinished), Open, View.
export const ACTION_ORDER = ['track', 'edit', 'open', 'view'];

export const SORT_FIELDS = ['id', 'client', 'subject', 'status', 'views', 'created_at', 'total', 'action'];

const lower = (value) => String(value || '').toLowerCase();

// Hot = viewed at least three times and not signed/paid yet (the one eligibility rule of the list, the banner and the row badge).
export function isQuoteHot(quote) {
  const status = lower(quote?.status) || 'draft';
  return Number(quote?.view_count || 0) >= 3 && status !== 'approved' && status !== 'paid' && !isOpenQuoteExpired(quote);
}

// R-07 (night task 2026-10-16): the SAME status the row shows - a Draft the customer already opened sorts with the sent quotes
export function getQuoteStatusKey(quote) {
  if (isQuoteHot(quote)) return 'hot';
  const status = lower(quote?.status) || 'draft';
  if (status === 'approved') return 'approved';
  if (status === 'paid') return 'paid';
  if (isOpenQuoteExpired(quote) && !(status === 'draft' && isUnfinishedSavedQuote(quote))) return 'expired';
  if (status === 'sent' || Number(quote?.view_count || 0) > 0) return 'sent';
  return isUnfinishedSavedQuote(quote) && status === 'draft' ? 'unfinished' : 'needs-sending';
}

export function getQuoteActionKind(quote) {
  if (isQuoteHot(quote)) return 'track';
  const status = getQuoteStatusKey(quote);
  if (status === 'unfinished' && !isQuoteImmutable(quote)) return 'edit';
  return status === 'approved' || status === 'paid' ? 'view' : 'open';
}

export function quoteSubject(quote) {
  return quote?.subject || quote?.quote_subject || quote?.quote_items?.[0]?.description || '';
}

const stamp = (value) => { const t = Date.parse(value); return Number.isNaN(t) ? 0 : t; };

// 'date' (mobile select) and 'created_at' (toolbar default) are the same column.
export function normalizeSortField(field) {
  return field === 'date' ? 'created_at' : field;
}

export function sortQuotes(quotes, field, direction, locale = 'en') {
  const key = normalizeSortField(field);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const factor = direction === 'asc' ? 1 : -1;
  const text = (pick) => (a, b) => collator.compare(pick(a), pick(b));
  const compare = {
    id: (a, b) => getQuoteOrderSortKey(a) - getQuoteOrderSortKey(b),
    client: text((q) => q?.clients?.company_name || ''),
    clientType: text((q) => q?.clients?.client_type || ''),
    subject: text(quoteSubject),
    status: (a, b) => STATUS_ORDER.indexOf(getQuoteStatusKey(a)) - STATUS_ORDER.indexOf(getQuoteStatusKey(b)),
    views: (a, b) => Number(a?.view_count || 0) - Number(b?.view_count || 0),
    total: (a, b) => Number(a?.total || 0) - Number(b?.total || 0),
    action: (a, b) => ACTION_ORDER.indexOf(getQuoteActionKind(a)) - ACTION_ORDER.indexOf(getQuoteActionKind(b)),
    created_at: (a, b) => stamp(a?.created_at) - stamp(b?.created_at),
  }[key] || ((a, b) => stamp(a?.created_at) - stamp(b?.created_at));
  return quotes
    .map((quote, index) => ({ quote, index }))
    .sort((x, y) => (compare(x.quote, y.quote) * factor) || (x.index - y.index))
    .map((entry) => entry.quote);
}
