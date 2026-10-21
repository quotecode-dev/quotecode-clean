// Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22 וב-L-01: מסך החזרה מהתשלום בחלון המסלולים, ותיקון הנוסח, הכפתור והשוק בחלון
// המסלולים"): back from the payment page in the plans window; the 'not available yet' lines only while paying is not possible; a fresh
// pay button on every opening / Back; Israel only. Billing off (today) = everything exactly as before.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PricingModal from './components/PricingModal';
import useBillingReturn, { markBillingDeparture } from './hooks/useBillingReturn';
import { parseAccountSummary } from '../supabase/functions/_shared/subscriptionContract.ts';
import {
  packageCheckoutAvailable, billingReturnFromSearch, searchWithoutBillingReturn, billingReturnState, billingReturnText,
  BILLING_RETURN_POLL_MS, BILLING_RETURN_WAIT_MS,
} from './domain/subscriptions/packageCheckout';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

afterEach(() => { cleanup(); vi.useRealTimers(); try { window.sessionStorage.clear(); } catch { /* none */ } });
const raw = (over = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'prepared' },
  market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 }, catalog: { active: 4, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
  priceCatalogVersion: 'pv1:0123456789abcdef', ...over,
});
const summary = (over) => parseAccountSummary(raw(over));
const OFF = { phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } };
const active = (smart = false, limited = false) => summary({ plan: { id: 'all_inclusive' }, subscriptionStatus: 'active', free10: null,
  catalog: { active: 4, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true },
  billing: limited ? { paidThrough: '2026-11-21T10:00:00.000Z', graceEndsAt: '2026-11-24T10:00:00.000Z', inGrace: false, limited: true }
    : { paidThrough: '2026-11-21T10:00:00.000Z', graceEndsAt: null, inGrace: false, limited: false },
  smartPack: { active: smart, source: smart ? 'add_on' : null, until: null } });

describe('the market: Israel only', () => {
  it('an international account never gets the pay button (the connector charges ILS only)', () => {
    expect(packageCheckoutAvailable(summary())).toBe(true);
    expect(packageCheckoutAvailable(summary({ market: 'INTERNATIONAL' }))).toBe(false);
    render(<PricingModal isOpen onClose={() => {}} isHebrew={false} isLocalIsraeliBusiness={false} accountSummary={summary({ market: 'INTERNATIONAL' })} onPurchase={vi.fn()} />);
    expect(screen.queryByTestId('plans-pay')).toBeNull();
    expect(screen.getByTestId('plans-modal-availability')).toBeTruthy();
  });
});

