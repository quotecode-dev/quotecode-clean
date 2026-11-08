import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { answerAppDialog } from '../test/appDialog';
import QuoteForm from './QuoteForm';
import { APP } from '../theme/neonTheme';

// Owner Visual Review - Correction 4 ("compact saved-item card"): focused
// regression coverage for the NEW compact/expanded item card and its
// consolidated actions menu. This does not retest pre-existing business
// logic (duplicateItem/removeItem/handleItemChange themselves are already
// exercised elsewhere and untouched by this task) - it verifies the new UI
// wiring calls those exact existing functions correctly, and that the menu
// only ever exposes supported actions with Delete visually/structurally
// separated as the only destructive one.

const t = {
  clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone',
  currency: 'Currency', description: 'Description', discount: 'Discount',
  generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items',
  status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price',
  unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT',
};

function makeItem(overrides = {}) {
  return { description: '', quantity: '1', unit_price: '', isFromCatalog: false, section_key: null, ...overrides };
}

function baseProps(overrides = {}) {
  return {
    editingQuoteId: null,
    editingQuoteNumber: null,
    onSave: vi.fn((e) => e?.preventDefault?.()),
    onCancel: vi.fn(),
    clientName: '', setClientName: vi.fn(),
    clientEmail: '', setClientEmail: vi.fn(),
    clientPhone: '', setClientPhone: vi.fn(),
    clientType: 'business', setClientType: vi.fn(),
    clientTaxId: '', setClientTaxId: vi.fn(),
    clientAddress: '', setClientAddress: vi.fn(),
    quoteSubject: '', setQuoteSubject: vi.fn(),
    attnName: '', setAttnName: vi.fn(),
    attnRole: '', setAttnRole: vi.fn(),
    currency: 'ILS',
    quoteStatus: 'draft', setQuoteStatus: vi.fn(),
    validUntil: '', setValidUntil: vi.fn(),
    discount: 0, setDiscount: vi.fn(),
    terms: '', setTerms: vi.fn(),
    warranty: '', setWarranty: vi.fn(),
    notes: '', setNotes: vi.fn(),
    items: [makeItem({ description: 'Aluminum window', unit_price: '300' })],
    setItems: vi.fn(),
    sections: [],
    setSections: vi.fn(),
    addSection: vi.fn(),
    renameSection: vi.fn(),
    removeSection: vi.fn(),
    // חוק ברזל (Smart Quote Structure-First UX Correction task): ברירת-
    // מחדל 'regular' לכל הבדיקות הקיימות שכבר הניחו רשימה שטוחה גלויה-
    // מיד - זהה למה ש-Dashboard.jsx נותן בפועל להצעה קיימת (עריכה) בלי
    // sections אמיתיות (inferStructureModeFromQuote). בדיקות ל-null/
    // 'divided' עצמן מעבירות ערך מפורש, לא מסתמכות על ברירת-המחדל הזו.
    quoteStructureMode: 'regular', setQuoteStructureMode: vi.fn(),
    projectName: '', setProjectName: vi.fn(),
    services: [],
    clients: [],
    isHebrew: false,
    isLocalIsraeliBusiness: false,
    t,
    sym: '$',
    formatNum: (n) => Number(n || 0).toFixed(2),
    formatMoneyDisplay: (n) => Number(n || 0).toFixed(2),
    subtotal: 300, discountAmount: 0, taxAmount: 0, totalAmount: 300,
    removeItem: vi.fn(),
    handleItemChange: vi.fn(),
    canUseAttachments: true,
    canUseProfessionalQuotes: true,
    businessDefaultProfessionalUnit: null,
    duplicateItem: vi.fn(),
    canUseProfessionalQuoteReuse: true,
    handleProfessionalUnitChange: vi.fn(),
    addMeasurementRow: vi.fn(),
    removeMeasurementRow: vi.fn(),
    handleMeasurementChange: vi.fn(),
    toggleManualQuantityOverride: vi.fn(),
    handleManualQuantityChange: vi.fn(),
    toggleMeasurementPricingDriving: vi.fn(),
    addSpecificationRow: vi.fn(),
    handleSpecificationChange: vi.fn(),
    removeSpecificationRow: vi.fn(),
    onOpenPricingModal: vi.fn(),
    quoteFiles: [], setQuoteFiles: vi.fn(),
    allUserAttachments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Owner console 2026-11-08 (stage 2 of the one quote builder, typed: "מאשר השלמת שלב 2 של בונה ההצעה לפי התוכנית, כולל שינוי ב-L-09, L-14,
// L-15, L-17, L-23 ..."): every line is a row of the quote screen - the item cards, the item window's add flow, "add another item?" and the
// quick "Edit price" window are replaced by the row (design A). The row behaviour itself is in src/quoteRowsEditor20261108.test.jsx.
const rowOf = (name) => screen.getByDisplayValue(name).closest('.qrow-line');
describe('QuoteForm - every line is a row', () => {
  it('a line shows as an editable row with its own total (not a read-only card)', () => {
    render(<QuoteForm {...baseProps({ subtotal: 999, totalAmount: 999 })} />);
    const row = rowOf('Aluminum window');
    expect(row.querySelector('[data-testid^="qrow-total-"]').textContent).toBe('$300.00');
    expect(screen.queryByText('1 × $300.00')).toBeNull();
  });
  it('with no line at all the list offers "Add row", which adds a blank row', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({ items: [], setItems })} />);
    fireEvent.click(screen.getByTestId('qrow-add'));
    expect(setItems.mock.calls[0][0]([])).toEqual([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false, section_key: null }]);
  });
  it('details for the customer are open in the row when the line has them', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'Item', unit_price: '10', specification: [{ label: 'Color', value: 'Red' }] })] })} />);
    expect(screen.getByDisplayValue('Color')).toBeTruthy();
    expect(screen.getByDisplayValue('Red')).toBeTruthy();
  });
  it('no item window and no "add another item?" question open while adding rows', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByTestId('qrow-add'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('QuoteForm - units', () => {
  it('an empty-string unit name never silently vanishes - falls back to "(unnamed)" in the safe-removal dialog (superseded by the Unit Board in the Structure-First UX Correction task; same regression concern as the old per-item badge)', () => {
    // Regression: an empty-string section.name is falsy in JS - the fallback
    // must key off section presence, not the name string, or a freshly-
    // created (not-yet-renamed, non-empty) unit silently loses its label.
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      items: [makeItem({ description: 'Item', unit_price: '10', section_key: 'sec1' })],
      sections: [{ key: 'sec1', name: '' }],
    })} />);
    fireEvent.click(screen.getByTitle('Remove unit'));
    expect(screen.getByText('Remove (unnamed)')).toBeTruthy();
  });
});

