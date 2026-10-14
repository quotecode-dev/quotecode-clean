// IRON-MARKET-004 (rendered, Task 39 release line): the quotes overview row (Owner console approval 2026-10-13) totals the COMPLETE
// collection per persisted quote currency - one token per currency, never one mixed sum relabelled with the account currency, and a
// missing / invalid currency is reported, never assigned. Every row / card amount is a single quote's total keyed on THAT quote's
// persisted currency - in the table (desktop / tablet landscape) and in the cards (tablet portrait / mobile), HE and EN. ILS amounts
// follow IRON-ILS-001 (whole shekel, half-up) because the formatter is keyed on the quote currency, not on the UI language.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import QuotesTab from './QuotesTab';
import { formatMoneyForCurrency } from '../utils/money';

const noop = vi.fn();
const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const q = (id, currency, total, status = 'sent') => ({
  id, quote_number: id, currency, total, status, view_count: 0, signature: null, subtotal: total, discount: 0, tax_rate: currency === 'ILS' ? 18 : 0,
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
const amounts = (c) => [...c.querySelectorAll('[data-qh="amount"]')].map((e) => strip(e.textContent));
const totalCell = (c) => c.querySelector('[data-qh-overview="total"]');
const tokens = (c) => [...totalCell(c).querySelectorAll('.pf-money')].map((e) => strip(e.textContent));
const count = (c, key) => c.querySelector(`[data-qh-overview="${key}"] .quote-overview-value`).textContent;
const setWidth = (width) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: width <= Number((query.match(/max-width:\s*(\d+)px/) || [0, Infinity])[1]), media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }));
};

afterEach(() => { delete window.matchMedia; });

describe('IRON-MARKET-004 quotes overview row: totals per persisted currency', () => {
  it('International account in EUR: $151.00, €200.40 and £80.10 as separate tokens - never €431.50', () => {
    const { container } = render(<QuotesTab {...props()} />);
    expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(strip(totalCell(container).textContent)).not.toContain('431.50');
    expect(totalCell(container)).toHaveClass('quote-overview-cell--multi');
    expect(container.querySelector('[data-testid="quote-overview"]')).toHaveClass('quote-overview--multi');
    expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe('Total by currency');
    expect([...totalCell(container).querySelectorAll('.pf-money')].map((e) => e.dataset.currency)).toEqual(['EUR', 'USD', 'GBP']);
  });

  it('switching the account currency EUR -> GBP changes only the order of the overview tokens', () => {
    const { container } = render(<QuotesTab {...props({ account: 'GBP' })} />);
    expect(tokens(container)).toEqual(['£80.10', '$151.00', '€200.40']);
  });

  it('one currency keeps a single token and the plain label (HE / Local / ILS, whole shekel per IRON-ILS-001)', () => {
    const quotes = [q(1, 'ILS', 1227.5), q(2, 'ILS', 100)];
    const { container } = render(<QuotesTab {...props({ quotes, account: 'ILS', isHebrew: true, local: true })} />);
    expect(tokens(container)).toEqual(['₪1,328.00']); // 1327.50 -> half-up
    expect(totalCell(container)).not.toHaveClass('quote-overview-cell--multi');
    expect(totalCell(container).querySelector('.pf-currency-totals')).toBeNull();
    expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe('סה״כ');
  });

  it('a single foreign currency is shown under ITS symbol, not the account symbol', () => {
    const { container } = render(<QuotesTab {...props({ quotes: [q(1, 'USD', 100.25), q(2, 'USD', 50.75)], account: 'EUR' })} />);
    expect(tokens(container)).toEqual(['$151.00']);
  });

  it('a quote with a missing / invalid currency is reported as missing data and never added to the account currency', () => {
    const { container } = render(<QuotesTab {...props({ quotes: [...HISTORY, q(9, null, 999), q(10, 'XYZ', 1)] })} />);
    expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(totalCell(container).querySelector('[data-currency-unknown]').dataset.currencyUnknown).toBe('2');
    expect(totalCell(container).textContent).toContain('No valid currency');
  });

  it('the overview is computed from the COMPLETE collection: a search / filter (fewer listed quotes) never changes the totals or counts', () => {
    const { container } = render(<QuotesTab {...props()} quotes={[HISTORY[2]]} />);
    expect(amounts(container)).toEqual(['€200.40']); // the listed (filtered) rows
    expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect([count(container, 'all'), count(container, 'awaiting'), count(container, 'approved')]).toEqual(['4', '1', '2']);
  });

  it('counts: awaiting = sent only (never a draft), approved = approved + paid', () => {
    const quotes = [q(1, 'USD', 1, 'draft'), q(2, 'USD', 1, 'sent'), q(3, 'USD', 1, 'approved'), q(4, 'USD', 1, 'paid'), q(5, 'USD', 1, 'Sent')];
    const { container } = render(<QuotesTab {...props({ quotes })} />);
    expect([count(container, 'all'), count(container, 'awaiting'), count(container, 'approved')]).toEqual(['5', '2', '2']);
  });
});

