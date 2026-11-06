// Task 34 extension (Owner AI specification, section ה): the per-item "Edit price" action. It changes ONLY unit_price (quantity, unit,
// source, measurements, specification, section, catalog origin untouched; no wizard); shows the quantity + unit and the expected line total;
// cancel / Escape change nothing; invalid input is refused; an empty price is "missing" (never shown as free); 0 is an intentional free line.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import QuoteForm from './QuoteForm';
import { parsePriceInput } from '../utils/itemPrice';

const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
const noop = () => {};
const props = (items, extra = {}) => ({
  editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: '', setClientName: noop, clientEmail: '', setClientEmail: noop, clientPhone: '', setClientPhone: noop, clientType: 'business', setClientType: noop,
  clientTaxId: '', setClientTaxId: noop, clientAddress: '', setClientAddress: noop, quoteSubject: '', setQuoteSubject: noop, attnName: '', setAttnName: noop,
  attnRole: '', setAttnRole: noop, currency: 'USD', quoteStatus: 'draft', setQuoteStatus: noop, validUntil: '', setValidUntil: noop, discount: 0, setDiscount: noop,
  terms: '', setTerms: noop, warranty: '', setWarranty: noop, notes: '', setNotes: noop, items, setItems: vi.fn(), sections: [], setSections: noop,
  addSection: noop, renameSection: noop, removeSection: noop, quoteStructureMode: 'regular', setQuoteStructureMode: noop, isHebrew: false, t, sym: '$',
  formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2), handleItemChange: vi.fn(), duplicateItem: noop, removeItem: noop,
  projectName: '', setProjectName: noop, services: [], clients: [], isLocalIsraeliBusiness: false, subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0,
  canUseAttachments: true, canUseProfessionalQuotes: true, businessDefaultProfessionalUnit: null, canUseProfessionalQuoteReuse: true,
  handleProfessionalUnitChange: noop, addMeasurementRow: noop, removeMeasurementRow: noop, handleMeasurementChange: noop, toggleManualQuantityOverride: noop,
  handleManualQuantityChange: noop, toggleMeasurementPricingDriving: noop, addSpecificationRow: noop, handleSpecificationChange: noop, removeSpecificationRow: noop,
  onOpenPricingModal: noop, quoteFiles: [], setQuoteFiles: noop, allUserAttachments: [],
  ...extra,
});
const M2 = { description: 'Tile the master bedroom', quantity: '1', unit_price: '', isFromCatalog: false, section_key: null, pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 36, measurements: [] };

describe('parsePriceInput', () => {
  it('empty = missing, 0 = intentional, decimals up to 2 with a point, a comma only as thousands groups, anything else refused', () => {
    expect(parsePriceInput('')).toEqual({ ok: true, value: '' });
    expect(parsePriceInput('0')).toEqual({ ok: true, value: '0' });
    // Task 35 (Codex F3): '.' is the only decimal point (<= 2 places); ',' is accepted ONLY as complete thousands groups - nothing is guessed
    for (const [raw, value] of [['1,200', '1200'], ['1,234,567.5', '1234567.5'], ['12.50', '12.5'], [' 450 ', '450'], ['0.99', '0.99'], ['10000000', '10000000']]) {
      expect(parsePriceInput(raw)).toEqual({ ok: true, value });
    }
    for (const bad of ['-5', 'abc', '1.234', '1e3', '1,,2', '1,2,3', '99,5', '1,20', '12,3456', ',5', '5,', '1.', '.5', '1 200', '₪100', '100₪', '$5',
      '+5', 'NaN', 'Infinity', '0x10', '1,2.5', '10000000.01', '99999999']) expect(parsePriceInput(bad).ok, bad).toBe(false);
  });
});

describe('Edit price on a quote item', () => {
  it('a missing price shows "Enter a price" - never a free line; 0 shows 0.00', () => {
    render(<QuoteForm {...props([M2, { ...M2, description: 'Free inspection', pricing_unit: undefined, quantity_source: undefined, calculated_quantity: '', quantity: '1', unit_price: '0' }])} />);
    const totals = screen.getAllByTestId('item-line-total').map((e) => e.textContent);
    expect(totals).toEqual(['Enter a price', '$0.00']);
  });

  it('shows quantity + unit and the expected total, and saves ONLY the unit price (36 m² x 100 = 3,600)', () => {
    const p = props([M2]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByTestId('edit-price-qty').textContent).toBe('Quantity: 36.00 m²');
    expect(screen.getByLabelText('Price per m² ($)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Price per m² ($)'), { target: { value: '100' } });
    expect(screen.getByTestId('edit-price-total').textContent).toBe('Expected line total: $3600.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save price' }));
    expect(p.handleItemChange).toHaveBeenCalledTimes(1);
    expect(p.handleItemChange).toHaveBeenCalledWith(0, 'unit_price', '100');
    expect(p.setItems).not.toHaveBeenCalled(); // nothing else of the item is rewritten
    expect(screen.queryByTestId('edit-item-price')).toBeNull();
  });

  it('cancel and Escape change nothing; an invalid price is refused with a message; it is also in the item actions menu', () => {
    const p = props([M2]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    fireEvent.change(screen.getByLabelText('Price per m² ($)'), { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save price' }));
    expect(screen.getByRole('alert').textContent).toContain('valid price');
    expect(p.handleItemChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId('edit-item-price'), { key: 'Escape' });
    expect(screen.queryByTestId('edit-item-price')).toBeNull();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit price/ }));
    fireEvent.click(within(screen.getByTestId('edit-item-price')).getByRole('button', { name: 'Cancel' }));
    expect(p.handleItemChange).not.toHaveBeenCalled();
  });

  it('a single fixed item is priced as its total; an hourly item per hour', () => {
    render(<QuoteForm {...props([{ description: 'Kitchen renovation', quantity: '1', unit_price: '5000', isFromCatalog: false, section_key: null }, { description: 'Electrician', quantity: '1', unit_price: '', isFromCatalog: false, section_key: null, pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 5 }])} />);
    fireEvent.click(screen.getAllByTestId('item-edit-price')[0]);
    expect(screen.getByLabelText('Price for this item (total) ($)').value).toBe('5000');
    fireEvent.click(within(screen.getByTestId('edit-item-price')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getAllByTestId('item-edit-price')[1]);
    expect(screen.getByLabelText('Price per hour ($)')).toBeTruthy();
    expect(screen.getByTestId('edit-price-qty').textContent).toBe('Quantity: 5.00 hour');
  });
});