// SMART-QUOTE-01..04 (2026-09-22, Owner-locked) SUPERSEDE the former "Structure-First selector" (Locked Decision 1): there is no
// compulsory structure decision any more; grouping is offered in context and remains fully available.
describe('QuoteForm - SMART-QUOTE child-simple first-use flow', () => {
  it('SMART-QUOTE-02: an undecided (null) structure shows the simple list with a row to type in immediately - no structure question', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [] })} />);
    // the rows' own "Add row", plus (Owner 2026-10-15) the price step's way back to step 2 while the quote has no item
    expect(screen.getByTestId('qrow-add')).toBeTruthy();
    expect(screen.getByTestId('sq-price-go-rows')).toBeTruthy();
    expect(screen.queryByText('How would you like to structure this quote?')).toBeNull();
    expect(screen.queryByText('Regular quote')).toBeNull();
    expect(screen.queryByText(/Smart Quote/)).toBeNull();
  });

  it('the four numbered steps appear in the first-use order: who -> what -> price -> review & save', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [] })} />);
    const order = ['sq-step-1', 'sq-step-2', 'sq-step-3', 'sq-step-4'].map((id) => screen.getByTestId(id));
    expect(order[0]).toHaveTextContent('Who is it for?');
    expect(order[1]).toHaveTextContent('What work or product?');
    expect(order[2]).toHaveTextContent('Price');
    expect(order[3]).toHaveTextContent('Review and save');
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('the untouched first line of a fresh quote is the empty row to type in - never an "(unnamed)" card', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }] })} />);
    expect(screen.queryByText('(unnamed)')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Item' }).value).toBe('');
  });

  it('SMART-QUOTE-02: grouping by rooms / areas / units stays available as an optional, contextual action', () => {
    const setQuoteStructureMode = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular', setQuoteStructureMode })} />);
    fireEvent.click(screen.getByText('Group by rooms / areas / units (optional)'));
    expect(setQuoteStructureMode).toHaveBeenCalledWith('divided');
  });

  it('SMART-QUOTE-03: a NEW quote offers no status choice - it is a Draft; Sent/Approved/Paid are edit-time lifecycle actions', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: null })} />);
    expect(screen.getByTestId('sq-status-draft')).toHaveTextContent('Draft');
    expect(screen.queryByRole('option', { name: 'Paid' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Approved' })).toBeNull();
  });

  it('SMART-QUOTE-03: editing a saved, finished quote keeps the lifecycle status control', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', editingQuoteNumber: 100701, quoteStatus: 'Draft' })} />);
    expect(screen.getByRole('option', { name: 'Sent' })).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'Paid' })).not.toBeDisabled();
  });

  it('SMART-QUOTE-01: an unfinished quote can only be saved as a clearly labelled unfinished draft', () => {
    render(<QuoteForm {...baseProps({ items: [], subtotal: 0, totalAmount: 0 })} />);
    expect(screen.getByTestId('sq-unfinished-notice')).toHaveTextContent('not finished yet');
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Save as unfinished draft');
  });

  it('SMART-QUOTE-01: an unfinished quote being edited cannot be moved to Sent / Approved / Paid', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', items: [], subtotal: 0, totalAmount: 0, quoteStatus: 'Draft' })} />);
    expect(screen.getByRole('option', { name: 'Sent' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Approved' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Paid' })).toBeDisabled();
  });

  it('a finished quote shows the normal save label and no unfinished notice', () => {
    render(<QuoteForm {...baseProps()} />);
    expect(screen.queryByTestId('sq-unfinished-notice')).toBeNull();
    // Retro ledger C03 (2026-10-05): a new quote keeps the base label t.generateSave; the unapproved hint line is gone
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Generate & Save');
    expect(screen.queryByTestId('sq-save-draft-hint')).toBeNull();
  });

  it('Task 16: an edit whose status is no longer Draft keeps the update label and no draft hint', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', quoteStatus: 'Sent' })} />);
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Update Quote');
    expect(screen.queryByTestId('sq-save-draft-hint')).toBeNull();
  });

  it('SMART-QUOTE-04: a name with no matching client discloses that a NEW client record will be created on save', () => {
    render(<QuoteForm {...baseProps({ clientName: 'Synthetic New Co', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    expect(screen.getByTestId('sq-client-disclosure')).toHaveTextContent('a new client record will be created');
  });

  it('SMART-QUOTE-04: a matching existing client (case-insensitive) discloses that its saved details will be updated', () => {
    render(<QuoteForm {...baseProps({ clientName: 'other co', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    expect(screen.getByTestId('sq-client-disclosure')).toHaveTextContent('Existing client');
  });

  it('SMART-QUOTE-04: an empty / whitespace-only client name makes NO client claim (nothing is disclosed that save will not do)', () => {
    const { unmount } = render(<QuoteForm {...baseProps({ clientName: '   ', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    expect(screen.queryByTestId('sq-client-disclosure')).toBeNull();
    unmount();
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪', clientName: '' })} />);
    expect(screen.queryByTestId('sq-client-disclosure')).toBeNull();
  });

  it('HE copy for the disclosure, the steps and the unfinished label is market-native', () => {
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪', clientName: 'לקוח סינתטי', items: [], subtotal: 0, totalAmount: 0 })} />);
    expect(screen.getByTestId('sq-client-disclosure')).toHaveTextContent('ייווצר כרטיס לקוח חדש');
    expect(screen.getByTestId('sq-save')).toHaveTextContent('שמירה כטיוטה לא גמורה');
    expect(screen.getByTestId('sq-step-1')).toHaveTextContent('למי ההצעה?');
  });

  it('optional details are progressive: collapsed on a fresh quote, open when any optional value exists', () => {
    const { unmount } = render(<QuoteForm {...baseProps()} />);
    expect(screen.queryByTestId('sq-more-details')).toBeNull();
    fireEvent.click(screen.getByTestId('sq-more-details-toggle'));
    expect(screen.getByTestId('sq-more-details')).toBeTruthy();
    unmount();
    render(<QuoteForm {...baseProps({ projectName: 'Synthetic Tower' })} />);
    expect(screen.getByTestId('sq-more-details')).toBeTruthy();
  });

  it('OD-1 issuer path: a past validity date shows how to fix it (extend) without changing it', () => {
    const setValidUntil = vi.fn();
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', validUntil: '2020-01-13', setValidUntil })} />);
    expect(screen.getByTestId('sq-validity-expired')).toBeTruthy();
    expect(setValidUntil).not.toHaveBeenCalled();
  });
});

describe('QuoteForm - Regular quote flow (Locked Decision 2)', () => {
  it('shows the rows with "Add row" and no unit-management UI at all', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular' })} />);
    expect(screen.getByTestId('qrow-add')).toBeTruthy();
    expect(screen.queryByText('How would you like to structure this quote?')).toBeNull();
    expect(screen.queryByText(/No items added yet/)).toBeNull();
  });
});

describe('QuoteForm - Task 21: the untouched placeholder is never a divided-mode item card', () => {
  it('a fresh divided quote shows no "(unnamed)" row and no "1 item" count, but keeps adding a row without a unit', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [], items: [makeItem()] })} />);
    expect(screen.queryByText('(unnamed)')).toBeNull();
    expect(screen.queryByText('1 item')).toBeNull();
    expect(screen.getByText('Add a row with no unit')).toBeTruthy();
    expect(screen.getByText('Add the first unit')).toBeTruthy();
  });
  it('once a real item exists it is counted; the untouched row stays a row to type in, never counted', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [], items: [makeItem(), makeItem({ description: 'Aluminium window', unit_price: '600' })] })} />);
    expect(screen.queryByText('(unnamed)')).toBeNull();
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByDisplayValue('Aluminium window')).toBeTruthy();
    // the untouched first row stays as the empty row to type in, but is not counted
    expect(screen.getAllByRole('textbox', { name: 'Item' }).map((el) => el.value)).toEqual(['', 'Aluminium window']);
  });
  it('with units and only the placeholder unassigned, no empty "Unassigned" card is shown', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], items: [makeItem()] })} />);
    expect(screen.queryByText('Add a row with no unit')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a row to Apartment 33' })).toBeTruthy();
  });
});

