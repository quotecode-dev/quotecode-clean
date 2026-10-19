// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-17 ושדה זמן חתימה חדש במסד: התראה בפעמון כשלקוח חותם על הצעה".
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from './components/NotificationCenter';
import { deriveInAppReminders, normalizeReminderSettings } from './utils/reminders';
import { bellActionsFor, saveFloatedKeys } from './utils/bellSubject';

const NOW = new Date('2026-10-19T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const USER = 'u-signed';
const signedQuote = (over = {}) => ({ id: 's1', quote_number: 100701, status: 'approved', signature: 'data:x', signed_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), first_viewed_at: null, view_count: 3, clients: { company_name: 'נעמה כהן' }, ...over });
const derive = (quotes, mode = 'in_app') => deriveInAppReminders({ settings: normalizeReminderSettings({ mode }), tasks: [], quotes, today: '2026-10-19', nowClock: '15:00', now: NOW.getTime(), isExpired: () => false, firstViewAvailable: true });

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

function fakeClient() {
  const rows = { reminder_settings: { mode: 'in_app' }, tasks: [], reminder_notification_state: [] };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, in: () => q, maybeSingle: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej), upsert: () => Promise.resolve({ error: null }) };
    return q;
  };
  return { from: query };
}

describe('the customer signed - bell item (Owner 2026-10-19)', () => {
  it('a quote signed within 14 days is a "signed" item with a View quote action', () => {
    const items = derive([signedQuote()]);
    expect(items.map((i) => i.key)).toEqual(['signed:s1']);
    expect(bellActionsFor(items[0])).toEqual([{ kind: 'quote', quoteId: 's1' }]);
  });

  it('never: older than 14 days, not approved / paid, no signing time, or reminders Off', () => {
    expect(derive([signedQuote({ signed_at: new Date(NOW - 15 * DAY).toISOString() })])).toEqual([]);
    expect(derive([signedQuote({ status: 'sent' })])).toEqual([]);
    expect(derive([signedQuote({ signed_at: null })])).toEqual([]);
    expect(derive([signedQuote()], 'off')).toEqual([]);
    expect(derive([signedQuote({ status: 'paid' })]).map((i) => i.kind)).toEqual(['signed']);
  });

  it('the bell shows "the customer signed" with the client, the time and "View quote" (HE / EN)', async () => {
    saveFloatedKeys(USER, new Set(['signed:s1']));
    const he = render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[signedQuote()]} isHebrew isLocalIsraeliBusiness />);
    fireEvent.click(he.getByTestId('header-bell'));
    const row = await waitFor(() => he.getByTestId('notification-signed'));
    expect(row.textContent).toContain('הלקוח חתם על הצעה');
    expect(row.textContent).toContain('נעמה כהן');
    expect(he.getByTestId('notification-action-quote').textContent).toBe('צפייה בהצעה');
    he.unmount();
    const en = render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[signedQuote()]} isHebrew={false} isLocalIsraeliBusiness={false} />);
    fireEvent.click(en.getByTestId('header-bell'));
    const enRow = await waitFor(() => en.getByTestId('notification-signed'));
    expect(enRow.textContent).toContain('The customer signed quote');
    expect(en.getByTestId('notification-action-quote').textContent).toBe('View quote');
  });

  it('a NEW signing floats once (like every new notification)', async () => {
    saveFloatedKeys(USER, new Set());
    render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[signedQuote()]} isHebrew isLocalIsraeliBusiness />);
    const notice = await waitFor(() => { const n = document.querySelector('[data-testid="bell-float-notice"]'); expect(n).toBeTruthy(); return n; });
    expect(notice.getAttribute('data-notice-kind')).toBe('signed');
    expect(notice.textContent).toContain('הלקוח חתם על הצעה');
  });
});
