// Task 40 (Owner console 2026-10-15): the approved welcome item in the notifications panel - shown to a NEW account (created within
// 30 days) while reminders are not Off, HE / EN copy exactly as approved, counted as unread until marked read through the existing path.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from './NotificationCenter';
import { REMINDERS_COPY, WELCOME_ITEM_KEY, OPEN_REMINDERS_SETTINGS_EVENT, isWelcomeVisible } from '../utils/reminders';

afterEach(() => cleanup());

const NOW = new Date('2026-10-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

// a minimal chainable Supabase-like client: every query resolves to the table's rows; upserts are recorded
function fakeClient({ mode = 'in_app', readKeys = [], failing = [] } = {}) {
  const upserts = [];
  const rows = {
    reminder_settings: mode ? { mode } : null,
    tasks: [],
    reminder_notification_state: readKeys.map((item_key) => ({ item_key })),
  };
  const query = (table) => {
    const result = failing.includes(table) ? { data: null, error: { message: 'Failed to fetch' } } : { data: rows[table], error: null };
    const q = {
      select: () => q, eq: () => q, order: () => q,
      maybeSingle: () => Promise.resolve(result),
      then: (res, rej) => Promise.resolve(result).then(res, rej),
      upsert: (r) => { upserts.push(...r); return Promise.resolve({ error: null }); },
    };
    return q;
  };
  return { from: query, upserts };
}

const openPanel = async (props) => {
  const utils = render(<NotificationCenter userId="u1" now={NOW} quotes={[]} {...props} />);
  fireEvent.click(utils.getByTestId('header-bell'));
  await waitFor(() => expect(utils.getByTestId('notification-center')).toBeTruthy());
  return utils;
};

describe('isWelcomeVisible', () => {
  it('a new account within 30 days, reminders not Off', () => {
    expect(isWelcomeVisible({ accountCreatedAt: new Date(NOW - 2 * DAY).toISOString(), mode: 'in_app', now: NOW.getTime() })).toBe(true);
    expect(isWelcomeVisible({ accountCreatedAt: new Date(NOW - 29 * DAY).toISOString(), mode: 'full', now: NOW.getTime() })).toBe(true);
  });
  it('never for an older account, when Off, or without a creation time', () => {
    expect(isWelcomeVisible({ accountCreatedAt: new Date(NOW - 31 * DAY).toISOString(), mode: 'in_app', now: NOW.getTime() })).toBe(false);
    expect(isWelcomeVisible({ accountCreatedAt: new Date(NOW - DAY).toISOString(), mode: 'off', now: NOW.getTime() })).toBe(false);
    expect(isWelcomeVisible({ accountCreatedAt: null, mode: 'in_app', now: NOW.getTime() })).toBe(false);
    expect(isWelcomeVisible({ accountCreatedAt: 'not a date', mode: 'in_app', now: NOW.getTime() })).toBe(false);
  });
});

describe('NotificationCenter welcome item', () => {
  it('HE: the approved copy, RTL, support mail link, counted unread', async () => {
    const client = fakeClient();
    const { getByTestId } = await openPanel({ client, isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('notification-welcome')).toBeTruthy());
    const w = getByTestId('notification-welcome');
    expect(w.textContent).toContain('ברוכים הבאים למשפחת TEKANGO! 👋');
    expect(w.textContent).toContain('כאן תקבלו התראה כשלקוח צופה בהצעה. אפשר להפעיל גם תזכורות להצעות שנצפו ועדיין לא אושרו ולהצעות שתוקפן עומד להסתיים. את התזכורות מפעילים בהגדרות עסק › תזכורות ואוטומציות.');
    expect(w.textContent).toContain('יש שאלה או בקשה? אנחנו כאן:');
    expect(w.textContent).toContain('אפשר גם להיעזר בעוזר החכם שלנו.');
    expect(w.querySelector('a').getAttribute('href')).toBe('mailto:support@tekango.com');
    expect(getByTestId('notification-center').getAttribute('dir')).toBe('rtl');
    expect(w.textContent).not.toMatch(/Welcome|notified/);
    await waitFor(() => expect(getByTestId('header-bell-count').textContent).toBe('1'));
  });

  it('EN: the mirrored copy, LTR, no Hebrew', async () => {
    const client = fakeClient();
    const { getByTestId } = await openPanel({ client, isHebrew: false, isLocalIsraeliBusiness: false, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('notification-welcome')).toBeTruthy());
    const w = getByTestId('notification-welcome');
    expect(w.textContent).toContain('Welcome to the TEKANGO family! 👋');
    expect(w.textContent).toContain("You'll be notified here when a client views a quote. You can also turn on reminders for a viewed quote still awaiting approval and for a quote about to expire, in Business settings › Reminders & automation.");
    expect(w.textContent).toContain("Questions or requests? We're here:");
    expect(w.textContent).toContain('You can also use our smart AI.');
    // the International market's service mailbox (src/shared/brand.js), never the Hebrew-market one
    expect(w.querySelector('a').getAttribute('href')).toBe('mailto:info@tekango.com');
    expect(w.textContent).not.toContain('support@');
    expect(w.textContent).not.toMatch(/[֐-׿]/);
    expect(getByTestId('notification-center').getAttribute('dir')).toBe('ltr');
  });

  it('marking all read stores the welcome key through the existing read-mark path', async () => {
    const client = fakeClient();
    const { getByTestId, getByText } = await openPanel({ client, isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('header-bell-count')).toBeTruthy());
    fireEvent.click(getByText(REMINDERS_COPY.he.center.markAll));
    await waitFor(() => expect(client.upserts.map((r) => r.item_key)).toContain(WELCOME_ITEM_KEY));
    await waitFor(() => expect(getByTestId('notification-welcome').style.opacity).toBe('0.6'));
    expect(document.querySelector('[data-testid="header-bell-count"]')).toBeNull();
  });

  it('an already-read welcome is dimmed and not counted', async () => {
    const client = fakeClient({ readKeys: [WELCOME_ITEM_KEY] });
    const { getByTestId, queryByTestId } = await openPanel({ client, isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('notification-welcome').style.opacity).toBe('0.6'));
    expect(queryByTestId('header-bell-count')).toBeNull();
  });

  it('not shown to an older account or when reminders are Off', async () => {
    const old = await openPanel({ client: fakeClient(), isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - 60 * DAY).toISOString() } });
    await waitFor(() => expect(old.getByText(REMINDERS_COPY.he.center.empty)).toBeTruthy());
    expect(old.queryByTestId('notification-welcome')).toBeNull();
    cleanup();
    const off = await openPanel({ client: fakeClient({ mode: 'off' }), isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(off.getByText(REMINDERS_COPY.he.center.modeOff)).toBeTruthy());
    expect(off.queryByTestId('notification-welcome')).toBeNull();
  });

  it.each([[true, 'פתיחת צ׳אט AI'], [false, 'Open AI Chat']])('isHebrew=%s: the AI button opens the one assistant (existing event) and closes the panel', async (he, label) => {
    const opened = [];
    const onOpen = () => opened.push(1);
    window.addEventListener('open-proflow-ai-chat', onOpen);
    try {
      const { getByTestId, queryByTestId } = await openPanel({ client: fakeClient(), isHebrew: he, isLocalIsraeliBusiness: he, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
      await waitFor(() => expect(getByTestId('notification-welcome-ai')).toBeTruthy());
      expect(getByTestId('notification-welcome-ai').textContent).toBe(label);
      fireEvent.click(getByTestId('notification-welcome-ai'));
      expect(opened).toEqual([1]);
      await waitFor(() => expect(queryByTestId('notification-center')).toBeNull());
    } finally { window.removeEventListener('open-proflow-ai-chat', onOpen); }
  });

  it.each([[true, 'בהגדרות עסק › תזכורות ואוטומציות'], [false, 'Business settings › Reminders & automation']])('isHebrew=%s: the settings link opens Reminders & automation (product event) and closes the panel', async (he, label) => {
    const opened = [];
    const onOpen = () => opened.push(1);
    window.addEventListener(OPEN_REMINDERS_SETTINGS_EVENT, onOpen);
    try {
      const { getByTestId, queryByTestId } = await openPanel({ client: fakeClient(), isHebrew: he, isLocalIsraeliBusiness: he, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
      await waitFor(() => expect(getByTestId('notification-welcome-settings')).toBeTruthy());
      expect(getByTestId('notification-welcome-settings').textContent).toBe(label);
      fireEvent.click(getByTestId('notification-welcome-settings'));
      expect(opened).toEqual([1]);
      await waitFor(() => expect(queryByTestId('notification-center')).toBeNull());
    } finally { window.removeEventListener(OPEN_REMINDERS_SETTINGS_EVENT, onOpen); }
  });

  it('read marks unavailable: the welcome shows but adds no badge the user could not clear', async () => {
    const { getByTestId, queryByTestId } = await openPanel({ client: fakeClient({ failing: ['reminder_notification_state'] }), isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('notification-welcome')).toBeTruthy());
    expect(queryByTestId('header-bell-count')).toBeNull();
  });

  it('saved mode not loaded: no welcome (an account that chose Off never sees it by mistake)', async () => {
    const { getByTestId, queryByTestId } = await openPanel({ client: fakeClient({ failing: ['reminder_settings'] }), isHebrew: true, isLocalIsraeliBusiness: true, authUser: { created_at: new Date(NOW - DAY).toISOString() } });
    await waitFor(() => expect(getByTestId('notification-center')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 30));
    expect(queryByTestId('notification-welcome')).toBeNull();
  });
});
