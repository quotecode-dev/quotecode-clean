// L-22 (Owner console 2026-10-28, the subscription & payment card - docs/ADMIN_BILLING_BUTTONS_PLAN_2026-10-22.md, typed "... - מאשר"):
// the card shows the server's preview of a paid package; stop renewal / end early / close an interrupted action / confirm a refund go
// through the shared re-auth proof bound to the SAME params admin-billing claims; the result line comes from the server's answer.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const inv = vi.fn();
vi.mock('../shared/invokeWithFreshSession', () => ({ invokeWithFreshSession: (...a) => inv(...a) }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn) => (fn === 'get_admin_audit_log' ? { data: [], error: null } : { data: null, error: { code: 'PGRST202' }, status: 404 })),
    from: () => ({ select: () => ({ eq: () => Object.assign(Promise.resolve({ count: 0, error: null }), { neq: async () => ({ count: 0, error: null }) }) }) }),
    functions: { invoke: vi.fn() },
  },
}));

import AdminUserDetails from './AdminUserDetails';
import AdminUsersTab from './AdminUsersTab';
import { runBillingAction, billingPreview, billingCardVisible, billingRefundMoney, billingErrorText } from '../domain/admin/adminBilling';

const UID = '11111111-1111-4111-8111-111111111111';
const account = { id: 7, user_id: UID, business_name: 'עסק בדיקה ישראל', email: 'tekangoisrael@gmail.com', role: 'user', country: 'Local', created_at: '2026-10-19T10:00:00Z' };
const preview = { ok: true, currency: 'ILS', paidMinor: 3000, period: 'month', periodStart: '2026-10-25T00:00:00Z', paidThrough: '2026-11-25T00:00:00Z',
  effectiveEnd: '2026-10-29T00:00:00Z', daysInPeriod: 31, unusedDays: 27, proratedMinor: 2613, feeMinor: 150, feeWaived: false, refundMinor: 2463,
  renewalStopped: false, hasStandingOrder: true, hasChargeRef: true, openAction: null, unsettledRefund: null };
const ok = (data) => ({ data, error: null });
const httpError = (body) => ({ data: null, error: { context: { json: async () => body } } });

beforeEach(() => inv.mockReset());
afterEach(cleanup);

describe('the client side of admin-billing', () => {
  it('each action proves the SAME params the server claims, then sends them with the proof', async () => {
    inv.mockImplementation(async (fn) => (fn === 'admin-reauth-verify' ? ok({ success: true, proofToken: 'P' }) : ok({ ok: true })));
    await runBillingAction(inv, { action: 'stop_renewal', targetUserId: UID, password: 'pw', reason: '  בקשת הבעלים ' });
    await runBillingAction(inv, { action: 'end_early', targetUserId: UID, password: 'pw', reason: 'r1x', waiveFee: true, expectedRefundMinor: 2613 });
    await runBillingAction(inv, { action: 'resolve', targetUserId: UID, password: 'pw', reason: 'r2x', actionId: 'A', stoppedAtPayPlus: false });
    await runBillingAction(inv, { action: 'settle_refund', targetUserId: UID, password: 'pw', reason: 'r3x', actionId: 'B' });
    const calls = inv.mock.calls.map(([fn, { body }]) => [fn, body]);
    expect(calls[0]).toEqual(['admin-reauth-verify', { action: 'billing_stop_renewal', targetUserId: UID, params: { reason: 'בקשת הבעלים', waiveFee: false, expectedRefundMinor: 0 }, password: 'pw' }]);
    expect(calls[1]).toEqual(['admin-billing', { action: 'stop_renewal', targetUserId: UID, proofToken: 'P', reason: 'בקשת הבעלים', waiveFee: false, expectedRefundMinor: 0 }]);
    expect(calls[2][1]).toMatchObject({ action: 'billing_end_early', params: { reason: 'r1x', waiveFee: true, expectedRefundMinor: 2613 } });
    expect(calls[4][1]).toMatchObject({ action: 'billing_resolve', params: { reason: 'r2x', actionId: 'A', stoppedAtPayPlus: false } });
    expect(calls[5][1]).toMatchObject({ action: 'resolve', actionId: 'A', stoppedAtPayPlus: false });
    expect(calls[6][1]).toMatchObject({ action: 'billing_settle_refund', params: { reason: 'r3x', actionId: 'B' } });
  });
  it('a wrong password stops before admin-billing; a refusal carries the server code', async () => {
    inv.mockResolvedValueOnce(ok({ success: false, error: 'Incorrect password' }));
    expect(await runBillingAction(inv, { action: 'stop_renewal', targetUserId: UID, password: 'x', reason: 'abc' })).toEqual({ ok: false, code: 'reauth_failed' });
    expect(inv).toHaveBeenCalledTimes(1);
    inv.mockResolvedValueOnce(httpError({ ok: false, code: 'billing_off' }));
    expect(await billingPreview(inv, UID)).toEqual({ ok: false, code: 'billing_off' });
    expect(billingCardVisible({ ok: false, code: 'billing_off' })).toBe(false);
    expect(billingCardVisible({ ok: false, code: 'no_live_package', unsettledRefund: { actionId: 'x' } })).toBe(true);
  });
});

