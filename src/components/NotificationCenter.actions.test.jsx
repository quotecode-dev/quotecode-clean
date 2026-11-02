// Night task 2026-10-19 (Owner console, doc 4559529a): every bell notification has a button that opens its own subject (quote / task /
// client); a NEW notification floats once at the top of the work area, closes on X, and never floats again (reload / second tab).
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import NotificationCenter from './NotificationCenter';
import { BELL_SUBJECT_EVENT, bellActionsFor, pendingFloating, loadFloatedKeys, saveFloatedKeys } from '../utils/bellSubject';
import { WELCOME_ITEM_KEY } from '../utils/reminders';

const NOW = new Date('2026-10-15T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const USER = 'u-actions';

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

function fakeClient({ mode = 'in_app', tasks = [], readKeys = [] } = {}) {
  const upserts = [];
  const rows = { reminder_settings: mode ? { mode } : null, tasks, reminder_notification_state: readKeys.map((item_key) => ({ item_key })) };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = {
      select: () => q, eq: () => q, order: () => q, in: () => q,
      maybeSingle: () => Promise.resolve(result),
      then: (res, rej) => Promise.resolve(result).then(res, rej),
      upsert: (r) => { upserts.push(...r); return Promise.resolve({ error: null }); },
    };
    return q;
  };
  return { from: query, upserts };
}

const viewedQuote = { id: 'q1', quote_number: 1001, status: 'sent', first_viewed_at: new Date(NOW - HOUR).toISOString(), view_count: 1, client_name: 'Eden David', clients: { name: 'Eden David' } };
const davidTask = { id: 't1', status: 'open', title: 'להתקשר לדוד', due_date: '2026-10-15', due_time: null, client_id: 'c1', quote_id: null };

const mountBell = (props) => render(<NotificationCenter userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness {...props} />);
const openPanel = async (utils) => {
  fireEvent.click(utils.getByTestId('header-bell'));
  await waitFor(() => expect(utils.getByTestId('notification-center')).toBeTruthy());
};
const captureSubject = () => {
  const got = [];
  const on = (e) => got.push(e.detail);
  window.addEventListener(BELL_SUBJECT_EVENT, on);
  return { got, stop: () => window.removeEventListener(BELL_SUBJECT_EVENT, on) };
};

describe('bellActionsFor (pure)', () => {
  it('a quote notification opens the quote; a task opens the task and, when linked, the client', () => {
    expect(bellActionsFor({ kind: 'first_view', quoteId: 'q1' })).toEqual([{ kind: 'quote', quoteId: 'q1' }]);
    expect(bellActionsFor({ kind: 'viewed_not_approved', quoteId: 'q2' })).toEqual([{ kind: 'quote', quoteId: 'q2' }]);
    expect(bellActionsFor({ kind: 'validity_ending', quoteId: 'q3' })).toEqual([{ kind: 'quote', quoteId: 'q3' }]);
    expect(bellActionsFor({ kind: 'task_due', taskId: 't1' }, [davidTask])).toEqual([{ kind: 'task', taskId: 't1' }, { kind: 'client', clientId: 'c1' }]);
    expect(bellActionsFor({ kind: 'task_due', taskId: 't9' }, [davidTask])).toEqual([{ kind: 'task', taskId: 't9' }]);
  });
  it('the welcome item and unknown kinds get no button (never a dead button)', () => {
    expect(bellActionsFor({ kind: 'welcome', key: WELCOME_ITEM_KEY })).toEqual([]);
    expect(bellActionsFor({ kind: 'first_view' })).toEqual([]);
    expect(bellActionsFor(null)).toEqual([]);
  });
  it('pendingFloating: unread and never floated, newest first; nothing before the floated memory exists', () => {
    const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    expect(pendingFloating(items, new Set(['b']), new Set(['c']))).toEqual([{ key: 'a' }]);
    expect(pendingFloating(items, new Set(), null)).toEqual([]);
  });
});

