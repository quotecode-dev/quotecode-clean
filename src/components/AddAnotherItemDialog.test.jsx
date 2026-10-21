// Owner 2026-10-18 (L-09 approval: "בחירה של כמה פריטים מהקטלוג בסימון וי והוספתם יחד להצעה"; flow: "האם תרצה להוסיף פריט נוסף?"
// -> Yes opens the catalog tick list). After a NEW item the quote form asks; Yes opens the tick list; every ticked catalog item is
// added with its catalog name + price and quantity 1 (one setItems call); No / Cancel / Escape add nothing; no catalog -> Yes opens
// the item wizard; an EDIT of an existing item never asks.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddAnotherItemDialog from './AddAnotherItemDialog';
import QuoteForm from './QuoteForm';

const SERVICES = [{ id: 1, name: 'Faucet replacement', price: 300 }, { id: 2, name: 'Door handle', price: 150 }, { id: 3, name: 'Cistern install', price: 450 }];
const dialogProps = (extra = {}) => ({ services: SERVICES, isHebrew: false, sym: '$', formatMoneyDisplay: (n) => Number(n).toFixed(2), onAddSelected: vi.fn(), onNewItem: vi.fn(), onClose: vi.fn(), ...extra });

describe('AddAnotherItemDialog', () => {
  it('asks first; Yes opens the catalog as a tick list with every item and its price; nothing is ticked', () => {
    render(<AddAnotherItemDialog {...dialogProps()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Would you like to add another item?');
    expect(screen.queryByTestId('catalog-multi-pick')).toBeNull();
    fireEvent.click(screen.getByTestId('add-another-yes'));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => !b.checked)).toBe(true);
    expect(screen.getByTestId('catalog-pick-1').textContent).toContain('$300.00');
    expect(screen.getByTestId('catalog-pick-add').disabled).toBe(true);
  });

  it('ticking two items adds exactly those two (in catalog order); unticking removes one; the button counts them', () => {
    const p = dialogProps();
    render(<AddAnotherItemDialog {...p} />);
    fireEvent.click(screen.getByTestId('add-another-yes'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cistern install/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Faucet replacement/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Door handle/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Door handle/ }));
    expect(screen.getByTestId('catalog-pick-add').textContent).toBe('Add 2 items to the quote');
    fireEvent.click(screen.getByTestId('catalog-pick-add'));
    expect(p.onAddSelected).toHaveBeenCalledTimes(1);
    expect(p.onAddSelected.mock.calls[0][0].map((s) => s.id)).toEqual([1, 3]);
  });

  it('No, Cancel, the X and Escape close without adding', () => {
    const p = dialogProps();
    const { unmount } = render(<AddAnotherItemDialog {...p} />);
    fireEvent.click(screen.getByTestId('add-another-no'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('add-another-yes'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Door handle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onClose).toHaveBeenCalledTimes(4);
    expect(p.onAddSelected).not.toHaveBeenCalled();
    unmount();
  });

  it('without a catalog Yes opens the item wizard; the tick list also offers a new item not in the catalog', () => {
    const p = dialogProps({ services: [] });
    const { unmount } = render(<AddAnotherItemDialog {...p} />);
    fireEvent.click(screen.getByTestId('add-another-yes'));
    expect(p.onNewItem).toHaveBeenCalledTimes(1);
    unmount();
    const q = dialogProps();
    render(<AddAnotherItemDialog {...q} />);
    fireEvent.click(screen.getByTestId('add-another-yes'));
    fireEvent.click(screen.getByTestId('catalog-pick-new-item'));
    expect(q.onNewItem).toHaveBeenCalledTimes(1);
  });

  it('Hebrew: RTL, the Owner wording, one item / several items wording, the price isolated LTR', () => {
    render(<AddAnotherItemDialog {...dialogProps({ isHebrew: true, sym: '₪' })} />);
    const ask = screen.getByRole('dialog');
    expect(ask.getAttribute('dir')).toBe('rtl');
    expect(ask.textContent).toContain('להוסיף פריט נוסף?');
    fireEvent.click(screen.getByTestId('add-another-yes'));
    expect(screen.getByTestId('catalog-pick-add').textContent).toBe('סמנו לפחות פריט אחד');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByTestId('catalog-pick-add').textContent).toBe('הוספת פריט אחד להצעה');
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(screen.getByTestId('catalog-pick-add').textContent).toBe('הוספת 2 פריטים להצעה');
    const price = screen.getByTestId('catalog-pick-1').querySelector('bdi');
    expect(price.getAttribute('dir')).toBe('ltr');
    expect(price.textContent).toBe('₪300.00');
  });
});

