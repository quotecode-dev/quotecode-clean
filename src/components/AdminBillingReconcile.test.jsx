// Owner console 2026-10-23 (L-22): the payment reconciliation screen - the open differences with their amount in the right unit, the runs,
// "checked" through the super-admin RPC, "run now" through the function; the Owner only; Israeli dates; read only.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
import AdminBillingReconcile from './AdminBillingReconcile';
import { ADMIN_DESTINATIONS, canOpenDestination } from './adminDestinations';

afterEach(cleanup);
beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

const state = {
  ok: true,
  runs: [{ id: 'r1', day: '2026-11-02', source: 'cron', startedAt: '2026-11-02T04:00:00Z', status: 'ok', provider: 4, ours: 3, matched: 3, newFindings: 2, scale: 'minor' }],
  open: [
    { id: 'f1', code: 'UNLINKED', uid: 'tx-9', detail: { amount: 3000, currency: 'ILS', scale: 'minor', at: '2026-11-01T10:00:00Z' }, createdAt: '2026-11-02T04:00:01Z' },
    { id: 'f2', code: 'MISSING_AT_PROVIDER', uid: 'tx-7', detail: { amountMinor: 1900, currency: 'USD', at: '2026-11-01T11:00:00Z' }, createdAt: '2026-11-02T04:00:01Z' },
    { id: 'f3', code: 'REFUND_UNRECORDED', uid: 'tx-5', detail: { amount: 12345, currency: 'ILS', scale: 'unknown', at: '2026-11-01T12:00:00Z' }, createdAt: '2026-11-02T04:00:01Z' },
  ],
  checked: [],
};

describe('payment reconciliation screen', () => {
  it('HE: every open difference with its meaning, amount in the detected unit and transaction id; the last run; Israeli dates', async () => {
    rpc.mockResolvedValue({ data: state, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-open')).toBeTruthy());
    expect(rpc).toHaveBeenCalledWith('billing_reconcile_admin_state');
    const f1 = document.querySelector('[data-finding="f1"]');
    expect(f1.textContent).toContain('נגבה כסף ואין מנוי');
    expect(f1.textContent).toContain('₪30.00');
    expect(f1.textContent).toContain('tx-9');
    expect(f1.textContent).toMatch(/01[./]11[./]2026/);
    expect(document.querySelector('[data-finding="f2"]').textContent).toContain('$19.00');
    expect(document.querySelector('[data-finding="f3"]').textContent).toContain('(יחידה לא ידועה)');
    expect(screen.getByTestId('reconcile-last').textContent).toContain('הושלמה');
    expect(screen.getByTestId('reconcile-runs').querySelector('tr[data-run="r1"]').textContent).toMatch(/02[./]11[./]2026/);
  });

  it('"checked" goes through the super-admin RPC and reloads', async () => {
    rpc.mockImplementation(async (name) => (name === 'billing_reconcile_set_status' ? { data: { ok: true }, error: null } : { data: state, error: null }));
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-check-f1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('reconcile-check-f1'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('billing_reconcile_set_status', { p_id: 'f1', p_status: 'checked' }));
  });

  it('"run now" calls the function and says what happened; a missing terminal id is said plainly', async () => {
    rpc.mockResolvedValue({ data: { ...state, open: [], runs: [] }, error: null });
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'ok', provider: 5, matched: 5, newFindings: 0 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, status: 'not_configured' }, error: null });
    render(<AdminBillingReconcile isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('reconcile-empty').textContent).toBe('The reconciliation has not run yet.'));
    fireEvent.click(screen.getByTestId('reconcile-run'));
    await waitFor(() => expect(screen.getByTestId('reconcile-notice').textContent).toBe('Reconciliation done: 5 PayPlus transactions, 5 matched, 0 new items to check.'));
    expect(invoke).toHaveBeenCalledWith('billing-reconcile', { body: { action: 'run' } });
    fireEvent.click(screen.getByTestId('reconcile-run'));
    await waitFor(() => expect(screen.getByTestId('reconcile-notice').textContent).toContain('read settings are missing'));
  });

  it('an amount mismatch shows both amounts; after a failed run nothing says "everything matched"; a stopped run is named', async () => {
    const mismatch = { id: 'f4', code: 'AMOUNT_MISMATCH', uid: 'tx-4', detail: { at: '2026-11-01T10:00:00Z', provider: { amount: 2900, currency: 'ILS', scale: 'minor' }, ours: { amountMinor: 3000, currency: 'ILS' } }, createdAt: '2026-11-02T04:00:01Z' };
    rpc.mockResolvedValue({ data: { ...state, open: [mismatch] }, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(document.querySelector('[data-finding="f4"]')).toBeTruthy());
    expect(document.querySelector('[data-finding="f4"]').textContent).toContain('בפיי פלוס ₪29.00, אצלנו ₪30.00');
    cleanup();
    rpc.mockResolvedValue({ data: { ...state, open: [], runs: [{ ...state.runs[0], status: 'failed', error: 'provider_400' }, { ...state.runs[0], id: 'r0', status: 'running', startedAt: '2026-10-01T04:00:00Z' }] }, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-empty')).toBeTruthy());
    expect(screen.getByTestId('reconcile-empty').textContent).toBe('ההרצה האחרונה לא הושלמה, ולכן אין כרגע תמונה עדכנית.');
    expect(screen.getByTestId('reconcile-runs').querySelector('tr[data-run="r0"]').textContent).toContain('נעצרה באמצע');
  });

  it('a failed load says so (never "no differences")', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'super admin only' } });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-unavailable')).toBeTruthy());
    expect(screen.queryByTestId('reconcile-empty')).toBe(null);
  });

  it('the destination is the Owner\'s only, under System', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'billing-reconcile');
    expect(d.hub).toBe('system');
    expect(d.permission).toBe('owner');
    expect(canOpenDestination(d, { owner: true, permissions: [] })).toBe(true);
    expect(canOpenDestination(d, { owner: false, permissions: ['activity.view', 'plans.view'] })).toBe(false);
  });
});

