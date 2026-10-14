// IRON-MARKET-004 (rendered): the Quotes overview total is one money token per persisted quote currency - never one mixed sum
// relabelled with the account currency. Individual rows keep each quote's own historical currency.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import QuotesTab from './QuotesTab';
import { formatMoneyForCurrency } from '../utils/money';

const noop = vi.fn();
const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const q = (id, currency, total, status = 'sent') => ({
  id, quote_number: id, currency, total, status, view_count: 0, signature: null, subtotal: total, discount: 0, tax_rate: 0,
  created_at: '2026-01-01T00:00:00.000Z', clients: { company_name: `Client ${id}`, client_type: 'business' }, quote_items: [{ description: 'Item' }],
});
const HISTORY = [q(1, 'USD', 100.25, 'approved'), q(2, 'USD', 50.75), q(3, 'EUR', 200.4, 'paid'), q(4, 'GBP', 80.1, 'draft')];
const props = ({ quotes = HISTORY, account = 'EUR', isHebrew = false, local = false } = {}) => ({
  quotes, allQuotes: quotes, searchTerm: '', setSearchTerm: noop, statusFilter: 'All', setStatusFilter: noop, quoteSortField: 'date',
  quoteSortDirection: 'desc', handleQuoteSort: noop, handleExportQuotes: noop, handleEditClick: noop, handleDuplicateQuote: noop,
  sendWhatsApp: noop, handleDeleteQuote: noop, handleProtectedAction: vi.fn((id, a, fn) => fn()), activeTooltip: { quoteId: null, action: null },
  openDropdownId: null, isHebrew, isLocalIsraeliBusiness: local, formatNum: (n) => String(n),
  formatMoneyDisplay: (val, cur) => formatMoneyForCurrency(val, cur || account), // Dashboard's injected canonical formatter
  t: { recentHistory: 'History', quotesNav: 'Quotes', searchQuote: 'Search', filterStatus: 'Status' }, setPendingEmailQuote: noop,
  emailStatuses: {}, currency: account,
});
const totalCell = (c) => c.querySelector('[data-qh-overview="total"]');
const tokens = (c) => [...totalCell(c).querySelectorAll('.pf-money')].map((e) => strip(e.textContent));

afterEach(() => { delete window.matchMedia; });

describe('IRON-MARKET-004 Quotes overview totals per persisted currency', () => {
  it('International account in EUR: $151.00, €200.40 and £80.10 as separate tokens - never €431.50', () => {
    const { container } = render(<QuotesTab {...props()} />);
    expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(strip(totalCell(container).textContent)).not.toContain('431.50');
    expect(totalCell(container)).toHaveClass('quote-overview-cell--multi');
    expect(container.querySelector('[data-testid="quote-overview"]')).toHaveClass('quote-overview--multi');
    expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe('Total by currency');
    expect([...totalCell(container).querySelectorAll('.pf-money')].map((e) => e.dataset.currency)).toEqual(['EUR', 'USD', 'GBP']);
  });

  it('switching the account currency EUR -> GBP changes only the order', () => {
    const { container } = render(<QuotesTab {...props({ account: 'GBP' })} />);
    expect(tokens(container)).toEqual(['£80.10', '$151.00', '€200.40']);
  });

  it('Hebrew label for several currencies; the token list stays a set of LTR .pf-money atoms', () => {
    const { container } = render(<QuotesTab {...props({ isHebrew: true })} />);
    expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe('סה״כ לפי מטבע');
    totalCell(container).querySelectorAll('.pf-money').forEach((m) => expect(m.closest('.pf-currency-token')).not.toBeNull());
  });

  it('one currency keeps today\'s single token and label (HE/Local/ILS, whole shekel per IRON-ILS-001)', () => {
    const quotes = [q(1, 'ILS', 1227.5), q(2, 'ILS', 100)];
    const { container } = render(<QuotesTab {...props({ quotes, account: 'ILS', isHebrew: true, local: true })} />);
    expect(tokens(container)).toEqual(['₪1,328.00']); // 1327.50 -> half-up
    expect(totalCell(container)).not.toHaveClass('quote-overview-cell--multi');
    expect(container.querySelector('[data-testid="quote-overview"]')).not.toHaveClass('quote-overview--multi'); // exact 44px R5 strip
    expect(totalCell(container).querySelector('.pf-currency-totals')).toBeNull();
    expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe('סה״כ'); // Task 20 Continuation 2 (Owner 2026-10-10): was בסך הכול
  });

  it('a single foreign currency is shown under ITS symbol, not the account symbol', () => {
    const quotes = [q(1, 'USD', 100.25), q(2, 'USD', 50.75)];
    const { container } = render(<QuotesTab {...props({ quotes, account: 'EUR' })} />);
    expect(tokens(container)).toEqual(['$151.00']);
  });

  it('a quote with a missing/invalid currency is reported as missing data and never added to the account currency', () => {
    const quotes = [...HISTORY, q(9, null, 999), q(10, 'XYZ', 1)];
    const { container } = render(<QuotesTab {...props({ quotes })} />);
    expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(totalCell(container).querySelector('[data-currency-unknown]').dataset.currencyUnknown).toBe('2');
    expect(totalCell(container).textContent).toContain('No valid currency');
  });

  // every device class through the component's real breakpoint (max-width: 768px): table (desktop, tablet landscape) and cards
  // (tablet portrait, mobile) render the same per-currency tokens in the same overview cell, HE and EN
  for (const [device, width] of [['desktop', 1280], ['tablet-landscape', 1024], ['tablet-portrait', 768], ['mobile', 390]]) {
    for (const isHebrew of [false, true]) {
      it(`${device} ${width}px ${isHebrew ? 'HE' : 'EN'}: separate per-currency overview tokens`, () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: width <= Number((query.match(/max-width:\s*(\d+)px/) || [0, Infinity])[1]), media: query,
          addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
        }));
        const { container } = render(<QuotesTab {...props({ isHebrew })} />);
        expect(container.querySelectorAll(width <= 768 ? '.quote-card' : '.quote-modern-row').length).toBeGreaterThan(0);
        expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
        expect(totalCell(container)).toHaveClass('quote-overview-cell--multi');
      });
    }
  }

  it('individual rows keep each quote\'s own historical currency', () => {
    const { container } = render(<QuotesTab {...props()} />);
    const rows = [...container.querySelectorAll('.quote-modern-amount')].map((e) => strip(e.textContent)).sort();
    expect(rows).toEqual(['$100.25', '$50.75', '£80.10', '€200.40'].sort());
  });
});
