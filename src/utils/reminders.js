// Task 20 (Phase 4) - Reminders & automation, app side: the shared pure rules (supabase/functions/_shared/reminderRules.js, the same
// bytes the future dispatcher uses), the HE/EN copy, and the ONE data path to public.reminder_settings / reminder_notification_state /
// customer_contact_stops / reminder_audit (migration 20261009200000). Results: { ok: true, data } | { ok: false, error: { code } }.
// While the migration is not applied to the connected project, every call returns code 'unavailable' - the screen then says so and
// never pretends a value was saved.
export * from '../../supabase/functions/_shared/reminderRules.js';
import { normalizeReminderSettings, toReminderSettingsRow } from '../../supabase/functions/_shared/reminderRules.js';

export const REMINDERS_COPY = Object.freeze({
  he: Object.freeze({
    entry: 'תזכורות ואוטומציות',
    entrySub: 'בממשק בלבד, כיבוי או מלא — כולל שליחה ללקוח',
    back: 'חזרה להגדרות עסק',
    title: 'תזכורות ואוטומציות',
    sub: 'בחרו איך TEKANGO יזכיר לכם — ומה, אם בכלל, יישלח ללקוחות שלכם.',
    modes: { in_app: 'בממשק בלבד', off: 'כבוי', full: 'מלא, כולל שליחה ללקוח' },
    modeTags: { in_app: 'ברירת מחדל', full: 'נדרשת הפעלה' },
    modeText: {
      in_app: 'תזכורות מופיעות אצלכם בפעמון. שום הודעה לא נשלחת ללקוח.',
      off: 'אין תזכורות ואין אוטומציות.',
      full: 'TEKANGO ישלח ללקוח מייל רק לפי כללים שתסמנו ותגדירו אחד-אחד. הפעלת המצב לבדה לא שולחת דבר.',
    },
    turnOnFull: 'הפעלת מצב מלא',
    fullConfirmTitle: 'להפעיל מצב מלא?',
    fullConfirmText: 'במצב מלא אפשר להגדיר כללים שישלחו מייל ללקוחות שלכם. שום כלל לא יפעל עד שתסמנו אותו ותגדירו עיתוי, תוכן, שעות שליחה ואזור זמן. הלקוח יוכל תמיד לבקש להפסיק.',
    fullConfirmYes: 'כן, להפעיל מצב מלא',
    cancel: 'ביטול',
    whatTitle: 'מה להפעיל',
    groupInApp: 'תזכורות אליכם, בממשק',
    groupFull: 'אוטומציה',
    groupFullTag: 'במצב מלא',
    behaviors: {
      task_due: ['משימה שמגיע מועדה', 'בשעת המשימה; בלי שעה — מתחילת אותו יום'],
      first_view: ['צפייה בקישור ההצעה', 'הפעם הראשונה שקישור ההצעה נפתח והמסמך הוצג בדפדפן שאינו מחובר לחשבון שלכם (פתיחת מייל אינה נספרת). זו אינדיקציה לפתיחת הקישור, לא זיהוי ודאי של הלקוח.'],
      viewed_not_approved: ['קישור שנצפה והצעה שלא אושרה', 'הספירה מתחילה בצפייה הראשונה בקישור ההצעה'],
      validity_ending: ['תוקף ההצעה מסתיים בקרוב', 'לפני תאריך "בתוקף עד" של ההצעה'],
      followup_task: ['יצירת משימת מעקב', 'כשקישור ההצעה נצפה וההצעה לא אושרה אחרי הזמן שתבחרו'],
      customer_followup_email: ['מייל מעקב ללקוח אחרי צפייה בקישור ההצעה', 'נשלח רק אם ההצעה עדיין ממתינה לחתימה'],
      customer_validity_email: ['מייל ללקוח לפני סיום תוקף ההצעה', 'נשלח רק אם ההצעה עדיין ממתינה לחתימה'],
    },
    daysAfterView: 'ימים אחרי הצפייה הראשונה בקישור',
    daysBefore: 'ימים לפני סיום התוקף',
    chooseDays: 'בחרו ימים',
    configure: 'הגדרה',
    notConfigured: 'לא מוגדר',
    configured: 'מוגדר',
    needsFull: 'דורש מצב מלא',
    waTitle: 'WhatsApp אוטומטי',
    waText: 'לא זמין. WhatsApp נשלח רק ידנית מתוך ההצעה — נפתח אצלכם, ואתם לוחצים שליחה.',
    waTag: 'ידני בלבד',
    sendTitle: 'זמני שליחה ללקוחות',
    zone: 'אזור זמן',
    zoneLocal: 'ישראל · Asia/Jerusalem — לפי כרטיס העסק',
    zoneIntlMissing: 'בכרטיס העסק אין מדינה מדויקת, ולכן אי אפשר לקבוע אזור זמן בבטחה. בחרו כאן את אזור הזמן של העסק — עד אז שליחה ללקוחות מושהית.',
    zoneChoose: 'בחרו אזור זמן',
    hours: 'שעות שליחה מותרות',
    hoursMissing: 'בחרו ימים ושעות — בלי זה שום מייל לא יישלח ללקוח.',
    from: 'מ-', to: 'עד',
    weekdays: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    pauseTitle: 'השהיית כל האוטומציות',
    pauseText: 'עוצר מיד כל שליחה ויצירת משימה מתוכננות. התזכורות בממשק ממשיכות.',
    historyTitle: 'היסטוריית פעולות',
    historyEmpty: 'עדיין אין פעולות.',
    save: 'שמירה',
    saved: 'נשמר',
    saving: 'שומר…',
    unavailable: 'שמירת ההגדרות תהיה זמינה אחרי עדכון השרת. כרגע פועלות ברירות המחדל: בממשק בלבד, ושום הודעה לא נשלחת ללקוח.',
    saveFailed: 'השמירה נכשלה. ההגדרות הקודמות נשארו ללא שינוי.',
    customerSendingInactive: 'שליחת מיילים אוטומטית ללקוחות עדיין לא פעילה בשרת. אפשר להגדיר כללים — הם לא יישלחו עד שהשליחה תופעל.',
    blockers: {
      mode_off: 'התזכורות כבויות', not_selected: 'לא סומן', full_mode_required: 'דורש מצב מלא', automation_paused: 'האוטומציה מושהית',
      days_required: 'בחרו ימים', first_view_unavailable: 'רישום צפייה בקישור עדיין לא פעיל בשרת', server_automation_inactive: 'אוטומציה עדיין לא פעילה בשרת',
      rule_paused: 'הכלל מושהה', content_required: 'חסר תוכן', send_window_required: 'חסרות שעות שליחה', time_zone_required: 'חסר אזור זמן',
      customer_sending_inactive: 'שליחה ללקוחות עדיין לא פעילה', unknown_behavior: '—',
    },
    ready: 'יפעל',
    rule: {
      title: 'הגדרת כלל', trigger: 'טריגר', timing: 'עיתוי', recipient: 'נמען', channel: 'ערוץ', language: 'שפה', subject: 'נושא', body: 'תוכן',
      triggers: { customer_followup_email: 'קישור ההצעה נצפה לראשונה, וההצעה עדיין ממתינה לחתימה', customer_validity_email: 'תוקף ההצעה מתקרב, וההצעה עדיין ממתינה לחתימה' },
      recipientText: 'איש הקשר של ההצעה — המייל שבכרטיס הלקוח',
      channelText: 'מייל', waManual: 'WhatsApp — ידני בלבד',
      languageText: 'עברית — לפי שוק החשבון',
      withinHours: 'בתוך שעות השליחה המותרות',
      safety: ['יבוטל אוטומטית אם ההצעה אושרה, שולמה או שתוקפה פג', 'לא יישלח ללקוח שביקש להפסיק לקבל הודעות, או שהמייל שלו חזר', 'לכל לקוח: הודעה אוטומטית אחת לכל היותר לכל הצעה בכל כלל — ללא כפילויות'],
      tokens: 'שדות שאפשר לשבץ',
      preview: 'תצוגה מקדימה — בדיוק מה שיישלח',
      previewTo: 'אל: איש הקשר של ההצעה · מאת: {business} דרך TEKANGO',
      stopFooter: 'קיבלת הודעה זו כי {business} שלח לך הצעת מחיר.',
      stopLink: 'להפסקת הודעות אוטומטיות מהעסק',
      sample: { client_name: 'דנה כהן', quote_number: 'A1043', quote_link: 'https://www.tekango.com/…', valid_until: '11/10/2026' },
      pauseRule: 'השהיית הכלל', resumeRule: 'חידוש הכלל', done: 'סיום',
      needsToRun: 'כדי שהכלל יפעל:',
    },
    firstSetupTitle: 'חדש: תזכורות ואוטומציות',
    firstSetupText: 'ברירת המחדל היא „בממשק בלבד": תזכורות מופיעות אצלכם, ושום הודעה לא נשלחת ללקוח. אפשר גם „כבוי", או „מלא, כולל שליחה ללקוח" — לפי כללים שתבחרו. מגדירים ב: הגדרות עסק › תזכורות ואוטומציות.',
    gotIt: 'הבנתי',
    // Task 40 (Owner console 2026-10-15): the approved welcome item for a new account - copy is Owner-locked
    welcome: {
      title: 'ברוכים הבאים למשפחת TEKANGO! 👋',
      body: 'כאן תקבלו התראה כשלקוח צופה בהצעה. אפשר להפעיל גם תזכורת כשהצעה נצפתה ועדיין לא אושרה וכשתוקף הצעה מתקרב לסיום,',
      settingsLink: 'בהגדרות עסק › תזכורות ואוטומציות', // Owner 2026-10-15: a link to the exact screen
      support: 'יש שאלה או בקשה? אנחנו כאן:',
      ai: 'אפשר גם להשתמש ב-AI החכם שלנו.',
      aiButton: 'פתיחת צ׳אט AI',
    },
    center: { title: 'התראות', empty: 'אין תזכורות כרגע.', markAll: 'סימון הכול כנקרא', modeOff: 'התזכורות כבויות.', modeLine: { in_app: 'מצב: בממשק בלבד — שום הודעה לא נשלחת ללקוחות.', off: 'מצב: כבוי.', full: 'מצב: מלא.' }, readNotSaved: 'סימון כנקרא יישמר אחרי עדכון השרת.' },
    item: {
      task_due: (i) => `משימה: ${i.title}`, task_due_overdue: 'באיחור', today: 'היום',
      first_view: (n) => `קישור ההצעה ${n} נצפה`,
      viewed_not_approved: (n, d) => `קישור הצעה ${n} נצפה וההצעה לא אושרה — ${d} ימים מאז הצפייה הראשונה בקישור`,
      validity_ending: (n, d) => (d === 0 ? `תוקף הצעה ${n} מסתיים היום` : `תוקף הצעה ${n} מסתיים בעוד ${d} ימים`),
    },
  }),
  en: Object.freeze({
    entry: 'Reminders & automation',
    entrySub: 'In-app only, Off or Full — including customer sending',
    back: 'Back to Business settings',
    title: 'Reminders & automation',
    sub: 'Choose how TEKANGO reminds you — and what, if anything, is sent to your customers.',
    modes: { in_app: 'In-app only', off: 'Off', full: 'Full, including customer sending' },
    modeTags: { in_app: 'Default', full: 'Requires activation' },
    modeText: {
      in_app: 'Reminders appear for you under the bell. Nothing is sent to a customer.',
      off: 'No reminders and no automation.',
      full: 'TEKANGO emails a customer only through rules you tick and configure one by one. Turning the mode on sends nothing by itself.',
    },
    turnOnFull: 'Turn on Full mode',
    fullConfirmTitle: 'Turn on Full mode?',
    fullConfirmText: 'In Full mode you can set up rules that email your customers. No rule runs until you tick it and set its timing, content, sending hours and time zone. The customer can always ask to stop.',
    fullConfirmYes: 'Yes, turn on Full mode',
    cancel: 'Cancel',
    whatTitle: 'What to turn on',
    groupInApp: 'Reminders for you, in the app',
    groupFull: 'Automation',
    groupFullTag: 'Full mode',
    behaviors: {
      task_due: ['A task is due', 'At the task time; without a time — from the start of that day'],
      first_view: ['Quote link viewed', 'The first time the quote link was opened and the document shown in a browser not signed in to your account (email opens do not count). It indicates the link was opened; it is not a certain identification of the customer.'],
      viewed_not_approved: ['Link viewed, quote not approved', 'Counting starts at the first view of the quote link'],
      validity_ending: ['Quote validity ends soon', 'Before the quote\'s "valid until" date'],
      followup_task: ['Create a follow-up task', 'When the quote link was viewed and the quote not approved after the time you choose'],
      customer_followup_email: ['Follow-up email to the customer after the quote link was viewed', 'Sent only while the quote still awaits signature'],
      customer_validity_email: ['Email to the customer before validity ends', 'Sent only while the quote still awaits signature'],
    },
    daysAfterView: 'days after the first link view',
    daysBefore: 'days before validity ends',
    chooseDays: 'Choose days',
    configure: 'Set up',
    notConfigured: 'Not set up',
    configured: 'Set up',
    needsFull: 'Needs Full mode',
    waTitle: 'Automatic WhatsApp',
    waText: 'Not available. WhatsApp is sent only manually from the quote — it opens for you and you press send.',
    waTag: 'Manual only',
    sendTitle: 'Customer sending times',
    zone: 'Time zone',
    zoneLocal: 'Israel · Asia/Jerusalem — from the business card',
    zoneIntlMissing: 'The business card has no exact country, so the time zone cannot be determined safely. Pick your business time zone here — until then customer sending is paused.',
    zoneChoose: 'Choose a time zone',
    hours: 'Allowed sending hours',
    hoursMissing: 'Choose days and hours — without them no email is sent to a customer.',
    from: 'From', to: 'to',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    pauseTitle: 'Pause all automation',
    pauseText: 'Immediately stops all planned sending and task creation. In-app reminders continue.',
    historyTitle: 'Action history',
    historyEmpty: 'No actions yet.',
    save: 'Save',
    saved: 'Saved',
    saving: 'Saving…',
    unavailable: 'Saving these settings becomes available after the server update. The defaults apply now: In-app only, and nothing is sent to a customer.',
    saveFailed: 'Saving failed. The previous settings are unchanged.',
    customerSendingInactive: 'Automatic customer emails are not active on the server yet. You can set up rules — they will not be sent until sending is activated.',
    blockers: {
      mode_off: 'Reminders are off', not_selected: 'Not ticked', full_mode_required: 'Needs Full mode', automation_paused: 'Automation paused',
      days_required: 'Choose days', first_view_unavailable: 'Link-view recording is not active on the server yet', server_automation_inactive: 'Automation is not active on the server yet',
      rule_paused: 'Rule paused', content_required: 'Content missing', send_window_required: 'Sending hours missing', time_zone_required: 'Time zone missing',
      customer_sending_inactive: 'Customer sending is not active yet', unknown_behavior: '—',
    },
    ready: 'Will run',
    rule: {
      title: 'Rule setup', trigger: 'Trigger', timing: 'Timing', recipient: 'Recipient', channel: 'Channel', language: 'Language', subject: 'Subject', body: 'Content',
      triggers: { customer_followup_email: 'The quote link was first viewed and the quote still awaits signature', customer_validity_email: 'The quote validity is near and it still awaits signature' },
      recipientText: 'The quote\'s contact — the email on the client card',
      channelText: 'Email', waManual: 'WhatsApp — manual only',
      languageText: 'English — by the account market',
      withinHours: 'within allowed sending hours',
      safety: ['Cancelled automatically if the quote is approved, paid or expired', 'Never sent to a customer who asked to stop, or whose email bounced', 'Per customer: at most one automatic message per quote per rule — no duplicates'],
      tokens: 'Fields you can insert',
      preview: 'Preview — exactly what will be sent',
      previewTo: 'To: the quote\'s contact · From: {business} via TEKANGO',
      stopFooter: 'You received this because {business} sent you a quote.',
      stopLink: 'Stop automatic messages from this business',
      sample: { client_name: 'Dana Cohen', quote_number: 'A1043', quote_link: 'https://www.tekango.com/…', valid_until: '10/11/2026' },
      pauseRule: 'Pause this rule', resumeRule: 'Resume this rule', done: 'Done',
      needsToRun: 'For this rule to run:',
    },
    firstSetupTitle: 'New: Reminders & automation',
    firstSetupText: 'The default is "In-app only": reminders appear for you and nothing is sent to a customer. You can also choose "Off", or "Full, including customer sending" — by rules you pick. Set it in: Business settings › Reminders & automation.',
    gotIt: 'Got it',
    welcome: {
      title: 'Welcome to the TEKANGO family! 👋',
      body: "You'll be notified here when a client views a quote. You can also turn on reminders for a viewed quote still awaiting approval and for a quote about to expire, in",
      settingsLink: 'Business settings › Reminders & automation',
      support: "Questions or requests? We're here:",
      ai: 'You can also use our smart AI.',
      aiButton: 'Open AI Chat',
    },
    center: { title: 'Notifications', empty: 'No reminders right now.', markAll: 'Mark all read', modeOff: 'Reminders are off.', modeLine: { in_app: 'Mode: In-app only — nothing is sent to customers.', off: 'Mode: Off.', full: 'Mode: Full.' }, readNotSaved: 'Read marks are saved after the server update.' },
    item: {
      task_due: (i) => `Task: ${i.title}`, task_due_overdue: 'Overdue', today: 'Today',
      first_view: (n) => `Quote link ${n} viewed`,
      viewed_not_approved: (n, d) => `Quote link ${n} viewed, quote not approved — ${d} days since the first link view`,
      validity_ending: (n, d) => (d === 0 ? `Quote ${n} validity ends today` : `Quote ${n} validity ends in ${d} days`),
    },
  }),
});

