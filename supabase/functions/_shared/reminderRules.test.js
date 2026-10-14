import { describe, it, expect } from 'vitest';
import {
  normalizeReminderSettings, toReminderSettingsRow, behaviorBlockers, resolveSendingTimeZone, isWithinSendWindow, nextSendWindowStart,
  deriveInAppReminders, planCustomerOccurrences, renderTemplateText, buildCustomerMessage, DEFAULT_TEMPLATES, DAY_CHOICES,
  INTERNATIONAL_SENDING_TIME_ZONES, BEHAVIOR_IDS,
} from './reminderRules.js';

const never = () => false;
const fullReady = (over = {}) => normalizeReminderSettings({
  mode: 'full',
  behaviors: { customer_followup_email: true, customer_validity_email: true, followup_task: true },
  days: { customer_followup_email: 2, customer_validity_email: 3, followup_task: 2 },
  rules: { customer_followup_email: DEFAULT_TEMPLATES.he.customer_followup_email, customer_validity_email: DEFAULT_TEMPLATES.he.customer_validity_email },
  send_window: { days: [0, 1, 2, 3, 4], start: '09:00', end: '19:00' },
  ...over,
});
const READY_CTX = { firstViewAvailable: true, serverAutomationAvailable: true, customerSendingAvailable: true, isLocal: true };

describe('settings normalization', () => {
  it('defaults to In-app only with no customer behavior and no preset day', () => {
    const s = normalizeReminderSettings(null);
    expect(s.mode).toBe('in_app');
    expect(s.behaviors.customer_followup_email).toBe(false);
    expect(s.behaviors.customer_validity_email).toBe(false);
    expect(s.behaviors.followup_task).toBe(false);
    expect(s.days).toEqual({});
    expect(s.sendWindow).toBeNull();
    expect(s.timeZone).toBeNull();
  });
  it('drops invalid values instead of guessing', () => {
    const s = normalizeReminderSettings({ mode: 'reject', days: { validity_ending: 4, viewed_not_approved: 5 }, send_window: { days: [1], start: '19:00', end: '09:00' }, time_zone: 'Mars/Base' });
    expect(s.mode).toBe('in_app');
    expect(s.days).toEqual({ viewed_not_approved: 5 });
    expect(s.sendWindow).toBeNull();
    expect(s.timeZone).toBeNull();
  });
  it('has no reject behavior and only the offered day choices', () => {
    expect(BEHAVIOR_IDS.some((id) => /reject/.test(id))).toBe(false);
    expect(DAY_CHOICES).toEqual([1, 2, 3, 5, 7]);
  });
  it('round-trips through the DB row shape', () => {
    const s = fullReady();
    expect(normalizeReminderSettings(toReminderSettingsRow(s))).toMatchObject({ mode: 'full', days: s.days, sendWindow: s.sendWindow });
  });
});

describe('what a rule needs to run', () => {
  it('turning Full on enables no customer rule by itself', () => {
    const s = normalizeReminderSettings({ mode: 'full' });
    expect(behaviorBlockers(s, 'customer_followup_email', READY_CTX)).toEqual(expect.arrayContaining(['not_selected', 'days_required', 'content_required', 'send_window_required']));
  });
  it('a fully configured customer rule runs only with every server capability present', () => {
    const s = fullReady();
    expect(behaviorBlockers(s, 'customer_followup_email', READY_CTX)).toEqual([]);
    expect(behaviorBlockers(s, 'customer_followup_email', { ...READY_CTX, customerSendingAvailable: false })).toContain('customer_sending_inactive');
    expect(behaviorBlockers(s, 'customer_followup_email', { ...READY_CTX, firstViewAvailable: false })).toContain('first_view_unavailable');
  });
  it('customer rules need Full mode, are stopped by pause, and Off blocks everything', () => {
    expect(behaviorBlockers(fullReady({ mode: 'in_app' }), 'customer_validity_email', READY_CTX)).toContain('full_mode_required');
    expect(behaviorBlockers(fullReady({ paused: true }), 'customer_validity_email', READY_CTX)).toContain('automation_paused');
    expect(behaviorBlockers(fullReady({ mode: 'off' }), 'task_due', READY_CTX)).toEqual(['mode_off']);
  });
  it('International customer rules need a picked sending zone; Local uses Asia/Jerusalem', () => {
    const s = fullReady();
    expect(behaviorBlockers(s, 'customer_validity_email', { ...READY_CTX, isLocal: false })).toContain('time_zone_required');
    expect(resolveSendingTimeZone({ isLocal: true })).toBe('Asia/Jerusalem');
    expect(resolveSendingTimeZone({ isLocal: false, chosenZone: null })).toBeNull();
    expect(resolveSendingTimeZone({ isLocal: false, chosenZone: 'Europe/London' })).toBe('Europe/London');
    expect(resolveSendingTimeZone({ isLocal: false, chosenZone: 'Asia/Jerusalem' })).toBeNull(); // not an International choice
    expect(INTERNATIONAL_SENDING_TIME_ZONES.every((z) => resolveSendingTimeZone({ isLocal: false, chosenZone: z }) === z)).toBe(true);
  });
});

