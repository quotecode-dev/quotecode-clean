// Owner console 2026-10-19 (night task 4559529a; typed: "מאשר במשימת הלילה כפתורי פעולה בהודעות הפעמון (צפייה בהצעה / צפייה במשימה /
// פרטי הלקוח) והודעה צפה במיקום ובברירות המחדל שתיארת, ופתיחת L-17 L-11 L-07 L-15 L-19 רק לשינויים האלה"; docs/OWNER_REQUEST_BELL_ACTIONS_2026-10-16.md).
// Every bell notification gets the button(s) that open its own subject; a NEW notification also floats once at the top of the work area.
// Pure helpers (no React): the actions of an item, their copy, and the "floated once" memory per account.

// the bell / floating notice asks the Dashboard to open a subject through this window event (detail = { kind, quoteId | taskId | clientId })
export const BELL_SUBJECT_EVENT = 'tekango-open-bell-subject';

export const BELL_ACTION_COPY = Object.freeze({
  he: Object.freeze({ quote: 'צפייה בהצעה', task: 'צפייה במשימה', client: 'פרטי הלקוח', close: 'סגירת ההודעה', closePanel: 'סגירת ההתראות', markRead: 'סימון כנקרא', more: (n) => `+${n} נוספות`, region: 'הודעה חדשה' }),
  en: Object.freeze({ quote: 'View quote', task: 'View task', client: 'Client details', close: 'Close notification', closePanel: 'Close notifications', markRead: 'Mark as read', more: (n) => `+${n} more`, region: 'New notification' }),
});

/** The subject buttons of one derived reminder item. A task linked to a client also gets "client details". Welcome items get none. */
export function bellActionsFor(item, tasks = []) {
  if (!item || typeof item !== 'object') return [];
  if (item.kind === 'task_due') {
    if (!item.taskId) return [];
    const task = Array.isArray(tasks) ? tasks.find((t) => t?.id === item.taskId) : null;
    const out = [{ kind: 'task', taskId: item.taskId }];
    if (task?.client_id) out.push({ kind: 'client', clientId: task.client_id });
    return out;
  }
  if ((item.kind === 'first_view' || item.kind === 'viewed_not_approved' || item.kind === 'validity_ending') && item.quoteId) {
    return [{ kind: 'quote', quoteId: item.quoteId }];
  }
  return [];
}

// ---------------------------------------------------------------- floated once (per account, shared by every tab of this browser)
const STORE_PREFIX = 'tekango-bell-floated:';
const MAX_KEYS = 500;
const storage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };

/** null = this account never ran the floating notice in this browser (the current items become the baseline, nothing floats). */
export function loadFloatedKeys(userId) {
  const s = storage();
  if (!s || !userId) return null;
  try {
    const raw = s.getItem(STORE_PREFIX + userId);
    if (raw === null) return null;
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((k) => typeof k === 'string') : []);
  } catch { return new Set(); }
}

export function saveFloatedKeys(userId, keys) {
  const s = storage();
  if (!s || !userId) return false;
  try { s.setItem(STORE_PREFIX + userId, JSON.stringify([...keys].slice(-MAX_KEYS))); return true; } catch { return false; }
}

export const floatedStorageKey = (userId) => STORE_PREFIX + userId;

/**
 * The notifications that should float now: unread, not floated before, not the welcome item; newest first (items are already sorted
 * newest first by deriveInAppReminders). Reminders Off = the derivation is empty = nothing floats.
 */
export function pendingFloating(items, read, floated) {
  if (!Array.isArray(items) || !floated) return [];
  return items.filter((i) => i && i.key && !read.has(i.key) && !floated.has(i.key));
}
