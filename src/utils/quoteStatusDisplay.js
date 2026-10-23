// Night task 2026-10-16 (R-06 / R-07 / R-08 / R-21 / R-22, Owner-approved L-13 / L-14): the ONE status a quote SHOWS - the same label
// on the desktop list, the phone / tablet cards, the old table, the client list, Statistics, the status filter and the status sort.
// Derived from the saved status + the customer views, never a new persisted status:
//   hot              viewed 3+ times and not approved / paid                       "נצפתה, ממתינה"
//   approved / paid  the final statuses
//   sent_*           saved Sent, or a Draft whose link the customer already opened (shared by hand)
//   unfinished       a draft with nothing to charge yet                           "טיוטה"
//   needs_sending    a complete draft the customer has not seen                    "צריך לשלוח"
//   expired          not approved / paid and its validity date has passed           "פג תוקף" (Owner 2026-10-23, typed L-13 / L-14 / L-17 / L-25 / L-26)
import { isHotQuote, isAwaitingQuote } from './quoteStatistics';
import { sentNotViewed } from './quoteSentMark';
import { isUnfinishedSavedQuote } from './quoteCompleteness';
import { isOpenQuoteExpired } from './quoteValidity';

const lower = (v) => String(v || '').toLowerCase();
const views = (q) => Number(q?.view_count || 0);

export const QUOTE_DISPLAY_STATUSES = Object.freeze(['hot', 'approved', 'paid', 'sent_not_viewed', 'sent_viewed', 'sent', 'unfinished', 'needs_sending', 'expired']);

export function quoteDisplayStatus(quote) {
  const s = lower(quote?.status) || 'draft';
  if (isHotQuote({ ...quote, status: s })) return 'hot';
  if (s === 'approved') return 'approved';
  if (s === 'paid') return 'paid';
  // an unfinished draft stays "Draft" (continue editing comes first)
  if (isOpenQuoteExpired(quote) && !(s === 'draft' && isUnfinishedSavedQuote(quote))) return 'expired';
  if (s === 'sent' || views(quote) > 0) return sentNotViewed(quote) ? 'sent_not_viewed' : views(quote) > 0 ? 'sent_viewed' : 'sent';
  return isUnfinishedSavedQuote(quote) ? 'unfinished' : 'needs_sending';
}

// R-08 (Owner default 1): "awaiting" = reached the customer (Sent or viewed) and not approved / paid - everywhere
export const isQuoteAwaiting = isAwaitingQuote;

const LABELS = Object.freeze({
  hot: ['נצפתה, ממתינה', 'Viewed, awaiting'],
  approved: ['אושרה', 'Approved'],
  paid: ['שולמה', 'Paid'],
  sent_not_viewed: ['נשלחה · טרם נצפתה', 'Sent · not viewed yet'],
  sent_viewed: ['נשלחה · נצפתה', 'Sent · viewed'],
  sent: ['נשלחה', 'Sent'],
  unfinished: ['טיוטה', 'Draft'],
  needs_sending: ['צריך לשלוח', 'Needs sending'],
  expired: ['פג תוקף', 'Expired'],
});
export const quoteDisplayLabel = (key, isHebrew) => (LABELS[key] || LABELS.needs_sending)[isHebrew ? 0 : 1];

// the visual tone of the list (data-tone) and the chip colours of the cards / old table
export function quoteDisplayTone(key) {
  if (key === 'hot') return 'hot';
  if (key === 'approved' || key === 'paid') return 'approved';
  if (key.startsWith('sent')) return 'sent';
  if (key === 'expired') return 'expired';
  return key === 'unfinished' ? 'draft' : 'needs-sending';
}
export const quoteDisplayChipRole = (key) => (key === 'paid' ? 'paid' : key === 'approved' ? 'approved' : key === 'hot' || key.startsWith('sent') ? 'sent' : key === 'unfinished' ? 'unfinished' : key === 'expired' ? 'expired' : 'draft');

// R-07: the status filter speaks the shown labels. 'draft' (an older saved filter value) = not yet with the customer.
export const QUOTE_FILTER_OPTIONS = Object.freeze(['needs_sending', 'unfinished', 'sent', 'hot', 'expired', 'approved', 'paid']);
export function matchesQuoteFilter(quote, filter) {
  if (!filter || filter === 'All') return true;
  const f = lower(filter);
  const key = quoteDisplayStatus(quote);
  if (f === 'sent') return key.startsWith('sent');
  if (f === 'draft') return key === 'unfinished' || key === 'needs_sending';
  return key === f;
}
export const quoteFilterLabel = (f, isHebrew) => (f === 'sent' ? (isHebrew ? 'נשלחה (כולל נצפתה)' : 'Sent (incl. viewed)') : quoteDisplayLabel(f, isHebrew));
