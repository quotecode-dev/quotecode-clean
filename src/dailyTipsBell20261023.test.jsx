// Owner console 2026-10-23, typed: "מאשר שינוי ב-L-02, L-04, L-11, L-12, L-14, L-17, L-24, L-26, L-27 ו-L-28: ... וטיפ יומי שנסגר נשמר
// בפעמון כנקרא למשך 30 יום עם אותו כפתור פעולה" - a closed daily tip sits in the bell as a READ item (never unread, never floats) for
// 30 days, and its button runs the card's own action.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from './components/NotificationCenter';
import { saveFloatedKeys, bellActionsFor, pendingFloating } from './utils/bellSubject';
import { activeAnnouncements } from './utils/bellAnnouncements';
import { tipBellItems, markTipShown, parseTipState, DAILY_TIP_ACTION_EVENT } from './utils/dailyTips';

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
    expect(bellActionsFor(items[0])).toEqual([{ kind: 'tip', tipAction: 'twin' }]);
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
    expect(r.queryAllByTestId('notification-mark-read')).toHaveLength(0);
    const btn = rows[0].querySelector('[data-testid="notification-action-tip"]');
    expect(btn.textContent).toBe('לבדוק את ההצעה');
    fireEvent.click(btn);
    expect(ran).toHaveBeenCalledWith({ action: 'twin' });
    expect(client.upserts).toHaveLength(0);
    window.removeEventListener(DAILY_TIP_ACTION_EVENT, on);
  });
});
