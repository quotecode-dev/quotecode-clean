// Task 18 - durable manual tasks: the PURE rules shared by the Tasks screen and its tests (no I/O, no clock unless passed).
// The same limits and enums are enforced again by public.tasks (supabase/migrations/20261009180000_task18_durable_manual_tasks.sql);
// this module only mirrors them so the form can explain a refusal before anything is sent.
//
// Dates (IRON-DATE-001): due_date is a DATE-ONLY calendar value ('YYYY-MM-DD') and due_time a local wall-clock time ('HH:MM[:SS]');
// both are stored and compared as given - never shifted by a time zone or the UI language. "Today" and "now" are the AUTHENTICATED
// ACCOUNT MARKET's product day / clock (Local -> Asia/Jerusalem, International -> UTC), never the browser zone.
import { SHORT_DATE_TIME_ZONE, calendarParts, resolveDateMarket } from './shortDate';

export const TASK_STATUSES = Object.freeze(['open', 'completed']);
export const TASK_PRIORITIES = Object.freeze(['low', 'normal', 'high']);
export const TASK_TITLE_MAX = 200;
export const TASK_NOTES_MAX = 2000;
export const TASK_GROUPS = Object.freeze(['overdue', 'today', 'upcoming', 'noDate']);
const PRIORITY_RANK = Object.freeze({ high: 0, normal: 1, low: 2 });
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// The account market from the authenticated account flag (isLocalIsraeliBusiness) - never from the UI language.
export const taskMarket = (isLocalIsraeliBusiness) => resolveDateMarket(isLocalIsraeliBusiness === true ? 'Local' : 'International');

// The market's product calendar day 'YYYY-MM-DD' for an instant.
export function marketToday(market, now = new Date()) {
  const p = calendarParts(now instanceof Date ? now : new Date(now), market);
  return p ? `${p.y}-${p.m}-${p.d}` : null;
}

