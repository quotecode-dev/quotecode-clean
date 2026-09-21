import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyValue, NumericValue } from './NumericValue';
import QuotesTab from './QuotesTab';
import { formatNumberLocal } from '../utils/regionConfig';

// Component-level contract for the Iron Numeric Typography primitives. Computed-style / coordinate proof lives in
// e2e/numeric-geometry.gate.mjs (jsdom does not load index.css); here we lock the structure + the text pipeline.
const VALUES = [0, 1, 9, 10, 99, 100, 333, 1300, 10000, -1300, 9999999.99];

describe('MoneyValue / NumericValue primitives', () => {
  it('renders symbol + caller-formatted text unchanged (no formatting/rounding inside the primitive)', () => {
    render(<MoneyValue symbol="₪" text="1,300.00" data-testid="m" />);
    expect(screen.getByTestId('m').textContent).toBe('₪1,300.00');
  });
  it('adds the shared contract classes', () => {
    const { rerender } = render(<MoneyValue symbol="$" text="5.00" data-testid="m" />);
    expect(screen.getByTestId('m').className).toBe('pf-money');
    rerender(<MoneyValue symbol="$" text="5.00" slot hero data-testid="m" />);
    expect(screen.getByTestId('m').className).toBe('pf-money pf-money-slot pf-money--hero');
    rerender(<NumericValue data-testid="n">A101041</NumericValue>);
    expect(screen.getByTestId('n').className).toBe('pf-num');
  });
});

afterEach(() => { delete window.matchMedia; });

describe.each([['HE', true, '₪'], ['EN', false, '$']])('QuotesTab mobile card amount slot (%s)', (_l, isHebrew, sym) => {
  it('renders every value inside a .pf-money-slot with the canonical formatter text', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const quotes = VALUES.map((total, i) => ({
      id: `q-${i}-000000000000000`, status: 'pending', signature: null, clients: { company_name: 'C', client_type: 'business' },
      subtotal: total, discount: 0, total, currency: isHebrew ? 'ILS' : 'USD', tax_rate: 18, view_count: 0,
      created_at: '2026-01-01T00:00:00.000Z', quote_items: [{ description: 'I' }], client_type: 'business', email_bounced: false,
    }));
    const noop = vi.fn();
    render(<QuotesTab quotes={quotes} searchTerm="" setSearchTerm={noop} statusFilter="All" setStatusFilter={noop} quoteSortField="date" quoteSortDirection="desc"
      handleQuoteSort={noop} handleCreateNewQuoteClick={noop} handleExportQuotes={noop} handleEditClick={noop} handleDuplicateQuote={noop} sendWhatsApp={noop}
      handleDeleteQuote={noop} handleProtectedAction={noop} activeTooltip={{ quoteId: null, action: null }} openDropdownId={null} isHebrew={isHebrew}
      isLocalIsraeliBusiness={isHebrew} formatNum={(n) => formatNumberLocal(n, isHebrew)} t={{ recentHistory: 'H', searchQuote: 'S', filterStatus: 'F' }}
      setPendingEmailQuote={noop} emailStatuses={{}} currency={isHebrew ? 'ILS' : 'USD'} />);
    const slots = screen.getAllByTestId('quote-card-amount');
    expect(slots).toHaveLength(VALUES.length);
    slots.forEach((el, i) => {
      expect(el.className).toContain('pf-money-slot');
      expect(el.className).toContain('pf-money');
      expect(el.textContent).toBe(`${sym}${formatNumberLocal(VALUES[i], isHebrew)}`);
    });
  });
});
