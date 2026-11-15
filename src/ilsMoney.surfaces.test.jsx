// IRON-ILS-001 RENDERED-SURFACE PROOF (component level, real components, real canonical formatter).
// Closes the coverage gaps named in the combined First-LIVE closure: Quote Form totals + item card, Catalog, Add Item Wizard
// (catalog list, formula, review line). Local/ILS => nearest whole shekel, half-up, always ".00"; International keeps cents.
// Stored values are passed in unchanged - only the rendered text is asserted.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import QuoteForm from './components/QuoteForm';
import ServicesCatalog from './components/ServicesCatalog';
import AddItemWizard from './components/AddItemWizard';
import QuotesTab from './components/QuotesTab';
import { formatMoneyForCurrency } from './utils/money';

const noop = vi.fn();
const t = {
  clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description',
  discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status',
  subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote',
  validUntil: 'Valid until', vat: 'VAT', catalogTitle: 'Catalog', addService: 'Add', serviceName: 'Name', price: 'Price',
};
// Dashboard's exact injected formatter (Dashboard.jsx: formatMoneyDisplay = (val, cur) => formatMoneyForCurrency(val, cur || account))
const dashFormatter = (accountCurrency) => (val, cur) => formatMoneyForCurrency(val, cur || accountCurrency);

function quoteFormProps({ ils }) {
  const currency = ils ? 'ILS' : 'USD';
  return {
    editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: noop,
    clientName: '', setClientName: noop, clientEmail: '', setClientEmail: noop, clientPhone: '', setClientPhone: noop,
    clientType: 'business', setClientType: noop, clientTaxId: '', setClientTaxId: noop, clientAddress: '', setClientAddress: noop,
    quoteSubject: '', setQuoteSubject: noop, attnName: '', setAttnName: noop, attnRole: '', setAttnRole: noop,
    currency, quoteStatus: 'draft', setQuoteStatus: noop, validUntil: '', setValidUntil: noop, discount: 1.5, setDiscount: noop,
    terms: '', setTerms: noop, warranty: '', setWarranty: noop, notes: '', setNotes: noop,
    items: [{ description: 'Window', quantity: '1', unit_price: '191.16', isFromCatalog: false, section_key: null }],
    setItems: noop, sections: [], setSections: noop, addSection: noop, renameSection: noop, removeSection: noop,
    quoteStructureMode: 'regular', setQuoteStructureMode: noop, projectName: '', setProjectName: noop,
    services: [], clients: [], isHebrew: ils, isLocalIsraeliBusiness: ils, t, sym: ils ? '₪' : '$',
    formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: dashFormatter(currency),
    subtotal: 6532.48, discountAmount: 100.49, taxAmount: 324.5, totalAmount: 28346.16,
    removeItem: noop, handleItemChange: noop, canUseAttachments: true, canUseProfessionalQuotes: true, businessDefaultProfessionalUnit: null,
    duplicateItem: noop, canUseProfessionalQuoteReuse: true, onOpenPricingModal: noop, quoteFiles: [], setQuoteFiles: noop, allUserAttachments: [],
  };
}

const text = (c) => c.textContent.replace(/\s+/g, ' ');

describe('IRON-ILS-001 Quote Form (rendered)', () => {
  it('Local/ILS: item card, subtotal, discount, net, VAT and grand total are whole shekels with .00', () => {
    const { container } = render(<QuoteForm {...quoteFormProps({ ils: true })} />);
    const s = text(container);
    expect(s).toContain('₪191.00'); // item 191.16
    expect(s).toContain('₪6,532.00'); // subtotal 6532.48
    expect(s).toContain('₪100.00'); // discount 100.49 (half-up: .49 down)
    expect(s).toContain('₪325.00'); // VAT 324.50 (half-up: .50 up)
    expect(s).toContain('₪28,346.00'); // grand total 28346.16
    expect(s).not.toMatch(/₪[\d,]+\.(?!00)\d\d/); // no ₪ amount with non-zero agorot anywhere
  });

  it('International/USD: the same values keep cents and show no ₪', () => {
    const { container } = render(<QuoteForm {...quoteFormProps({ ils: false })} />);
    const s = text(container);
    expect(s).toContain('$191.16');
    expect(s).toContain('$6,532.48');
    expect(s).toContain('$28,346.16');
    expect(s).not.toContain('₪');
  });
});

