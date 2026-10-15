// Task 17 (2026-10-09): truthful quote statistics derived ONLY from the already-loaded, tenant-scoped quotes.
// Data contract facts this module relies on (and never goes beyond):
//   - quote status is the canonical enum public.quote_status = draft | sent | approved | paid (there is NO `rejected`);
//   - per quote: created_at, view_count, total, currency (persisted, historical);
//   - there are NO authoritative sent_at / first_viewed_at / approved_at / rejected_at fields, so no rejected metric and no
//     time-to-view / time-to-approval is computed (updated_at is never used as a lifecycle time).
// Money is never combined across currencies: value totals come from totalsByQuoteCurrency (IRON-MARKET-004).
import { totalsByQuoteCurrency } from './money';

export const QUOTE_STATUSES = Object.freeze(['draft', 'sent', 'approved', 'paid']);
export const STAT_PERIODS = Object.freeze({ '7d': 7, '30d': 30, '90d': 90, all: null });
export const UNSUPPORTED_METRICS = Object.freeze(['rejected', 'time_to_first_view', 'time_to_approval']);
const DAY_MS = 86_400_000;

const statusOf = (q) => String(q?.status || '').toLowerCase();
const views = (q) => Number(q?.view_count || 0);
export const isWonQuote = (q) => statusOf(q) === 'approved' || statusOf(q) === 'paid';
// the ONE hot-quote rule (also used by the quote list): viewed 3+ times and not yet approved/paid
export const isHotQuote = (q) => views(q) >= 3 && !isWonQuote(q);
// Night task 2026-10-16 (R-08 / AUD-09, Owner default 1): the ONE "awaiting" rule - reached the customer (Sent, or a Draft whose link
// the customer already opened) and not approved / paid. The quote list counter, Statistics, reminders and the calendar all use it.
export const isAwaitingQuote = (q) => !isWonQuote(q) && (statusOf(q) === 'sent' || views(q) > 0);

export function filterQuotesForStatistics(quotes, { period = '30d', status = 'all', now = Date.now() } = {}) {
  if (!(period in STAT_PERIODS)) throw new Error(`unknown statistics period ${period}`);
  if (status !== 'all' && !QUOTE_STATUSES.includes(status)) throw new Error(`unknown quote status ${status}`);
  const days = STAT_PERIODS[period];
  const since = days === null ? null : now - days * DAY_MS;
  return (Array.isArray(quotes) ? quotes : []).filter((q) => {
    if (!q) return false;
    if (status !== 'all' && statusOf(q) !== status) return false;
    if (since === null) return true;
    const created = Date.parse(q.created_at);
    return Number.isFinite(created) && created >= since && created <= now;
  });
}

// hot list order: most views first, then newest first (id as a final deterministic tie-break)
const byViewsThenNewest = (a, b) => (views(b) - views(a))
  || ((Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  || String(a.id).localeCompare(String(b.id));

export function computeQuoteStatistics(quotes, { period = '30d', status = 'all', now = Date.now(), accountCurrency = null } = {}) {
  const population = filterQuotesForStatistics(quotes, { period, status, now });
  const count = (fn) => population.filter(fn).length;
  const awaiting = count(isAwaitingQuote);
  const won = count(isWonQuote);
  const denominator = awaiting + won; // quotes that reached the customer; an unseen draft never enters the denominator
  return {
    created: population.length,
    awaiting,
    viewed: count((q) => views(q) > 0),
    won,
    hot: count(isHotQuote),
    conversion: { numerator: won, denominator, percent: denominator === 0 ? 0 : Math.round((won / denominator) * 100) },
    valueTotals: totalsByQuoteCurrency(population, { accountCurrency }),
    hotQuotes: population.filter(isHotQuote).sort(byViewsThenNewest),
    unsupported: UNSUPPORTED_METRICS,
  };
}