// ---------------------------------------------------------------- data path
const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
const guard = (client, userId) => (client && typeof client.from === 'function' && typeof userId === 'string' && userId ? null : fail('not_signed_in'));
export function classifyReminderError(error) {
  const text = `${error?.message || ''} ${error?.code || ''}`;
  if (/relation .* does not exist|Could not find the table|schema cache|PGRST205|42P01|PGRST204/i.test(text)) return 'unavailable';
  if (/row-level security|permission denied|42501|JWT|not authorized/i.test(text)) return 'not_allowed';
  if (/check constraint|23514|22P02/i.test(text)) return 'invalid';
  if (/fetch|network|Failed to fetch|timeout/i.test(text)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyReminderError(error), error?.message);
const SETTINGS_COLUMNS = 'user_id, mode, behaviors, days, rules, send_window, time_zone, paused, full_enabled_at, updated_at';

// -> { ok, data: { settings, stored } } ; stored=false when the business never saved (defaults apply).
export async function loadReminderSettings(client, userId) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('reminder_settings').select(SETTINGS_COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return fromError(error);
    return { ok: true, data: { settings: normalizeReminderSettings(data), stored: !!data } };
  } catch (e) { return fail('network', e?.message); }
}

// Persists and returns what the database actually stored (never optimistic).
export async function saveReminderSettings(client, userId, settings) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('reminder_settings').upsert({ ...toReminderSettingsRow(settings), user_id: userId }, { onConflict: 'user_id' }).select(SETTINGS_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.user_id !== userId) return fail('unknown', 'no persisted row returned');
    return { ok: true, data: { settings: normalizeReminderSettings(data), stored: true } };
  } catch (e) { return fail('network', e?.message); }
}