describe('IRON-ILS-001 Catalog (rendered)', () => {
  const props = (ils) => ({
    t, isHebrew: ils, newServiceName: '', setNewServiceName: noop, newServicePrice: '', setNewServicePrice: noop, handleAddService: noop,
    services: [{ id: 's1', name: 'Glass', price: 191.16 }, { id: 's2', name: 'Frame', price: 100.5 }],
    editingServiceId: null, setEditingServiceId: noop, editServiceName: '', setEditServiceName: noop, editServicePrice: '', setEditServicePrice: noop,
    handleSaveEditedService: noop, handleDeleteService: noop, sym: ils ? '₪' : '€', formatMoneyDisplay: dashFormatter(ils ? 'ILS' : 'EUR'),
  });
  it('Local/ILS catalog prices render whole shekels', () => {
    const s = text(render(<ServicesCatalog {...props(true)} />).container);
    expect(s).toContain('₪191.00');
    expect(s).toContain('₪101.00');
  });
  it('International/EUR catalog prices keep cents', () => {
    const s = text(render(<ServicesCatalog {...props(false)} />).container);
    expect(s).toContain('€191.16');
    expect(s).toContain('€100.50');
  });
});

describe('IRON-ILS-001 Add Item Wizard (rendered)', () => {
  const props = (over) => ({
    isOpen: true, onClose: noop, onAdd: noop, editingItem: null, isHebrew: false, sections: [], defaultSectionKey: null,
    canUseProfessionalQuotes: true, onRequestUpgrade: noop, recommendedMethod: null,
    services: [{ id: 's1', name: 'Glass', price: 191.16 }, { id: 's2', name: 'Frame', price: 324.5 }], ...over,
  });
  it('Local/ILS catalog-first list renders whole shekels (injected formatter)', () => {
    const s = text(render(<AddItemWizard {...props({ sym: '₪', formatMoneyDisplay: dashFormatter('ILS') })} />).container);
    expect(s).toContain('₪191.00');
    expect(s).toContain('₪325.00');
  });
  it('Local/ILS renders whole shekels even when a caller omits the formatter (canonical fallback, never raw)', () => {
    const s = text(render(<AddItemWizard {...props({ sym: '₪', formatMoneyDisplay: undefined })} />).container);
    expect(s).toContain('₪191.00');
    expect(s).not.toContain('191.16');
  });
  it('International/GBP keeps cents', () => {
    const s = text(render(<AddItemWizard {...props({ sym: '£', formatMoneyDisplay: dashFormatter('GBP') })} />).container);
    expect(s).toContain('£191.16');
    expect(s).toContain('£324.50');
  });
});