describe('a PayPlus refusal in plain words (Owner 2026-10-23: the first live run answered 403)', () => {
  it('403 = the IP check of the PayPlus account; the button is a real admin button', async () => {
    rpc.mockResolvedValue({ data: { ...state, open: [], runs: [{ ...state.runs[0], status: 'failed', error: 'provider_403' }] }, error: null });
    invoke.mockResolvedValue({ data: { ok: false, status: 'failed', code: 'provider_403' }, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-last').textContent).toContain('בדיקת כתובות ה-IP'));
    expect(screen.getByTestId('reconcile-run').className).toBe('av-btn av-primary');
    fireEvent.click(screen.getByTestId('reconcile-run'));
    await waitFor(() => expect(screen.getByTestId('reconcile-notice').textContent).toContain('(provider_403)'));
    expect(screen.getByTestId('reconcile-notice').textContent).toContain('בדרך כלל זו בדיקת כתובות ה-IP');
  });
});

// Codex review 2026-10-23 R-01 / R-10
describe('the screen never says "everything matched" for unverified amounts; a refusal is said as likely', () => {
  it('a completed run with unverified amounts says so, and counts them', async () => {
    rpc.mockResolvedValue({ data: { ...state, open: [], runs: [{ ...state.runs[0], matched: 0, unverified: 2 }] }, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-empty')).toBeTruthy());
    expect(screen.getByTestId('reconcile-empty').textContent).toContain('הסכום עוד לא אומת');
    expect(screen.getByTestId('reconcile-empty').textContent).not.toContain('כל העסקאות התאימו');
    expect(screen.getByTestId('reconcile-last').textContent).toContain('לא אומתו: 2');
  });
  it('403 is "usually" the IP check; a refused relay is the relay', async () => {
    rpc.mockResolvedValue({ data: { ...state, open: [], runs: [{ ...state.runs[0], status: 'failed', error: 'relay_refused' }] }, error: null });
    render(<AdminBillingReconcile isHebrew />);
    await waitFor(() => expect(screen.getByTestId('reconcile-last').textContent).toContain('המתווך עם הכתובת הקבועה לא העביר'));
  });
});
