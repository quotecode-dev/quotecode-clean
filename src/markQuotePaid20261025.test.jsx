// Owner 2026-10-25 (typed: "מאשר שינוי: הצעה שאושרה או נחתמה אפשר לסמן כשולמה (רק המצב)"; placement + a short question chosen in
// the console): an approved / signed quote gets "Mark as paid" in its actions row; it asks first; only the status is written.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import QuotesTab from './components/QuotesTab';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { canMarkQuotePaid, isQuoteImmutable } from './utils/quoteLock';
import { formatMoneyForCurrency } from './utils/money';
import { PRODUCT_HOW_TO } from './data/productHowTo';

afterEach(cleanup);

const baseQuote = {
  id: 'quote-paid-test-000001',
  quote_number: 100704,
  status: 'approved',
  signature: null,
  clients: { company_name: 'Test Client', client_type: 'business' },
  subtotal: 100, discount: 0, total: 118, currency: 'ILS', tax_rate: 18, view_count: 0,
  created_at: '2026-01-01T00:00:00.000Z', quote_items: [{ description: 'Item' }], client_type: 'business', email_bounced: false,
};

function renderList(isHebrew, overrides = {}, handleMarkQuotePaid = vi.fn()) {
  const quote = { ...baseQuote, ...overrides };
  render(<QuotesTab
    quotes={[quote]} searchTerm="" setSearchTerm={vi.fn()} statusFilter="All" setStatusFilter={vi.fn()}
    quoteSortField="date" quoteSortDirection="desc" handleQuoteSort={vi.fn()} handleCreateNewQuoteClick={vi.fn()}
    handleExportQuotes={vi.fn()} handleEditClick={vi.fn()} handleDuplicateQuote={vi.fn()} sendWhatsApp={vi.fn()}
    handleMarkQuotePaid={handleMarkQuotePaid} handleDeleteQuote={vi.fn()} handleProtectedAction={vi.fn((id, a, fn) => fn())}
    activeTooltip={{ quoteId: null, action: null }} openDropdownId={null} isHebrew={isHebrew} isLocalIsraeliBusiness={isHebrew}
    formatNum={(n) => String(n)} formatMoneyDisplay={(v, c) => formatMoneyForCurrency(v, c || 'ILS')}
    t={{ recentHistory: 'History', quotesNav: 'Quotes', searchQuote: 'Search', filterStatus: 'Status' }}
    setPendingEmailQuote={vi.fn()} emailStatuses={{}} currency={isHebrew ? 'ILS' : 'USD'}
  />);
  fireEvent.click(screen.getByLabelText(/הצגת פרטים נוספים|Show more details/));
  return { quote, handleMarkQuotePaid };
}

describe('canMarkQuotePaid - the same rule as guard_quote_immutability (20261025100000)', () => {
  it('only an approved quote (by hand or signed) may become paid', () => {
    expect(canMarkQuotePaid({ status: 'approved' })).toBe(true);
    expect(canMarkQuotePaid({ status: 'Approved', signature: 'data:image/png;base64,AAAA' })).toBe(true);
    for (const status of ['paid', 'Paid', 'sent', 'draft', '']) expect(canMarkQuotePaid({ status })).toBe(false);
    expect(canMarkQuotePaid(null)).toBe(false);
    expect(isQuoteImmutable({ status: 'approved' })).toBe(true); // still locked for editing
  });
});

describe.each([['Hebrew', true, 'סימון כשולמה'], ['English', false, 'Mark as paid']])('Mark as paid in the actions row (%s)', (_l, isHebrew, label) => {
  it('an approved quote shows the button and hands the quote to the handler', () => {
    const { quote, handleMarkQuotePaid } = renderList(isHebrew);
    fireEvent.click(screen.getByTestId('quote-mark-paid'));
    expect(screen.getByTestId('quote-mark-paid').textContent).toBe(label);
    expect(handleMarkQuotePaid).toHaveBeenCalledTimes(1);
    expect(handleMarkQuotePaid.mock.calls[0][0]).toMatchObject({ id: quote.id });
  });
  it('a signed quote shows it too; Edit and Delete stay disabled', () => {
    renderList(isHebrew, { signature: 'data:image/png;base64,AAAA' });
    expect(screen.getByTestId('quote-mark-paid')).toBeTruthy();
    expect(screen.getByText(isHebrew ? 'עריכה' : 'Edit').closest('button')).toBeDisabled();
    expect(screen.getByText(isHebrew ? 'מחיקה' : 'Delete').closest('button')).toBeDisabled();
  });
  it.each(['paid', 'sent', 'draft'])('a %s quote has no such button', (status) => {
    renderList(isHebrew, { status });
    expect(screen.queryByTestId('quote-mark-paid')).toBeNull();
  });
});

describe('the question before marking', () => {
  it('tone "paid" shows the paid icon and wording, never the trash icon; deletion is unchanged', () => {
    const { container, unmount } = render(<DeleteConfirmModal isOpen isHebrew title="לסמן את ההצעה כשולמה?" message="m" confirmLabel="סימון כשולמה"
      cancelLabel="ביטול" isDeleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} tone="paid" />);
    expect(container.querySelector('.lucide-banknote')).toBeTruthy();
    expect(container.querySelector('.lucide-trash2, .lucide-trash-2')).toBeNull();
    unmount();
    const del = render(<DeleteConfirmModal isOpen isHebrew title="t" message="m" confirmLabel="מחיקה" cancelLabel="ביטול"
      isDeleting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(del.container.querySelector('.lucide-trash2, .lucide-trash-2')).toBeTruthy();
    expect(del.container.querySelector('.lucide-banknote')).toBeNull();
  });
  it('Dashboard asks first and writes only the status, then reloads the list', () => {
    const src = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
    const req = src.slice(src.indexOf('function requestMarkQuotePaid'), src.indexOf('async function executeMarkQuotePaid'));
    const exec = src.slice(src.indexOf('async function executeMarkQuotePaid'), src.indexOf('async function executeDeleteClient'));
    expect(req).toMatch(/if \(!canMarkQuotePaid\(quote\)\) return;/);
    expect(req).toMatch(/type: 'mark_paid'/);
    expect(req).toMatch(/אי אפשר לחזור למצב "אושרה"/);
    expect(exec).toMatch(/\.update\(\{ status: 'paid' \}\)\.eq\('id', quoteId\)\.select\('id'\)/);
    expect(exec).toMatch(/fetchQuotes\(session\.user\.id\)/);
    expect(src).toMatch(/else if \(pendingDelete\.type === 'mark_paid'\) await executeMarkQuotePaid\(pendingDelete\.id\);/);
    expect(src).toMatch(/handleMarkQuotePaid=\{requestMarkQuotePaid\}/);
  });
});

describe('the assistant how-to tells the truth', () => {
  it('quote_status_mark explains Mark as paid and no longer says the status cannot change', () => {
    const t = PRODUCT_HOW_TO.find((x) => x.id === 'quote_status_mark');
    expect(t.he.steps.join(' ')).toMatch(/"סימון כשולמה"/);
    expect(t.en.steps.join(' ')).toMatch(/"Mark as paid"/);
    expect(t.he.steps.join(' ')).not.toMatch(/וגם לא לשנות את המצב/);
    expect(t.en.steps.join(' ')).not.toMatch(/status cannot change/);
  });
});
