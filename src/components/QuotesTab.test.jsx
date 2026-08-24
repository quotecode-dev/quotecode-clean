import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuotesTab from './QuotesTab';

const baseQuote = {
  id: 'quote-test-id-000000',
  status: 'pending',
  signature: null,
  clients: { company_name: 'Test Client' },
  subtotal: 100,
  discount: 0,
  total: 118,
  currency: 'ILS',
  tax_rate: 18,
  view_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  quote_items: [{ description: 'Item' }],
  client_type: 'business',
  email_bounced: false,
};

const t = {
  recentHistory: 'History',
  searchQuote: 'Search',
  filterStatus: 'Status',
};

function buildProps(isHebrew, quoteOverrides = {}, handlers = {}) {
  const quote = { ...baseQuote, ...quoteOverrides };
  return {
    quotes: [quote],
    searchTerm: '',
    setSearchTerm: vi.fn(),
    statusFilter: 'All',
    setStatusFilter: vi.fn(),
    quoteSortField: 'date',
    quoteSortDirection: 'desc',
    handleQuoteSort: vi.fn(),
    handleCreateNewQuoteClick: vi.fn(),
    handleExportQuotes: vi.fn(),
    handleEditClick: vi.fn(),
    handleDuplicateQuote: vi.fn(),
    sendWhatsApp: vi.fn(),
    handleDeleteQuote: vi.fn(),
    handleProtectedAction: handlers.handleProtectedAction || vi.fn((id, action, fn) => fn()),
    activeTooltip: { quoteId: null, action: null },
    openDropdownId: quote.id,
    setOpenDropdownId: vi.fn(),
    dropdownPos: { top: 0, left: 0 },
    dropdownRef: { current: null },
    handleToggleDropdown: vi.fn(),
    isHebrew,
    isLocalIsraeliBusiness: isHebrew,
    formatNum: (n) => String(n),
    t,
    setPendingEmailQuote: vi.fn(),
    emailStatuses: {},
    currency: isHebrew ? 'ILS' : 'USD',
    quote,
  };
}

describe.each([
  ['English', false, 'Cannot edit a signed quote', 'Cannot delete a signed quote'],
  ['Hebrew', true, 'לא ניתן לערוך הצעה חתומה', 'לא ניתן למחוק הצעה חתומה'],
])('QuotesTab lock state (%s)', (_label, isHebrew, editTooltip, deleteTooltip) => {
  it('leaves Edit/Delete enabled for a pending quote', () => {
    const props = buildProps(isHebrew, { status: 'pending', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).not.toBeDisabled();
    expect(deleteBtn).not.toBeDisabled();
    expect(editBtn.parentElement).not.toHaveAttribute('title');
    expect(deleteBtn.parentElement).not.toHaveAttribute('title');
    expect(screen.queryByTitle(editTooltip)).not.toBeInTheDocument();
    expect(screen.queryByTitle(deleteTooltip)).not.toBeInTheDocument();
  });

  it('disables Edit/Delete with the correct tooltip on the wrapper for an approved quote', () => {
    const props = buildProps(isHebrew, { status: 'approved', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn.parentElement).toHaveAttribute('title', editTooltip);
    expect(deleteBtn.parentElement).toHaveAttribute('title', deleteTooltip);
    expect(screen.getByTitle(editTooltip)).toBe(editBtn.parentElement);
    expect(screen.getByTitle(deleteTooltip)).toBe(deleteBtn.parentElement);
  });

  it('disables Edit/Delete with the correct tooltip on the wrapper for a paid quote', () => {
    const props = buildProps(isHebrew, { status: 'paid', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn.parentElement).toHaveAttribute('title', editTooltip);
    expect(deleteBtn.parentElement).toHaveAttribute('title', deleteTooltip);
  });

  it('disables Edit/Delete for a signed quote with an unrelated status', () => {
    const props = buildProps(isHebrew, { status: 'sent', signature: 'data:image/png;base64,abc' });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
  });

  it('never invokes the edit/delete handlers when clicking a locked button', () => {
    const handleProtectedAction = vi.fn();
    const props = buildProps(isHebrew, { status: 'approved', signature: null }, { handleProtectedAction });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    fireEvent.click(editBtn);
    fireEvent.click(deleteBtn);

    expect(handleProtectedAction).not.toHaveBeenCalled();
  });
});