describe('L-22 (Owner 2026-10-28, "החזר בקירוב במסך, והודעה ברורה כשהתקופה הבאה כבר שולמה")', () => {
  it('a refund the whole-shekel display rounds says it is approximate; a whole amount stays exact', () => {
    expect(billingRefundMoney(2463, 'ILS', true)).toBe('כ־₪25.00 (בקירוב)');
    expect(billingRefundMoney(2463, 'ILS', false)).toBe('about ₪25.00 (approximately)');
    expect(billingRefundMoney(3000, 'ILS', true)).toBe('₪30.00');
  });
  it('a later period already paid: a clear message in both languages, never "try again"', () => {
    expect(billingErrorText({ code: 'future_period_paid' }, true)).toMatch(/^התקופה הבאה כבר שולמה/);
    expect(billingErrorText({ code: 'future_period_paid' }, false)).toMatch(/^The next period is already paid/);
  });
});

describe('the card on the user details page', () => {
  it.each([[true], [false]])('isHebrew=%s: a paid package - plan, paid through, renewal and the two protected buttons', async (isHebrew) => {
    inv.mockResolvedValue(ok(preview));
    const onBilling = vi.fn();
    render(<AdminUserDetails account={account} isHebrew={isHebrew} onBack={vi.fn()} onBilling={onBilling} />);
    const card = await screen.findByTestId('admin-billing-card');
    expect(inv).toHaveBeenCalledWith('admin-billing', { body: { action: 'preview', targetUserId: UID, waiveFee: false } });
    expect(card.textContent).toContain(isHebrew ? 'מנוי ותשלום' : 'Subscription & payment');
    expect(card.textContent).toContain('₪30.00');
    expect(card.textContent).toContain('25/11/2026');
    expect(screen.getByTestId('admin-billing-renewal').textContent).toBe(isHebrew ? 'פעיל' : 'Active');
    fireEvent.click(screen.getByTestId('admin-billing-stop'));
    expect(onBilling).toHaveBeenCalledWith('stop_renewal', account, expect.objectContaining({ refundMinor: 2463 }));
    expect(screen.getByTestId('admin-billing-end').textContent).toBe(isHebrew ? 'סיום מוקדם והחזר' : 'End early & refund');
  });
  it('a stopped renewal: no stop button, the limit date; an owed refund and an open action have their buttons', async () => {
    inv.mockResolvedValue(ok({ ...preview, renewalStopped: true, openAction: { actionId: 'A', kind: 'end_early', createdAt: '2026-10-28T12:00:00Z' },
      unsettledRefund: { actionId: 'B', refundMinor: 818, currency: 'ILS', state: 'sending', createdAt: '2026-10-28T12:00:00Z' } }));
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} onBilling={vi.fn()} />);
    await screen.findByTestId('admin-billing-card');
    expect(screen.getByTestId('admin-billing-renewal').textContent).toBe('הופסק · החשבון יוגבל ב־25/11/2026');
    expect(screen.queryByTestId('admin-billing-stop')).toBeNull();
    expect(screen.queryByTestId('admin-billing-end')).toBeNull(); // an open action blocks every new action
    expect(screen.getByTestId('admin-billing-refund').textContent).toContain('₪8.00'); // IRON-ILS-001: whole shekels on screen
    expect(screen.getByTestId('admin-billing-refund').textContent).toContain('נשלח, ממתין לאישור');
    expect(screen.getByTestId('admin-billing-open-action').textContent).toContain('סיום מוקדם והחזר');
  });
  it('free / Lifetime / billing off: no card; a supervisor (no onBilling) never reads it', async () => {
    inv.mockResolvedValue(httpError({ ok: false, code: 'no_live_package', unsettledRefund: null }));
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} onBilling={vi.fn()} />);
    await waitFor(() => expect(inv).toHaveBeenCalled());
    expect(screen.queryByTestId('admin-billing-card')).toBeNull();
    cleanup(); inv.mockClear();
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} />);
    expect(inv).not.toHaveBeenCalled();
  });
});

