import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import QuoteForm from './QuoteForm';
import { useState as useStateLive } from 'react';

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

// 2026-11-13 (Owner: the manual quote of the 13/11 spec / demo, typed "מאשר שינוי ב-L-05, L-08, L-09, L-13, L-15, L-16, L-17, L-19, L-23,
// L-24, L-25, L-26, L-27, L-28, L-29 לביצוע האפיון מ-13/11 בשחרור אחד"): the work area is the heading tree of the demo - three structure
// buttons, a full add form under every heading, read rows with ONE actions menu, the summary in a bar at the bottom. The editor itself is
// covered in src/components/quoteTree/*.test.*; these tests are the QuoteForm wiring and every behaviour kept from before.
const openSummary = () => { if (!screen.queryByTestId('qt-summary-panel')) fireEvent.click(screen.getByTestId('qt-summary-toggle')); };
// 2026-11-15 (the demo): a section of the quote details opens as its own page
const openPage = (k) => fireEvent.click(screen.getByTestId(`sq-extra-${k}`));
const rowNamed = (name) => screen.getAllByTestId('qt-row').find((r) => r.querySelector('.qt-desc')?.textContent.startsWith(name));
function LiveForm({ initialSections = [], initialItems = [], extra = {} }) {
  const [items, setItems] = useStateLive(initialItems);
  const [sections, setSections] = useStateLive(initialSections);
  liveState = { items, sections };
  return <QuoteForm {...baseProps({ quoteStructureMode: initialSections.length ? 'divided' : 'regular', items, setItems, sections, setSections, ...extra })} />;
}
let liveState = null;

describe('QuoteForm - every line is a read row of the new work area', () => {
  it('a line shows as a read row with its own total (edited only through "Actions" -> "Edit")', () => {
    render(<QuoteForm {...baseProps({ subtotal: 999, totalAmount: 999 })} />);
    const row = rowNamed('Aluminum window');
    expect(row.querySelector('.qt-sum').textContent).toBe('$300.00');
    expect(screen.queryByDisplayValue('Aluminum window')).toBeNull();
  });
  it('with no line at all the add form is open at the whole-quote level, with the local example offered', () => {
    render(<QuoteForm {...baseProps({ items: [] })} />);
    const form = screen.getAllByTestId('qt-form')[0];
    expect(form.getAttribute('data-target')).toBe('root');
    expect(screen.getAllByTestId('qt-form-to')[0].textContent).toBe('To: Whole quote');
    expect(screen.getByTestId('quote-show-example')).toHaveTextContent('Show an example (not saved)');
    expect(screen.queryAllByTestId('qt-row')).toHaveLength(0);
  });
  it('details for the customer show under the line', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'Item', unit_price: '10', specification: [{ label: 'Color', value: 'Red' }] })] })} />);
    expect(rowNamed('Item').textContent).toContain('Color: Red');
  });
  it('no window is open when the work area opens', () => {
    render(<QuoteForm {...baseProps()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('the untouched starter line of a new quote is never shown as a row', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [makeItem()] })} />);
    expect(screen.queryAllByTestId('qt-row')).toHaveLength(0);
    expect(screen.queryByText('(unnamed)')).toBeNull();
  });
});

