// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-09 ו-L-15 לתיקון חמשת הממצאים של המעבר האמיתי באשף הפריט, כולל מידות נוספות, מעבר
// ס״מ ומטרים ופרטים ללקוח במסך הבדיקה של הקטלוג, שאלה לפני יציאה מפריט לא גמור, ושאלת פריט נוסף אחרי כל הוספה"): the findings of the
// real walk on LIVE (two agents, both test accounts, four sizes) - each one proven here.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AddItemWizard from './AddItemWizard';
import QuoteForm from './QuoteForm';
import { answerAppDialog } from '../test/appDialog';

const SERVICES = [{ id: 1, name: 'AC installation', price: 400 }, { id: 2, name: 'Glass panel', price: 50 }, { id: 3, name: 'Copper pipe per meter', price: 30 }];
const props = (extra = {}) => ({ isOpen: true, onClose: vi.fn(), onAdd: vi.fn(), onAddMany: vi.fn(), editingItem: null, isHebrew: false, sym: '$',
  formatMoneyDisplay: (n) => Number(n).toFixed(2), services: SERVICES, sections: [], defaultSectionKey: null, canUseProfessionalQuotes: true,
  onRequestUpgrade: vi.fn(), recommendedMethod: 'area', ...extra });
const setValue = (el, value) => fireEvent.change(el, { target: { value } });
const tick = async (name) => { await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name })); }); };
const toCheck = async (names) => { for (const n of names) await tick(n); fireEvent.click(screen.getByText(`Continue to check (${names.length})`)); };

describe('finding 1: leaving an unfinished item asks first', () => {
  it('Escape (the phone / browser Back sends it) with a typed item asks; "Keep going" keeps everything', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await new Promise((r) => setTimeout(r, 20));
    setValue(document.getElementById('wiz-description'), 'Half typed job');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await answerAppDialog(false)).toBe('Leave without adding the item? What you typed or ticked will not be kept.');
    expect(p.onClose).not.toHaveBeenCalled();
    expect(document.getElementById('wiz-description').value).toBe('Half typed job');
  });
  it('ticked catalog items + the X: "Leave without adding" closes', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await new Promise((r) => setTimeout(r, 20));
    await tick(/AC installation/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]); // the X in the header
    await answerAppDialog(true);
    await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
  });
  it('nothing started: Cancel closes at once, no question', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancel$/ }).at(-1)); // the footer Cancel
    await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('app-dialog-confirm')).toBeNull();
  });
  it('an edited item: a change asks "Leave without saving the changes"; no change closes at once', async () => {
    const p = props({ editingItem: { description: 'Door', quantity: '1', unit_price: '100' } });
    const { unmount } = render(<AddItemWizard {...p} />);
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
    unmount();
    const q = props({ editingItem: { description: 'Door', quantity: '1', unit_price: '100' } });
    render(<AddItemWizard {...q} />);
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.click(screen.getByText('Change name'));
    setValue(document.getElementById('wiz-description'), 'Front door');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await answerAppDialog(false)).toBe('Leave without saving the changes to this item?');
    expect(q.onClose).not.toHaveBeenCalled();
  });
});