describe('the return address and state (pure)', () => {
  it('reads processing / failed / cancelled only (an appended "?x=" is tolerated); afterwards only ?lang= stays', () => {
    expect(billingReturnFromSearch('?billing=processing&lang=he')).toBe('processing');
    expect(billingReturnFromSearch('?billing=failed')).toBe('failed');
    expect(billingReturnFromSearch('?billing=cancelled')).toBe('cancelled');
    expect(billingReturnFromSearch('?billing=processing?page_request_uid=abc')).toBe('processing');
    expect(billingReturnFromSearch('?billing=active')).toBeNull();
    expect(billingReturnFromSearch('')).toBeNull();
    expect(searchWithoutBillingReturn('?billing=processing&lang=he&transaction_uid=x&approval_num=1')).toBe('?lang=he');
    expect(searchWithoutBillingReturn('?billing=failed&page_request_uid=y')).toBe('');
    expect(searchWithoutBillingReturn('?billing=failed&lang=fr')).toBe('');
  });
  it('"confirmed" only from the server summary, which wins over the address; billing off / not ready = nothing; 90 s then "timeout"', () => {
    expect(billingReturnState('processing', summary(OFF), 0)).toBeNull();
    expect(billingReturnState('processing', { state: 'loading' }, 0)).toBeNull();
    expect(billingReturnState('processing', summary(), 0)).toBe('waiting');
    expect(billingReturnState('processing', summary(), BILLING_RETURN_WAIT_MS)).toBe('timeout');
    expect(billingReturnState('processing', active(), 5000)).toBe('confirmed');
    expect(billingReturnState('processing', active(false, true), 5000)).toBe('waiting'); // a limited account paying again
    expect(billingReturnState('failed', summary(), 0)).toBe('failed');
    expect(billingReturnState('cancelled', summary(), 0)).toBe('cancelled');
    expect(billingReturnState('failed', active(), 0)).toBe('confirmed');
    expect(billingReturnState('cancelled', active(), 0)).toBe('confirmed');
    expect(billingReturnState('active', active(), 0)).toBeNull();
  });
  it('the words (HE / EN): never "active" while waiting; SMART PACK only when the server says so', () => {
    expect(billingReturnText('waiting', true)).toBe('מאמתים את התשלום… המסלול ייפתח רק אחרי שהתשלום יאושר.');
    expect(billingReturnText('waiting', false)).toBe('Confirming your payment… Your package opens only after the payment is confirmed.');
    expect(billingReturnText('confirmed', true, { smartPack: true })).toBe('התשלום אושר. חכם פלוס פעיל.');
    expect(billingReturnText('confirmed', false)).toBe('Payment confirmed.');
    expect(billingReturnText('confirmed', false, { smartPack: true })).toBe('Payment confirmed. SMART PACK is active.');
    expect(billingReturnText('failed', true)).toBe('התשלום לא הושלם, ולא נפתח מסלול. אפשר לנסות שוב.');
    expect(billingReturnText('cancelled', false)).toBe('The payment was cancelled. Nothing was charged.');
    expect(billingReturnText('timeout', true)).toBe('האישור על התשלום עדיין לא הגיע. אם בוצע חיוב, המסלול ייפתח מעצמו תוך כמה דקות.');
  });
});

describe('the plans window', () => {
  it('billing off (today): the window is exactly as before - both "not yet" lines, no return line, no button', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary(OFF)} onPurchase={vi.fn()} />);
    expect(screen.getByTestId('plans-modal-availability').textContent).toMatch(/רכישת מנוי עדיין לא זמינה/);
    expect(screen.queryByTestId('plans-modal-billing-return')).toBeNull();
    expect(screen.queryByTestId('plans-pay')).toBeNull();
  });
  it('paying possible: no "not available yet" / "details later" lines next to the pay button', () => {
    const { container } = render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} onPurchase={vi.fn()} />);
    expect(screen.getByTestId('plans-pay')).toBeTruthy();
    expect(screen.queryByTestId('plans-modal-availability')).toBeNull();
    expect(container.textContent).not.toMatch(/עדיין לא זמינה|יפורסמו לפני הפעלת המנויים/);
  });
  it('HE / RTL: waiting is a status line; confirmed (+ SMART PACK) and the server plan line below; failed is an alert; the pay button stays', () => {
    const { rerender } = render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} onPurchase={vi.fn()} billingReturn={{ state: 'waiting' }} />);
    let line = screen.getByTestId('plans-modal-billing-return');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.closest('[dir]').getAttribute('dir')).toBe('rtl');
    expect(line.textContent).toBe('מאמתים את התשלום… המסלול ייפתח רק אחרי שהתשלום יאושר.');
    rerender(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={active(true)} onPurchase={vi.fn()} billingReturn={{ state: 'confirmed' }} />);
    expect(screen.getByTestId('plans-modal-billing-return').textContent).toBe('התשלום אושר. חכם פלוס פעיל.');
    expect(screen.getByTestId('plans-modal-current').textContent).toMatch(/^המסלול הנוכחי: /);
    expect(screen.queryByTestId('plans-pay')).toBeNull(); // an active package pays for nothing
    rerender(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} onPurchase={vi.fn()} billingReturn={{ state: 'failed' }} />);
    line = screen.getByTestId('plans-modal-billing-return');
    expect(line.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('plans-pay')).toBeTruthy();
  });
  it('EN / LTR: timeout offers "Check again"; HE says "בדיקה חוזרת"', () => {
    const onCheckAgain = vi.fn();
    const { rerender } = render(<PricingModal isOpen onClose={() => {}} isHebrew={false} isLocalIsraeliBusiness accountSummary={summary()} onPurchase={vi.fn()} billingReturn={{ state: 'timeout', onCheckAgain }} />);
    expect(screen.getByTestId('plans-modal-billing-return').closest('[dir]').getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByTestId('plans-modal-billing-check-again'));
    expect(screen.getByTestId('plans-modal-billing-check-again').textContent).toBe('Check again');
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
    rerender(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} onPurchase={vi.fn()} billingReturn={{ state: 'timeout', onCheckAgain }} />);
    expect(screen.getByTestId('plans-modal-billing-check-again').textContent).toBe('בדיקה חוזרת');
  });
  it('LIFETIME never sees a return line', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} isLifetime onPurchase={vi.fn()} billingReturn={{ state: 'waiting' }} />);
    expect(screen.queryByTestId('plans-modal-billing-return')).toBeNull();
  });
  it('the pay button starts fresh when the window opens again and when the page comes back (Back from the payment page)', async () => {
    const onPurchase = vi.fn(async () => ({ ok: true })); // leaving for the payment page: the button stays busy
    const props = { onClose: () => {}, isHebrew: true, isLocalIsraeliBusiness: true, accountSummary: summary(), onPurchase };
    const { rerender } = render(<PricingModal isOpen {...props} />);
    fireEvent.click(screen.getByTestId('plans-pay'));
    await waitFor(() => expect(screen.getByTestId('plans-pay').disabled).toBe(true));
    act(() => { window.dispatchEvent(new Event('pageshow')); });
    expect(screen.getByTestId('plans-pay').disabled).toBe(false);
    fireEvent.click(screen.getByTestId('plans-pay'));
    await waitFor(() => expect(screen.getByTestId('plans-pay').disabled).toBe(true));
    rerender(<PricingModal isOpen={false} {...props} />);
    rerender(<PricingModal isOpen {...props} />);
    expect(screen.getByTestId('plans-pay').disabled).toBe(false);
  });
});