describe('bell rows: subject buttons', () => {
  it('HE: "צפייה בהצעה" on a viewed quote - dispatches the quote, marks it read, closes the panel', async () => {
    saveFloatedKeys(USER, new Set(['first_view:q1'])); // already floated: this test is about the row button
    const client = fakeClient();
    const utils = mountBell({ client, quotes: [viewedQuote] });
    await openPanel(utils);
    const btn = await waitFor(() => utils.getByTestId('notification-action-quote'));
    expect(btn.textContent).toBe('צפייה בהצעה');
    const cap = captureSubject();
    fireEvent.click(btn);
    cap.stop();
    expect(cap.got).toEqual([{ kind: 'quote', quoteId: 'q1' }]);
    expect(utils.queryByTestId('notification-center')).toBeNull();
    await waitFor(() => expect(client.upserts.map((r) => r.item_key)).toContain('first_view:q1'));
  });

  it('a task linked to a client: "צפייה במשימה" and "פרטי הלקוח"', async () => {
    saveFloatedKeys(USER, new Set(['task_due:t1:2026-10-15T']));
    const client = fakeClient({ tasks: [davidTask] });
    const utils = mountBell({ client });
    await openPanel(utils);
    const task = await waitFor(() => utils.getByTestId('notification-action-task'));
    expect(task.textContent).toBe('צפייה במשימה');
    expect(utils.getByTestId('notification-action-client').textContent).toBe('פרטי הלקוח');
    const cap = captureSubject();
    fireEvent.click(utils.getByTestId('notification-action-client'));
    cap.stop();
    expect(cap.got).toEqual([{ kind: 'client', clientId: 'c1' }]);
  });

  it('the panel closes on its own X; an unread notification is marked read on its own (Owner 2026-10-20)', async () => {
    saveFloatedKeys(USER, new Set(['first_view:q1']));
    const utils = mountBell({ client: fakeClient(), quotes: [viewedQuote] });
    await openPanel(utils);
    const mark = await waitFor(() => utils.getByTestId('notification-mark-read'));
    expect(mark.textContent).toBe('סימון כנקרא');
    fireEvent.click(mark);
    await waitFor(() => expect(utils.queryByTestId('notification-mark-read')).toBeNull());
    expect(utils.getByTestId('notification-center')).toBeTruthy();
    expect(utils.getByTestId('notification-center-close').getAttribute('aria-label')).toBe('סגירת ההתראות');
    fireEvent.click(utils.getByTestId('notification-center-close'));
    expect(utils.queryByTestId('notification-center')).toBeNull();
  });

  it('EN copy', async () => {
    saveFloatedKeys(USER, new Set(['first_view:q1']));
    const utils = mountBell({ client: fakeClient(), quotes: [viewedQuote], isHebrew: false, isLocalIsraeliBusiness: false });
    await openPanel(utils);
    await waitFor(() => expect(utils.getByTestId('notification-action-quote').textContent).toBe('View quote'));
  });
});

describe('floating notice', () => {
  const header = () => {
    const h = document.createElement('div');
    h.className = 'dash-upper-section';
    h.getBoundingClientRect = () => ({ top: 6, bottom: 62, left: 6, right: 384, width: 378, height: 56 });
    document.body.appendChild(h);
    return h;
  };
  afterEach(() => { document.querySelectorAll('.dash-upper-section').forEach((n) => n.remove()); });

  it('the first run in this browser only records the existing notifications (nothing floats)', async () => {
    header();
    mountBell({ client: fakeClient(), quotes: [viewedQuote] });
    await waitFor(() => expect(loadFloatedKeys(USER)).not.toBeNull());
    expect(loadFloatedKeys(USER).has('first_view:q1')).toBe(true);
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('a NEW notification floats once with its subject button; X closes it; a remount (reload / second tab) never floats it again', async () => {
    header();
    saveFloatedKeys(USER, new Set()); // the memory exists (not a first run)
    const client = fakeClient();
    const first = mountBell({ client, quotes: [viewedQuote] });
    const notice = await waitFor(() => { const n = document.querySelector('[data-testid="bell-float-notice"]'); expect(n).toBeTruthy(); return n; });
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.getAttribute('dir')).toBe('rtl');
    expect(notice.textContent).toContain('1001');
    expect(document.querySelector('[data-testid="bell-float-action-quote"]').textContent).toBe('צפייה בהצעה');
    expect(loadFloatedKeys(USER).has('first_view:q1')).toBe(true);
    fireEvent.click(document.querySelector('[data-testid="bell-float-close"]'));
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
    first.unmount();
    mountBell({ client, quotes: [viewedQuote] });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('its action opens the subject and marks it read; "+N" shows the other new ones in the bell', async () => {
    header();
    saveFloatedKeys(USER, new Set());
    const client = fakeClient({ tasks: [davidTask] });
    mountBell({ client, quotes: [viewedQuote] });
    await waitFor(() => expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeTruthy());
    expect(document.querySelector('[data-testid="bell-float-more"]').textContent).toBe('+1 נוספות');
    const cap = captureSubject();
    fireEvent.click(document.querySelector('[data-testid^="bell-float-action-"]'));
    cap.stop();
    expect(cap.got.length).toBe(1);
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('waits for the fresh server list: a cached list never sets the first-run memory and never floats', async () => {
    header();
    mountBell({ client: fakeClient(), quotes: [viewedQuote], quotesFresh: false });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(loadFloatedKeys(USER)).toBeNull();
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('reminders Off: nothing floats', async () => {
    header();
    saveFloatedKeys(USER, new Set());
    mountBell({ client: fakeClient({ mode: 'off' }), quotes: [viewedQuote] });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('floats exactly where the bell panel opens, at the panel size (Owner 2026-10-20)', async () => {
    const w = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const rect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function rectOf() {
      if (this.getAttribute?.('data-testid') === 'header-bell') return { top: 20, bottom: 50, left: 60, right: 90, width: 30, height: 30 };
      return rect.call(this);
    };
    try {
      saveFloatedKeys(USER, new Set());
      const utils = mountBell({ client: fakeClient(), quotes: [viewedQuote] });
      const n = await waitFor(() => { const x = document.querySelector('[data-testid="bell-float-notice"]'); expect(x).toBeTruthy(); return x; });
      const box = { top: n.style.top, left: n.style.left, width: n.style.width };
      expect(box).toEqual({ top: '60px', left: '22px', width: '360px' });
      fireEvent.click(document.querySelector('[data-testid="bell-float-close"]'));
      await openPanel(utils);
      const p = utils.getByTestId('notification-center');
      expect({ top: p.style.top, left: p.style.left, width: p.style.width }).toEqual(box);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rect;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
    }
  });
});
