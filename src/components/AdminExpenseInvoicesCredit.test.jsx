// Owner console 2026-11-01 (L-22, typed: "כל חשבונית חיוב עוברת לפיי פלוס בפלוס וכל חשבונית זיכוי עוברת לפיי פלוס במינוס, כל מסמך בפני עצמו, בלי חישוב נטו, אחרי אישור שלי במסך"):
// a credit note shows its amount with a minus and is approved like any document; there is no net line, in Hebrew and English.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminExpenseInvoices } = await import('./AdminExpenseInvoices');

const inv = (o) => ({ mailbox: 'quotecodedev@gmail.com', supplierName: 'אור ממן', supplierVatId: '311214605', docDate: '2026-11-01', currency: 'ILS', amountIncludesVat: false,
  vatPercentage: 0, category: 'ai', confidence: 'high', reason: '', hasFile: false, ...o });
const charge = inv({ id: 'charge', docType: 'tax_invoice_receipt', docNumber: '30529', amount: 390, status: 'pending' });
const credit = inv({ id: 'credit', docType: 'credit_note', docNumber: '30530', creditedDocNumber: '30529', amount: 370, status: 'pending' });
const state = (invoices) => ({ data: { ok: true, connections: [], invoices, settings: { expenseTypes: [], defaultSubcategoryId: null } }, error: null });

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });
afterEach(() => cleanup());

describe.each([[true, 'חשבונית זיכוי'], [false, 'Credit note']])('isHebrew=%s', (he, badge) => {
  it('the credit note is in minus, the charge is not, and nothing nets them', async () => {
    rpc.mockResolvedValue(state([charge, credit]));
    const { findByTestId, getByTestId, queryByTestId } = render(<AdminExpenseInvoices isHebrew={he} />);
    await findByTestId('expense-list');
    expect(getByTestId('expense-amount-credit').textContent).toMatch(/-.*370|370.*-/);
    expect(getByTestId('expense-amount-charge').textContent).toContain('390');
    expect(getByTestId('expense-amount-charge').textContent).not.toContain('-');
    expect(queryByTestId('expense-net-charge')).toBeNull();
    expect(getByTestId('expense-list').textContent).not.toContain(he ? 'נטו' : 'Net expense');
  });
  it('the credit note says so, names the cancelled document, and has the approve button', async () => {
    rpc.mockResolvedValue(state([charge, credit]));
    const { findByTestId, getByTestId } = render(<AdminExpenseInvoices isHebrew={he} />);
    await findByTestId('expense-list');
    expect(getByTestId('expense-credit-credit').textContent).toContain(badge);
    expect(getByTestId('expense-credit-credit').textContent).toContain('30529');
    expect(getByTestId('expense-approve-credit')).toBeTruthy();
  });
});