// IRON-ILS-001 Quotes dashboard (rendered): the quote rows, overview total, mobile/tablet-portrait cards and amount tooltips.
// Every device class of the responsive matrix is emulated through the component's real breakpoint (max-width: 768px).
describe('IRON-ILS-001 Quotes dashboard (rendered, HE/Local/ILS vs EN/International, all device classes)', () => {
  const DEVICES = [['desktop', 1280], ['tablet-landscape', 1024], ['tablet-portrait', 768], ['mobile', 390]];
  const setWidth = (width) => {
    window.matchMedia = vi.fn().mockImplementation((query) => {
      const max = query.match(/max-width:\s*(\d+)px/); const min = query.match(/min-width:\s*(\d+)px/);
      const matches = (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() };
    });
  };
  afterEach(() => { delete window.matchMedia; });
  const RAW = [1227.2, 18397.2, 1227.5, 191.16, 324.5];
  const quotes = (cur) => RAW.map((total, i) => ({
    id: `q-${i}`, quote_number: 12000 + i, status: i === 0 ? 'sent' : 'draft', view_count: i === 0 ? 3 : 0, signature: null, total,
    subtotal: total, discount: 0, tax_rate: cur === 'ILS' ? 18 : 0, currency: cur, created_at: '2026-01-0' + (i + 1) + 'T00:00:00.000Z',
    clients: { company_name: `Client ${i}`, client_type: 'business' }, quote_items: [{ description: 'Item' }], email_bounced: false,
  }));
  const props = (ils, cur) => {
    const list = quotes(cur);
    return {
      quotes: list, allQuotes: list, searchTerm: '', setSearchTerm: noop, statusFilter: 'All', setStatusFilter: noop, quoteSortField: 'date',
      quoteSortDirection: 'desc', handleQuoteSort: noop, handleExportQuotes: noop, handleEditClick: noop, handleDuplicateQuote: noop,
      sendWhatsApp: noop, handleDeleteQuote: noop, handleProtectedAction: vi.fn((id, a, fn) => fn()), activeTooltip: { quoteId: null, action: null },
      openDropdownId: null, isHebrew: ils, isLocalIsraeliBusiness: ils, formatNum: (n) => String(n), formatMoneyDisplay: dashFormatter(cur),
      t: { recentHistory: 'History', quotesNav: 'Quotes', searchQuote: 'Search', filterStatus: 'Status' }, setPendingEmailQuote: noop,
      emailStatuses: {}, currency: cur,
    };
  };
  const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
  const amountsOf = (c) => [...c.querySelectorAll('.pf-money')].map((e) => strip(e.textContent));
  const tooltipsOf = (c) => [...c.querySelectorAll('[title]')].map((e) => strip(e.getAttribute('title'))).filter((x) => /[₪$€£][\d,]+\.\d\d/.test(x));

  it('the money atoms are LTR-isolated tabular numerals (index.css .pf-money)', () => {
    const css = readFileSync(join(cwd(), 'src', 'index.css'), 'utf8');
    const rule = css.slice(css.indexOf('.pf-money {'), css.indexOf('}', css.indexOf('.pf-money {')));
    expect(rule).toMatch(/direction: ltr;/);
    expect(rule).toMatch(/unicode-bidi: isolate;/);
    expect(rule).toMatch(/font-variant-numeric: tabular-nums/);
  });

  for (const [device, width] of DEVICES) {
    const cards = width <= 768;
    it(`${device} ${width}px HE/Local/ILS: every amount (${cards ? 'cards' : 'rows'}, overview, tooltips) is a whole shekel ".00"`, () => {
      setWidth(width);
      const { container } = render(<QuotesTab {...props(true, 'ILS')} />);
      if (!cards) fireEvent.click(container.querySelector('.quote-modern-show-all') || container);
      const amounts = amountsOf(container);
      expect(amounts.length).toBeGreaterThanOrEqual(RAW.length + 1);
      for (const a of amounts) expect(a).toMatch(/^₪-?[\d,]+\.00$/);
      // rows/cards 1227.20, 18397.20, 1227.50, 191.16, 324.50 and the overview total 21367.56
      for (const expected of ['₪1,227.00', '₪18,397.00', '₪1,228.00', '₪191.00', '₪325.00', '₪21,368.00']) expect(amounts).toContain(expected);
      for (const tip of tooltipsOf(container)) expect(tip).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
      expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
      if (cards) {
        expect(container.querySelectorAll('.quote-card').length).toBeGreaterThan(0);
      } else {
        const list = container.querySelector('.quote-modern-list');
        expect(list).toHaveAttribute('dir', 'rtl');
        const row = container.querySelector('.quote-modern-row');
        expect(row.firstElementChild).toHaveClass('quote-modern-toggle'); // R5: trigger stays the outermost leading control
        expect([...row.children].slice(1).map((e) => e.className.split(' ').find((x) => x.startsWith('quote-modern-')))).toEqual(
          ['quote-modern-number', 'quote-modern-client', 'quote-modern-title', 'quote-modern-status', 'quote-modern-views', 'quote-modern-date', 'quote-modern-amount']);
        expect(row.querySelector('.quote-modern-number')).toHaveAttribute('dir', 'ltr');
        fireEvent.click(row.querySelector('.quote-modern-toggle'));
        expect(row.querySelector('.quote-modern-toggle')).toHaveAttribute('aria-expanded', 'true');
      }
    });

    it(`${device} ${width}px EN/International: USD keeps cents, never ₪`, () => {
      setWidth(width);
      const { container } = render(<QuotesTab {...props(false, 'USD')} />);
      if (!cards) fireEvent.click(container.querySelector('.quote-modern-show-all') || container);
      const amounts = amountsOf(container);
      for (const expected of ['$1,227.20', '$18,397.20', '$1,227.50', '$191.16', '$324.50', '$21,367.56']) expect(amounts).toContain(expected);
      expect(container.textContent).not.toContain('₪');
      if (!cards) expect(container.querySelector('.quote-modern-list')).toHaveAttribute('dir', 'ltr');
    });
  }
});