describe('IRON-MARKET-004 Quotes list: every amount in its own quote currency', () => {
  it('EUR account, mixed history: table rows show $100.25, $50.75, €200.40, £80.10 - each under its own symbol', () => {
    const { container } = render(<QuotesTab {...props()} />);
    expect(amounts(container).sort()).toEqual(['$100.25', '$50.75', '£80.10', '€200.40'].sort());
  });

  it('cards (mobile) keep the same per-quote currencies as the table', () => {
    setWidth(390);
    const { container } = render(<QuotesTab {...props()} />);
    expect(container.querySelectorAll('[data-testid="quote-card-amount"]').length).toBe(4);
    expect([...container.querySelectorAll('[data-testid="quote-card-amount"]')].map((e) => strip(e.textContent)).sort())
      .toEqual(['$100.25', '$50.75', '£80.10', '€200.40'].sort());
  });

  it('switching the account currency EUR -> GBP changes no row amount or symbol (rows never follow the account currency)', () => {
    const eur = amounts(render(<QuotesTab {...props({ account: 'EUR' })} />).container).sort();
    const gbp = amounts(render(<QuotesTab {...props({ account: 'GBP' })} />).container).sort();
    expect(gbp).toEqual(eur.slice(0, 4));
  });

  it('no displayed amount is a cross-currency sum (no €431.50 / 431.50 anywhere in the list)', () => {
    const { container } = render(<QuotesTab {...props()} />);
    expect(strip(container.textContent)).not.toMatch(/431\.50|1,430\.50/);
  });

  it('HE / Local / ILS rows: whole shekel, half-up (1227.50 -> ₪1,228.00) in the table', () => {
    const quotes = [q(1, 'ILS', 1227.5), q(2, 'ILS', 100.49)];
    const { container } = render(<QuotesTab {...props({ quotes, account: 'ILS', isHebrew: true, local: true })} />);
    expect(amounts(container).sort()).toEqual(['₪1,228.00', '₪100.00'].sort());
  });

  it('an ILS quote inside an International (EUR) account still follows the ILS rule - keyed on the quote currency', () => {
    const { container } = render(<QuotesTab {...props({ quotes: [q(1, 'ILS', 99.5), q(2, 'EUR', 99.5)], account: 'EUR' })} />);
    expect(amounts(container).sort()).toEqual(['₪100.00', '€99.50'].sort());
  });

  it('a USD quote inside a Local (ILS) account keeps its cents - never the whole-shekel rule', () => {
    const { container } = render(<QuotesTab {...props({ quotes: [q(1, 'USD', 10.25)], account: 'ILS', isHebrew: true, local: true })} />);
    expect(amounts(container)).toEqual(['$10.25']);
  });

  it('every row amount is ONE .pf-money atom (LTR-isolated, tabular) - symbol and digits never split across nodes', () => {
    const { container } = render(<QuotesTab {...props()} />);
    const atoms = [...container.querySelectorAll('[data-qh="amount"]')];
    expect(atoms.length).toBe(4);
    for (const a of atoms) { expect(a).toHaveClass('pf-money'); expect(a.children.length).toBe(0); }
  });

  // every device class through the component's real breakpoint (max-width: 768px): table (desktop, tablet landscape) and cards
  // (tablet portrait, mobile); HE (RTL) and EN (LTR)
  for (const [device, width] of [['desktop', 1280], ['tablet-landscape', 1024], ['tablet-portrait', 768], ['mobile', 390]]) {
    for (const isHebrew of [false, true]) {
      it(`${device} ${width}px ${isHebrew ? 'HE' : 'EN'}: per-quote amounts in the ${width <= 768 ? 'cards' : 'table'} + separate per-currency overview tokens`, () => {
        setWidth(width);
        const { container } = render(<QuotesTab {...props({ isHebrew })} />);
        expect(container.querySelectorAll('.quote-card').length > 0).toBe(width <= 768);
        expect(amounts(container).sort()).toEqual(['$100.25', '$50.75', '£80.10', '€200.40'].sort());
        expect(tokens(container)).toEqual(['€200.40', '$151.00', '£80.10']);
        expect(totalCell(container).querySelector('.quote-overview-label').textContent).toBe(isHebrew ? 'סה״כ לפי מטבע' : 'Total by currency');
        totalCell(container).querySelectorAll('.pf-money').forEach((m) => expect(m.closest('.pf-currency-token')).not.toBeNull());
      });
    }
  }
});