describe('QuoteForm - Divided quote unit board (Locked Decision 3/4/5/6/10)', () => {
  it('has no global "Add product or work" button - every add action belongs to a specific unit', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.queryByText('Add product or work')).toBeNull();
  });

  it('shows the unit\'s own real name in its "Add a row" button, item count, and offers "Add another unit"', () => {
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
    })} />);
    expect(screen.getByRole('button', { name: 'Add a row to Apartment 33' })).toBeTruthy();
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByText('Add another unit')).toBeTruthy();
  });

  it('an unnamed (freshly created) unit falls back to "this unit" in its "Add a row" button', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: '' }] })} />);
    expect(screen.getByRole('button', { name: 'Add a row to this unit' })).toBeTruthy();
  });

  it('an empty unit visibly shows "No items added yet" and still exposes its "Add a row" action - collapsed or not', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 35' }], items: [] })} />);
    expect(screen.getByText('No items added yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a row to Apartment 35' })).toBeTruthy();
  });

  it('offers "Add the first unit" when no unit exists yet, "Add another unit" once at least one does', () => {
    const { rerender } = render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [] })} />);
    expect(screen.getByText('Add the first unit')).toBeTruthy();
    rerender(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText('Add another unit')).toBeTruthy();
  });

  it('a unit\'s own "Add a row" adds a blank row already in that unit (no window, no re-selection)', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], setItems })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a row to Apartment 33' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const next = setItems.mock.calls[0][0]([]);
    expect(next).toEqual([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false, section_key: 'sec1' }]);
  });

  it('"Duplicate unit" adds one copy right after it, with new lines (no saved ids) and its own sizes, its name ready to edit', () => {
    const setItems = vi.fn();
    const setSections = vi.fn();
    const window1 = makeItem({ id: 'db1', description: 'Window', unit_price: '100', section_key: 'sec1', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area',
      calculated_quantity: 2, measurements: [{ id: 'm1', width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true }] });
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 30' }, { key: 'sec2', name: 'Apartment 40' }], items: [window1], setItems, setSections })} />);
    fireEvent.click(screen.getAllByTestId('unit-duplicate')[0]);
    // Owner console 2026-11-08 (stage 3 of the one quote builder, typed incl. L-09 / L-17 / L-24..L-28): the copy counts 1, and the source row and its copy share one price link
    const secs = setSections.mock.calls[0][0];
    expect(secs.map((s) => [s.name, s.sort_order, s.repeat_count])).toEqual([['Apartment 30', 0, 1], ['Apartment 30 - copy', 1, 1], ['Apartment 40', 2, undefined]]);
    const all = setItems.mock.calls[0][0];
    const copies = all.slice(1);
    expect(copies).toHaveLength(1);
    expect(all[0].price_link_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(copies[0].price_link_id).toBe(all[0].price_link_id);
    expect(all[0]).toMatchObject({ id: 'db1', unit_price: '100' });
    expect(copies[0].id).toBeUndefined();
    expect(copies[0].section_key).toBe(secs[1].key);
    expect(copies[0].measurements[0]).toEqual({ width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true });
    expect(copies[0].measurements).not.toBe(window1.measurements);
  });

  it('"Duplicate unit" of measured lines without the reuse entitlement shows the one capability notice and copies nothing', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', canUseProfessionalQuoteReuse: false, sections: [{ key: 'sec1', name: 'Apartment 30' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 2 })], setItems })} />);
    fireEvent.click(screen.getByTestId('unit-duplicate'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-capability', 'professional_quote.reuse');
    expect(setItems).not.toHaveBeenCalled();
  });

  it('existing items with no section_key appear in a visible "Unassigned" unit, never silently disappear (Decision 8, Regular->Divided)', () => {
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Legacy item', unit_price: '50' })],
    })} />);
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByDisplayValue('Legacy item')).toBeTruthy();
  });

  it('offers a "Switch to a regular quote" link', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText('Switch to a regular quote')).toBeTruthy();
  });

  // Owner console 2026-10-26 (typed approval naming L-09): the app's own question window, answered by its buttons
  it('"Switch to a regular quote" asks for confirmation, then flattens sections and clears every item\'s section_key (Decision 8, Divided->Regular)', async () => {
    const setItems = vi.fn();
    const setSections = vi.fn();
    const setQuoteStructureMode = vi.fn();
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
      setItems, setSections, setQuoteStructureMode,
    })} />);
    fireEvent.click(screen.getByText('Switch to a regular quote'));
    expect(await answerAppDialog(true)).toContain('Switching to a regular quote will merge all units into one list.');
    await waitFor(() => expect(setSections).toHaveBeenCalledWith([]));
    expect(setQuoteStructureMode).toHaveBeenCalledWith('regular');
    const updater = setItems.mock.calls[0][0];
    const result = updater([{ description: 'Window', section_key: 'sec1' }]);
    expect(result[0].section_key).toBeNull();
  });

  it('declining the confirmation leaves the divided structure untouched', async () => {
    const setSections = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], setSections })} />);
    fireEvent.click(screen.getByText('Switch to a regular quote'));
    await answerAppDialog(false);
    expect(setSections).not.toHaveBeenCalled();
  });
});

