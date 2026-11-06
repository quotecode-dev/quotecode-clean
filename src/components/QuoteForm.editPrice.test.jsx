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
    // Owner 2026-11-06 (release A): an hourly item is not measured - its quantity is an input, shown as a count (5, never 5.00)
    expect(screen.getByLabelText('Quantity (hour)').value).toBe('5');
    expect(screen.queryByTestId('edit-price-qty')).toBeNull();
  });
});

// Owner console 2026-11-06 (typed L-09 / L-14 / L-17 / L-24 / L-27 approval, release A): the quick dialog edits the quantity of an item that
// is not measured; a measured item keeps its read-only quantity (from the measurements); an unchanged quantity leaves the item as it was.
describe('Edit price and quantity (release A)', () => {
  const HOUR = { description: 'Electrician', quantity: '1', unit_price: '100', isFromCatalog: false, section_key: null, pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 5 };
  const PLAIN = { description: 'Door handle', quantity: '1', unit_price: '40', isFromCatalog: false, section_key: null };
  // the one setItems update the dialog made, applied to the form items
  const applied = (p) => { expect(p.setItems).toHaveBeenCalledTimes(1); return p.setItems.mock.calls[0][0](p.items); };

  it('the card says "Edit price and quantity" for an item that is not measured and "Edit price" for a measured one', () => {
    render(<QuoteForm {...props([PLAIN, M2])} />);
    expect(screen.getAllByTestId('item-edit-price').map((b) => b.textContent)).toEqual(['Edit price and quantity', 'Edit price']);
  });

  it('a measured item has no quantity input - its quantity stays read-only, in the area format (36.00)', () => {
    render(<QuoteForm {...props([M2])} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.queryByTestId('edit-price-qty-input')).toBeNull();
    expect(screen.getByTestId('edit-price-qty').textContent).toBe('Quantity: 36.00 m²');
  });

  it('an hourly item: 7.5 hours x 100 = 750; the real amount is saved where the line keeps it (calculated_quantity)', () => {
    const p = props([HOUR]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByRole('heading', { name: 'Edit price and quantity' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantity (hour)'), { target: { value: '7.5' } });
    expect(screen.getByTestId('edit-price-total').textContent).toBe('Expected line total: $750.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(p.handleItemChange).not.toHaveBeenCalled();
    expect(applied(p)).toEqual([{ ...HOUR, unit_price: '100', calculated_quantity: 7.5 }]);
    expect(screen.queryByTestId('edit-item-price')).toBeNull();
  });

  it('a plain item: quantity 1 -> 3 updates quantity (a whole number, as text like the item window)', () => {
    const p = props([PLAIN]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByLabelText('Quantity').value).toBe('1');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(applied(p)).toEqual([{ ...PLAIN, unit_price: '40', quantity: '3' }]);
  });

  it('an unchanged quantity saves only the price', () => {
    const p = props([PLAIN]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    fireEvent.change(screen.getByLabelText('Price for this item (total) ($)'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(p.handleItemChange.mock.calls).toEqual([[0, 'unit_price', '45']]);
    expect(p.setItems).not.toHaveBeenCalled();
  });

  it('an invalid quantity (0, negative, text, comma, empty, 7 decimals) is refused with a message and nothing changes', () => {
    const p = props([PLAIN]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    for (const bad of ['0', '-2', 'abc', '2,5', '', '1.1234567', '100001']) {
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('alert').textContent, bad).toContain('valid quantity');
    }
    expect(p.handleItemChange).not.toHaveBeenCalled();
    expect(p.setItems).not.toHaveBeenCalled();
  });

  it('Hebrew: the link, the title and the save button', () => {
    const p = props([PLAIN], { isHebrew: true, sym: '₪', currency: 'ILS' });
    render(<QuoteForm {...p} />);
    expect(screen.getByTestId('item-edit-price').textContent).toBe('עריכת מחיר וכמות');
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByRole('heading', { name: 'עריכת מחיר וכמות' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('כמות'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(applied(p)).toEqual([{ ...PLAIN, unit_price: '40', quantity: '2.5' }]);
  });

  // test-qa review 2026-11-06: an untouched quantity box never rewrites the stored amount
  it('a count line carrying float noise (switched from m2) - a price-only save never rewrites the quantity', () => {
    const NOISY = { ...HOUR, pricing_unit: 'unit', calculated_quantity: 3.3000000000000003 };
    const p = props([NOISY]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByLabelText('Quantity').value).toBe('3.3');
    fireEvent.change(screen.getByLabelText('Price per unit ($)'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(p.handleItemChange.mock.calls).toEqual([[0, 'unit_price', '120']]);
    expect(p.setItems).not.toHaveBeenCalled();
  });

  it('a stored quantity of 0 does not block a price-only save', () => {
    const p = props([{ ...PLAIN, quantity: '0' }]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByLabelText('Quantity').value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(p.handleItemChange.mock.calls).toEqual([[0, 'unit_price', '40']]);
  });

  it('a unit-less item: quantity 1 is priced as its total, 3 is priced per unit (3 x 40 = 120), back to 1 is the total again', () => {
    render(<QuoteForm {...props([PLAIN])} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    expect(screen.getByLabelText('Price for this item (total) ($)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    expect(screen.getByLabelText('Price per unit ($)')).toBeTruthy();
    expect(screen.getByTestId('edit-price-total').textContent).toBe('Expected line total: $120.00');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } });
    expect(screen.getByLabelText('Price for this item (total) ($)')).toBeTruthy();
  });

  it('Enter in the quantity box saves; a kg line with calculated_quantity keeps the amount there', () => {
    const KG = { description: 'Cement', quantity: '1', unit_price: '10', isFromCatalog: false, section_key: null, pricing_unit: 'kg', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 2.5 };
    const p = props([KG]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByTestId('item-edit-price'));
    fireEvent.change(screen.getByLabelText('Quantity (kg)'), { target: { value: '4' } });
    fireEvent.keyDown(screen.getByLabelText('Quantity (kg)'), { key: 'Enter' });
    expect(applied(p)).toEqual([{ ...KG, unit_price: '10', calculated_quantity: 4 }]);
  });

  it('Hebrew quantity label with a unit, and the measured read-only line', () => {
    render(<QuoteForm {...props([HOUR, M2], { isHebrew: true, sym: '₪', currency: 'ILS' })} />);
    fireEvent.click(screen.getAllByTestId('item-edit-price')[0]);
    expect(screen.getByLabelText('כמות (שעה)').value).toBe('5');
    fireEvent.click(within(screen.getByTestId('edit-item-price')).getByRole('button', { name: 'ביטול' }));
    fireEvent.click(screen.getAllByTestId('item-edit-price')[1]);
    expect(screen.getByTestId('edit-price-qty').textContent).toBe('כמות: 36.00 מ״ר');
  });
});
