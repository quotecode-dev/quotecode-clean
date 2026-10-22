// Owner console 2026-10-22, typed L-22 (the expense-invoice tool): the Owner's screen reads the server state, lists the invoices by status,
// approves / rejects through the function, sends only approved ones (10 at a time, every failure reported), shows the server's own error
// codes, and shows money by the currency law (IRON-ILS-001).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminExpenseInvoices } = await import('./AdminExpenseInvoices');

const inv = (o) => ({ id: o.id, mailbox: 'quotecodedev@gmail.com', emailFrom: 'Supabase <billing@supabase.io>', supplierName: 'Supabase Inc', docNumber: 'INV-1',
  docDate: '2026-09-01', amount: 35, currency: 'USD', amountIncludesVat: false, vatPercentage: 0, category: 'software_cloud', confidence: 'high',
  reason: 'חשבונית ענן', hasFile: true, status: 'pending', ...o });
const state = (over = {}) => ({ data: { ok: true, connections: [{ mailbox: 'quotecodedev@gmail.com', connectedAt: '2026-10-22T18:00:00Z', lastScanAt: null }],
  invoices: [inv({ id: 'a' }), inv({ id: 'a2', confidence: 'low' }), inv({ id: 'b', supplierName: 'בזק', amount: 117.5, currency: 'ILS', amountIncludesVat: true, vatPercentage: 18, status: 'approved' }), inv({ id: 'c', status: 'sent' })],
  settings: { expenseTypes: [{ id: 5554, name: 'תוכנה' }], defaultSubcategoryId: 5554 }, ...over }, error: null });
// the real supabase-js shape of a non-2xx function answer: data null, error.context = the Response
const httpError = (status, body) => ({ data: null, error: { name: 'FunctionsHttpError', context: { status, json: async () => body } } });

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); rpc.mockResolvedValue(state()); invoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null }); });
afterEach(() => cleanup());

describe('AdminExpenseInvoices', () => {
  it.each([true, false])('isHebrew=%s: the mailboxes, the waiting list, the sender and exact counts', async (he) => {
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew={he} />);
    await findByTestId('expense-list');
    expect(getByTestId('expense-mailboxes').textContent).toContain('shlomisiny@gmail.com');
    expect(getByTestId('expense-connect-shlomisiny@gmail.com').textContent).toBe(he ? 'חיבור' : 'Connect');
    expect(getByTestId('expense-connect-quotecodedev@gmail.com').textContent).toBe(he ? 'חיבור מחדש' : 'Reconnect');
    expect(getByTestId('expense-list').querySelectorAll('[data-invoice]').length).toBe(2);
    expect(getByTestId('expense-list').textContent).toContain('billing@supabase.io');
    expect(getByTestId('expense-tab-pending').querySelector('bdi').textContent).toBe('2');
    expect(getByTestId('expense-tab-approved').querySelector('bdi').textContent).toBe('1');
  });
  it('money follows the currency law: ILS whole shekel with .00, USD exact', async () => {
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    expect(getByTestId('expense-list').textContent).toContain('$35.00');
    fireEvent.click(getByTestId('expense-tab-approved'));
    expect(getByTestId('expense-list').textContent).toContain('₪118.00');
  });
  it('approve goes through the function; "approve all" leaves out the uncertain ones; send only the approved list', async () => {
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    fireEvent.click(getByTestId('expense-approve-a'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('expense-invoices', { body: { action: 'update', ids: ['a'], patch: { status: 'approved' } } }));
    await waitFor(() => expect(getByTestId('expense-approve-all').disabled).toBe(false));
    fireEvent.click(getByTestId('expense-approve-all'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('expense-invoices', { body: { action: 'update', ids: ['a'], patch: { status: 'approved' } } }));
    expect(invoke.mock.calls.some(([, o]) => o.body.ids?.includes('a2'))).toBe(false);
    fireEvent.click(getByTestId('expense-tab-approved'));
    await waitFor(() => expect(getByTestId('expense-send').disabled).toBe(false));
    fireEvent.click(getByTestId('expense-send'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('expense-invoices', { body: { action: 'send', ids: ['b'] } }));
  });
  it('sends 10 at a time and reports a failed batch instead of hiding it', async () => {
    const many = Array.from({ length: 12 }, (_, i) => inv({ id: `s${i}`, status: 'approved' }));
    rpc.mockResolvedValue(state({ invoices: many }));
    invoke.mockImplementation(async (_n, { body }) => (body.ids.length === 10 ? { data: { ok: true, results: body.ids.map((id) => ({ id, ok: true })) }, error: null } : httpError(500, { ok: false, code: 'failed' })));
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-empty');
    fireEvent.click(getByTestId('expense-tab-approved'));
    fireEvent.click(getByTestId('expense-send'));
    await waitFor(() => expect(getByTestId('expense-notice').textContent).toContain('נשלחו לפיי פלוס: 10. לא נשלחו: 2'));
    expect(invoke.mock.calls.map(([, o]) => o.body.ids.length)).toEqual([10, 2]);
  });
  it("shows the server's own error code (not configured) from a non-2xx answer", async () => {
    invoke.mockResolvedValue(httpError(503, { ok: false, code: 'google_not_configured' }));
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    fireEvent.click(getByTestId('expense-connect-shlomisiny@gmail.com'));
    await waitFor(() => expect(getByTestId('expense-notice').textContent).toContain('החיבור לגוגל עדיין לא מוגדר בשרת'));
  });
  it('connect shows the Owner a link to Google (the screen never navigates by itself)', async () => {
    invoke.mockResolvedValue({ data: { ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }, error: null });
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    fireEvent.click(getByTestId('expense-connect-shlomisiny@gmail.com'));
    await waitFor(() => expect(getByTestId('expense-google-continue').getAttribute('href')).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1'));
  });
  it('without expense types nothing can be sent, and it says why', async () => {
    rpc.mockResolvedValue(state({ settings: { expenseTypes: [], defaultSubcategoryId: null } }));
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-types-empty');
    fireEvent.click(getByTestId('expense-tab-approved'));
    expect(getByTestId('expense-send').disabled).toBe(true);
  });
  it('a server failure shows the unavailable state, never an empty success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    const { findByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-unavailable');
  });
});