export async function listReadMarks(client, userId) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('reminder_notification_state').select('item_key').eq('user_id', userId);
    if (error) return fromError(error);
    return { ok: true, data: new Set((data || []).map((r) => r.item_key)) };
  } catch (e) { return fail('network', e?.message); }
}

// Task 40: the welcome item is shown to a NEW account (auth user created within the window) and never when reminders are Off.
export const WELCOME_ITEM_KEY = 'welcome:v1';
// the welcome link to Business settings › Reminders & automation (product-owned; Dashboard opens that exact sub-screen)
export const OPEN_REMINDERS_SETTINGS_EVENT = 'tekango-open-reminders-settings';
export const WELCOME_WINDOW_DAYS = 30;
export function isWelcomeVisible({ accountCreatedAt, mode, now = Date.now() }) {
  if (mode === 'off' || !accountCreatedAt) return false;
  const created = new Date(accountCreatedAt).getTime();
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(nowMs)) return false;
  const day = 24 * 60 * 60 * 1000;
  const age = nowMs - created; // a device clock slightly behind the server never hides a brand-new account's welcome
  return age > -day && age < WELCOME_WINDOW_DAYS * day;
}

export async function markRemindersRead(client, userId, keys) {
  const g = guard(client, userId); if (g) return g;
  const rows = [...new Set(keys)].filter((k) => typeof k === 'string' && k && k.length <= 200).map((item_key) => ({ user_id: userId, item_key }));
  if (!rows.length) return { ok: true, data: [] };
  try {
    const { error } = await client.from('reminder_notification_state').upsert(rows, { onConflict: 'user_id,item_key', ignoreDuplicates: true });
    if (error) return fromError(error);
    return { ok: true, data: rows.map((r) => r.item_key) };
  } catch (e) { return fail('network', e?.message); }
}