describe('sending window (explicit zone, DST-safe)', () => {
  const w = { days: [0, 1, 2, 3, 4], start: '09:00', end: '19:00' };
  it('uses the business zone, not the machine zone', () => {
    // 2026-10-11 (Sunday) 06:30 UTC = 09:30 Asia/Jerusalem (IDT, UTC+3)
    expect(isWithinSendWindow(new Date('2026-10-11T06:30:00Z'), 'Asia/Jerusalem', w)).toBe(true);
    expect(isWithinSendWindow(new Date('2026-10-11T05:30:00Z'), 'Asia/Jerusalem', w)).toBe(false);
    // after the Israeli DST end (2026-10-25) 06:30 UTC = 08:30 IST
    expect(isWithinSendWindow(new Date('2026-10-26T06:30:00Z'), 'Asia/Jerusalem', w)).toBe(false);
    expect(isWithinSendWindow(new Date('2026-10-26T07:00:00Z'), 'Asia/Jerusalem', w)).toBe(true);
  });
  it('never sends on a day the business did not allow (Friday/Saturday here)', () => {
    expect(isWithinSendWindow(new Date('2026-10-16T08:00:00Z'), 'Asia/Jerusalem', w)).toBe(false);
    expect(isWithinSendWindow(new Date('2026-10-17T08:00:00Z'), 'Asia/Jerusalem', w)).toBe(false);
  });
  it('defers outside the window to the next allowed start', () => {
    const next = nextSendWindowStart(new Date('2026-10-16T08:00:00Z'), 'Asia/Jerusalem', w); // Friday
    expect(next.toISOString()).toBe('2026-10-18T06:00:00.000Z'); // Sunday 09:00 IDT
  });
});

describe('in-app reminders', () => {
  const tasks = [
    { id: 't1', status: 'open', title: 'Call Dana', due_date: '2026-10-09', due_time: '16:00:00' },
    { id: 't2', status: 'open', title: 'Measure', due_date: '2026-10-08', due_time: null },
    { id: 't3', status: 'completed', title: 'Done', due_date: '2026-10-08' },
    { id: 't4', status: 'open', title: 'Later', due_date: '2026-10-12' },
  ];
  const quotes = [
    { id: 'q1', status: 'sent', valid_until: '2026-10-11', first_viewed_at: '2026-10-06T10:00:00Z' },
    { id: 'q2', status: 'approved', valid_until: '2026-10-10', first_viewed_at: '2026-10-08T10:00:00Z' },
    { id: 'q3', status: 'sent', valid_until: '2026-10-30', first_viewed_at: null },
  ];
  const base = { tasks, quotes, today: '2026-10-09', nowClock: '16:30', now: Date.parse('2026-10-09T13:30:00Z'), isExpired: never, firstViewAvailable: true };
  it('Off shows nothing', () => {
    expect(deriveInAppReminders({ ...base, settings: normalizeReminderSettings({ mode: 'off' }) })).toEqual([]);
  });
  it('defaults: due/overdue open tasks and first views only (validity needs a chosen day count)', () => {
    const items = deriveInAppReminders({ ...base, settings: normalizeReminderSettings(null) });
    expect(items.filter((i) => i.kind === 'task_due').map((i) => i.taskId).sort()).toEqual(['t1', 't2']);
    expect(items.filter((i) => i.kind === 'first_view').map((i) => i.quoteId).sort()).toEqual(['q1', 'q2']);
    expect(items.some((i) => i.kind === 'validity_ending')).toBe(false);
  });
  it('first-view reminders need a real first view and stop without the server field', () => {
    const items = deriveInAppReminders({ ...base, firstViewAvailable: false, settings: normalizeReminderSettings(null) });
    expect(items.some((i) => i.kind === 'first_view')).toBe(false);
  });
  it('viewed-not-approved counts from the first view; approval cancels; an unviewed quote never starts it', () => {
    const settings = normalizeReminderSettings({ behaviors: { viewed_not_approved: true }, days: { viewed_not_approved: 3 } });
    const items = deriveInAppReminders({ ...base, settings }).filter((i) => i.kind === 'viewed_not_approved');
    expect(items.map((i) => i.quoteId)).toEqual(['q1']);
  });
  it('validity-ending respects the chosen days and expiry', () => {
    const settings = normalizeReminderSettings({ days: { validity_ending: 2 } });
    expect(deriveInAppReminders({ ...base, settings }).filter((i) => i.kind === 'validity_ending').map((i) => i.quoteId)).toEqual(['q1']);
    expect(deriveInAppReminders({ ...base, settings, isExpired: () => true }).filter((i) => i.kind === 'validity_ending')).toEqual([]);
  });
});

