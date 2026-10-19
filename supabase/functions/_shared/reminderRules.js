// Task 20 (Phase 4) - Reminders & automation: the ONE pure rule module shared by the app (Vite, via src/utils/reminders.js) and the
// future dispatcher (Deno). Plain JS on purpose, same as shortDate.js. No I/O, no clock unless passed.
//
// Owner decisions this module encodes (PROFLOW_PROJECT_CONTEXT.md §246, Task 20 contract):
//   - three modes: 'in_app' (default) | 'off' | 'full' (customer sending only after the business turns it on explicitly);
//   - inside Full a checkbox list of behaviors; turning Full on enables NO customer behavior by itself;
//   - every customer behavior needs explicit timing, recipient, channel, language, content, an allowed sending window and a time zone;
//   - view-based timing starts at the FIRST VIEW OF THE QUOTE LINK (quotes.first_viewed_at: the link opened and the document shown in a
//     browser that is not the issuing account, known bots excluded) - an indication, never a certain identification of the customer, and
//     never an email open;
//   - no reject status / behavior; WhatsApp is manual only (never an automatic channel here);
//   - timing values are chosen by the user from DAY_CHOICES - there is no default anywhere.
// Customer-facing scheduling uses the business sending zone: Local -> Asia/Jerusalem; International -> the zone the business picks in
// the Reminders screen (the business card has no country for International). Unresolved -> customer behaviors stay paused.
// IRON-DATE-001 is untouched: displayed dates/times keep the market product zone; this zone is used only for sending windows.

export const REMINDER_MODES = Object.freeze(['in_app', 'off', 'full']);
export const DEFAULT_REMINDER_MODE = 'in_app';
export const DAY_CHOICES = Object.freeze([1, 2, 3, 5, 7]);
export const WEEKDAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]); // 0 = Sunday
export const LOCAL_SENDING_TIME_ZONE = 'Asia/Jerusalem';
// Technical abuse guard for the future dispatcher (not a product promise): at most this many automatic customer emails per account per
// day in the sending zone. The product rule the Owner approved is "at most one automatic message per quote per rule" (the dedup key).
export const ACCOUNT_DAILY_CUSTOMER_EMAIL_CAP = 50;

// group 'in_app' = reminders shown to the business user inside TEKANGO; group 'full' = automation (needs Full mode).
export const BEHAVIORS = Object.freeze([
  Object.freeze({ id: 'task_due', group: 'in_app', needsDays: false, needsFirstView: false, customer: false }),
  Object.freeze({ id: 'first_view', group: 'in_app', needsDays: false, needsFirstView: true, customer: false }),
  Object.freeze({ id: 'viewed_not_approved', group: 'in_app', needsDays: true, needsFirstView: true, customer: false }),
  Object.freeze({ id: 'validity_ending', group: 'in_app', needsDays: true, needsFirstView: false, customer: false }),
  Object.freeze({ id: 'followup_task', group: 'full', needsDays: true, needsFirstView: true, customer: false }),
  Object.freeze({ id: 'customer_followup_email', group: 'full', needsDays: true, needsFirstView: true, customer: true }),
  Object.freeze({ id: 'customer_validity_email', group: 'full', needsDays: true, needsFirstView: false, customer: true }),
]);
export const BEHAVIOR_IDS = Object.freeze(BEHAVIORS.map((b) => b.id));
export const CUSTOMER_BEHAVIOR_IDS = Object.freeze(BEHAVIORS.filter((b) => b.customer).map((b) => b.id));
export const behaviorById = (id) => BEHAVIORS.find((b) => b.id === id) || null;

// Pre-ticked in-app reminders (Owner-approved sketch). Nothing in the 'full' group is ever pre-ticked; no day value is preset.
const DEFAULT_TICKED = Object.freeze({ task_due: true, first_view: true, viewed_not_approved: false, validity_ending: true });

