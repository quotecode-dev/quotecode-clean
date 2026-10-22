// Owner console 2026-10-23 ("להוסיף פופאפ של פעם ביום, של הודעות כמו 'הידעת? ...' ו/או לזהות איפה המשתמש נמצא ולהציע לו בפופאפ את
// התוספת שיכולה לסייע לו בשלב שהוא נמצא"; chosen: a small corner card, at most once a day; "ליישם את זה ישר באתר החי"): the daily tip.
// ONE tip a day at most, chosen by where the user is and what the account has; a tip once seen never returns; "לא להציג טיפים" turns
// them all off. Every tip names a capability that exists in the product today (copy aligned with the bell announcements and the
// new-quote menu). Pure helpers (no React); the per-user state lives in this browser only (a convenience, never a record).

export const TIP_STATE_VERSION = 1;
export const tipStorageKey = (userId) => `tekango.dailyTips.v${TIP_STATE_VERSION}.${userId || 'anon'}`;

// priority order: the first eligible, unseen tip wins
export const DAILY_TIPS = Object.freeze([
  Object.freeze({
    id: 'twin_before_send', icon: 'twin', action: 'twin',
    when: (c) => !!c.unsentQuote,
    he: { text: 'לפני השליחה, "בדיקת הלקוח" מראה איך הלקוח יראה את ההצעה: מה ישכנע אותו ומה עלול להרתיע.', action: 'לבדוק את ההצעה' },
    en: { text: 'Before you send it, "Customer check" shows how your customer will see the quote: what will convince them and what may put them off.', action: 'Check the quote' },
  }),
  Object.freeze({
    id: 'smart_quote', icon: 'ai', action: 'smart_quote',
    when: (c) => c.quotesCount >= 1,
    he: { text: 'ב"הצעת מחיר חכמה עם AI" מתארים את העבודה במילים, והעוזר מכין טיוטה שאפשר לערוך לפני השמירה.', action: 'לנסות עכשיו' },
    en: { text: 'In the "AI smart quote" you describe the job in your own words and the assistant prepares a draft you can edit before saving.', action: 'Try it now' },
  }),
  Object.freeze({
    id: 'voice', icon: 'ai', action: 'chat',
    when: (c) => c.mobile && c.voice,
    he: { text: 'בצ׳אט אפשר ללחוץ על המיקרופון ולשאול בקול, במקום להקליד.', action: 'לפתוח את הצ׳אט' },
    en: { text: 'In the chat you can tap the microphone and ask out loud instead of typing.', action: 'Open the chat' },
  }),
  Object.freeze({
    id: 'ai_chat', icon: 'ai', action: 'chat',
    when: () => true,
    he: { text: 'הצ׳אט החכם עונה מתוך הנתונים שלכם: הצעות, לקוחות, הקטלוג והמשימות.', action: 'לפתוח את הצ׳אט' },
    en: { text: 'The smart chat answers from your own data: quotes, clients, the catalog and tasks.', action: 'Open the chat' },
  }),
  Object.freeze({
    id: 'templates', icon: 'template', action: 'templates',
    when: (c) => c.quotesCount >= 3,
    he: { text: 'הצעה שחוזרת על עצמה? שומרים אותה כתבנית, ואת הבאה מתחילים "מתבנית שמורה".', action: 'להתחיל מתבנית' },
    en: { text: 'A quote you repeat? Save it as a template and start the next one "From a saved template".', action: 'Start from a template' },
  }),
]);

const EMPTY = Object.freeze({ seen: [], seenAt: {}, last: null, off: false });
/** the stored state, tolerant of anything unreadable */
export function parseTipState(raw) {
  try {
    const j = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!j || typeof j !== 'object') return { ...EMPTY, seen: [], seenAt: {} };
    const seenAt = j.seenAt && typeof j.seenAt === 'object' ? Object.fromEntries(Object.entries(j.seenAt).filter(([k, v]) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(v)))) : {};
    return { seen: Array.isArray(j.seen) ? j.seen.filter((x) => typeof x === 'string') : [], seenAt, last: typeof j.last === 'string' ? j.last : null, off: j.off === true };
  } catch { return { ...EMPTY, seen: [], seenAt: {} }; }
}

/** the tip to show now, or null (off / already one today / nothing eligible and unseen) */
export function pickDailyTip(context, state, today) {
  if (!state || state.off || !today || state.last === today) return null;
  const seen = new Set(state.seen || []);
  return DAILY_TIPS.find((t) => !seen.has(t.id) && t.when(context || {})) || null;
}

/** the state after a tip was shown (it counts as seen and uses up today) */
export const markTipShown = (state, tipId, today) => ({ ...state, seen: [...new Set([...(state.seen || []), tipId])], seenAt: { ...(state.seenAt || {}), [tipId]: today }, last: today });
export const turnTipsOff = (state) => ({ ...state, off: true });

/** a saved quote that was never sent nor opened by the customer and has at least one described item - the Customer Twin moment */
export function firstUnsentQuote(quotes) {
  return (quotes || []).find((q) => q && !['sent', 'approved', 'paid'].includes(q.status) && !(Number(q.view_count || 0) > 0)
    && (q.quote_items || []).some((it) => String(it?.description || '').trim())) || null;
}

// Owner console 2026-10-23 (typed L-11 + L-17): "טיפ יומי שנסגר נשמר בפעמון כנקרא למשך 30 יום עם אותו כפתור פעולה" - each tip that was
// shown and closed becomes an already-read bell announcement (preRead: never unread, never floats) for TIP_BELL_DAYS from the day it was
// shown; its one action is the card's own action, run by the Dashboard through DAILY_TIP_ACTION_EVENT.
export const TIP_BELL_DAYS = 30;
export const DAILY_TIP_ACTION_EVENT = 'tekango:daily-tip-action';
const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
export function tipBellItems(state, openTipId = null) {
  const seenAt = (state && state.seenAt) || {};
  return DAILY_TIPS.filter((t) => seenAt[t.id] && t.id !== openTipId).map((t) => Object.freeze({
    key: `tip:${t.id}`, kind: 'announce', tipAction: t.action, preRead: true,
    from: seenAt[t.id], until: addDays(seenAt[t.id], TIP_BELL_DAYS), sortAt: `${seenAt[t.id]}T00:00`,
    copy: Object.freeze({
      he: Object.freeze({ title: 'הידעתם?', body: t.he.text, action: t.he.action }),
      en: Object.freeze({ title: 'Did you know?', body: t.en.text, action: t.en.action }),
    }),
  }));
}
