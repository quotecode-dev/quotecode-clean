import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuoteForm from './QuoteForm';

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

describe('QuoteForm - compact item card is the default for a real (non-blank) item', () => {
  it('renders the compact summary (name, calc summary, total) instead of the full editable row', () => {
    render(<QuoteForm {...baseProps({ subtotal: 999, totalAmount: 999 })} />);
    // Compact: the description is shown as read-only text, not an editable input.
    expect(screen.getByText('Aluminum window')).toBeTruthy();
    expect(document.querySelector('input[value="Aluminum window"]')).toBeNull();
    expect(screen.getByText('1.00 × $300.00')).toBeTruthy();
    // The card's own total is distinct from the (deliberately different, in
    // this fixture) footer subtotal/total - proves this is the card's own
    // total, not an accidental match against the totals footer below it.
    expect(screen.getByText('$300.00')).toBeTruthy();
  });

  it('shows the empty-state message instead of any editable row when there are zero items (Smart Quote Guided UX Completion task - no more blank starter row)', () => {
    render(<QuoteForm {...baseProps({ items: [] })} />);
    expect(screen.getByText(/No products or work added to this quote yet/)).toBeTruthy();
    expect(document.querySelector('input[placeholder="Description"]')).toBeNull();
  });

  it('expanding via the chevron opens the guided AddItemWizard in edit mode, populated with the real saved values (Add/Edit unification - no more inline classic-row editor)', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Edit'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Edit product or work')).toBeTruthy();
    expect(screen.getAllByText('Aluminum window').length).toBeGreaterThan(0);
  });
});

describe('QuoteForm - compact card optional indicators only appear when present', () => {
  it('shows no specification/section badge when neither is set', () => {
    render(<QuoteForm {...baseProps()} />);
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('shows a specification badge when the item has specification rows', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'Item', unit_price: '10', specification: [{ label: 'Color', value: 'Red' }] })] })} />);
    expect(screen.getByText('Details')).toBeTruthy();
  });

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

describe('QuoteForm - Structure-First selector (Smart Quote Structure-First UX Correction task, Locked Decision 1)', () => {
  it('shows the structure question before any Add Item action when the mode is undecided (null)', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [] })} />);
    expect(screen.getByText('How would you like to structure this quote?')).toBeTruthy();
    expect(screen.getByText('Regular quote')).toBeTruthy();
    expect(screen.getByText('All products and work appear in one list.')).toBeTruthy();
    expect(screen.getByText('Quote by units')).toBeTruthy();
    expect(screen.getByText('Ideal for apartments, rooms, floors, areas, or separate work units.')).toBeTruthy();
    // Not "Smart Quote" as the opposite of "Regular" (Decision 1).
    expect(screen.queryByText(/Smart Quote/)).toBeNull();
    // No Add Item action reachable yet - structure comes first.
    expect(screen.queryByText('Add product or work')).toBeNull();
  });

  it('choosing "Regular quote" calls setQuoteStructureMode("regular")', () => {
    const setQuoteStructureMode = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [], setQuoteStructureMode })} />);
    fireEvent.click(screen.getByText('Regular quote'));
    expect(setQuoteStructureMode).toHaveBeenCalledWith('regular');
  });

  it('choosing "Quote by units" calls setQuoteStructureMode("divided")', () => {
    const setQuoteStructureMode = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [], setQuoteStructureMode })} />);
    fireEvent.click(screen.getByText('Quote by units'));
    expect(setQuoteStructureMode).toHaveBeenCalledWith('divided');
  });

  it('HE copy matches exactly', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: null, items: [], isHebrew: true, sym: '₪' })} />);
    expect(screen.getByText('איך תרצו לבנות את ההצעה?')).toBeTruthy();
    expect(screen.getByText('הצעה רגילה')).toBeTruthy();
    expect(screen.getByText('כל המוצרים והעבודות מופיעים ברשימה אחת.')).toBeTruthy();
    expect(screen.getByText('הצעה לפי חלוקה')).toBeTruthy();
    expect(screen.getByText('מתאים לדירות, חדרים, קומות, אזורים או יחידות נפרדות.')).toBeTruthy();
  });
});