// SMART-QUOTE-01..04 (2026-09-22, Owner-locked) SUPERSEDE the former "Structure-First selector" (Locked Decision 1); since 13/11 the three
// structure buttons of the demo are shown directly - choosing one never removes anything.
describe('QuoteForm - SMART-QUOTE child-simple first-use flow', () => {
  it('SMART-QUOTE-02: an undecided (null) structure opens as a simple quote with the add form ready - no structure question', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [] })} />);
    expect(screen.getByTestId('qt-structure-simple')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('qt-form')).toHaveLength(1);
    expect(screen.queryByText('How would you like to structure this quote?')).toBeNull();
    expect(screen.queryByText(/Smart Quote/)).toBeNull();
  });

  it('the order of the screen: who -> what, then the demo\'s "More quote details" line and the bar', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [] })} />);
    const [s1, s2] = ['sq-step-1', 'sq-step-2'].map((id) => screen.getByTestId(id));
    expect(s1).toHaveTextContent('Who is this quote for?');
    expect(s2).toHaveTextContent('What goes in the quote?');
    const details = screen.getByTestId('sq-more-details-toggle');
    expect(details).toHaveTextContent('More quote details (optional)');
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s2.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(details.compareDocumentPosition(screen.getByTestId('qt-bar')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('SMART-QUOTE-02: dividing into apartments stays available - "By apartments", then kind, how many, names', () => {
    const setQuoteStructureMode = vi.fn();
    const setSections = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular', setQuoteStructureMode, setSections })} />);
    fireEvent.click(screen.getByTestId('qt-structure-grouped'));
    fireEvent.click(screen.getByTestId('qt-add-first'));
    fireEvent.click(screen.getByTestId('qt-kind-apartment'));
    fireEvent.change(screen.getByTestId('qt-count'), { target: { value: '2' } });
    fireEvent.click(within(screen.getByTestId('qt-wizard')).getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByTestId('qt-name-0'), { target: { value: 'Apartment 32' } });
    fireEvent.change(screen.getByTestId('qt-name-1'), { target: { value: 'Apartment 33' } });
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    const next = setSections.mock.calls[0][0];
    expect(next.map((x) => [x.name, x.kind, x.parent_key ?? null])).toEqual([['Apartment 32', 'apartment', null], ['Apartment 33', 'apartment', null]]);
    expect(setQuoteStructureMode).toHaveBeenCalledWith('divided');
  });

  it('SMART-QUOTE-03: a NEW quote offers no status choice - it is a Draft; Sent/Approved/Paid are edit-time lifecycle actions', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: null })} />);
    expect(screen.queryByTestId('sq-extra-status')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Paid' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Approved' })).toBeNull();
  });

  it('SMART-QUOTE-03: editing a saved, finished quote keeps the lifecycle status control', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', editingQuoteNumber: 100701, quoteStatus: 'Draft' })} />);
    openPage('status');
    expect(screen.getByRole('option', { name: 'Sent' })).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'Paid' })).not.toBeDisabled();
  });

  it('SMART-QUOTE-01: an unfinished quote can only be saved as a clearly labelled unfinished draft (the label is on the save in the bar)', () => {
    render(<QuoteForm {...baseProps({ items: [], subtotal: 0, totalAmount: 0 })} />);
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Save as unfinished draft');
    expect(screen.getByTestId('qt-bar-total-label')).toHaveTextContent('Partial total'); // the demo's "סכום חלקי"
  });

  it('SMART-QUOTE-01: an unfinished quote being edited cannot be moved to Sent / Approved / Paid', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', items: [], subtotal: 0, totalAmount: 0, quoteStatus: 'Draft' })} />);
    openPage('status');
    expect(screen.getByRole('option', { name: 'Sent' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Approved' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Paid' })).toBeDisabled();
  });

  it('a finished quote shows the normal save label and no unfinished notice', () => {
    render(<QuoteForm {...baseProps()} />);
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Save the quote');
    expect(screen.getByTestId('qt-bar-total-label')).toHaveTextContent('Total to pay');
    expect(screen.queryByTestId('sq-save-draft-hint')).toBeNull();
  });

  // Owner 2026-11-13 (typed: "למה שלא יופיע עכשיו כפתור "עדכון ההצעה" במקום שמירת ההצעה"): a saved quote is updated, a new one saved
  it('Task 16: an edit whose status is no longer Draft keeps the update label and no draft hint', () => {
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', quoteStatus: 'Sent' })} />);
    expect(screen.getByTestId('sq-save')).toHaveTextContent('Update the quote');
    expect(screen.queryByTestId('sq-save-draft-hint')).toBeNull();
  });

  // Owner 2026-11-13 (answer 3 "א", the demo's "שמירת הלקוח והמשך"): a NEW client is saved to the list from the client step; the button says so
  it('SMART-QUOTE-04: a new client is saved by "Save the client and continue" (the button discloses it); a chosen client is not saved twice', async () => {
    const onSaveClientNow = vi.fn(async () => true); const onFlowStep = vi.fn();
    const { unmount } = render(<QuoteForm {...baseProps({ flowStep: 'client', items: [], onFlowStep, onSaveClientNow, clientName: 'Synthetic New Co', clientType: 'private', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    expect(screen.queryByTestId('sq-client-disclosure')).toBeNull();
    fireEvent.click(screen.getByTestId('sq-client-continue'));
    await waitFor(() => expect(onFlowStep).toHaveBeenCalledWith('editor'));
    expect(screen.getByTestId('sq-client-continue')).toHaveTextContent('Save the client and continue');
    expect(onSaveClientNow).toHaveBeenCalledTimes(1);
    expect(onSaveClientNow.mock.calls[0][0]).toMatchObject({ company_name: 'Synthetic New Co', client_type: 'private' });
    unmount();
    onSaveClientNow.mockClear(); onFlowStep.mockClear();
    render(<QuoteForm {...baseProps({ flowStep: 'client', onFlowStep, onSaveClientNow, clientName: 'other co', clientType: 'private', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    fireEvent.click(screen.getByTestId('sq-client-continue'));
    await waitFor(() => expect(onFlowStep).toHaveBeenCalledWith('editor'));
    expect(onSaveClientNow).not.toHaveBeenCalled();
  });

  it('the demo\'s client step words: an existing client "Continue"; back from the quote "...back to the quote"', () => {
    const { unmount } = render(<QuoteForm {...baseProps({ flowStep: 'client', items: [], clientName: 'other co', clients: [{ id: 'c1', company_name: 'Other Co' }] })} />);
    expect(screen.getByTestId('sq-client-continue')).toHaveTextContent('Continue');
    expect(screen.queryByTestId('sq-client-disclosure')).toBeNull();
    unmount();
    render(<QuoteForm {...baseProps({ flowStep: 'client', clientName: 'New Co', clients: [] })} />);
    expect(screen.getByTestId('sq-client-continue')).toHaveTextContent('Save the client and back to the quote');
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
    // 2026-11-13: a new client is no longer announced in a note - the button "שמירת הלקוח והמשך" saves it
    expect(screen.queryByTestId('sq-client-disclosure')).toBeNull();
    expect(screen.getByTestId('sq-save')).toHaveTextContent('שמירה כטיוטה לא גמורה');
    expect(screen.getByTestId('sq-step-1')).toHaveTextContent('למי מכינים את ההצעה?');
  });

  it('optional details are progressive: collapsed on a fresh quote, open when any optional value exists', () => {
    const { unmount } = render(<QuoteForm {...baseProps()} />);
    expect(screen.getByTestId('sq-details').open).toBe(false);
    unmount();
    render(<QuoteForm {...baseProps({ projectName: 'Synthetic Tower' })} />);
    expect(screen.getByTestId('sq-details').open).toBe(true);
  });

  it('OD-1 issuer path: a past validity date shows how to fix it (extend) without changing it', () => {
    const setValidUntil = vi.fn();
    render(<QuoteForm {...baseProps({ editingQuoteId: 'q1', validUntil: '2020-01-13', setValidUntil })} />);
    openPage('project');
    expect(screen.getByTestId('sq-validity-expired')).toBeTruthy();
    expect(setValidUntil).not.toHaveBeenCalled();
  });
});

describe('QuoteForm - headings (apartments, floors, rooms) and their content', () => {
  it('a simple quote shows the add form and no heading UI at all', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular' })} />);
    expect(screen.getAllByTestId('qt-form')).toHaveLength(1);
    expect(screen.queryAllByTestId('qt-heading')).toHaveLength(0);
    expect(screen.queryByTestId('qt-nav-whole')).toBeNull();
  });

  it('a heading shows its name, its total and its own add form ("To: <heading>"); its rows sit under it', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33', kind: 'apartment' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })] })} />);
    const heading = screen.getByTestId('qt-heading');
    expect(heading.querySelector('.qt-head-name').textContent).toBe('Apartment 33');
    expect(heading.querySelector('.qt-head-total').textContent).toBe('$100.00');
    expect(within(heading).getByTestId('qt-form-to').textContent).toBe('To: Apartment 33');
    expect(within(heading).getAllByTestId('qt-row')).toHaveLength(1);
    expect(screen.getByTestId('qt-add-same')).toHaveTextContent('+ Add an apartment');
  });

  it('rows of no heading stay at the whole-quote level - never hidden', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], items: [makeItem({ description: 'Legacy item', unit_price: '50' })] })} />);
    expect(within(screen.getByTestId('qt-heading')).queryAllByTestId('qt-row')).toHaveLength(0);
    expect(rowNamed('Legacy item')).toBeTruthy();
  });

  it('a heading can hold headings ("Floors, apartments and rooms"): the room sits inside the apartment, the total counts both', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided',
      sections: [{ key: 'a', name: 'Apartment 22', kind: 'apartment', sort_order: 0 }, { key: 'k', name: 'Kitchen', kind: 'room', parent_key: 'a', sort_order: 1 }],
      items: [makeItem({ description: 'Paint', unit_price: '40', section_key: 'a' }), makeItem({ description: 'Tiles', unit_price: '60', section_key: 'k' })] })} />);
    expect(screen.getByTestId('qt-structure-tiered')).toHaveAttribute('aria-pressed', 'true');
    const [apt, kitchen] = screen.getAllByTestId('qt-heading');
    expect(apt.contains(kitchen)).toBe(true);
    expect(kitchen.getAttribute('data-depth')).toBe('1');
    expect(apt.querySelector('.qt-head-total').textContent).toBe('$100.00');
    expect(within(kitchen).getByTestId('qt-form-to').textContent).toBe('To: Apartment 22 → Kitchen');
  });

  it('"Duplicate" copies the heading with everything in it right after it - new keys, no saved ids, each row price-linked to its copy (stage 3)', () => {
    render(<LiveForm initialSections={[{ key: 'sec1', name: 'Apartment 30', sort_order: 0 }, { key: 'sec2', name: 'Apartment 40', sort_order: 1 }]}
      initialItems={[makeItem({ id: 'db1', description: 'Window', unit_price: '100', section_key: 'sec1', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area',
        calculated_quantity: 2, measurements: [{ id: 'm1', width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true }] })]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[0]);
    fireEvent.click(screen.getByTestId('qt-head-duplicate'));
    expect(liveState.sections.map((s) => [s.name, s.sort_order])).toEqual([['Apartment 30', 0], ['Apartment 30 - copy', 1], ['Apartment 40', 2]]);
    const [src, copy] = liveState.items;
    expect(src).toMatchObject({ id: 'db1', unit_price: '100' });
    expect(src.price_link_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(copy.price_link_id).toBe(src.price_link_id);
    expect(copy.id).toBeUndefined();
    expect(copy.section_key).toBe(liveState.sections[1].key);
    expect(copy.measurements[0]).toEqual({ width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true });
  });

  it('"Duplicate" of a heading with measured lines without the reuse entitlement shows the one capability notice and copies nothing', () => {
    const setItems = vi.fn(); const setSections = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', canUseProfessionalQuoteReuse: false, sections: [{ key: 'sec1', name: 'Apartment 30' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 2 })], setItems, setSections })} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    fireEvent.click(screen.getByTestId('qt-head-duplicate'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-capability', 'professional_quote.reuse');
    expect(setItems).not.toHaveBeenCalled();
    expect(setSections).not.toHaveBeenCalled();
  });

  // 2026-11-13 (the 13/11 demo "מחיקת דירה עם התוכן", approved in the plan): the heading goes with everything under it - and undo restores it exactly
  it('"Delete with its content" removes the heading, its sub-headings and their rows, and can be undone exactly', () => {
    render(<LiveForm initialSections={[{ key: 'a', name: 'Apartment 33', kind: 'apartment', sort_order: 0 }, { key: 'k', name: 'Kitchen', parent_key: 'a', sort_order: 1 }, { key: 'b', name: 'Apartment 34', kind: 'apartment', sort_order: 2 }]}
      initialItems={[makeItem({ description: 'Window', unit_price: '100', section_key: 'a' }), makeItem({ description: 'Tiles', unit_price: '10', section_key: 'k' }), makeItem({ description: 'Door', unit_price: '5', section_key: 'b' })]} />);
    const before = liveState;
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[0]);
    expect(screen.getByTestId('qt-head-delete')).toHaveTextContent('Delete the apartment with its content');
    fireEvent.click(screen.getByTestId('qt-head-delete'));
    expect(liveState.sections.map((s) => s.name)).toEqual(['Apartment 34']);
    expect(liveState.items.map((it) => [it.description, it.section_key])).toEqual([['Door', 'b']]);
    expect(screen.getByTestId('qt-undo')).toHaveTextContent('The place was removed with its content. You can undo it.');
    fireEvent.click(within(screen.getByTestId('qt-undo')).getByRole('button', { name: 'Undo the last action' }));
    expect(liveState.sections).toEqual(before.sections);
    expect(liveState.items).toEqual(before.items);
  });

  it('choosing "Simple quote" never removes a heading or a row', () => {
    const setSections = vi.fn(); const setItems = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })], setSections, setItems })} />);
    fireEvent.click(screen.getByTestId('qt-structure-simple'));
    expect(setSections).not.toHaveBeenCalled();
    expect(setItems).not.toHaveBeenCalled();
    // the demo: the simple structure lists every row in one table (headings are kept, not shown)
    expect(screen.queryAllByTestId('qt-heading')).toHaveLength(0);
    expect(screen.getAllByTestId('qt-row').map((r) => r.querySelector('.qt-row-name').textContent)).toEqual(['Window']);
  });
});

