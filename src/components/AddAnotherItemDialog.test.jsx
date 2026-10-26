// Owner 2026-10-18 (L-09 approval: "בחירה של כמה פריטים מהקטלוג בסימון וי והוספתם יחד להצעה"; flow: "האם תרצה להוסיף פריט נוסף?").
// Owner console 2026-10-26 (typed L-09 / L-15 / L-17 approval, docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md): after a NEW item the quote form
// still asks; "Yes" opens the item wizard, whose catalog is the same tick list with the shared check; the checked items are added in ONE
// update with the catalog hook; No / Escape add nothing; an EDIT never asks; Tab stays in the question.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AddAnotherItemDialog from './AddAnotherItemDialog';
import QuoteForm from './QuoteForm';

const SERVICES = [{ id: 1, name: 'Faucet replacement', price: 300 }, { id: 2, name: 'Door handle', price: 150 }, { id: 3, name: 'Cistern install', price: 450 }];

describe('AddAnotherItemDialog', () => {
  it('asks; Yes opens the item wizard (the catalog tick list lives there); nothing is added here', () => {
    const p = { isHebrew: false, onNewItem: vi.fn(), onClose: vi.fn() };
    render(<AddAnotherItemDialog {...p} />);
    expect(screen.getByRole('dialog').textContent).toContain('Would you like to add another item?');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('add-another-yes'));
    expect(p.onNewItem).toHaveBeenCalledTimes(1);
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('No and Escape close without adding', () => {
    const p = { isHebrew: false, onNewItem: vi.fn(), onClose: vi.fn() };
    render(<AddAnotherItemDialog {...p} />);
    fireEvent.click(screen.getByTestId('add-another-no'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalledTimes(2);
    expect(p.onNewItem).not.toHaveBeenCalled();
  });

  it('Hebrew: RTL, the Owner wording; Tab stays inside the question (Codex F-04)', () => {
    render(<AddAnotherItemDialog isHebrew onNewItem={vi.fn()} onClose={vi.fn()} />);
    const ask = screen.getByRole('dialog');
    expect(ask.getAttribute('dir')).toBe('rtl');
    expect(ask.textContent).toContain('להוסיף פריט נוסף?');
    const yes = screen.getByTestId('add-another-yes');
    const no = screen.getByTestId('add-another-no');
    expect(document.activeElement).toBe(yes);
    no.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(yes);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(no);
  });
});

// QuoteForm wiring: a new item through the wizard -> the question -> the wizard's tick list -> the shared check -> ONE setItems call
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
const setValue = (el, value) => fireEvent.change(el, { target: { value } });

describe('QuoteForm: add another item from the catalog', () => {
  const addFirstItem = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /Add product or work/ })[0]);
    setValue(document.getElementById('wiz-description'), 'Window screen');
    fireEvent.click(screen.getByText('One total price'));
    setValue(document.getElementById('wiz-fixed-amount'), '120');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
  };

  it('after a new item the question appears; Yes opens the wizard; two ticked items are checked together and appended in ONE update with the catalog hook', async () => {
    const onCatalogItemAdded = vi.fn();
    const p = formProps([], { onCatalogItemAdded });
    render(<QuoteForm {...p} />);
    addFirstItem();
    expect(p.setItems).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('add-another-yes'));
    expect(screen.getByText('Add product or work', { selector: 'h2, h3, [id], span, div' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: /Cistern install/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: /Door handle/ })); });
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('2 selected');
    fireEvent.click(screen.getByText('Continue to check (2)'));
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(p.setItems).toHaveBeenCalledTimes(2);
    const update = p.setItems.mock.calls[1][0];
    expect(typeof update).toBe('function');
    const existing = [{ description: 'Window screen', quantity: '1', unit_price: '120' }];
    expect(update(existing)).toEqual([
      ...existing,
      { description: 'Door handle', quantity: '1', unit_price: '150', isFromCatalog: true, section_key: null },
      { description: 'Cistern install', quantity: '1', unit_price: '450', isFromCatalog: true, section_key: null },
    ]);
    expect(onCatalogItemAdded.mock.calls.map((c) => c[0])).toEqual(['2', '3']);
    // a whole selection does not ask "add another item?" again
    expect(screen.queryByTestId('add-another-item')).toBeNull();
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
