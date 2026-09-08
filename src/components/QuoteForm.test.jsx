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
    addSection: vi.fn(),
    renameSection: vi.fn(),
    removeSection: vi.fn(),
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

  it('still shows the classic editable row for the blank starter item (not yet a saved item)', () => {
    render(<QuoteForm {...baseProps({ items: [makeItem()] })} />);
    expect(document.querySelector('input[placeholder="Description"]')).toBeTruthy();
  });

  it('expanding via the chevron reveals the existing full editor, and Collapse returns to compact', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Expand/edit item'));
    expect(document.querySelector('input[value="Aluminum window"]')).toBeTruthy();
    fireEvent.click(screen.getByText('Collapse'));
    expect(document.querySelector('input[value="Aluminum window"]')).toBeNull();
    expect(screen.getByText('Aluminum window')).toBeTruthy();
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

  it('shows the section name as a badge when assigned, falling back to "(unnamed)" for an empty section name', () => {
    // Regression: an empty-string section.name is falsy in JS - the badge must
    // key off section presence, not the name string, or a freshly-created
    // (not-yet-renamed) section silently loses its badge even though assigned.
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'Item', unit_price: '10', section_key: 'sec1' })],
      sections: [{ key: 'sec1', name: '' }],
    })} />);
    expect(screen.getByText('(unnamed)')).toBeTruthy();
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

  it('Edit calls the same expand toggle as the chevron button', () => {
    render(<QuoteForm {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    expect(document.querySelector('input[value="Aluminum window"]')).toBeTruthy();
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

  it('"Move to section" calls handleItemChange with section_key, reusing the existing setter', () => {
    const handleItemChange = vi.fn();
    render(<QuoteForm {...baseProps({
      items: [makeItem({ description: 'A' })],
      sections: [{ key: 'sec1', name: 'Kitchen' }],
      handleItemChange,
    })} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Move to section/ }));
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