describe('finding 2: a catalog item has the same size tools as a typed item', () => {
  it('area in metres with a second size and a detail for the customer: the same shape as a typed item', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await toCheck([/Glass panel/]);
    fireEvent.change(document.getElementById('wiz-pick-0-method'), { target: { value: 'area' } });
    await answerAppDialog(true);
    await waitFor(() => expect(document.getElementById('wiz-pick-0-manualQty')).not.toBeNull());
    fireEvent.click(screen.getByText('Enter sizes'));
    fireEvent.click(screen.getByTestId('wiz-pick-0-unit-m'));
    setValue(document.getElementById('wiz-pick-0-width'), '2');
    setValue(document.getElementById('wiz-pick-0-height'), '1.5');
    fireEvent.click(screen.getByText('+ Add another size'));
    setValue(document.getElementById('wiz-pick-0-xw0'), '1');
    setValue(document.getElementById('wiz-pick-0-xh0'), '1');
    expect(screen.getByTestId('wiz-pick-total-0').textContent).toBe('Line total: $200.00');
    fireEvent.click(screen.getByText('Add details for the customer?'));
    setValue(screen.getAllByPlaceholderText('e.g. Colour')[0], 'Colour');
    setValue(screen.getAllByPlaceholderText('e.g. White')[0], 'Clear');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    const item = p.onAddMany.mock.calls[0][0][0];
    expect(item).toMatchObject({ description: 'Glass panel', unit_price: '50', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 4,
      specification: [{ label: 'Colour', value: 'Clear' }] });
    expect(item.measurements.map((m) => [m.width, m.height, m.calculated_area])).toEqual([[2, 1.5, 3], [1, 1, 1]]);
  });
  it('the cm / m switch converts what was typed (300 cm -> 3 m)', async () => {
    render(<AddItemWizard {...props()} />);
    await toCheck([/Copper pipe per meter/]);
    fireEvent.change(document.getElementById('wiz-pick-0-method'), { target: { value: 'linear' } });
    await answerAppDialog(true);
    await waitFor(() => expect(screen.getByText('Enter sizes')).toBeTruthy());
    fireEvent.click(screen.getByText('Enter sizes'));
    setValue(document.getElementById('wiz-pick-0-width'), '300');
    fireEvent.click(screen.getByTestId('wiz-pick-0-unit-m'));
    expect(document.getElementById('wiz-pick-0-width').value).toBe('3');
    expect(screen.getByTestId('wiz-pick-total-0').textContent).toBe('Line total: $90.00');
  });
  it('a started second size must be completed: named, focused, nothing added', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await toCheck([/Glass panel/]);
    fireEvent.change(document.getElementById('wiz-pick-0-method'), { target: { value: 'area' } });
    await answerAppDialog(true);
    await waitFor(() => expect(screen.getByText('Enter sizes')).toBeTruthy());
    fireEvent.click(screen.getByText('Enter sizes'));
    setValue(document.getElementById('wiz-pick-0-width'), '100');
    setValue(document.getElementById('wiz-pick-0-height'), '100');
    fireEvent.click(screen.getByText('+ Add another size'));
    setValue(document.getElementById('wiz-pick-0-xw0'), '50');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:Item 1: size 2');
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-pick-0-xh0'));
    expect(p.onAddMany).not.toHaveBeenCalled();
  });
});