describe('QuoteForm - safe unit removal (Locked Decision 7 - no silent data loss)', () => {
  it('removes an empty unit immediately, with no confirmation dialog', () => {
    const removeSection = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 35' }], items: [], removeSection })} />);
    fireEvent.click(screen.getByTitle('Remove unit'));
    expect(removeSection).toHaveBeenCalledWith('sec1');
    expect(screen.queryByText(/This unit has/)).toBeNull();
  });

  it('a non-empty unit opens a safe choice dialog instead of removing directly - cancel leaves everything untouched', () => {
    const removeSection = vi.fn();
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
      removeSection,
    })} />);
    fireEvent.click(screen.getByTitle('Remove unit'));
    expect(screen.getByText(/This unit has 1 item\(s\)/)).toBeTruthy();
    expect(removeSection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/This unit has/)).toBeNull();
    expect(removeSection).not.toHaveBeenCalled();
  });

  it('confirming removal moves the unit\'s items (default: Unassigned) before removing the section - no item is ever deleted', () => {
    const removeSection = vi.fn();
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
      removeSection, setItems,
    })} />);
    fireEvent.click(screen.getByTitle('Remove unit'));
    fireEvent.click(screen.getByText('Remove unit'));
    const updater = setItems.mock.calls[0][0];
    const result = updater([{ description: 'Window', section_key: 'sec1' }]);
    expect(result[0].section_key).toBeNull();
    expect(removeSection).toHaveBeenCalledWith('sec1');
  });

  it('offers moving the unit\'s items to another existing unit instead of Unassigned', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }, { key: 'sec2', name: 'Apartment 34' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
      setItems,
    })} />);
    fireEvent.click(screen.getAllByTitle('Remove unit')[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Move items to' }), { target: { value: 'sec2' } });
    fireEvent.click(screen.getByText('Remove unit'));
    const updater = setItems.mock.calls[0][0];
    const result = updater([{ description: 'Window', section_key: 'sec1' }]);
    expect(result[0].section_key).toBe('sec2');
  });
});

