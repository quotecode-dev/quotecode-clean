// Night task 2026-10-19 (Owner console, doc 4559529a): the bell's "View quote" opens that quote's page + tracking details in the list;
// the Dashboard routes the three subjects through the SAME unsaved-work guard as every other navigation.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, waitFor } from '@testing-library/react';
import QuotesTab from './components/QuotesTab';
import { formatMoneyForCurrency } from './utils/money';

const quote = (id, created) => ({
  id, status: 'sent', signature: null, clients: { company_name: `Client ${id}`, client_type: 'business' }, subtotal: 100, discount: 0, total: 118,
  currency: 'ILS', tax_rate: 18, view_count: 1, first_viewed_at: created, created_at: created, quote_items: [{ description: 'Item', unit_price: 100, quantity: 1 }],
  client_type: 'business', email_bounced: false,
});

function props(extra) {
  const quotes = [quote('aaaaaaaa-0000-4000-8000-000000000001', '2026-10-10T10:00:00.000Z'), quote('aaaaaaaa-0000-4000-8000-000000000002', '2026-10-01T10:00:00.000Z')];
  return {
    quotes, allQuotes: quotes, searchTerm: '', setSearchTerm: vi.fn(), statusFilter: 'All', setStatusFilter: vi.fn(), quoteSortField: 'date', quoteSortDirection: 'desc',
    handleQuoteSort: vi.fn(), handleExportQuotes: vi.fn(), handleEditClick: vi.fn(), handleDuplicateQuote: vi.fn(), sendWhatsApp: vi.fn(), handleDeleteQuote: vi.fn(),
    handleProtectedAction: vi.fn((id, a, fn) => fn()), activeTooltip: { quoteId: null, action: null }, openDropdownId: null, isHebrew: true, isLocalIsraeliBusiness: true,
    formatMoneyDisplay: (v, c) => formatMoneyForCurrency(v, c || 'ILS'), t: { recentHistory: 'History', quotesNav: 'Quotes', searchQuote: 'Search', filterStatus: 'Status' },
    setPendingEmailQuote: vi.fn(), emailStatuses: {}, currency: 'ILS', ...extra,
  };
}

describe('QuotesTab: a bell focus request', () => {
  it('opens the requested quote\'s tracking details once and consumes the request', async () => {
    const consumed = vi.fn();
    const id = 'aaaaaaaa-0000-4000-8000-000000000002';
    render(<QuotesTab {...props({ focusQuoteRequest: { quoteId: id, nonce: 1 }, onFocusQuoteConsumed: consumed })} />);
    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect([`quote-modern-detail-${id}`, `quote-detail-${id}`, `quote-detail-mobile-${id}`].some((x) => document.getElementById(x))).toBe(true));
  });
  it('no request: nothing opens, nothing consumed', () => {
    const consumed = vi.fn();
    render(<QuotesTab {...props({ onFocusQuoteConsumed: consumed })} />);
    expect(consumed).not.toHaveBeenCalled();
  });
});

describe('Dashboard wiring (static): one guarded navigation path for the bell', () => {
  const SRC = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(SRC, 'pages/Dashboard.jsx'), 'utf8');
  it('listens to the bell subject event and maps it to product-owned internal actions of the guarded handler', () => {
    expect(src).toMatch(/window\.addEventListener\(BELL_SUBJECT_EVENT, handleBellSubject\)/);
    expect(src).toMatch(/window\.removeEventListener\(BELL_SUBJECT_EVENT, handleBellSubject\)/);
    for (const a of ['open_bell_quote_internal', 'open_bell_task_internal', 'open_bell_client_internal']) expect(src).toContain(`case '${a}'`);
    expect(src).toMatch(/handleAiNavigate\(\{ detail: \{ action: BELL_ACTIONS\[d\.kind\], meta: d \} \}\)/);
  });
  it('a quote clears the search / filter before its page opens; a missing subject shows a real message', () => {
    const quoteCase = src.slice(src.indexOf("case 'open_bell_quote_internal'"), src.indexOf("case 'open_bell_task_internal'"));
    expect(quoteCase).toContain("setSearchTerm('')");
    expect(quoteCase).toContain("setStatusFilter('All')");
    expect(quoteCase).toContain('setBellQuoteFocus');
    expect(quoteCase).toContain('setAlertModalMsg');
    const clientCase = src.slice(src.indexOf("case 'open_bell_client_internal'"), src.indexOf("case 'open_bell_client_internal'") + 600);
    expect(clientCase).toContain('setEditingClient(target)');
    expect(clientCase).toContain('setAlertModalMsg');
  });
  it('the AI chat can never reach these destinations (they are not in the AI allowlist)', () => {
    const allow = readFileSync(resolve(SRC, 'utils/safeNavigation.js'), 'utf8');
    expect(allow).not.toMatch(/open_bell_/);
  });
});
