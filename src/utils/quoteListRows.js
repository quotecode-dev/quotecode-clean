import { formatShortDateTime, calendarParts } from './shortDate';
import { formatQuoteFallback } from './quoteNumber';

// Owner R4 (moved here unchanged by Task 17 so the Statistics screen shares them): quote numbers on list surfaces are displayed
// WITHOUT a literal '#' (persisted ids/routing untouched; formatQuoteFallback keeps its own output for PDF/delete-confirm).
export const displayQuoteNumber = (quote) => String(formatQuoteFallback(quote) || '').replace(/^#/, '');

// ONE truthful party label for a quote (Codex Task 17 review follow-up, fixed in Task 18): the real client name, else the quote's
// own title, else its full number - never a fabricated client and never 'N/A'. `kind` tells the caller which one it shows.
// Shared by the hot-quote alert, the Statistics hot list and the task links.
export function quotePartyLabel(quote) {
  const client = String(quote?.clients?.company_name || '').trim();
  if (client) return { kind: 'client', text: client };
  const title = String(quote?.subject || quote?.quote_subject || '').trim();
  if (title) return { kind: 'title', text: title };
  return { kind: 'number', text: displayQuoteNumber(quote) };
}

// השפה/מע"מ של קישור ההצעה נגזרים מנתוני ההצעה השמורים (currency/tax_rate)
// ולא מהגדרת השפה הנוכחית של המשתמש המחובר - כך שקישור להצעה בינלאומית
// תמיד יפתח כאנגלית/ללא מע"מ, גם אם נוצר ע"י בעל עסק ישראלי, ולהיפך.
// Shared with the Statistics hot-quote actions (Task 17) - one canonical view/tracking link.
export const getQuoteViewLink = (quote) => {
  const isLocalQuote = Number(quote?.tax_rate) > 0 || (quote?.currency || '').toUpperCase() === 'ILS';
  return isLocalQuote
    ? `${window.location.origin}/public-quote/${quote.id}`
    : `${window.location.origin}/en/public-quote/${quote.id}?lang=en`;
};


// Relative day for the desktop list: 'today' / 'yesterday' / null (older). The calendar day is the ACCOUNT MARKET's product
// day (IRON-DATE-001), never the browser zone. The clock time is the same instant in the same zone ('HH:mm').
export function relativeQuoteDay(createdAt, market, now = new Date()) {
  const day = calendarParts(createdAt, market);
  if (!day) return { kind: null, time: '' };
  const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;
  const kind = same(day, calendarParts(now, market)) ? 'today'
    : same(day, calendarParts(new Date(now.getTime() - 86400000), market)) ? 'yesterday' : null;
  const time = (formatShortDateTime(createdAt, market).match(/\d{2}:\d{2}$/) || [''])[0];
  return { kind, time };
}

// Hot promotion: when an eligible hot quote exists the compact list shows it first (most views, ties newest), followed by the next
// three non-hot rows in the existing sort order. Every quote appears exactly once. Show-all keeps the existing order.
// The hottest eligible row (most views, ties newest) - the ONE pick shared by the compact promotion and the hot-quote banner.
export function pickLeadHotRow(rows) {
  const hot = rows.filter((r) => r.isHot);
  if (hot.length === 0) return null;
  const stamp = (r) => { const t = Date.parse(r.quote.created_at); return Number.isNaN(t) ? 0 : t; };
  return hot.reduce((best, r) => {
    const views = Number(r.quote.view_count || 0);
    const bestViews = Number(best.quote.view_count || 0);
    return views > bestViews || (views === bestViews && stamp(r) > stamp(best)) ? r : best;
  });
}

// Owner bug 2026-10-14: the compact list must never DROP a quote - it used to skip every other hot quote, so with two hot quotes
// (and the "show all" button only above 4) the second one was unreachable. The lead hot quote is first; every other row follows in order.
export function pickCompactRows(rows, limit = 4) {
  const lead = pickLeadHotRow(rows);
  if (!lead) return rows.slice(0, limit);
  return [lead, ...rows.filter((r) => r !== lead)].slice(0, limit);
}
