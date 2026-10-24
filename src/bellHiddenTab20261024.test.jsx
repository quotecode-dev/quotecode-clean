// Owner console 2026-10-24 (typed L-17, a real user's report: "the quote was signed - no popup, only in the bell"): a notification that
// arrives while the page is hidden floats when the page is visible again - it is never marked floated without being shown.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import NotificationCenter from './components/NotificationCenter';
import { loadFloatedKeys, saveFloatedKeys } from './utils/bellSubject';

const NOW = new Date('2026-10-24T20:00:00Z');
const USER = 'u-hidden';
const signedQuote = { id: 's9', quote_number: 100901, status: 'approved', signature: 'data:x', signed_at: new Date(NOW - 60 * 1000).toISOString(), first_viewed_at: null, view_count: 1, clients: { company_name: 'דורון' } };

function fakeClient() {
  const rows = { reminder_settings: { mode: 'in_app' }, tasks: [], reminder_notification_state: [] };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, in: () => q, maybeSingle: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej), upsert: () => Promise.resolve({ error: null }) };
    return q;
  };
  return { from: query };
}
let visibility = 'visible';
const setVisibility = (v) => { visibility = v; document.dispatchEvent(new Event('visibilitychange')); };

beforeEach(() => {
  window.localStorage.clear();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => { cleanup(); window.localStorage.clear(); delete document.visibilityState; });

describe('a notification that arrives while the page is hidden', () => {
  it('is not shown and not marked while hidden; floats once when the page is visible again', async () => {
    saveFloatedKeys(USER, new Set());
    visibility = 'hidden';
    render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[signedQuote]} isHebrew isLocalIsraeliBusiness />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
    expect([...(loadFloatedKeys(USER) || [])]).not.toContain('signed:s9');
    await act(async () => { setVisibility('visible'); });
    const notice = await waitFor(() => { const n = document.querySelector('[data-testid="bell-float-notice"]'); expect(n).toBeTruthy(); return n; });
    expect(notice.getAttribute('data-notice-kind')).toBe('signed');
    expect([...(loadFloatedKeys(USER) || [])]).toContain('signed:s9');
  });

  it('a visible page floats it at once (as before)', async () => {
    saveFloatedKeys(USER, new Set());
    render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[signedQuote]} isHebrew isLocalIsraeliBusiness />);
    await waitFor(() => expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeTruthy());
  });
});
