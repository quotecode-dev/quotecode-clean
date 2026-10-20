// Owner console 2026-10-20 (typed L-17 approval: "מאשר שינוי ב-L-17: הצעה לשדרוג בפריט הפעמון של החתימה הראשונה, רק במסלול החינם"):
// the bell item of the account's FIRST customer signature in its free plan also opens the plans view. Every other bell item and button
// stays as it was; no window (plan system off / paid / LIFETIME) = no offer.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import NotificationCenter from './NotificationCenter';
import { bellActionsFor, firstFreeSignatureQuoteId, saveFloatedKeys } from '../utils/bellSubject';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const NOW = new Date('2026-10-24T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const USER = 'u-upgrade';
// the free window started 2026-10-21 12:00 UTC (ends 168h later)
const FREE10 = { limit: 10, consumed: 2, reserved: 0, remaining: 8, endsAt: '2026-10-28T12:00:00.000Z', periodEnded: false };
const signed = (id, iso) => ({ id, quote_number: Number(id.replace(/\D/g, '')) || 1, status: 'approved', signed_at: iso, client_name: 'Eden David', clients: { name: 'Eden David' } });

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

function fakeClient() {
  const rows = { reminder_settings: { mode: 'in_app' }, tasks: [], reminder_notification_state: [] };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, in: () => q, maybeSingle: () => Promise.resolve(result),
      then: (res, rej) => Promise.resolve(result).then(res, rej), upsert: () => Promise.resolve({ error: null }) };
    return q;
  };
  return { from: query };
}

describe('firstFreeSignatureQuoteId (pure)', () => {
  it('the earliest signature since the free window started; signatures before it never count', () => {
    const quotes = [
      signed('q-old', '2026-10-01T09:00:00Z'),      // before the window (an existing account's earlier customer)
      signed('q-second', '2026-10-23T09:00:00Z'),
      signed('q-first', '2026-10-22T09:00:00Z'),
      { id: 'q-unsigned', status: 'sent', signed_at: null },
    ];
    expect(firstFreeSignatureQuoteId(quotes, FREE10)).toBe('q-first');
    expect(firstFreeSignatureQuoteId([signed('q-old', '2026-10-01T09:00:00Z')], FREE10)).toBeNull();
  });
  it('no window (plan system off, paid, LIFETIME) or no list = no offer', () => {
    const quotes = [signed('q1', '2026-10-22T09:00:00Z')];
    expect(firstFreeSignatureQuoteId(quotes, null)).toBeNull();
    expect(firstFreeSignatureQuoteId(quotes, { ...FREE10, endsAt: null })).toBeNull();
    expect(firstFreeSignatureQuoteId(null, FREE10)).toBeNull();
  });
  it('bellActionsFor: only that signed item gets the plans button, after its quote button; nothing else changes', () => {
    expect(bellActionsFor({ kind: 'signed', quoteId: 'q1' }, [], 'q1')).toEqual([{ kind: 'quote', quoteId: 'q1' }, { kind: 'plans' }]);
    expect(bellActionsFor({ kind: 'signed', quoteId: 'q2' }, [], 'q1')).toEqual([{ kind: 'quote', quoteId: 'q2' }]);
    expect(bellActionsFor({ kind: 'signed', quoteId: 'q1' })).toEqual([{ kind: 'quote', quoteId: 'q1' }]);
    expect(bellActionsFor({ kind: 'first_view', quoteId: 'q1' }, [], 'q1')).toEqual([{ kind: 'quote', quoteId: 'q1' }]);
  });
});

describe('the bell renders the offer (HE / EN)', () => {
  const quotes = [signed('q7', new Date(NOW - 2 * HOUR).toISOString())];
  const mount = (props) => render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={quotes} isLocalIsraeliBusiness {...props} />);
  it('HE: "למסלולים" next to "צפייה בהצעה" on the first signature; it opens the plans view', async () => {
    saveFloatedKeys(USER, new Set(['signed:q7'])); // already floated: this test is about the row buttons
    const utils = mount({ isHebrew: true, upgradeQuoteId: 'q7' });
    fireEvent.click(utils.getByTestId('header-bell'));
    const plans = await waitFor(() => utils.getByTestId('notification-action-plans'));
    expect(plans.textContent).toBe('למסלולים');
    expect(utils.getByTestId('notification-action-quote').textContent).toBe('צפייה בהצעה');
    let opened = 0;
    const on = () => { opened += 1; };
    window.addEventListener('tekango:open-plans', on);
    fireEvent.click(plans);
    window.removeEventListener('tekango:open-plans', on);
    expect(opened).toBe(1);
  });
  it('EN: "See the plans"; without the id (not Free / not enforced) there is no plans button', async () => {
    saveFloatedKeys(USER, new Set(['signed:q7']));
    const en = mount({ isHebrew: false, upgradeQuoteId: 'q7' });
    fireEvent.click(en.getByTestId('header-bell'));
    expect((await waitFor(() => en.getByTestId('notification-action-plans'))).textContent).toBe('See the plans');
    cleanup();
    saveFloatedKeys(USER, new Set(['signed:q7']));
    const off = mount({ isHebrew: true });
    fireEvent.click(off.getByTestId('header-bell'));
    await waitFor(() => expect(off.getByTestId('notification-action-quote')).toBeTruthy());
    expect(off.queryByTestId('notification-action-plans')).toBeNull();
  });
});

describe('Dashboard wiring (source guard)', () => {
  const dash = fs.readFileSync(path.join(HERE, '..', 'pages', 'Dashboard.jsx'), 'utf8');
  it('the id comes from the server summary: Free + enforced only, never LIFETIME; both bells get it', () => {
    expect(dash).toMatch(/if \(isLifetimeAccount \|\| accountSummary\?\.state !== 'ready' \|\| accountSummary\.phase\.output !== 'enforced' \|\| accountSummary\.planId !== 'free'\) return null;/);
    expect((dash.match(/upgradeQuoteId=\{bellUpgradeQuoteId\}/g) || []).length).toBe(2);
  });
});
