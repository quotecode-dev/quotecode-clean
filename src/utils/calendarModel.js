// Task 19 - Calendar (minimal Owner-approved scope): the PURE calendar model. No I/O and no clock unless one is passed.
//
// Dates: every calendar day is a date-only 'YYYY-MM-DD' string handled with UTC arithmetic only, so a day never shifts across a time
// zone or the UI language (IRON-DATE-001). "Today" is the AUTHENTICATED ACCOUNT MARKET's product day (Local Asia/Jerusalem,
// International UTC) through manualTasks.marketToday - unchanged law, no business time-zone setting. The week starts on Sunday.
//
// Holidays: Local/Israel accounts only, from the BUNDLED dataset src/data/israelHolidays.json (Israeli official non-working rest days,
// generated from the ICU/CLDR Hebrew calendar by scripts/generate-israel-holidays.mjs). International accounts get no holiday data and no
// Saturday/holiday day classes. Outside the dataset range a Local calendar shows no holiday data and says so - never a guessed date.
//
// Events come only from existing persisted records: tasks with a due date (their due time when set) and SENT quotes (awaiting the
// customer's signature) on their existing validity-end date. Signed quotes (approved / paid) are never dated events - the product has no
// reliable signed-at timestamp. Drafts are not awaiting a signature and are not shown.
// Task 27 (spec §6): plus each quote's OPTIONAL work date (public.quote_service_schedule) - its own 'service' layer, separate from the
// validity end; shown for any of the owner's quotes except a rejected one, and only when the quote is in the loaded list.
import holidayData from '../data/israelHolidays.json';
import { isAwaitingQuote } from './quoteStatistics';
import { isCalendarDate, marketToday, shortTime, taskGroupOf, marketClock } from './manualTasks';
import { isQuoteAcceptanceExpired } from './quoteValidity';
import { displayQuoteNumber, quotePartyLabel } from './quoteListRows';

