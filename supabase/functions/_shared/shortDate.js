// IRON-DATE-001 - THE ONE product-owned short-date primitive (frontend + Edge Functions import this exact file).
//
// Contract (Owner rule):
//   Local / Hebrew market          -> DD/MM/YYYY   (2026-09-13 -> 13/09/2026)
//   International / English market -> MM/DD/YYYY   (2026-09-13 -> 09/13/2026)
// The ACCOUNT MARKET alone decides the order. Currency, browser locale, OS locale and the UI language toggle never do.
//
// Calendar rule:
//   - A date-only value ('YYYY-MM-DD', e.g. quotes.valid_until) is a calendar date: rendered as-is, never shifted by a time zone.
//   - A timestamp (ISO string with time, Date, epoch ms) is converted to its calendar day in the market's product time zone:
//       Local -> Asia/Jerusalem, International -> UTC. The machine/browser time zone never decides the day.
//     (OD-1 validity uses Anywhere-on-Earth for International *expiry*; that is an acceptance rule, not a display rule.)
//   - A timestamp string without a zone designator is read as UTC (never as browser-local time).
// Long-form prose dates ("September 13, 2026") are NOT this primitive; they are separate, documented exceptions.
// Plain JS on purpose: Vite (src/utils/shortDate.js re-exports it) and Deno (chat-ai) load the same bytes.

export const SHORT_DATE_TIME_ZONE = Object.freeze({ Local: 'Asia/Jerusalem', International: 'UTC' });

// 'Local' | 'LCL' | true -> 'Local'; everything else -> 'International'. A boolean is accepted only where the caller's flag IS the
// account market (e.g. the authenticated app's isHebrew = isHebrewEnv(stored country)); callers must never pass a language toggle.
export function resolveDateMarket(market) {
  if (market === true || market === 'Local' || market === 'LCL') return 'Local';
  return 'International';
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

// A timestamp as a Date (zone-less ISO strings are UTC), or null.
function toInstant(value) {
  let v = value;
  if (typeof v === 'string') {
    const s = v.trim();
    v = /^\d{4}-\d{2}-\d{2}[T ]\d/.test(s) && !HAS_ZONE.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  }
  const date = v instanceof Date ? v : new Date(v);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zonedParts(date, market, options) {
  const timeZone = SHORT_DATE_TIME_ZONE[resolveDateMarket(market)];
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, ...options }).formatToParts(date);
  return (type) => parts.find((p) => p.type === type)?.value;
}

// Calendar {y, m, d} (zero-padded strings) of a value under the market rule, or null when unusable.
export function calendarParts(value, market) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const only = value.trim().match(DATE_ONLY);
    if (only) return { y: only[1], m: only[2], d: only[3] };
  }
  const date = toInstant(value);
  if (!date) return null;
  const get = zonedParts(date, market, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return { y: get('year'), m: get('month'), d: get('day') };
}

// The canonical short date. Empty input -> ''; an unparseable value is returned unchanged (never a fabricated date).
export function formatShortDate(value, market) {
  const p = calendarParts(value, market);
  if (!p) return value === null || value === undefined ? '' : String(value);
  return resolveDateMarket(market) === 'Local' ? `${p.d}/${p.m}/${p.y}` : `${p.m}/${p.d}/${p.y}`;
}

// Short date + 24h HH:mm, both in the market's product time zone (Admin/audit timestamps). Date-only input -> date only.
export function formatShortDateTime(value, market) {
  const date = typeof value === 'string' && DATE_ONLY.test(value.trim()) ? null : toInstant(value);
  if (!date) return formatShortDate(value, market);
  const get = zonedParts(date, market, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${formatShortDate(date, market)} ${get('hour')}:${get('minute')}`;
}

// The viewer's own wall-calendar day as 'YYYY-MM-DD' - ONLY for a live "today" clock (the Header), which shows the device's
// current day by design; the order still comes from formatShortDate(..., market).
export function deviceCalendarDate(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// A device-originated moment (e.g. "draft saved at", live shell clock): the device's own day + 24h HH:mm, ordered by the market.
export function formatDeviceShortDateTime(value, market) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${formatShortDate(deviceCalendarDate(d), market)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
