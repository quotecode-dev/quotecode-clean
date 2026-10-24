// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-25 וב-L-26 לפס "הצעד הבא" לפי התוכנית" - the hot-quote banner becomes the
// "next step" banner: the same place, size, frame and 4-second rotation, now cycling (in this order) overdue tasks, hot quotes and
// quotes whose validity ends within NEXT_STEP_EXPIRING_DAYS while still awaiting the customer. Pure helpers (no React).
import { quoteAwaitsCustomer } from './reminders';

export const NEXT_STEP_EXPIRING_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const hm = (t) => (t ? String(t).slice(0, 5) : null);

/** Open tasks past their due day, or due today with a time already passed (market day / clock); the oldest first. */
export function overdueTasks(tasks, today, nowClock) {
  if (!Array.isArray(tasks) || !today) return [];
  return tasks.filter((t) => {
    if (!t || t.status !== 'open' || !t.due_date) return false;
    const day = String(t.due_date).slice(0, 10);
    const time = hm(t.due_time);
    return day < today || (day === today && !!time && !!nowClock && time < nowClock);
  }).sort((a, b) => `${String(a.due_date).slice(0, 10)}T${hm(a.due_time) || '00:00'}`.localeCompare(`${String(b.due_date).slice(0, 10)}T${hm(b.due_time) || '00:00'}`));
}

/** Quotes still awaiting the customer whose validity ends today or within NEXT_STEP_EXPIRING_DAYS; the soonest first. */
export function expiringQuotes(quotes, today, isExpired, skipIds = new Set()) {
  if (!Array.isArray(quotes) || !today || typeof isExpired !== 'function') return [];
  const base = dayOf(today);
  const out = [];
  for (const q of quotes) {
    if (!q?.id || skipIds.has(q.id) || !q.valid_until || !quoteAwaitsCustomer(q, isExpired)) continue;
    const end = dayOf(q.valid_until);
    if (end === null || base === null) continue;
    const daysLeft = Math.round((end - base) / DAY_MS);
    if (daysLeft >= 0 && daysLeft <= NEXT_STEP_EXPIRING_DAYS) out.push({ quote: q, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** The banner's rotation: overdue tasks, then the hot quotes (already ordered), then the expiring quotes that are not hot. */
export function nextSteps({ hotRows = [], tasks = [], quotes = [], today, nowClock, isExpired }) {
  const hotIds = new Set(hotRows.map((r) => r.quote?.id).filter(Boolean));
  return [
    ...overdueTasks(tasks, today, nowClock).map((task) => ({ kind: 'task', key: `task:${task.id}`, task, today: String(task.due_date).slice(0, 10) === today })),
    ...hotRows.map((r) => ({ kind: 'hot', key: `hot:${r.quote.id}`, ...r })),
    ...expiringQuotes(quotes, today, isExpired, hotIds).map((e) => ({ kind: 'expiring', key: `expiring:${e.quote.id}`, ...e })),
  ];
}

// numbers / dates / times are rendered separately (isolated LTR) between these parts - never inside a sentence string
export const NEXT_STEP_COPY = Object.freeze({
  he: Object.freeze({
    viewTask: 'צפייה במשימה',
    openTrack: 'פתיחה ומעקב',
    taskLead: 'משימה באיחור: ',
    taskDueOn: ' – הייתה אמורה להתבצע ב-',
    taskDueToday: ' – הייתה אמורה להתבצע היום ב-',
    end: '.',
    expiringLead: 'התוקף של ההצעה עבור ',
    expiringNumberLead: 'התוקף של הצעה ',
    expiringToday: ' מסתיים היום, וההצעה עדיין לא נחתמה.',
    expiringTomorrow: ' מסתיים מחר, וההצעה עדיין לא נחתמה.',
    expiringInPre: ' מסתיים בעוד ',
    expiringInPost: ' ימים, וההצעה עדיין לא נחתמה.',
    emptyTitle: 'אין כרגע צעד דחוף.',
    emptyHint: 'משימה באיחור, הצעה חמה או הצעה שתוקפה מסתיים יופיעו כאן.',
    // Owner 2026-10-19 (L-25 / L-26, "תתקן גם את ההצעה החמה! כמו שאמרת"): the phone shows ONE line - short text + a short button
    shortOpen: 'פתיחה',
    shortView: 'צפייה',
    shortViewed: (n) => ` · צפיות: ${n}; טרם נחתמה`,
    shortOverdue: ' · באיחור',
    shortExpiresToday: ' · התוקף מסתיים היום',
    shortExpiresTomorrow: ' · התוקף מסתיים מחר',
    shortExpiresIn: (n) => ` · התוקף מסתיים בעוד ${n} ימים`,
  }),
  en: Object.freeze({
    viewTask: 'View task',
    openTrack: 'Open & track',
    taskLead: 'Overdue task: ',
    taskDueOn: ' – was due on ',
    taskDueToday: ' – was due today at ',
    end: '.',
    expiringLead: 'The quote for ',
    expiringNumberLead: 'Quote ',
    expiringToday: ' expires today and still isn’t signed.',
    expiringTomorrow: ' expires tomorrow and still isn’t signed.',
    expiringInPre: ' expires in ',
    expiringInPost: ' days and still isn’t signed.',
    emptyTitle: 'No urgent next step right now.',
    emptyHint: 'An overdue task, a hot quote or a quote about to expire will appear here.',
    shortOpen: 'Open',
    shortView: 'View',
    shortViewed: (n) => ` · viewed ${n} times, not signed`,
    shortOverdue: ' · overdue',
    shortExpiresToday: ' · expires today',
    shortExpiresTomorrow: ' · expires tomorrow',
    shortExpiresIn: (n) => ` · expires in ${n} days`,
  }),
});