// The market's product wall clock 'HH:MM' for an instant.
export function marketClock(market, now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SHORT_DATE_TIME_ZONE[resolveDateMarket(market)], hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('hour')}:${get('minute')}`;
}

// A real calendar date 'YYYY-MM-DD' (rejects 2026-02-30).
export function isCalendarDate(value) {
  const m = typeof value === 'string' ? value.match(DATE_ONLY) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

// 'HH:MM' from a stored/typed time ('HH:MM' or 'HH:MM:SS'); null when empty or invalid.
export function shortTime(value) {
  const m = typeof value === 'string' ? value.trim().match(TIME_RE) : null;
  return m ? `${m[1]}:${m[2]}` : null;
}

// Date ENTRY in the account market's order (the same order formatShortDate displays): Local DD/MM/YYYY, International MM/DD/YYYY.
// Accepts '/', '-', '.' or spaces as separators and 1-2 digit day / month. Returns the date-only 'YYYY-MM-DD' or null.
export function parseMarketDate(text, market) {
  const m = typeof text === 'string' ? text.trim().match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/) : null;
  if (!m) return null;
  const [a, b, y] = [m[1].padStart(2, '0'), m[2].padStart(2, '0'), m[3]];
  const iso = resolveDateMarket(market) === 'Local' ? `${y}-${b}-${a}` : `${y}-${a}-${b}`;
  return isCalendarDate(iso) ? iso : null;
}
export const marketDatePattern = (market) => (resolveDateMarket(market) === 'Local' ? 'DD/MM/YYYY' : 'MM/DD/YYYY');

// Time ENTRY as a 24-hour wall clock ('9:30' or '09:30') -> 'HH:MM', else null (never a browser AM/PM locale).
export function parseTimeText(text) {
  const m = typeof text === 'string' ? text.trim().match(/^(\d{1,2}):([0-5]\d)$/) : null;
  if (!m || Number(m[1]) > 23) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

const cleanText = (v) => (typeof v === 'string' ? v.trim() : '');
const idOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Form values -> { ok, value, errors }. `value` is exactly the column set the client may write (never user_id / status /
// timestamps). Error codes: title_required, title_too_long, notes_too_long, invalid_priority, invalid_date, invalid_time,
// time_without_date.
export function normalizeTaskInput(form = {}) {
  const errors = [];
  const title = cleanText(form.title);
  const notes = cleanText(form.notes);
  const priority = form.priority === undefined || form.priority === '' ? 'normal' : form.priority;
  const dueDate = cleanText(form.due_date);
  const dueTimeRaw = cleanText(form.due_time);
  if (!title) errors.push('title_required');
  else if (title.length > TASK_TITLE_MAX) errors.push('title_too_long');
  if (notes.length > TASK_NOTES_MAX) errors.push('notes_too_long');
  if (!TASK_PRIORITIES.includes(priority)) errors.push('invalid_priority');
  if (dueDate && !isCalendarDate(dueDate)) errors.push('invalid_date');
  const dueTime = dueTimeRaw ? (parseTimeText(dueTimeRaw) || shortTime(dueTimeRaw)) : null;
  if (dueTimeRaw && !dueTime) errors.push('invalid_time');
  if (dueTime && !dueDate) errors.push('time_without_date');
  const value = {
    title,
    notes: notes || null,
    priority,
    due_date: dueDate || null,
    due_time: dueDate && dueTime ? dueTime : null,
    quote_id: idOrNull(form.quote_id),
    client_id: idOrNull(form.client_id),
  };
  return { ok: errors.length === 0, value, errors };
}

const stamp = (v) => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t; };

// Deterministic open-task order: due date (dated first, earliest first), due time (timed first, earliest first), priority
// (high -> normal -> low), then creation time (oldest first), then id.
export function compareTasks(a, b) {
  const da = a?.due_date || null; const db = b?.due_date || null;
  if (da !== db) { if (!da) return 1; if (!db) return -1; return da < db ? -1 : 1; }
  const ta = shortTime(a?.due_time); const tb = shortTime(b?.due_time);
  if (ta !== tb) { if (!ta) return 1; if (!tb) return -1; return ta < tb ? -1 : 1; }
  const pa = PRIORITY_RANK[a?.priority] ?? 1; const pb = PRIORITY_RANK[b?.priority] ?? 1;
  if (pa !== pb) return pa - pb;
  const ca = stamp(a?.created_at); const cb = stamp(b?.created_at);
  if (ca !== cb) return ca - cb;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

// Completed tasks: most recently completed first, then the open-task order.
export function compareCompletedTasks(a, b) {
  const d = stamp(b?.completed_at) - stamp(a?.completed_at);
  return d !== 0 ? d : compareTasks(a, b);
}

// Which open group a task belongs to under the market's today / clock: overdue (an earlier day, or today with a passed due time),
// today, upcoming (a later day) or noDate.
export function taskGroupOf(task, { today, clock }) {
  const due = task?.due_date || null;
  if (!due) return 'noDate';
  if (due < today) return 'overdue';
  if (due > today) return 'upcoming';
  const t = shortTime(task?.due_time);
  return t && clock && t < clock ? 'overdue' : 'today';
}

// { overdue, today, upcoming, noDate, completed } - each sorted deterministically.
export function groupTasks(tasks, { market, now = new Date() } = {}) {
  const today = marketToday(market, now);
  const clock = marketClock(market, now);
  const out = { overdue: [], today: [], upcoming: [], noDate: [], completed: [] };
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.status === 'completed') out.completed.push(task);
    else out[taskGroupOf(task, { today, clock })].push(task);
  }
  for (const k of TASK_GROUPS) out[k].sort(compareTasks);
  out.completed.sort(compareCompletedTasks);
  return out;
}

// A follow-up draft for a hot quote: pre-linked to the quote and its client; nothing is created until the user saves.
export function followUpDraftFor(quote) {
  if (!quote?.id) return null;
  return { quote_id: quote.id, client_id: quote.client_id || quote.clients?.id || null, origin: 'hot_quote' };
}