// International sending zones offered in the Reminders screen (the business must pick one; no default).
export const INTERNATIONAL_SENDING_TIME_ZONES = Object.freeze([
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Brussels', 'Europe/Amsterdam', 'Europe/Berlin',
  'Europe/Zurich', 'Europe/Vienna', 'Europe/Rome', 'Europe/Warsaw', 'Europe/Stockholm', 'Europe/Helsinki', 'Europe/Athens',
  'America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Vancouver', 'America/Anchorage', 'Pacific/Honolulu', 'America/Mexico_City', 'America/Bogota',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Brisbane',
  'Australia/Sydney', 'Pacific/Auckland',
]);

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isDayChoice = (v) => DAY_CHOICES.includes(Number(v));
const clean = (s, max) => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

export function isValidSendWindow(w) {
  if (!w || typeof w !== 'object') return false;
  if (!Array.isArray(w.days) || w.days.length === 0 || !w.days.every((d) => WEEKDAYS.includes(d))) return false;
  if (!HHMM.test(String(w.start || '')) || !HHMM.test(String(w.end || ''))) return false;
  return w.start < w.end;
}

export function isValidTimeZone(zone) {
  if (typeof zone !== 'string' || !zone) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); return true; } catch { return false; }
}

// A stored settings row (or nothing) -> a complete, validated settings object. Unknown keys and invalid values are dropped, never guessed.
export function normalizeReminderSettings(row) {
  const r = row && typeof row === 'object' ? row : {};
  const behaviorsIn = r.behaviors && typeof r.behaviors === 'object' ? r.behaviors : {};
  const daysIn = r.days && typeof r.days === 'object' ? r.days : {};
  const rulesIn = r.rules && typeof r.rules === 'object' ? r.rules : {};
  const behaviors = {};
  const days = {};
  const rules = {};
  for (const b of BEHAVIORS) {
    behaviors[b.id] = typeof behaviorsIn[b.id] === 'boolean' ? behaviorsIn[b.id] : (b.group === 'in_app' ? DEFAULT_TICKED[b.id] === true : false);
    if (b.needsDays && isDayChoice(daysIn[b.id])) days[b.id] = Number(daysIn[b.id]);
    if (b.customer) {
      const x = rulesIn[b.id] && typeof rulesIn[b.id] === 'object' ? rulesIn[b.id] : {};
      rules[b.id] = { subject: clean(x.subject, 200), body: clean(x.body, 4000), paused: x.paused === true };
    }
  }
  return {
    mode: REMINDER_MODES.includes(r.mode) ? r.mode : DEFAULT_REMINDER_MODE,
    behaviors,
    days,
    rules,
    sendWindow: isValidSendWindow(r.send_window ?? r.sendWindow) ? { ...(r.send_window ?? r.sendWindow), days: [...(r.send_window ?? r.sendWindow).days].sort() } : null,
    timeZone: isValidTimeZone(r.time_zone ?? r.timeZone) ? (r.time_zone ?? r.timeZone) : null,
    paused: r.paused === true,
    fullEnabledAt: typeof (r.full_enabled_at ?? r.fullEnabledAt) === 'string' ? (r.full_enabled_at ?? r.fullEnabledAt) : null,
  };
}

// settings -> the DB row shape (public.reminder_settings). The caller adds nothing else.
export function toReminderSettingsRow(s) {
  return {
    mode: s.mode,
    behaviors: s.behaviors,
    days: s.days,
    rules: s.rules,
    send_window: s.sendWindow,
    time_zone: s.timeZone,
    paused: s.paused,
  };
}

// The zone used for customer sending windows, or null when it cannot be resolved safely (customer behaviors then stay paused).
export function resolveSendingTimeZone({ isLocal, chosenZone }) {
  if (isLocal === true) return LOCAL_SENDING_TIME_ZONE;
  return INTERNATIONAL_SENDING_TIME_ZONES.includes(chosenZone) && isValidTimeZone(chosenZone) ? chosenZone : null;
}

