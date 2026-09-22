// IRON-ILS-001 RENDERED-SURFACE PROOF (component level, real components, real canonical formatter).
// Closes the coverage gaps named in the combined First-LIVE closure: Quote Form totals + item card, Catalog, Add Item Wizard
// (catalog list, formula, review line). Local/ILS => nearest whole shekel, half-up, always ".00"; International keeps cents.
// Stored values are passed in unchanged - only the rendered text is asserted.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import QuoteForm from './components/QuoteForm';
import ServicesCatalog from './components/ServicesCatalog';
import AddItemWizard from './components/AddItemWizard';
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