describe('QuoteForm - the row menu', () => {
  it('opens from the three dots and shows the row actions; only "Remove row" is red', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A' }), makeItem({ description: 'B' })] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Details for the customer');
    expect(menu.textContent).toContain('Duplicate row');
    expect(menu.textContent).toContain('Move down');
    expect(menu.textContent).not.toContain('Move up');
    expect(menu.textContent).toContain('Remove row');
    const hex = APP.red.replace('#', '');
    const red = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
    const colors = screen.getAllByRole('menuitem').map((el) => ({ label: el.textContent, color: el.style.color }));
    expect(colors.find((c) => c.label === 'Remove row').color).toBe(red);
    colors.filter((c) => c.label !== 'Remove row').forEach((c) => expect(c.color).not.toBe(red));
  });

  it('duplicate inserts a copy right after the line, without its saved id', () => {
    const setItems = vi.fn();
    const a = makeItem({ id: 'db1', description: 'A', unit_price: '5' });
    const b = makeItem({ description: 'B' });
    render(<QuoteForm {...baseProps({ items: [a, b], setItems })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate row' }));
    const next = setItems.mock.calls[0][0]([a, b]);
    expect(next.map((x) => x.description)).toEqual(['A', 'A', 'B']);
    expect(next[1].id).toBeUndefined();
  });

  // Owner console 2026-11-08 (restore item 17 of docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md): as before stage 2, the only line of
  // the quote has no "Remove" (4f1592f2:src/components/QuoteForm.jsx 530-535 - shown only with more than one line)
  it('the only line of the quote has no Remove; with two lines Remove is there', () => {
    const setItems = vi.fn();
    const { unmount } = render(<QuoteForm {...baseProps({ setItems })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Remove row' })).toBeNull();
    unmount();
    render(<QuoteForm {...baseProps({ setItems, items: [makeItem({ description: 'A' }), makeItem({ description: 'B' })] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    expect(screen.getByRole('menuitem', { name: 'Remove row' })).toBeTruthy();
  });

  it('"Move to unit" sets the line\'s unit', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A' })], sections: [{ key: 'sec1', name: 'Kitchen' }], setItems })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.change(screen.getByRole('menu').querySelector('select'), { target: { value: 'sec1' } });
    expect(setItems.mock.calls[0][0]([makeItem({ description: 'A' })])[0].section_key).toBe('sec1');
  });

  it('"Move down" swaps the line with the next one (the saved order follows the list)', () => {
    const setItems = vi.fn();
    const a = makeItem({ description: 'A' }); const b = makeItem({ description: 'B' });
    render(<QuoteForm {...baseProps({ items: [a, b], setItems })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));
    expect(setItems.mock.calls[0][0]([a, b]).map((x) => x.description)).toEqual(['B', 'A']);
  });

  it('duplicate is locked (the one capability notice) for a measured line without the reuse entitlement', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'Measured item', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 5 })],
      canUseProfessionalQuoteReuse: false, setItems,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate row' }));
    const notice = screen.getByRole('dialog');
    expect(notice).toHaveAttribute('data-capability', 'professional_quote.reuse');
    expect(notice.textContent).not.toMatch(/PRO|Basic|BASIC|trial/);
    expect(setItems).not.toHaveBeenCalled();
  });

  it('Escape closes the menu and returns the focus to its three dots', () => {
    render(<QuoteForm {...baseProps()} />);
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('QuoteForm - Hebrew/RTL rows', () => {
  it('the row reads in Hebrew with the shekel total', () => {
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪', isLocalIsraeliBusiness: true })} />);
    expect(screen.getByTestId('quote-rows-editor').getAttribute('dir')).toBe('rtl');
    expect(rowOf('Aluminum window').querySelector('[data-testid^="qrow-total-"]').textContent).toBe('₪300.00');
    expect(screen.getByRole('button', { name: 'הוספת שורה' })).toBeTruthy();
  });
});

// Post-LIVE Wave 1 (First-LIVE findings): placeholders follow the form language (no English example in the Hebrew form,
// no Israeli example in the English form), and the icon-only attachment remove control has an accessible name.
describe('QuoteForm - market-correct placeholders and attachment remove accessibility', () => {
  const withFile = (isHebrew) => baseProps({
    isHebrew, sym: isHebrew ? '₪' : '$', currency: isHebrew ? 'ILS' : 'USD', isLocalIsraeliBusiness: isHebrew,
    quoteFiles: [{ id: 'att-1', file_name: 'plan.pdf', file_size: 1048576 }],
  });
  const placeholders = () => [...document.querySelectorAll('input[placeholder]')].map((el) => el.getAttribute('placeholder'));
  const HEBREW = /[֐-׿]/;

  it('Hebrew form: Hebrew client / attention / project examples, no English example', () => {
    render(<QuoteForm {...withFile(true)} />);
    fireEvent.click(screen.getByTestId('sq-client-contact-toggle')); // the attention contact is an optional detail (Owner round 1)
    const ph = placeholders();
    expect(ph).toContain('לדוגמה: כהן בנייה בע"מ');
    expect(ph).toContain('לדוגמה: שמעון לוי');
    expect(ph).toContain('לדוגמה: פרויקט חולון');
    expect(ph.filter((p) => /^e\.g\./.test(p))).toEqual([]);
  });

  it('English form: English examples only, no Israeli names and no Hebrew', () => {
    render(<QuoteForm {...withFile(false)} />);
    fireEvent.click(screen.getByTestId('sq-client-contact-toggle'));
    const ph = placeholders();
    expect(ph).toContain('e.g. Acme Corp');
    expect(ph).toContain('e.g. John Smith');
    expect(ph).toContain('e.g. Downtown Office Renovation');
    expect(ph.join(' ')).not.toMatch(/Holon|Simon Levy/);
    expect(ph.filter((p) => HEBREW.test(p))).toEqual([]);
  });

  it('the attachment remove button is named in the form language and still removes the file', () => {
    const props = withFile(false);
    const { unmount } = render(<QuoteForm {...props} />);
    const btn = screen.getByRole('button', { name: 'Remove attachment plan.pdf' });
    fireEvent.click(btn);
    expect(props.setQuoteFiles).toHaveBeenCalledTimes(1);
    unmount();
    render(<QuoteForm {...withFile(true)} />);
    expect(screen.getByRole('button', { name: 'הסרת הקובץ plan.pdf' })).toBeTruthy();
  });
});

// Owner 2026-10-23 (typed L-09, morning report item 5; IRON-DATE-001): the validity date in the editor follows the ACCOUNT MARKET, never the currency
describe('QuoteForm - the validity date order follows the account market', () => {
  const field = () => screen.getAllByRole('textbox').find((el) => /^\d{2}\/\d{2}\/\d{4}$/.test(el.value));
  it.each([
    ['an account abroad in euros', { isLocalIsraeliBusiness: false, currency: 'EUR' }, '11/05/2026'],
    ['an account abroad in pounds', { isLocalIsraeliBusiness: false, currency: 'GBP' }, '11/05/2026'],
    ['an account abroad in dollars', { isLocalIsraeliBusiness: false, currency: 'USD' }, '11/05/2026'],
    ['an Israeli account', { isLocalIsraeliBusiness: true, currency: 'ILS', isHebrew: true }, '05/11/2026'],
  ])('%s', (_label, props, shown) => {
    render(<QuoteForm {...baseProps({ ...props, validUntil: '2026-11-05' })} />);
    expect(field()?.value).toBe(shown);
  });
});

// Owner console 2026-11-08 (stage 3 of the one quote builder, typed incl. L-09 / L-17): the unit menu - identical unit count and
// "separate one copy" (with undo), on the real QuoteForm with live items / sections state
import { useState as useStateS3 } from 'react';
describe('QuoteForm - identical units (stage 3)', () => {
  const tiles = (o = {}) => makeItem({ id: 'db1', description: 'Tiles', unit_price: '100', quantity: '1', section_key: 'sec1', ...o });
  let state = null;
  function Live({ initialSections, initialItems }) {
    const [items, setItems] = useStateS3(initialItems);
    const [sections, setSections] = useStateS3(initialSections);
    state = { items, sections };
    return <QuoteForm {...baseProps({ quoteStructureMode: 'divided', items, setItems, sections, setSections })} />;
  }
  it('the count: a whole number 1..999 with one confirm; the header shows "× N", the per-copy line and the total of all copies', () => {
    render(<Live initialSections={[{ key: 'sec1', name: 'Type A', sort_order: 0 }]} initialItems={[tiles()]} />);
    fireEvent.click(screen.getByTestId('unit-menu'));
    fireEvent.click(screen.getByTestId('unit-repeat-open'));
    const input = screen.getByTestId('unit-repeat-input');
    for (const bad of ['0', '1000', '1.5', '']) {
      fireEvent.change(input, { target: { value: bad } });
      expect(screen.getByTestId('unit-repeat-confirm')).toBeDisabled();
    }
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('unit-repeat-confirm'));
    expect(state.sections[0].repeat_count).toBe(12);
    expect(screen.getByTestId('unit-repeat-badge').textContent).toBe('× 12');
    expect(screen.getByTestId('unit-total').textContent).toBe('$1200.00');
    expect(screen.getByTestId('unit-per-copy').textContent).toMatch(/\$100\.00 per unit × 12 = \$1200\.00/);
    expect(screen.getByTestId('unit-per-copy').textContent).toContain('The rows here are for one unit');
  });
  it('at 1 nothing new is shown (no badge, no per-copy line)', () => {
    render(<Live initialSections={[{ key: 'sec1', name: 'Type A', sort_order: 0 }]} initialItems={[tiles()]} />);
    expect(screen.queryByTestId('unit-repeat-badge')).toBeNull();
    expect(screen.queryByTestId('unit-per-copy')).toBeNull();
    fireEvent.click(screen.getByTestId('unit-menu'));
    expect(screen.queryByTestId('unit-separate')).toBeNull();
  });
  it('"separate one copy": the source counts one less, one linked copy right after it; no amount changes; undo restores all', () => {
    render(<Live initialSections={[{ key: 'sec1', name: 'Type A', sort_order: 0, repeat_count: 3 }, { key: 'sec2', name: 'Shop', sort_order: 1 }]} initialItems={[tiles()]} />);
    fireEvent.click(screen.getAllByTestId('unit-menu')[0]);
    fireEvent.click(screen.getByTestId('unit-separate'));
    expect(state.sections.map((s) => [s.name, s.repeat_count])).toEqual([['Type A', 2], ['Type A - copy', 1], ['Shop', undefined]]);
    expect(state.items).toHaveLength(2);
    expect(state.items[0]).toMatchObject({ id: 'db1', unit_price: '100', section_key: 'sec1' });
    expect(state.items[1].id).toBeUndefined();
    expect(state.items[1].section_key).toBe(state.sections[1].key);
    expect(state.items[1].price_link_id).toBe(state.items[0].price_link_id);
    fireEvent.click(screen.getByText('Undo'));
    expect(state.sections.map((s) => [s.name, s.repeat_count])).toEqual([['Type A', 3], ['Shop', undefined]]);
    expect(state.items).toEqual([tiles()]);
  });
});

// Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): the unit template entries in the editor
describe('QuoteForm - unit templates (stage 4)', () => {
  it('the unit menu saves THIS unit as a unit template; "from a saved unit" opens the unit templates', () => {
    const onSaveUnitTemplate = vi.fn();
    const onAddUnitFromTemplate = vi.fn();
    const sec = { key: 'sec1', name: 'Type A', sort_order: 0 };
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [sec], items: [makeItem({ description: 'Tiles', unit_price: '100', section_key: 'sec1' })], onSaveUnitTemplate, onAddUnitFromTemplate })} />);
    fireEvent.click(screen.getByTestId('unit-menu'));
    fireEvent.click(screen.getByTestId('unit-save-template'));
    expect(onSaveUnitTemplate).toHaveBeenCalledWith(sec);
    fireEvent.click(screen.getByTestId('unit-from-template'));
    expect(onAddUnitFromTemplate).toHaveBeenCalledTimes(1);
  });
  it('an empty or unnamed unit offers no "save as unit template"; no handler, no button', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: '', sort_order: 0 }], items: [], onSaveUnitTemplate: vi.fn() })} />);
    fireEvent.click(screen.getByTestId('unit-menu'));
    expect(screen.queryByTestId('unit-save-template')).toBeNull();
    expect(screen.queryByTestId('unit-from-template')).toBeNull();
  });
});
