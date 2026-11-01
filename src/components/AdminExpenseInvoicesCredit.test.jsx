// Owner console 2026-11-01 (L-22): a credit note says so and has no approve button; its charge shows the net expense (390 - 370 = 20), in Hebrew and English.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminExpenseInvoices } = await import('./AdminExpenseInvoices');

const inv = (o) => ({ mailbox: 'quotecodedev@gmail.com', supplierName: 'אור ממן', supplierVatId: '311214605', docDate: '2026-11-01', currency: 'ILS', amountIncludesVat: false,
  vatPercentage: 0, category: 'ai', confidence: 'high', reason: '', hasFile: false, ...o });
const charge = inv({ id: 'charge', docType: 'tax_invoice_receipt', docNumber: '30529', amount: 390, status: 'pending' });
const credit = inv({ id: 'credit', docType: 'credit_note', docNumber: '30530', creditedDocNumber: '30529', amount: 370, status: 'excluded' });
const state = (invoices) => ({ data: { ok: true, connections: [], invoices, settings: { expenseTypes: [], defaultSubcategoryId: null } }, error: null });

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });
afterEach(() => cleanup());

describe.each([[true, 'חשבונית זיכוי', 'הוצאה נטו', '20'], [false, 'Credit note', 'Net expense', '20']])('isHebrew=%s', (he, badge, net, value) => {
  it('the charge shows the net expense', async () => {
    rpc.mockResolvedValue(state([charge, credit]));
    const { findByTestId } = render(<AdminExpenseInvoices isHebrew={he} />);
    const line = await findByTestId('expense-net-charge');
    expect(line.textContent).toContain(net);
    expect(line.textContent).toContain(value);
    expect(line.textContent).toContain('390');
    expect(line.textContent).toContain('370');
  });
  it('the credit note says so, names the cancelled document, and cannot be approved or returned to the list', async () => {
    rpc.mockResolvedValue(state([charge, credit]));
    const { findByTestId, getByTestId, queryByTestId, queryByText } = render(<AdminExpenseInvoices isHebrew={he} />);
    fireEvent.click(await findByTestId('expense-tab-excluded'));
    await findByTestId('expense-list');
    expect(getByTestId('expense-credit-credit').textContent).toContain(badge);
    expect(getByTestId('expense-credit-credit').textContent).toContain('30529');
    expect(queryByTestId('expense-approve-credit')).toBeNull();
    expect(queryByText(he ? 'החזרה לממתינות' : 'Back to waiting')).toBeNull();
  });
});

describe('what is not a match', () => {
  it('a credit note of another supplier or currency does not change a charge', async () => {
    rpc.mockResolvedValue(state([charge, { ...credit, supplierVatId: '999999999' }, { ...credit, id: 'usd', currency: 'USD' }]));
    const { findByTestId, queryByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    expect(queryByTestId('expense-net-charge')).toBeNull();
  });
  it('a charge without a credit note shows no net line', async () => {
    rpc.mockResolvedValue(state([charge]));
    const { findByTestId, queryByTestId } = render(<AdminExpenseInvoices isHebrew />);
    await findByTestId('expense-list');
    expect(queryByTestId('expense-net-charge')).toBeNull();
  });
});