// QuoteForm wiring: a new item through the wizard -> the question -> ticked catalog items appended in ONE setItems call
const noop = () => {};
const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
const formProps = (items, extra = {}) => ({
  editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: '', setClientName: noop, clientEmail: '', setClientEmail: noop, clientPhone: '', setClientPhone: noop, clientType: 'business', setClientType: noop,
  clientTaxId: '', setClientTaxId: noop, clientAddress: '', setClientAddress: noop, quoteSubject: '', setQuoteSubject: noop, attnName: '', setAttnName: noop,
  attnRole: '', setAttnRole: noop, currency: 'USD', quoteStatus: 'draft', setQuoteStatus: noop, validUntil: '', setValidUntil: noop, discount: 0, setDiscount: noop,
  terms: '', setTerms: noop, warranty: '', setWarranty: noop, notes: '', setNotes: noop, items, setItems: vi.fn(), sections: [], setSections: noop,
  addSection: noop, renameSection: noop, removeSection: noop, quoteStructureMode: 'regular', setQuoteStructureMode: noop, isHebrew: false, t, sym: '$',
  formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2), handleItemChange: vi.fn(), duplicateItem: noop, removeItem: noop,
  projectName: '', setProjectName: noop, services: SERVICES, clients: [], isLocalIsraeliBusiness: false, subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0,
  canUseAttachments: true, canUseProfessionalQuotes: true, businessDefaultProfessionalUnit: null, canUseProfessionalQuoteReuse: true,
  handleProfessionalUnitChange: noop, addMeasurementRow: noop, removeMeasurementRow: noop, handleMeasurementChange: noop, toggleManualQuantityOverride: noop,
  handleManualQuantityChange: noop, toggleMeasurementPricingDriving: noop, addSpecificationRow: noop, handleSpecificationChange: noop, removeSpecificationRow: noop,
  onOpenPricingModal: noop, quoteFiles: [], setQuoteFiles: noop, allUserAttachments: [],
  ...extra,
});

describe('QuoteForm: add another item from the catalog', () => {
  const addFirstItem = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /Add product or work/ })[0]);
    fireEvent.click(screen.getByText('Faucet replacement'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
  };

  it('after a new item the question appears; ticked items are appended with catalog name, price, quantity 1 and the catalog hook', () => {
    const onCatalogItemAdded = vi.fn();
    const p = formProps([], { onCatalogItemAdded });
    render(<QuoteForm {...p} />);
    addFirstItem();
    expect(p.setItems).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('add-another-item')).toBeTruthy();
    fireEvent.click(screen.getByTestId('add-another-yes'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Door handle/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cistern install/ }));
    fireEvent.click(screen.getByTestId('catalog-pick-add'));
    expect(p.setItems).toHaveBeenCalledTimes(2);
    const update = p.setItems.mock.calls[1][0];
    expect(typeof update).toBe('function');
    const existing = [{ description: 'Faucet replacement', quantity: '1', unit_price: '300' }];
    expect(update(existing)).toEqual([
      ...existing,
      { description: 'Door handle', quantity: '1', unit_price: '150', isFromCatalog: true, section_key: null },
      { description: 'Cistern install', quantity: '1', unit_price: '450', isFromCatalog: true, section_key: null },
    ]);
    expect(onCatalogItemAdded.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(screen.queryByTestId('catalog-multi-pick')).toBeNull();
  });

  it('No closes the question and adds nothing more', () => {
    const p = formProps([]);
    render(<QuoteForm {...p} />);
    addFirstItem();
    fireEvent.click(screen.getByTestId('add-another-no'));
    expect(screen.queryByTestId('add-another-item')).toBeNull();
    expect(p.setItems).toHaveBeenCalledTimes(1);
  });

  it('editing an existing item never asks', () => {
    const p = formProps([{ description: 'Faucet replacement', quantity: '1', unit_price: '300', isFromCatalog: true, section_key: null }]);
    render(<QuoteForm {...p} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Edit$/ }));
    expect(screen.getByText('Edit product or work')).toBeTruthy();
    const toCheck = screen.queryByText('Continue to check');
    if (toCheck) fireEvent.click(toCheck);
    fireEvent.click(screen.getByText('Save changes'));
    expect(p.setItems).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('add-another-item')).toBeNull();
  });
});