describe('finding 3: the "Complete" line follows the fix at once', () => {
  it('a typed item: filling the missing field removes the line and the message; the next missing field takes its place', async () => {
    render(<AddItemWizard {...props()} />);
    fireEvent.click(screen.getByText('Continue to check'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:item name');
    setValue(document.getElementById('wiz-description'), 'Pipe');
    await waitFor(() => expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:pricing method'));
    expect(document.getElementById('wiz-description-error')).toBeNull();
    fireEvent.click(screen.getByText('One total price'));
    await waitFor(() => expect(screen.queryByTestId('wiz-blocked')).toBeNull());
  });
  it('the check screen: fixing the quantity clears the line', async () => {
    render(<AddItemWizard {...props()} />);
    await toCheck([/AC installation/]);
    setValue(document.getElementById('wiz-pick-0-quantity'), '0');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:Item 1: quantity');
    setValue(document.getElementById('wiz-pick-0-quantity'), '2');
    await waitFor(() => expect(screen.queryByTestId('wiz-blocked')).toBeNull());
  });
});

describe('finding 5: the small things', () => {
  it('removing an item on the check moves the focus to the item now in its place', async () => {
    render(<AddItemWizard {...props()} />);
    await toCheck([/AC installation/, /Glass panel/]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove AC installation from the selection' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-pick-0-description'));
  });
  it('the focused method card is visibly marked', async () => {
    render(<AddItemWizard {...props()} />);
    const card = document.getElementById('wiz-method-fixed');
    act(() => { card.focus(); });
    expect(card.style.outline).toContain('3px solid');
  });
  it('the hint while items are ticked is short (not cut on a phone)', async () => {
    render(<AddItemWizard {...props({ isHebrew: true, sym: '₪' })} />);
    await tick(/AC installation/);
    expect(document.getElementById('wiz-description').getAttribute('placeholder')).toBe('לכתיבת פריט אחר, הקלידו כאן');
  });
  it('a later change of the recommendation never wipes the ticked items', async () => {
    const p = props();
    const { rerender } = render(<AddItemWizard {...p} />);
    await tick(/AC installation/);
    rerender(<AddItemWizard {...p} recommendedMethod="linear" />);
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('1 selected');
  });
});

describe('finding 5: a new unit opens with the cursor in its name', () => {
  it('"Add the first unit" focuses the new unit name', async () => {
    let sections = [];
    const noop = () => {};
    const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
    const make = () => ({ editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn(), onCancel: vi.fn(), clientName: '', setClientName: noop, clientEmail: '', setClientEmail: noop,
      clientPhone: '', setClientPhone: noop, clientType: 'business', setClientType: noop, clientTaxId: '', setClientTaxId: noop, clientAddress: '', setClientAddress: noop,
      quoteSubject: '', setQuoteSubject: noop, attnName: '', setAttnName: noop, attnRole: '', setAttnRole: noop, currency: 'USD', quoteStatus: 'draft', setQuoteStatus: noop,
      validUntil: '', setValidUntil: noop, discount: 0, setDiscount: noop, terms: '', setTerms: noop, warranty: '', setWarranty: noop, notes: '', setNotes: noop, items: [],
      setItems: vi.fn(), sections, setSections: noop, addSection: () => { sections = [...sections, { key: 'tmp_section_new', name: '', sort_order: 0 }]; return 'tmp_section_new'; },
      renameSection: noop, removeSection: noop, quoteStructureMode: 'divided', setQuoteStructureMode: noop, isHebrew: false, t, sym: '$',
      formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2), handleItemChange: vi.fn(), duplicateItem: noop, removeItem: noop,
      projectName: '', setProjectName: noop, services: SERVICES, clients: [], isLocalIsraeliBusiness: false, subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0,
      canUseAttachments: true, canUseProfessionalQuotes: true, businessDefaultProfessionalUnit: null, canUseProfessionalQuoteReuse: true, handleProfessionalUnitChange: noop,
      addMeasurementRow: noop, removeMeasurementRow: noop, handleMeasurementChange: noop, toggleManualQuantityOverride: noop, handleManualQuantityChange: noop,
      toggleMeasurementPricingDriving: noop, addSpecificationRow: noop, handleSpecificationChange: noop, removeSpecificationRow: noop, onOpenPricingModal: noop,
      quoteFiles: [], setQuoteFiles: noop, allUserAttachments: [] });
    const { rerender } = render(<QuoteForm {...make()} />);
    fireEvent.click(screen.getByText('Add the first unit'));
    rerender(<QuoteForm {...make()} />);
    await waitFor(() => expect(document.activeElement?.getAttribute('placeholder')).toBe('e.g. Apartment 33, Bedroom, Building A'));
  });
});

// Owner 2026-10-26, the second real walk on LIVE
describe('second walk: Back keeps asking; a restored item asks too', () => {
  it('the phone Back on the wizard: the question each time - a second Back never skips to the editor', async () => {
    const { closeTopDialogWithEscape } = await import('../hooks/useInAppBack');
    render(<AddItemWizard {...props()} />);
    await new Promise((r) => setTimeout(r, 20));
    setValue(document.getElementById('wiz-description'), 'Half typed job');
    const memo = { el: null };
    screen.getByRole('dialog').getClientRects = () => [{}]; // jsdom has no layout: the wizard is the visible top window
    expect(closeTopDialogWithEscape(memo)).toBe(true); // Back 1: the wizard takes it and asks
    await answerAppDialog(false);
    expect(memo.el).toBeNull();
    expect(closeTopDialogWithEscape(memo)).toBe(true); // Back 2: asked again, not passed to the editor
    expect(await answerAppDialog(false)).toBe('Leave without adding the item? What you typed or ticked will not be kept.');
  });
  it('an unfinished item restored after a reload asks before Escape closes it', async () => {
    const p = props({ resumeState: { stepModel: 2, step: 1, description: 'Reload test', pricingMethod: 'units', quantity: '4', unitPrice: '15', picks: [] } });
    render(<AddItemWizard {...p} />);
    await waitFor(() => expect(document.getElementById('wiz-description').value).toBe('Reload test'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await answerAppDialog(false)).toBe('Leave without adding the item? What you typed or ticked will not be kept.');
    expect(p.onClose).not.toHaveBeenCalled();
  });
});