describe('QuoteForm - Regular quote flow (Locked Decision 2)', () => {
  it('shows the primary Add action and no unit-management UI at all', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular' })} />);
    expect(screen.getByText('Add product or work')).toBeTruthy();
    expect(screen.queryByText('How would you like to structure this quote?')).toBeNull();
    expect(screen.queryByText(/No items added yet/)).toBeNull();
  });

  it('offers a "Switch to a divided quote" link that calls setQuoteStructureMode("divided")', () => {
    const setQuoteStructureMode = vi.fn();
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'regular', setQuoteStructureMode })} />);
    fireEvent.click(screen.getByText('Switch to a divided quote'));
    expect(setQuoteStructureMode).toHaveBeenCalledWith('divided');
  });
});

describe('QuoteForm - Divided quote unit board (Locked Decision 3/4/5/6/10)', () => {
  it('has no global "Add product or work" button - every add action belongs to a specific unit', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.queryByText('Add product or work')).toBeNull();
  });

  it('shows the unit\'s own real name in its per-unit Add Item button, item count, and offers "Add another unit"', () => {
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
    })} />);
    expect(screen.getByText('Add product or work to Apartment 33')).toBeTruthy();
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByText('Add another unit')).toBeTruthy();
  });

  it('an unnamed (freshly created) unit falls back to "this unit" in its Add Item button', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: '' }] })} />);
    expect(screen.getByText('Add product or work to this unit')).toBeTruthy();
  });

  it('an empty unit visibly shows "No items added yet" and still exposes its Add Item action - collapsed or not', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 35' }], items: [] })} />);
    expect(screen.getByText('No items added yet')).toBeTruthy();
    expect(screen.getByText('Add product or work to Apartment 35')).toBeTruthy();
  });

  it('offers "Add the first unit" when no unit exists yet, "Add another unit" once at least one does', () => {
    const { rerender } = render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [] })} />);
    expect(screen.getByText('Add the first unit')).toBeTruthy();
    rerender(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText('Add another unit')).toBeTruthy();
  });

  it('clicking a unit\'s own Add Item button opens the wizard already scoped to that unit (no re-selection asked)', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    fireEvent.click(screen.getByText('Add product or work to Apartment 33'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('existing items with no section_key appear in a visible "Unassigned" unit, never silently disappear (Decision 8, Regular->Divided)', () => {
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Legacy item', unit_price: '50' })],
    })} />);
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByText('Legacy item')).toBeTruthy();
  });

  it('offers a "Switch to a regular quote" link', () => {
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText('Switch to a regular quote')).toBeTruthy();
  });

  it('"Switch to a regular quote" asks for confirmation, then flattens sections and clears every item\'s section_key (Decision 8, Divided->Regular)', () => {
    const setItems = vi.fn();
    const setSections = vi.fn();
    const setQuoteStructureMode = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<QuoteForm {...baseProps({
      quoteStructureMode: 'divided',
      sections: [{ key: 'sec1', name: 'Apartment 33' }],
      items: [makeItem({ description: 'Window', unit_price: '100', section_key: 'sec1' })],
      setItems, setSections, setQuoteStructureMode,
    })} />);
    fireEvent.click(screen.getByText('Switch to a regular quote'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(setSections).toHaveBeenCalledWith([]);
    expect(setQuoteStructureMode).toHaveBeenCalledWith('regular');
    const updater = setItems.mock.calls[0][0];
    const result = updater([{ description: 'Window', section_key: 'sec1' }]);
    expect(result[0].section_key).toBeNull();
    confirmSpy.mockRestore();
  });

  it('declining the confirmation leaves the divided structure untouched', () => {
    const setSections = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<QuoteForm {...baseProps({ quoteStructureMode: 'divided', sections: [{ key: 'sec1', name: 'Apartment 33' }], setSections })} />);
    fireEvent.click(screen.getByText('Switch to a regular quote'));
    expect(setSections).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
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

describe('QuoteForm - consolidated actions menu', () => {
  it('opens on click and shows only supported actions', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A' }), makeItem({ description: 'B' })] })} />);
    const menuButtons = screen.getAllByLabelText('More actions');
    fireEvent.click(menuButtons[0]);
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Edit');
    expect(menu.textContent).toContain('Duplicate item');
    expect(menu.textContent).toContain('Delete item');
  });

  it('hides Delete when it is the only item (matches the pre-existing single-item protection)', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    const menu = screen.getByRole('menu');
    expect(menu.textContent).not.toContain('Delete item');
  });

  it('only Delete carries destructive (red) styling among the menu actions', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A' }), makeItem({ description: 'B' })] })} />);
    fireEvent.click(screen.getAllByLabelText('More actions')[0]);
    const items = screen.getAllByRole('menuitem');
    const colors = items.map((el) => ({ label: el.textContent, color: el.style.color }));
    const nonDelete = colors.filter((c) => !c.label.includes('Delete'));
    const del = colors.find((c) => c.label.includes('Delete'));
    expect(del.color).toBe('rgb(220, 38, 38)');
    nonDelete.forEach((c) => expect(c.color).not.toBe('rgb(220, 38, 38)'));
  });

  it('Edit opens the same guided AddItemWizard edit mode as the chevron button', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Edit product or work')).toBeTruthy();
  });

  it('Duplicate calls the existing duplicateItem function with the correct index', () => {
    const duplicateItem = vi.fn();
    render(<QuoteForm {...baseProps({ duplicateItem })} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate item/ }));
    expect(duplicateItem).toHaveBeenCalledWith(0);
  });

  it('Delete calls the existing removeItem function with the correct index', () => {
    const removeItem = vi.fn();
    render(<QuoteForm {...baseProps({ items: [makeItem({ description: 'A' }), makeItem({ description: 'B' })], removeItem })} />);
    fireEvent.click(screen.getAllByLabelText('More actions')[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete item/ }));
    expect(removeItem).toHaveBeenCalledWith(1);
  });

  it('"Move to unit" calls handleItemChange with section_key, reusing the existing setter', () => {
    const handleItemChange = vi.fn();
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'A' })],
      sections: [{ key: 'sec1', name: 'Kitchen' }],
      handleItemChange,
    })} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to unit/ }));
    const select = screen.getByRole('menu').querySelector('select');
    fireEvent.change(select, { target: { value: 'sec1' } });
    expect(handleItemChange).toHaveBeenCalledWith(0, 'section_key', 'sec1');
  });

  it('Duplicate is locked (shows the existing upgrade-confirmation modal) for a professional item without reuse entitlement', () => {
    const duplicateItem = vi.fn();
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'Measured item', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 5 })],
      canUseProfessionalQuoteReuse: false,
      duplicateItem,
    })} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate item/ }));
    // Locked duplication must show the existing upgrade-confirmation UI and
    // must NOT call the real duplicateItem function - not a silent no-op,
    // not a silent bypass of the entitlement gate.
    expect(screen.getByText('This option is for PRO plan users only. Would you like to upgrade your account now?')).toBeTruthy();
    expect(duplicateItem).not.toHaveBeenCalled();
  });

  // Addendum (mid-task, real Owner-observed defect): the menu was
  // position:absolute inside a scrollable/clipping ancestor
  // (.dash-main-content, overflow:auto) - live-measured in a real browser,
  // the old left/right:0 anchor pushed it 133px past that ancestor's own
  // right edge in RTL, so it was silently clipped under the sidebar. Fixed
  // by rendering via a React portal to document.body (immune to any
  // ancestor's overflow) with real collision-aware positioning. jsdom can't
  // meaningfully assert pixel collision math (getBoundingClientRect is all
  // zeros there), so these tests lock in what jsdom *can* prove: the portal
  // target itself, and the Escape/focus-return keyboard contract - the
  // actual pixel-fits-viewport claim was verified live in a real browser
  // at 320/360/392/430px and desktop, both languages (see the checkpoint).
  describe('menu portal, Escape, and focus return (Addendum)', () => {
    it('renders the open menu as a direct child of document.body, not nested inside the scrollable form (proves it cannot be clipped by an ancestor overflow)', () => {
      render(<QuoteForm {...baseProps()} />);
      fireEvent.click(screen.getByLabelText('More actions'));
      const menu = screen.getByRole('menu');
      expect(menu.parentElement).toBe(document.body);
    });

    it('closes the menu on Escape', () => {
      render(<QuoteForm {...baseProps()} />);
      fireEvent.click(screen.getByLabelText('More actions'));
      expect(screen.getByRole('menu')).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('returns focus to the three-dot trigger button after the menu closes', () => {
      render(<QuoteForm {...baseProps()} />);
      const trigger = screen.getByLabelText('More actions');
      fireEvent.click(trigger);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.activeElement).toBe(trigger);
    });
  });
});

describe('QuoteForm - Hebrew/RTL compact card', () => {
  it('renders the compact card correctly in Hebrew', () => {
    render(<QuoteForm {...baseProps({ isHebrew: true, sym: '₪' })} />);
    expect(screen.getByText('1.00 × ₪300.00')).toBeTruthy();
  });
});