describe('useBillingReturn', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/dashboard?billing=processing&lang=he&transaction_uid=t1'); });
  afterEach(() => { window.history.replaceState(null, '', '/'); });
  const hook = (props) => renderHook((p) => useBillingReturn(p), { initialProps: { userId: ME, plansOpen: false, refreshQuiet: vi.fn(async () => null), openPlans: vi.fn(), ...props } });

  it('the same account that left: reads the address once (payment parameters removed), opens the window, reads quietly until confirmed', async () => {
    vi.useFakeTimers();
    markBillingDeparture(ME);
    const openPlans = vi.fn();
    const refreshQuiet = vi.fn(async () => null);
    const { result, rerender } = hook({ summary: summary(), openPlans, refreshQuiet });
    expect(window.location.search).toBe('?lang=he');
    expect(result.current.state).toBe('waiting');
    expect(openPlans).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_POLL_MS); });
    expect(refreshQuiet).toHaveBeenCalledTimes(1);
    rerender({ summary: active(), userId: ME, plansOpen: true, openPlans, refreshQuiet });
    expect(result.current.state).toBe('confirmed');
    await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_POLL_MS * 3); });
    expect(refreshQuiet).toHaveBeenCalledTimes(1); // confirmed = no more reads
    expect(openPlans).toHaveBeenCalledTimes(1);
  });
  it('90 seconds without confirmation -> timeout, the reads stop; "check again" waits again and the reads resume', async () => {
    vi.useFakeTimers();
    markBillingDeparture(ME);
    const refreshQuiet = vi.fn(() => new Promise(() => {})); // a hung read never freezes the clock
    const { result } = hook({ summary: summary(), refreshQuiet });
    await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_WAIT_MS + BILLING_RETURN_POLL_MS); });
    expect(result.current.state).toBe('timeout');
    const reads = refreshQuiet.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_POLL_MS * 3); });
    expect(refreshQuiet.mock.calls.length).toBe(reads);
    act(() => { result.current.checkAgain(); });
    expect(result.current.state).toBe('waiting');
    await act(async () => { await vi.advanceTimersByTimeAsync(BILLING_RETURN_POLL_MS); });
    expect(refreshQuiet.mock.calls.length).toBeGreaterThan(reads + 1);
  });
  it('another account (signed in after the payment page), or no departure from this tab: nothing opens and the return is forgotten', () => {
    markBillingDeparture(OTHER);
    const openPlans = vi.fn();
    const { result } = hook({ summary: summary(), openPlans });
    expect(result.current.state).toBeNull();
    expect(openPlans).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('tekango:billing-return')).toBeNull();
    window.history.replaceState(null, '', '/dashboard?billing=failed');
    window.sessionStorage.clear();
    const second = hook({ summary: summary(), openPlans });
    expect(second.result.current.state).toBeNull();
    expect(openPlans).not.toHaveBeenCalled();
  });
  it('billing off (today): the address is removed and the return forgotten - nothing opens, nothing is read', () => {
    markBillingDeparture(ME);
    const openPlans = vi.fn();
    const refreshQuiet = vi.fn();
    const { result } = hook({ summary: summary(OFF), openPlans, refreshQuiet });
    expect(window.location.search).toBe('?lang=he');
    expect(result.current.state).toBeNull();
    expect(openPlans).not.toHaveBeenCalled();
    expect(refreshQuiet).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('tekango:billing-return')).toBeNull();
  });
  it('the return survives the dashboard language reload (this tab only); a stored return older than 10 minutes is ignored', () => {
    markBillingDeparture(ME);
    hook({ summary: { state: 'loading' } });
    window.history.replaceState(null, '', '/dashboard?lang=he'); // the reload drops the parameter
    const { result } = hook({ summary: summary() });
    expect(result.current.kind).toBe('processing');
    expect(result.current.state).toBe('waiting');
    cleanup();
    const old = JSON.parse(window.sessionStorage.getItem('tekango:billing-return'));
    window.sessionStorage.setItem('tekango:billing-return', JSON.stringify({ ...old, at: Date.now() - 11 * 60 * 1000 }));
    expect(hook({ summary: summary() }).result.current.state).toBeNull();
  });
  it('closing the window (X, Back - any path) ends the return; reopening the plans later shows no old line', () => {
    markBillingDeparture(ME);
    const { result, rerender } = hook({ summary: summary() });
    expect(result.current.state).toBe('waiting');
    rerender({ summary: summary(), userId: ME, plansOpen: true, refreshQuiet: vi.fn(), openPlans: vi.fn() });
    rerender({ summary: summary(), userId: ME, plansOpen: false, refreshQuiet: vi.fn(), openPlans: vi.fn() });
    expect(result.current.state).toBeNull();
    expect(window.sessionStorage.getItem('tekango:billing-return')).toBeNull();
    expect(window.sessionStorage.getItem('tekango:billing-departure')).toBeNull();
  });
});

describe('Dashboard wiring (source guard)', () => {
  const dash = fs.readFileSync(path.join(HERE, 'pages', 'Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');
  it('the signed-in account, the window state and the quiet read feed the return; the pay button marks the departure; the state reaches the window', () => {
    expect(dash).toMatch(/const billingReturn = useBillingReturn\(\{ summary: accountSummary, userId: session\?\.user\?\.id, plansOpen: showPricingModal,\n\s*refreshQuiet: refreshAccountSummaryQuiet, openPlans: openPlansForReturn \}\);/);
    expect(dash).toMatch(/if \(r\.ok\) \{ markBillingDeparture\(session\?\.user\?\.id\); window\.location\.assign\(r\.redirectUrl\); \}/);
    expect(dash).toMatch(/billingReturn=\{billingReturn\.state \? \{ state: billingReturn\.state, onCheckAgain: billingReturn\.checkAgain \} : null\}/);
  });
});