export const CALENDAR_VIEWS = Object.freeze(['day', 'week', 'month']);
export const WEEK_START = 0; // Sunday (Owner decision: no setting)
export const HOLIDAY_RANGE = Object.freeze({ from: holidayData.range.from, to: holidayData.range.to });
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const parse = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const addDays = (iso, n) => fmt(parse(iso) + n * DAY_MS);
export const weekday = (iso) => new Date(parse(iso)).getUTCDay(); // 0 Sunday .. 6 Saturday
export const dayOfMonth = (iso) => Number(String(iso).slice(8, 10));
export const monthKey = (iso) => String(iso).slice(0, 7);
export const addMonths = (iso, n) => { const d = new Date(parse(iso)); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); return fmt(t); };
export const startOfWeek = (iso) => addDays(iso, -((weekday(iso) - WEEK_START + 7) % 7));
export const weekDates = (iso) => { const s = startOfWeek(iso); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
// Sunday-start weeks covering the whole month of `iso` (5 or 6 rows; days outside the month are included and flagged by the caller).
export function monthWeeks(iso) {
  const first = `${monthKey(iso)}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const weeks = [];
  for (let s = startOfWeek(first); s <= last; s = addDays(s, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)));
  return weeks;
}

// Local/Israel only: date -> [{ key, he, en }]. International -> an empty map (no foreign holiday data, no country inference).
export function holidaysFor(isLocalIsraeliBusiness) {
  const map = new Map();
  if (isLocalIsraeliBusiness !== true) return map;
  for (const h of holidayData.days) { if (!map.has(h.date)) map.set(h.date, []); map.get(h.date).push({ key: h.key, he: h.he, en: h.en }); }
  return map;
}
// Owner 2026-10-29: Local/Israel only, the observances (Hanukkah, Purim, eves, Chol HaMoed...) - working days shown by name only. A
// separate map, never passed to dayClassOf, so these days keep their ordinary / Saturday background. International -> an empty map.
export function observancesFor(isLocalIsraeliBusiness) {
  const map = new Map();
  if (isLocalIsraeliBusiness !== true) return map;
  for (const h of holidayData.observances) { if (!map.has(h.date)) map.set(h.date, []); map.get(h.date).push({ key: h.key, he: h.he, en: h.en }); }
  return map;
}
export const holidayDataCovers = (iso) => { const y = Number(String(iso).slice(0, 4)); return y >= HOLIDAY_RANGE.from && y <= HOLIDAY_RANGE.to; };

// The day class drives the day background. Local/Israel: holiday > saturday > ordinary. International: always ordinary.
export function dayClassOf(iso, { isLocalIsraeliBusiness, holidays }) {
  if (isLocalIsraeliBusiness !== true) return 'ordinary';
  if (holidays?.has(iso)) return 'holiday';
  if (weekday(iso) === 6) return 'saturday';
  return 'ordinary';
}

// Events from existing persisted records only.
export function buildCalendarEvents({ tasks = [], quotes = [], schedules = [], market, now = new Date() } = {}) {
  const today = marketToday(market, now);
  const clock = marketClock(market, now);
  const out = [];
  for (const t of Array.isArray(tasks) ? tasks : []) {
    if (!t || !isCalendarDate(t.due_date)) continue;
    const done = t.status === 'completed';
    out.push({
      id: `task:${t.id}`, kind: 'task', ref: t.id, date: t.due_date, time: shortTime(t.due_time), title: t.title || '', priority: t.priority || 'normal',
      status: done ? 'completed' : (taskGroupOf(t, { today, clock }) === 'overdue' ? 'overdue' : 'open'),
    });
  }
  for (const q of Array.isArray(quotes) ? quotes : []) {
    // R-08 (night task 2026-10-16): awaiting the customer = the ONE rule (Sent, or a Draft the customer already opened; not approved /
    // paid); an unseen draft and a signed quote are not dated events
    if (!q || !isAwaitingQuote(q)) continue;
    const day = typeof q.valid_until === 'string' ? q.valid_until.slice(0, 10) : null;
    if (!isCalendarDate(day)) continue;
    out.push({
      id: `quote:${q.id}`, kind: 'quote', ref: q.id, date: day, time: null, number: displayQuoteNumber(q), party: quotePartyLabel(q),
      status: isQuoteAcceptanceExpired(day, market, now) ? 'expired' : 'awaiting_signature', quote: q,
    });
  }
  const quoteById = new Map((Array.isArray(quotes) ? quotes : []).filter((q) => q && q.id).map((q) => [q.id, q]));
  for (const s of Array.isArray(schedules) ? schedules : []) {
    const q = s ? quoteById.get(s.quote_id) : null;
    const day = typeof s?.service_date === 'string' ? s.service_date.slice(0, 10) : null;
    if (!q || String(q.status || '').toLowerCase() === 'rejected' || !isCalendarDate(day)) continue;
    out.push({
      id: `service:${q.id}`, kind: 'service', ref: q.id, date: day, time: shortTime(s.service_time), number: displayQuoteNumber(q), party: quotePartyLabel(q),
      status: 'scheduled', quote: q,
    });
  }
  return out;
}
// date -> events, deterministic order: untimed (quote deadlines first, then untimed tasks) before timed tasks by time, then title / id.
export function eventsByDate(events) {
  const map = new Map();
  for (const e of events) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); }
  const rank = (e) => (e.time ? 2 : e.kind === 'quote' ? 0 : 1);
  for (const list of map.values()) list.sort((a, b) => rank(a) - rank(b) || String(a.time || '').localeCompare(String(b.time || '')) || String(a.title || a.number || '').localeCompare(String(b.title || b.number || '')) || a.id.localeCompare(b.id));
  return map;
}
// The initial view from the device class (Owner decision): month on desktop and tablet portrait, week on tablet landscape, day on mobile.
export function initialViewFor(width, height) {
  if (!Number.isFinite(width) || width <= 560) return 'day';
  if (width <= 1180 && Number.isFinite(height) && width > height) return 'week';
  return 'month';
}
export const HE_MONTHS = Object.freeze(['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']);
export const EN_MONTHS = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
export const HE_WEEKDAYS_SHORT = Object.freeze(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);
export const EN_WEEKDAYS_SHORT = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const HE_WEEKDAYS = Object.freeze(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);
export const EN_WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
export const monthTitle = (iso, isHebrew) => `${(isHebrew ? HE_MONTHS : EN_MONTHS)[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}`;
export { marketToday };