export async function listReminderAudit(client, userId, limit = 20) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('reminder_audit').select('id, at, actor, action, detail').eq('user_id', userId).order('at', { ascending: false }).limit(limit);
    if (error) return fromError(error);
    return { ok: true, data: data || [] };
  } catch (e) { return fail('network', e?.message); }
}

export const AUDIT_ACTION_COPY = Object.freeze({
  he: { mode_set: 'שינוי מצב', automation_paused: 'השהיית אוטומציה', automation_resumed: 'חידוש אוטומציה', contact_stopped: 'עצירת הודעות ללקוח', contact_stop_lifted: 'ביטול עצירה', automation_sent: 'נשלחה הודעה אוטומטית', automation_failed: 'שליחה נכשלה', automation_unknown: 'תוצאת שליחה לא ידועה' },
  en: { mode_set: 'Mode changed', automation_paused: 'Automation paused', automation_resumed: 'Automation resumed', contact_stopped: 'Customer messages stopped', contact_stop_lifted: 'Stop lifted', automation_sent: 'Automatic message sent', automation_failed: 'Sending failed', automation_unknown: 'Sending outcome unknown' },
});

// Server capabilities this build can rely on. Customer sending / automation execution have no server job yet (Task 20 scope ends at
// the local rule model + DB ledger); they are reported inactive everywhere until a separately authorized activation exists.
export const SERVER_AUTOMATION_ACTIVE = false;
export const CUSTOMER_SENDING_ACTIVE = false;
// first_viewed_at is present on loaded quote rows only once the migration is applied to the connected project.
export const firstViewAvailableFor = (quotes) => Array.isArray(quotes) && quotes.some((q) => q && Object.prototype.hasOwnProperty.call(q, 'first_viewed_at'));
