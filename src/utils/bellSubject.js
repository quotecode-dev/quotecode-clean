// Owner console 2026-10-19 (night task 4559529a; typed: "מאשר במשימת הלילה כפתורי פעולה בהודעות הפעמון (צפייה בהצעה / צפייה במשימה /
// פרטי הלקוח) והודעה צפה במיקום ובברירות המחדל שתיארת, ופתיחת L-17 L-11 L-07 L-15 L-19 רק לשינויים האלה"; docs/OWNER_REQUEST_BELL_ACTIONS_2026-10-16.md).
// Every bell notification gets the button(s) that open its own subject; a NEW notification also floats once at the top of the work area.
// Pure helpers (no React): the actions of an item, their copy, and the "floated once" memory per account.

// the bell / floating notice asks the Dashboard to open a subject through this window event (detail = { kind, quoteId | taskId | clientId })
export const BELL_SUBJECT_EVENT = 'tekango-open-bell-subject';

export const BELL_ACTION_COPY = Object.freeze({
  he: Object.freeze({ assistant: 'פתיחת העוזר', plans: 'למסלולים', quote: 'צפייה בהצעה', task: 'צפייה במשימה', client: 'פרטי הלקוח', close: 'סגירת ההודעה', closePanel: 'סגירת ההתראות', markRead: 'סימון כנקרא', more: (n) => `+${n} נוספות`, region: 'הודעה חדשה' }),
  en: Object.freeze({ assistant: 'Open the assistant', plans: 'See the plans', quote: 'View quote', task: 'View task', client: 'Client details', close: 'Close notification', closePanel: 'Close notifications', markRead: 'Mark as read', more: (n) => `+${n} more`, region: 'New notification' }),
});

// Owner 2026-10-20 (typed L-17 approval: "הצעה לשדרוג בפריט הפעמון של החתימה הראשונה, רק במסלול החינם"): the quote of the account's
// FIRST customer signature in its free plan = the earliest signed_at since the free window started (the server's 7-day end minus 168h).
// No window (plan system off, paid, LIFETIME) = null = no offer anywhere.
const FREE_WINDOW_MS = 168 * 60 * 60 * 1000;
export function firstFreeSignatureQuoteId(quotes, free10) {
  const endsMs = free10?.endsAt ? Date.parse(free10.endsAt) : NaN;
  if (!Number.isFinite(endsMs) || !Array.isArray(quotes)) return null;
  const startMs = endsMs - FREE_WINDOW_MS;
  let best = null;
  for (const q of quotes) {
    const at = q?.signed_at ? Date.parse(q.signed_at) : NaN;
    if (!q?.id || !Number.isFinite(at) || at < startMs) continue;
    if (!best || at < best.at) best = { id: q.id, at };
  }
  return best ? best.id : null;
}

/** The subject buttons of one derived reminder item. A task linked to a client also gets "client details". Welcome items get none.
 *  upgradeQuoteId (Owner 2026-10-20, L-17): the signed item of that quote also gets the plans button (the first signature, Free plan). */
export function bellActionsFor(item, tasks = [], upgradeQuoteId = null) {
  if (!item || typeof item !== 'object') return [];
  if (item.kind === 'task_due') {
    if (!item.taskId) return [];
    const task = Array.isArray(tasks) ? tasks.find((t) => t?.id === item.taskId) : null;
    const out = [{ kind: 'task', taskId: item.taskId }];
    if (task?.client_id) out.push({ kind: 'client', clientId: task.client_id });
    return out;
  }
  // Owner 2026-10-19 (L-17): a product announcement opens the assistant
  // Owner 2026-10-20 (L-17): the SMART PACK announcement opens the plans view instead
  // Owner console 2026-10-23, typed: "מאשר שינוי ב-L-02, L-04, L-11, L-12, L-14, L-17, L-24, L-26, L-27 ו-L-28: ... וטיפ יומי שנסגר נשמר בפעמון כנקרא למשך 30 יום עם אותו כפתור פעולה": a closed daily tip keeps its own action (the same one as its card)
  if (item.kind === 'announce' && item.tipAction) return [{ kind: 'tip', tipAction: item.tipAction, quoteId: item.tipQuoteId || null }];
  if (item.kind === 'announce') return [{ kind: item.action === 'plans' ? 'plans' : 'assistant' }];
  if (item.kind === 'signed' && item.quoteId && upgradeQuoteId && item.quoteId === upgradeQuoteId) {
    return [{ kind: 'quote', quoteId: item.quoteId }, { kind: 'plans' }];
  }
  if ((item.kind === 'signed' || item.kind === 'first_view' || item.kind === 'viewed_not_approved' || item.kind === 'validity_ending') && item.quoteId) {
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
  // a closed daily tip is already read (preRead) - it never floats again
  return items.filter((i) => i && i.key && !i.preRead && !read.has(i.key) && !floated.has(i.key));
}
