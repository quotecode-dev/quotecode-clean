// QA 2026-10-25 (C5): a recurring (monthly) expense counts once for every calendar month of the chosen period from the month it started -
// never for months before it was created, and the same way in the period totals and in the monthly chart (a 1,000 monthly expense
// started in January is 12,000 for that year in both). Pure: the period is passed in, "now" only bounds an open-ended custom range.

import { SHORT_DATE_TIME_ZONE } from './shortDate';

const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
// 20261029000000 (Codex F21, IRON-DATE-001): a date-only value (YYYY-MM-DD) is its own calendar month in every time zone - never shifted
// by the browser's zone; only a real moment is read in local time
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Codex N15 (IRON-DATE-001): today (YYYY-MM-DD) on the account market's calendar - Local: Asia/Jerusalem, International: UTC */
export function marketCalendarDate(now = new Date(), market = 'International') {
  const timeZone = market === 'Local' ? SHORT_DATE_TIME_ZONE.Local : SHORT_DATE_TIME_ZONE.International;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
/** a date-only value as that calendar day at local midnight (so getFullYear / getMonth are the day written); other values as they are */
export function calendarDateOf(value) {
  const only = typeof value === 'string' ? value.trim().match(DATE_ONLY) : null;
  return only ? new Date(Number(only[1]), Number(only[2]) - 1, Number(only[3])) : new Date(value);
}
export function monthIndexOf(value) {
  const only = typeof value === 'string' ? value.trim().match(DATE_ONLY) : null;
  if (only) return Number(only[1]) * 12 + Number(only[2]) - 1;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? NaN : monthIndex(d);
}

/** The [from, to] calendar-month indices (year * 12 + month) of a finance report period. */
export function reportMonthRange({ type, year, month, startDate, endDate, now = new Date() }) {
  if (type === 'custom') {
    return {
      from: startDate ? monthIndexOf(startDate) : -Infinity,
      to: endDate ? monthIndexOf(endDate) : monthIndex(now),
    };
  }
  const base = year * 12;
  if (type === 'monthly') return { from: base + month, to: base + month };
  if (type === 'quarterly') { const q = Math.floor(month / 3) * 3; return { from: base + q, to: base + q + 2 }; }
  if (type === 'half-yearly') { const h = month < 6 ? 0 : 6; return { from: base + h, to: base + h + 5 }; }
  return { from: base, to: base + 11 };
}

/** How many months of the range a recurring expense counts for (0 when it started after the range). */
export function recurringMonthsInRange(expense, range) {
  if (!expense?.expense_date) return 0; // no start date (new Date(null) would be 1970) - counted nowhere
  const started = monthIndexOf(expense.expense_date);
  if (Number.isNaN(started)) return 0;
  const from = Math.max(range.from, started);
  return range.to >= from ? range.to - from + 1 : 0;
}
