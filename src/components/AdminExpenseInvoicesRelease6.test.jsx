// Codex release 6 (Owner console 2026-10-30, decision 10, L-22): a copy of a known supplier document says so in Hebrew and English, offers
// no approval, flags differing details, and a refused edit / approval shows the same sentence (the server guard decides).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminExpenseInvoices } = await import('./AdminExpenseInvoices');

const inv = (o) => ({ id: o.id, mailbox: 'quotecodedev@gmail.com', emailFrom: 'Bezeq <bills@bezeq.test>', supplierName: 'בזק', supplierVatId: '520031931', docNumber: 'INV77',
  docDate: '2026-10-01', amount: 117, currency: 'ILS', amountIncludesVat: true, vatPercentage: 18, category: 'software_cloud', confidence: 'high',
  reason: 'חשבונית', hasFile: false, status: 'pending', ...o });
const state = (invoices) => ({ data: { ok: true, connections: [], invoices, settings: { expenseTypes: [], defaultSubcategoryId: null } }, error: null });
const httpError = (status, body) => ({ data: null, error: { name: 'FunctionsHttpError', context: { status, json: async () => body } } });

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });
afterEach(() => cleanup());

describe('release 6 on the expense screen', () => {
  it.each([true, false])('isHebrew=%s: a copy says it already exists, has no approve button and flags differing details', async (he) => {
    rpc.mockResolvedValue(state([inv({ id: 'canon', status: 'sent' }), inv({ id: 'copy', status: 'excluded', duplicateOf: 'canon', amount: 120, mailbox: 'info@tekango.com' })]));
    const { findByTestId, getByTestId, queryByTestId } = render(<AdminExpenseInvoices isHebrew={he} />);
    fireEvent.click(await findByTestId('expense-tab-excluded'));
    await findByTestId('expense-list');
    expect(getByTestId('expense-duplicate-copy').textContent).toBe(he ? 'החשבונית הזו כבר קיימת בכלי. העותק הנוסף נשמר לתיעוד ולא יישלח שוב לפיי פלוס.'
      : 'This invoice already exists in the tool. The additional copy is kept as evidence and will not be sent to PayPlus again.');
    expect(getByTestId('expense-conflict-copy').textContent).toBe(he ? 'נמצאו פרטים סותרים לחשבונית הזו. בדקו אותם לפני אישור או שליחה.'
      : 'Conflicting details were found for this invoice. Review them before approval or sending.');
    expect(queryByTestId('expense-approve-copy')).toBeNull();
  });
  it('a copy with the same details shows no conflict line', async () => {
    rpc.mockResolvedValue(state([inv({ id: 'canon', status: 'sent' }), inv({ id: 'copy', status: 'excluded', duplicateOf: 'canon' })]));
    const { findByTestId, getByTestId, queryByTestId } = render(<AdminExpenseInvoices isHebrew />);
    fireEvent.click(await findByTestId('expense-tab-excluded'));
    await findByTestId('expense-list');
    expect(getByTestId('expense-duplicate-copy')).toBeTruthy();
    expect(queryByTestId('expense-conflict-copy')).toBeNull();
  });
  it('a refused approval shows the sentence instead of "the action failed"', async () => {
    rpc.mockResolvedValue(state([inv({ id: 'a' })]));
    invoke.mockResolvedValue(httpError(409, { ok: false, code: 'duplicate_copy', updated: 0 }));
    const { findByTestId, getByTestId, findByText } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    fireEvent.click(getByTestId('expense-approve-a'));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(await findByText('החשבונית הזו כבר קיימת בכלי. העותק הנוסף נשמר לתיעוד ולא יישלח שוב לפיי פלוס.')).toBeTruthy();
  });
});