describe('customer automation planning', () => {
  const quotes = [
    { id: 'q1', status: 'sent', client_id: 'c1', valid_until: '2026-10-13', first_viewed_at: '2026-10-06T10:00:00Z' },
    { id: 'q2', status: 'approved', client_id: 'c1', valid_until: '2026-10-13', first_viewed_at: '2026-10-06T10:00:00Z' },
    { id: 'q3', status: 'sent', client_id: 'c2', valid_until: '2026-10-13', first_viewed_at: '2026-10-06T10:00:00Z' },
    { id: 'q4', status: 'sent', client_id: 'c3', valid_until: '2026-10-13', first_viewed_at: null, email_bounced: true },
  ];
  const clientsById = { c1: { email: 'Dana@Example.test' }, c2: { email: 'stop@example.test' }, c3: { email: 'b@example.test' } };
  const args = { quotes, clientsById, now: new Date('2026-10-11T07:00:00Z'), isExpired: never, isLocal: true, today: '2026-10-11' };
  it('plans one occurrence per quote per rule, skips approved / stopped / bounced', () => {
    const occ = planCustomerOccurrences({ ...args, settings: fullReady(), stoppedEmails: new Set(['stop@example.test']) });
    expect(occ.map((o) => `${o.ruleId}:${o.quoteId}`).sort()).toEqual(['customer_followup_email:q1', 'customer_validity_email:q1']);
    expect(occ.every((o) => o.recipient === 'dana@example.test')).toBe(true);
  });
  it('is idempotent: an already-sent key is never planned again', () => {
    const first = planCustomerOccurrences({ ...args, settings: fullReady() });
    const again = planCustomerOccurrences({ ...args, settings: fullReady(), sentKeys: new Set(first.map((o) => o.dedupKey)) });
    expect(again).toEqual([]);
  });
  it('plans nothing outside the window, when paused, in In-app mode, or after expiry', () => {
    expect(planCustomerOccurrences({ ...args, settings: fullReady(), now: new Date('2026-10-16T08:00:00Z') })).toEqual([]);
    expect(planCustomerOccurrences({ ...args, settings: fullReady({ paused: true }) })).toEqual([]);
    expect(planCustomerOccurrences({ ...args, settings: fullReady({ mode: 'in_app' }) })).toEqual([]);
    expect(planCustomerOccurrences({ ...args, settings: fullReady(), isExpired: () => true })).toEqual([]);
  });
});

describe('templates and preview', () => {
  const values = { client_name: 'דנה', quote_number: 'A1043', quote_link: 'https://www.tekango.com/q/x', business_name: 'עסק בדיקה', valid_until: '11/10/2026' };
  it('fills account-language tokens and keeps unknown braces', () => {
    expect(renderTemplateText('שלום {שם הלקוח} {לא קיים}', 'he', values)).toBe('שלום דנה {לא קיים}');
  });
  it('escapes HTML and always carries the stop footer', () => {
    const m = buildCustomerMessage({ rule: { subject: 'S {מספר הצעה}', body: '<b>x</b>\n{שם העסק}' }, lang: 'he', values, stopLinkLabel: 'קיבלת הודעה זו כי', stopUrl: 'https://www.tekango.com/stop/t' });
    expect(m.subject).toBe('S A1043');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(m.html).toContain('https://www.tekango.com/stop/t');
    expect(m.html.startsWith('<div dir="rtl">')).toBe(true);
  });
});