describe('QuoteForm - the row menu', () => {
  const red = 'rgb(185, 28, 28)';
  it('"Actions" opens the row actions; only "Remove" is red', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A', unit_price: '1' }), makeItem({ description: 'B', unit_price: '1' })] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    const labels = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(labels).toEqual(['Edit', 'Duplicate', 'Remove']); // the demo: no up / down / move
    const colors = screen.getAllByRole('menuitem').map((el) => ({ label: el.textContent, color: el.style.color }));
    expect(colors.find((c) => c.label === 'Remove').color).toBe(red);
    colors.filter((c) => c.label !== 'Remove').forEach((c) => expect(c.color).not.toBe(red));
  });

  it('duplicate adds a copy at the end of its place (the demo), without its saved id', () => {
    const setItems = vi.fn();
    const a = makeItem({ id: 'db1', description: 'A', unit_price: '5' });
    const b = makeItem({ description: 'B', unit_price: '1' });
    render(<QuoteForm {...baseProps({ items: [a, b], setItems })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const next = setItems.mock.calls[0][0]([a, b]);
    expect(next.map((x) => x.description)).toEqual(['A', 'B', 'A']);
    expect(next[2].id).toBeUndefined();
  });

  // Owner console 2026-11-08 (restore item 17): the only line of the quote has no "Remove"
  it('the only line of the quote has no Remove; with two lines Remove is there', () => {
    const { unmount } = render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
    unmount();
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A', unit_price: '1' }), makeItem({ description: 'B', unit_price: '1' })] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeTruthy();
  });

  it('the row menu has no move / up / down (the demo: Edit, Duplicate, Remove)', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', items: [makeItem({ description: 'A', unit_price: '1' }), makeItem({ description: 'B', unit_price: '1' })], sections: [{ key: 'sec1', name: 'Kitchen' }] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    expect(screen.queryByRole('menuitem', { name: /Move to|Down|Up/ })).toBeNull();
  });

  it('duplicate is locked (the one capability notice) for a measured line without the reuse entitlement', () => {
    const setItems = vi.fn();
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'Measured item', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 5 })],
      canUseProfessionalQuoteReuse: false, setItems,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const notice = screen.getByRole('dialog');
    expect(notice).toHaveAttribute('data-capability', 'professional_quote.reuse');
    expect(notice.textContent).not.toMatch(/PRO|Basic|BASIC|trial/);
    expect(setItems).not.toHaveBeenCalled();
  });

  it('Escape closes the menu and returns the focus to its button', () => {
    render(<QuoteForm {...baseProps()} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('"Edit" opens the same row editor in place; "Cancel" returns the row exactly as it was', () => {
    render(<LiveForm initialItems={[makeItem({ description: 'Aluminum window', unit_price: '300' })]} />);
    const before = liveState.items[0];
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByDisplayValue('Aluminum window')).toBeTruthy();
    fireEvent.click(screen.getByTestId('qt-edit-cancel'));
    expect(liveState.items[0]).toBe(before);
    expect(screen.queryByDisplayValue('Aluminum window')).toBeNull();
  });
});

