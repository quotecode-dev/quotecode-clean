// Owner console 2026-10-23, typed: "מאשר שינוי ב-L-02, L-04, L-11, L-12, L-14, L-17, L-24, L-26, L-27 ו-L-28: ... וטיפ יומי שנסגר נשמר
// בפעמון כנקרא למשך 30 יום עם אותו כפתור פעולה" - a closed daily tip sits in the bell as a READ item (never unread, never floats) for
// 30 days, and its button runs the card's own action.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from './components/NotificationCenter';
import { saveFloatedKeys, bellActionsFor, pendingFloating } from './utils/bellSubject';
import { activeAnnouncements } from './utils/bellAnnouncements';
import { tipBellItems, markTipShown, parseTipState, tipQuoteLabel, DAILY_TIP_ACTION_EVENT } from './utils/dailyTips';

const NOW = new Date('2026-10-23T09:00:00Z');
const USER = 'u-tips';
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

function fakeClient() {
  const rows = { reminder_settings: { mode: 'in_app' }, tasks: [], reminder_notification_state: [] };
  const upserts = [];
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, in: () => q, maybeSingle: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej), upsert: (r) => { upserts.push(r); return Promise.resolve({ error: null }); } };
    return q;
  };
  return { from: query, upserts };
}
const state = markTipShown(markTipShown(parseTipState(null), 'twin_before_send', '2026-10-22'), 'ai_chat', '2026-10-23');

describe('closed daily tips in the bell', () => {
  it('each shown tip = a read announcement for 30 days, never the tip still on screen', () => {
    const items = tipBellItems(state, 'ai_chat');
    expect(items.map((i) => i.key)).toEqual(['tip:twin_before_send']);
    expect(items[0]).toMatchObject({ kind: 'announce', preRead: true, tipAction: 'twin', from: '2026-10-22', until: '2026-11-21' });
    expect(tipBellItems(state).map((i) => i.key)).toEqual(['tip:twin_before_send', 'tip:ai_chat']);
    expect(activeAnnouncements(items, new Date('2026-11-21T12:00:00Z'))).toHaveLength(1);
    expect(activeAnnouncements(items, new Date('2026-11-22T12:00:00Z'))).toHaveLength(0);
    expect(bellActionsFor(items[0])).toEqual([{ kind: 'tip', tipAction: 'twin', quoteId: null }]);
    expect(pendingFloating(items, new Set(), new Set())).toEqual([]);
  });
  it('in the panel: shown as read, adds nothing to the counter, never floats; its button runs the card action', async () => {
    saveFloatedKeys(USER, new Set());
    const ran = vi.fn();
    const on = (e) => ran(e.detail);
    window.addEventListener(DAILY_TIP_ACTION_EVENT, on);
    const client = fakeClient();
    const r = render(<NotificationCenter client={client} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness announcements={tipBellItems(state)} />);
    await new Promise((res) => setTimeout(res, 60));
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
    expect(r.getByTestId('header-bell').textContent).not.toMatch(/\d/);
    fireEvent.click(r.getByTestId('header-bell'));
    const rows = await waitFor(() => { const x = r.getAllByTestId('notification-announce'); expect(x).toHaveLength(2); return x; });
    expect(rows[0].textContent).toContain('הידעתם?');
    expect(rows[0].style.opacity).toBe('0.6');
    // newest first (L-17 23/10): the chat tip shown on 23/10 above the Customer Twin tip shown on 22/10
    expect(rows[0].textContent).toContain('הצ׳אט החכם');
    expect(r.queryAllByTestId('notification-mark-read')).toHaveLength(0);
    const btn = rows[1].querySelector('[data-testid="notification-action-tip"]');
    expect(btn.textContent).toBe('לבדוק את ההצעה');
    fireEvent.click(btn);
    expect(ran).toHaveBeenCalledWith({ action: 'twin', quoteId: null });
    expect(client.upserts).toHaveLength(0);
    window.removeEventListener(DAILY_TIP_ACTION_EVENT, on);
  });
});

// Owner console 2026-10-23, typed: "מאשר שינוי ב-L-17: כל הפריטים בפעמון ממוינים מהחדש לישן, וטיפ בדיקת הלקוח מציין את ההצעה ופותח אותה"
describe('the bell newest first; the Customer Twin tip names its quote', () => {
  const quote = { id: 'q-9', quote_number: 1042, quote_subject: 'שיפוץ מטבח', status: 'draft', quote_items: [{ description: 'פירוק' }] };
  const named = markTipShown(parseTipState(null), 'twin_before_send', '2026-10-23', { at: '2026-10-23T08:30:00.000Z', quoteId: 'q-9', quoteLabel: tipQuoteLabel(quote) });
  it('the label = the quote number and its subject; the bell item carries the quote and sorts by the moment shown', () => {
    expect(tipQuoteLabel(quote)).toBe('A1042 · שיפוץ מטבח');
    expect(tipQuoteLabel({ clients: { company_name: 'כהן בע"מ' } })).toBe('כהן בע"מ');
    const [item] = tipBellItems(named);
    expect(item.copy.he.body).toContain('ההצעה: A1042 · שיפוץ מטבח');
    expect(item.sortAt).toBe('2026-10-23T08:30:00.000Z');
    expect(bellActionsFor(item)).toEqual([{ kind: 'tip', tipAction: 'twin', quoteId: 'q-9' }]);
  });
  it('every bell item, reminders and announcements together, newest first; the tip button sends its quote', async () => {
    saveFloatedKeys(USER, new Set(['announce:old']));
    const old = { key: 'announce:old', kind: 'announce', from: '2026-10-01', until: '2026-12-31', sortAt: '2026-10-01T00:00', copy: { he: { title: 'ישן', body: 'x' }, en: { title: 'old', body: 'x' } } };
    const ran = vi.fn(); const on = (e) => ran(e.detail); window.addEventListener(DAILY_TIP_ACTION_EVENT, on);
    const r = render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness announcements={[old, ...tipBellItems(named)]} />);
    fireEvent.click(r.getByTestId('header-bell'));
    const rows = await waitFor(() => { const x = r.getAllByTestId('notification-announce'); expect(x).toHaveLength(2); return x; });
    expect(rows[0].textContent).toContain('הידעתם?');
    expect(rows[1].textContent).toContain('ישן');
    fireEvent.click(rows[0].querySelector('[data-testid="notification-action-tip"]'));
    expect(ran).toHaveBeenCalledWith({ action: 'twin', quoteId: 'q-9' });
    window.removeEventListener(DAILY_TIP_ACTION_EVENT, on);
  });
});