// What still blocks one behavior from running. [] = it runs. Codes are rendered by the UI / AI in the account language.
export function behaviorBlockers(settings, id, ctx = {}) {
  const b = behaviorById(id);
  if (!b) return ['unknown_behavior'];
  const s = settings;
  const out = [];
  if (s.mode === 'off') return ['mode_off'];
  if (!s.behaviors[id]) out.push('not_selected');
  if (b.group === 'full' && s.mode !== 'full') out.push('full_mode_required');
  if (b.group === 'full' && s.paused) out.push('automation_paused');
  if (b.needsDays && !isDayChoice(s.days[id])) out.push('days_required');
  if (b.needsFirstView && ctx.firstViewAvailable !== true) out.push('first_view_unavailable');
  if (b.group === 'full' && ctx.serverAutomationAvailable !== true) out.push('server_automation_inactive');
  if (b.customer) {
    const rule = s.rules[id] || {};
    if (rule.paused) out.push('rule_paused');
    if (!rule.subject || !rule.body) out.push('content_required');
    if (!s.sendWindow) out.push('send_window_required');
    if (!resolveSendingTimeZone({ isLocal: ctx.isLocal, chosenZone: s.timeZone })) out.push('time_zone_required');
    if (ctx.customerSendingAvailable !== true) out.push('customer_sending_inactive');
  }
  return out;
}

// ---------- time helpers (explicit zone, never the machine zone) ----------
function zonedParts(instant, zone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday: wd, date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function isWithinSendWindow(instant, zone, window) {
  if (!isValidSendWindow(window) || !isValidTimeZone(zone)) return false;
  const p = zonedParts(instant instanceof Date ? instant : new Date(instant), zone);
  return window.days.includes(p.weekday) && p.time >= window.start && p.time < window.end;
}

// The first instant >= `from` inside the window (15-minute steps, at most 8 days ahead), or null.
export function nextSendWindowStart(from, zone, window) {
  if (!isValidSendWindow(window) || !isValidTimeZone(zone)) return null;
  const start = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const STEP = 15 * 60 * 1000;
  const first = Math.ceil(start / STEP) * STEP;
  for (let t = first; t <= start + 8 * 86400000; t += STEP) {
    if (isWithinSendWindow(new Date(t), zone, window)) return new Date(t);
  }
  return null;
}

// ---------- quote predicates ----------
const statusOf = (q) => String(q?.status || '').toLowerCase();
// A quote that still awaits the customer: reached the customer (Sent, or a Draft whose link the customer already opened) and not
// approved / paid, and not past its validity (the caller passes the canonical expiry rule). Night task 2026-10-16 (R-08, Owner
// default 1): the same "awaiting" as the quote list and Statistics (src/utils/quoteStatistics.js isAwaitingQuote).
export const quoteAwaitsCustomer = (q, isExpired) => {
  const s = statusOf(q);
  if (s === 'approved' || s === 'paid') return false;
  return (s === 'sent' || Number(q?.view_count || 0) > 0) && !isExpired(q);
};
const firstViewMs = (q) => { const t = q?.first_viewed_at ? Date.parse(q.first_viewed_at) : NaN; return Number.isFinite(t) ? t : null; };

// ---------- in-app reminders (derived, never stored as truth) ----------
const DAY_MS = 86400000;
const dateMs = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };

// tasks: public.tasks rows; quotes: tenant quotes; today/nowClock: the market product day 'YYYY-MM-DD' and 'HH:MM'; isExpired(q).
export function deriveInAppReminders({ settings, tasks = [], quotes = [], today, nowClock, now = Date.now(), isExpired, firstViewAvailable = false }) {
  const s = settings;
  if (!s || s.mode === 'off') return [];
  // only the in-app group is derived here; its blockers are mode / not ticked / days / first-view availability
  const on = (id) => behaviorBlockers(s, id, { firstViewAvailable }).length === 0;
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  const items = [];
  if (on('task_due')) {
    for (const t of tasks) {
      if (t?.status !== 'open' || !t.due_date) continue;
      const time = t.due_time ? String(t.due_time).slice(0, 5) : null;
      const due = t.due_date < today || (t.due_date === today && (!time || time <= nowClock));
      if (!due) continue;
      items.push({ key: `task_due:${t.id}:${t.due_date}T${time || ''}`, kind: 'task_due', taskId: t.id, title: t.title, date: t.due_date, time, overdue: t.due_date < today, sortAt: `${t.due_date}T${time || '00:00'}` });
    }
  }
  for (const q of quotes) {
    // Owner console 2026-10-19 (typed L-17 approval): the customer signed - from the server-written signed_at, for 14 days
    const sg = q?.signed_at ? Date.parse(q.signed_at) : NaN;
    if (Number.isFinite(sg) && nowMs - sg <= 14 * DAY_MS && ['approved', 'paid'].includes(String(q?.status || '').toLowerCase())) {
      items.push({ key: `signed:${q.id}`, kind: 'signed', quoteId: q.id, quote: q, at: q.signed_at, sortAt: q.signed_at });
    }
    const fv = firstViewMs(q);
    if (on('first_view') && fv !== null && nowMs - fv <= 14 * DAY_MS) {
      items.push({ key: `first_view:${q.id}`, kind: 'first_view', quoteId: q.id, quote: q, at: q.first_viewed_at, sortAt: q.first_viewed_at });
    }
    const awaiting = isExpired ? quoteAwaitsCustomer(q, isExpired) : false;
    if (on('viewed_not_approved') && awaiting && fv !== null) {
      const days = s.days.viewed_not_approved;
      if (nowMs - fv >= days * DAY_MS) items.push({ key: `viewed_not_approved:${q.id}:${days}`, kind: 'viewed_not_approved', quoteId: q.id, quote: q, days, sortAt: new Date(fv + days * DAY_MS).toISOString() });
    }
    if (on('validity_ending') && awaiting && q.valid_until) {
      const days = s.days.validity_ending;
      const left = Math.round((dateMs(q.valid_until) - dateMs(today)) / DAY_MS);
      if (left >= 0 && left <= days) items.push({ key: `validity_ending:${q.id}:${String(q.valid_until).slice(0, 10)}`, kind: 'validity_ending', quoteId: q.id, quote: q, daysLeft: left, validUntil: String(q.valid_until).slice(0, 10), sortAt: `${String(q.valid_until).slice(0, 10)}T00:00` });
    }
  }
  return items.sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));
}

// ---------- customer automation planning (pure; the dispatcher claims each occurrence atomically in the DB) ----------
export const occurrenceKey = (ruleId, quoteId, anchor) => `${ruleId}:${quoteId}:${anchor}`;

// Returns occurrences that are due now: [{ dedupKey, ruleId, quoteId, recipient, notBefore }]. Every guard is re-checked here and again
// by the DB claim: Full + selected + not paused + content + window + zone, quote still awaiting the customer (approval / paid / expiry
// cancel), a customer email that is not stopped or bounced, and at most one occurrence per quote per rule (the dedup key).
export function planCustomerOccurrences({ settings, quotes = [], clientsById = {}, stoppedEmails = new Set(), sentKeys = new Set(), now, isExpired, isLocal, today }) {
  const s = settings;
  const ctx = { firstViewAvailable: true, serverAutomationAvailable: true, customerSendingAvailable: true, isLocal };
  const zone = resolveSendingTimeZone({ isLocal, chosenZone: s.timeZone });
  const nowDate = now instanceof Date ? now : new Date(now);
  const out = [];
  if (!zone || !isWithinSendWindow(nowDate, zone, s.sendWindow)) return out;
  for (const ruleId of CUSTOMER_BEHAVIOR_IDS) {
    if (behaviorBlockers(s, ruleId, ctx).length) continue;
    const days = s.days[ruleId];
    for (const q of quotes) {
      if (!quoteAwaitsCustomer(q, isExpired)) continue;
      const client = clientsById[q.client_id];
      const email = String(client?.email || '').trim().toLowerCase();
      if (!email || q.email_bounced === true || stoppedEmails.has(email)) continue;
      let anchor;
      if (ruleId === 'customer_followup_email') {
        const fv = firstViewMs(q);
        if (fv === null || nowDate.getTime() - fv < days * DAY_MS) continue;
        anchor = `fv${new Date(fv).toISOString()}`;
      } else {
        if (!q.valid_until) continue;
        const left = Math.round((dateMs(q.valid_until) - dateMs(today)) / DAY_MS);
        if (left < 0 || left > days) continue;
        anchor = `vu${String(q.valid_until).slice(0, 10)}`;
      }
      const dedupKey = occurrenceKey(ruleId, q.id, anchor);
      if (sentKeys.has(dedupKey)) continue;
      out.push({ dedupKey, ruleId, quoteId: q.id, recipient: email, notBefore: nowDate.toISOString() });
    }
  }
  return out;
}