describe('the stop-renewal flow (users screen)', () => {
  it('reason + password -> the server stops it -> the result line over the card', async () => {
    inv.mockImplementation(async (fn, { body } = { body: {} }) => {
      if (fn === 'admin-reauth-verify') return ok({ success: true, proofToken: 'P' });
      if (body.action === 'preview') return ok(preview);
      return ok({ ok: true, actionId: 'A', kind: 'stop_renewal', cancelStatus: 'cancelled', refundStatus: 'none', refundMinor: 0, currency: 'ILS', applied: true, paidThrough: '2026-11-25T00:00:00Z' });
    });
    render(<AdminUsersTab isHebrew allAccounts={[account]} filteredAdminAccounts={[account]} selectedAccount={account} onBackFromDetails={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('admin-billing-stop'));
    const dialog = await screen.findByTestId('admin-dialog-billing_stop');
    expect(dialog.textContent).toContain('המנוי ממשיך עד ⁦25/11/2026⁩');
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'בקשת הבעלים' } });
    fireEvent.change(dialog.querySelector('input[type=password]'), { target: { value: 'pw' } });
    fireEvent.submit(dialog.querySelector('form'));
    await waitFor(() => expect(inv).toHaveBeenCalledWith('admin-billing', { body: expect.objectContaining({ action: 'stop_renewal', proofToken: 'P', expectedRefundMinor: 0 }) }));
    const doneClose = await waitFor(() => { const b = document.querySelector('.av-result button'); expect(b).not.toBeNull(); return b; });
    fireEvent.click(doneClose);
    expect((await screen.findByTestId('admin-billing-notice')).textContent).toBe('החידוש הופסק. החשבון יוגבל ב־⁦25/11/2026⁩.');
  });

  const openStop = async (answer) => {
    inv.mockImplementation(async (fn, { body } = { body: {} }) => {
      if (fn === 'admin-reauth-verify') return ok({ success: true, proofToken: 'P' });
      if (body.action === 'preview') return ok(preview);
      return ok(answer);
    });
    render(<AdminUsersTab isHebrew allAccounts={[account]} filteredAdminAccounts={[account]} selectedAccount={account} onBackFromDetails={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('admin-billing-stop'));
    return screen.findByTestId('admin-dialog-billing_stop');
  };

  it('a reason the server would refuse (under 3 characters) stops before the password is sent', async () => {
    const dialog = await openStop({ ok: true });
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'ab' } });
    fireEvent.change(dialog.querySelector('input[type=password]'), { target: { value: 'pw' } });
    fireEvent.submit(dialog.querySelector('form'));
    expect((await screen.findByRole('alert')).textContent).toBe('הסיבה צריכה להיות באורך 3 עד 500 תווים.');
    expect(inv.mock.calls.some(([fn]) => fn === 'admin-reauth-verify')).toBe(false);
  });

  it('PayPlus refused / not applied: never the green "done" screen - the dialog and the card say what happened', async () => {
    const dialog = await openStop({ ok: true, actionId: 'A', kind: 'stop_renewal', cancelStatus: 'failed', refundStatus: 'none', refundMinor: 0, currency: 'ILS', applied: false, paidThrough: null });
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'בקשת הבעלים' } });
    fireEvent.change(dialog.querySelector('input[type=password]'), { target: { value: 'pw' } });
    fireEvent.submit(dialog.querySelector('form'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^החידוש לא הופסק/);
    expect(document.querySelector('.av-result')).toBeNull();
  });

  it('a supervisor (canProtect false) never reads the billing state and gets no billing button', async () => {
    inv.mockResolvedValue(ok(preview));
    render(<AdminUsersTab isHebrew allAccounts={[account]} filteredAdminAccounts={[account]} selectedAccount={account} onBackFromDetails={vi.fn()} canProtect={false} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(inv.mock.calls.some(([fn]) => fn === 'admin-billing')).toBe(false);
    expect(screen.queryByTestId('admin-billing-stop')).toBeNull();
  });
});
