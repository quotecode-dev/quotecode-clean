// Owner console 2026-11-06 (release C, L-22): helpers of the admin user card's SMART PACK usage (AdminUserSmartPackUsage.jsx)
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** the days of the account's month ("YYYY-MM"), each with its ILS and actions (0 for a day without usage) */
export function usageDays(month, days) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return [];
  const count = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const byDay = new Map((Array.isArray(days) ? days : []).map((d) => [String(d.day), d]));
  return Array.from({ length: count }, (_, i) => {
    const day = `${m[1]}-${m[2]}-${String(i + 1).padStart(2, '0')}`;
    const d = byDay.get(day);
    return { day: i + 1, costIls: num(d?.costIls), actions: num(d?.actions) };
  });
}

/** "נובמבר 2026" / "November 2026" (no bidi-mixed "2026-11") */
export function monthName(month, isHebrew) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return '';
  return new Intl.DateTimeFormat(isHebrew ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)));
}