// ---------- message templates + preview ----------
// Placeholders: one canonical token set, written in the account language. Rendering escapes HTML; the result is plain text paragraphs.
export const TEMPLATE_TOKENS = Object.freeze({
  he: Object.freeze({ client_name: '{שם הלקוח}', quote_number: '{מספר הצעה}', quote_link: '{קישור להצעה}', business_name: '{שם העסק}', valid_until: '{בתוקף עד}' }),
  en: Object.freeze({ client_name: '{client name}', quote_number: '{quote number}', quote_link: '{quote link}', business_name: '{business name}', valid_until: '{valid until}' }),
});

export const DEFAULT_TEMPLATES = Object.freeze({
  he: Object.freeze({
    customer_followup_email: Object.freeze({ subject: 'רציתי לוודא שקיבלת את הצעת המחיר {מספר הצעה}', body: 'שלום {שם הלקוח},\nרציתי לוודא שהצעה {מספר הצעה} הגיעה אליך. אשמח לענות על כל שאלה.\nלצפייה ולחתימה: {קישור להצעה}\n{שם העסק}' }),
    customer_validity_email: Object.freeze({ subject: 'הצעת המחיר {מספר הצעה} בתוקף עד {בתוקף עד}', body: 'שלום {שם הלקוח},\nרציתי להזכיר שהצעה {מספר הצעה} בתוקף עד {בתוקף עד}.\nלצפייה ולחתימה: {קישור להצעה}\n{שם העסק}' }),
  }),
  en: Object.freeze({
    customer_followup_email: Object.freeze({ subject: 'Checking you received quote {quote number}', body: 'Hello {client name},\nI wanted to make sure quote {quote number} reached you. Happy to answer any question.\nView and sign: {quote link}\n{business name}' }),
    customer_validity_email: Object.freeze({ subject: 'Quote {quote number} is valid until {valid until}', body: 'Hello {client name},\nA reminder that quote {quote number} is valid until {valid until}.\nView and sign: {quote link}\n{business name}' }),
  }),
});

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Replace the account-language tokens with values. Unknown braces stay as typed (never silently dropped).
export function renderTemplateText(text, lang, values) {
  const tokens = TEMPLATE_TOKENS[lang === 'he' ? 'he' : 'en'];
  let out = String(text ?? '');
  for (const [key, token] of Object.entries(tokens)) out = out.split(token).join(values[key] ?? '');
  return out;
}

// The exact message the dispatcher would send (subject + escaped HTML body + the mandatory stop footer). Used for the preview too.
export function buildCustomerMessage({ rule, lang, values, stopLinkLabel, stopUrl }) {
  const subject = renderTemplateText(rule.subject, lang, values);
  const lines = renderTemplateText(rule.body, lang, values).split('\n').map((l) => escapeHtml(l));
  const footer = `<p style="font-size:12px;color:#65727A">${escapeHtml(stopLinkLabel)} <a href="${escapeHtml(stopUrl)}">${escapeHtml(stopUrl ? (lang === 'he' ? 'להפסקת הודעות אוטומטיות' : 'Stop automatic messages') : '')}</a></p>`;
  return { subject, html: `<div dir="${lang === 'he' ? 'rtl' : 'ltr'}">${lines.map((l) => `<p>${l}</p>`).join('')}${footer}</div>`, text: renderTemplateText(rule.body, lang, values) };
}