describe('QuoteForm - Hebrew/RTL rows', () => {
  it('the work area reads in Hebrew with the shekel total', () => {
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪', isLocalIsraeliBusiness: true })} />);
    expect(screen.getByTestId('qt-editor').getAttribute('dir')).toBe('rtl');
    expect(rowNamed('Aluminum window').querySelector('.qt-sum').textContent).toBe('₪300.00');
    expect(screen.getByRole('button', { name: 'הוספה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'פעולות' })).toBeTruthy();
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
    expect(ph).toContain('הקלידו את שם הלקוח'); // the demo's placeholder
    expect(ph).toContain('לדוגמה: שמעון לוי');
    expect(ph.filter((p) => /^e\.g\./.test(p))).toEqual([]);
  });

  it('English form: English examples only, no Israeli names and no Hebrew', () => {
    render(<QuoteForm {...withFile(false)} />);
    fireEvent.click(screen.getByTestId('sq-client-contact-toggle'));
    const ph = placeholders();
    expect(ph).toContain('Type the client name');
    expect(ph).toContain('e.g. John Smith');
    expect(ph.join(' ')).not.toMatch(/Holon|Simon Levy/);
    expect(ph.filter((p) => HEBREW.test(p))).toEqual([]);
  });

  it('the attachment remove button is named in the form language and still removes the file', () => {
    const props = withFile(false);
    const { unmount } = render(<QuoteForm {...props} />);
    openPage('files');
    const btn = screen.getByRole('button', { name: 'Remove attachment plan.pdf' });
    fireEvent.click(btn);
    expect(props.setQuoteFiles).toHaveBeenCalledTimes(1);
    unmount();
    render(<QuoteForm {...withFile(true)} />);
    openPage('files');
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
    openPage('project');
    expect(field()?.value).toBe(shown);
  });
});

// Owner 2026-11-13 ("לא כפול, בדיוק כמו בדמו"): a NEW quote has no "× N"; an older quote whose heading stands for N identical copies keeps
// them, with the sums by name (Owner console 2026-11-10, G6a "א")
describe('QuoteForm - identical copies of an older quote', () => {
  const tiles = (o = {}) => makeItem({ id: 'db1', description: 'Tiles', unit_price: '100', quantity: '1', section_key: 'sec1', ...o });
  it('the heading shows "× N", the per-copy line and the total of all copies', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Type A', sort_order: 0, repeat_count: 12 }], items: [tiles()] })} />);
    const heading = screen.getByTestId('qt-heading');
    expect(heading.querySelector('.qt-head-name').textContent).toBe('Type A × 12');
    expect(heading.querySelector('.qt-head-total').textContent).toBe('$1200.00');
    expect(screen.getByTestId('unit-per-copy').textContent).toMatch(/Per section: \$100\.00 · All sections: \$1200\.00/);
    expect(screen.getByTestId('unit-per-copy').textContent).toContain('The rows here are for one section');
    expect(screen.getByTestId('unit-applies-all').textContent).toBe('Edits apply to all 12 sections.');
  });
  it('at 1 nothing new is shown (no "× 1", no per-copy line), and a new quote never gets a count', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Type A', sort_order: 0 }], items: [tiles()] })} />);
    expect(screen.getByTestId('qt-heading').querySelector('.qt-head-name').textContent).toBe('Type A');
    expect(screen.queryByTestId('unit-per-copy')).toBeNull();
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    // the options page has no "how many times" field (Owner 2026-11-13, answer ב)
    expect(screen.getByTestId('qt-heading-options').textContent).not.toMatch(/copies|separate|times/i);
    expect(screen.getByTestId('qt-heading-options').querySelectorAll('input')).toHaveLength(1);
  });
});

// Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): the unit template entries in the editor
describe('QuoteForm - unit templates (stage 4)', () => {
  it('the heading menu saves THIS heading as a unit template; "From a saved template" opens the unit templates', () => {
    const onSaveUnitTemplate = vi.fn();
    const onAddUnitFromTemplate = vi.fn();
    const sec = { key: 'sec1', name: 'Type A', sort_order: 0 };
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [sec], items: [makeItem({ description: 'Tiles', unit_price: '100', section_key: 'sec1' })], onSaveUnitTemplate, onAddUnitFromTemplate })} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    fireEvent.click(screen.getByTestId('qt-head-template'));
    expect(onSaveUnitTemplate).toHaveBeenCalledWith(expect.objectContaining({ key: 'sec1', name: 'Type A' }));
    // 2026-11-15 (the demo, C9): "From a saved template" stands beside "+ Add another kind" - at the whole quote only
    expect(screen.queryByTestId('unit-from-template')).toBeNull();
    fireEvent.click(screen.getByTestId('qt-nav-whole'));
    fireEvent.click(screen.getByTestId('unit-from-template'));
    expect(onAddUnitFromTemplate).toHaveBeenCalledTimes(1);
  });
  it('an empty or unnamed heading offers no "Save as a template"; no handler, no "From a saved template"', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: '', sort_order: 0 }], items: [], onSaveUnitTemplate: vi.fn() })} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    expect(screen.queryByTestId('qt-head-template')).toBeNull();
    expect(screen.queryByTestId('unit-from-template')).toBeNull();
  });
});

