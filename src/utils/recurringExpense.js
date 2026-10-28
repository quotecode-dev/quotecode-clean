// QA 2026-10-25 (C5): a recurring (monthly) expense counts once for every calendar month of the chosen period from the month it started -
// never for months before it was created, and the same way in the period totals and in the monthly chart (a 1,000 monthly expense
// started in January is 12,000 for that year in both). Pure: the period is passed in, "now" only bounds an open-ended custom range.

const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();

/** The [from, to] calendar-month indices (year * 12 + month) of a finance report period. */
export function reportMonthRange({ type, year, month, startDate, endDate, now = new Date() }) {
  if (type === 'custom') {
    return {
      from: startDate ? monthIndex(new Date(startDate)) : -Infinity,
      to: endDate ? monthIndex(new Date(endDate)) : monthIndex(now),
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
  const started = new Date(expense.expense_date);
  if (Number.isNaN(started.getTime())) return 0;
  const from = Math.max(range.from, monthIndex(started));
  return range.to >= from ? range.to - from + 1 : 0;
}