// 2026-11-12 (unified quote) + 13/11 (the demo): ONE total in the bar at the bottom beside the one save; the summary opens from the bar;
// the quote details name every extra and hold the discount, the status (edit only) and save as a template
describe('QuoteForm - the bottom bar, the summary and the quote details', () => {
  it('the bar: the total with its label, the save, what the client sees and the summary; the summary has the demo\'s lines', () => {
    render(<QuoteForm {...baseProps({ presentationController: { openPreview: vi.fn() } })} />);
    const bar = screen.getByTestId('qt-bar');
    expect(bar.querySelector('.qt-bar-total').textContent).toBe('Total to pay$300.00');
    expect(within(bar).getByTestId('sq-save')).toBeTruthy();
    expect(within(bar).getByTestId('qt-summary-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('qt-summary-panel')).toBeNull();
    openSummary();
    expect(screen.getByTestId('sq-summary').textContent).toContain('Works and products');
    expect(screen.getByTestId('sq-save-total').textContent).toBe('Total to pay$300.00');
    expect(screen.queryByTestId('sq-summary-counts')).toBeNull();
    expect(screen.getAllByTestId('sq-save')).toHaveLength(1);
  });
  it('a work without a price makes the total "Partial total" in the bar and in the summary (the demo)', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 's1', name: 'Apartment 1', kind: 'apartment' }],
      items: [makeItem({ description: 'Flooring', unit_price: '150', section_key: 's1' }), makeItem({ description: 'Windows', unit_price: '', section_key: 's1' })] })} />);
    expect(screen.getByTestId('qt-bar-total-label')).toHaveTextContent('Partial total');
    openSummary();
    expect(screen.getByTestId('sq-save-total').textContent).toContain('Partial total');
  });
  it('the details line opens the section buttons; each section is its own page; an edit has its status there', () => {
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪', editingQuoteId: 'q1', quoteStatus: 'Draft' })} />);
    expect(screen.getByTestId('sq-more-details-toggle').textContent).toBe('פרטים נוספים להצעה (לא חובה)');
    expect([...screen.getByTestId('sq-more-details').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['פרויקט, כתובת ותוקף', 'הערות לכל ההצעה', 'תנאים ואחריות', 'הנחה', 'קבצים ותמונות', 'מצב ההצעה']);
    // Owner 2026-11-13 (answer 7 "ב"): no "save as a template" in the details - it is offered on the first save
    expect(screen.getByTestId('sq-details').textContent).not.toContain('שמירה כתבנית');
    openPage('discount');
    expect(screen.getByTestId('sq-details-page').querySelector('[data-testid="sq-discount"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('sq-details-close'));
    openPage('status');
    expect(screen.getByTestId('sq-details-page').querySelector('option[value="Sent"]')).not.toBeNull();
  });
});
