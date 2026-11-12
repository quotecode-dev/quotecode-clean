// Owner console 2026-11-09 (typed: "מאשר את שלושת התיקונים (הודעת שמירה, סה״כ ליד הכפתור, מספר עוסק חובה) כולל שינוי ב-L-09, שחרור עד הלייב"):
// (1) the quote-saved message stays 8 seconds with a close button, every other message keeps 2.7 seconds; (2) "סה״כ לתשלום" / "Total to pay"
// right above the save button, the same total as the summary; (3) a business client's tax ID is marked "(חובה)" / "(required)" and a
// missing one shows our own message under the field instead of the browser's bubble.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import QuoteForm from './components/QuoteForm';

afterEach(cleanup);
const t = {
  clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description',
  discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal',
  totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT',
};
const props = (o = {}) => ({
  editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: 'Synthetic client', setClientName: vi.fn(), clientEmail: '', setClientEmail: vi.fn(), clientPhone: '', setClientPhone: vi.fn(),
  clientType: 'business', setClientType: vi.fn(), clientTaxId: '', setClientTaxId: vi.fn(), clientAddress: '', setClientAddress: vi.fn(),
  quoteSubject: '', setQuoteSubject: vi.fn(), attnName: '', setAttnName: vi.fn(), attnRole: '', setAttnRole: vi.fn(), currency: 'ILS',
  quoteStatus: 'draft', setQuoteStatus: vi.fn(), validUntil: '', setValidUntil: vi.fn(), discount: 0, setDiscount: vi.fn(), terms: '', setTerms: vi.fn(),
  warranty: '', setWarranty: vi.fn(), notes: '', setNotes: vi.fn(),
  items: [{ description: 'Aluminum window', quantity: '1', unit_price: '300', isFromCatalog: false, section_key: null }], setItems: vi.fn(),
  sections: [], setSections: vi.fn(), addSection: vi.fn(), renameSection: vi.fn(), removeSection: vi.fn(),
  quoteStructureMode: 'regular', setQuoteStructureMode: vi.fn(), projectName: '', setProjectName: vi.fn(), services: [], clients: [],
  isHebrew: false, isLocalIsraeliBusiness: false, t, sym: '$', formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2),
  subtotal: 300, discountAmount: 0, taxAmount: 54, totalAmount: 354, removeItem: vi.fn(), handleItemChange: vi.fn(), canUseAttachments: true,
  canUseProfessionalQuotes: true, businessDefaultProfessionalUnit: null, duplicateItem: vi.fn(), canUseProfessionalQuoteReuse: true,
  handleProfessionalUnitChange: vi.fn(), addMeasurementRow: vi.fn(), removeMeasurementRow: vi.fn(), handleMeasurementChange: vi.fn(),
  toggleManualQuantityOverride: vi.fn(), handleManualQuantityChange: vi.fn(), toggleMeasurementPricingDriving: vi.fn(), addSpecificationRow: vi.fn(),
  handleSpecificationChange: vi.fn(), removeSpecificationRow: vi.fn(), onOpenPricingModal: vi.fn(), quoteFiles: [], setQuoteFiles: vi.fn(), allUserAttachments: [],
  ...o,
});

describe('2026-11-09 · tax ID required for a business client, with our own message', () => {
  it('Hebrew: the label says (חובה), a missing value shows our message (no browser bubble) and typing clears it', () => {
    render(<QuoteForm {...props({ isHebrew: true, isLocalIsraeliBusiness: true, sym: '₪' })} />);
    expect(screen.getByText('ח״פ / עוסק / ת״ז (חובה)')).toBeTruthy();
    const input = screen.getByTestId('sq-client-tax-id');
    expect(input.required).toBe(true);
    // fireEvent returns false when the handler called preventDefault - the browser's own bubble is suppressed
    expect(fireEvent.invalid(input)).toBe(false);
    expect(screen.getByTestId('sq-client-tax-id-missing').textContent).toBe('חסר מספר עוסק. ללקוח עסקי צריך למלא ח״פ, עוסק או ת״ז.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: '123456782' } });
    expect(screen.queryByTestId('sq-client-tax-id-missing')).toBeNull();
  });
  // Owner 2026-11-11 (finding 5, option א; typed L-09): abroad (the International market) the business client's Tax ID is optional
  it('International: the label says (optional) and the quote saves without it', () => {
    render(<QuoteForm {...props({ isLocalIsraeliBusiness: false, currency: 'USD' })} />);
    expect(screen.getByText('Tax ID / ID (optional)')).toBeTruthy();
    const input = screen.getByTestId('sq-client-tax-id');
    expect(input.required).toBe(false);
    expect(input.getAttribute('pattern')).toBeNull();
  });
  it('the Israeli market keeps it required whatever the UI language; the message is in English', () => {
    render(<QuoteForm {...props({ isLocalIsraeliBusiness: true })} />);
    expect(screen.getByText('Tax ID / ID (required)')).toBeTruthy();
    fireEvent.invalid(screen.getByTestId('sq-client-tax-id'));
    expect(screen.getByTestId('sq-client-tax-id-missing').textContent).toBe('Tax ID is missing. A business client needs a Tax ID.');
  });
  it('a private client: not required and not marked', () => {
    render(<QuoteForm {...props({ isHebrew: true, clientType: 'private' })} />);
    expect(screen.getByText('ח״פ / עוסק / ת״ז')).toBeTruthy();
    expect(screen.getByTestId('sq-client-tax-id').required).toBe(false);
  });
});

describe('2026-11-09 · the total right above the save button', () => {
  it('shows the same total as the summary, in both languages, before the save button', () => {
    render(<QuoteForm {...props({ isHebrew: true, sym: '₪' })} />);
    const box = screen.getByTestId('sq-save-total');
    expect(box.textContent).toBe('סה״כ לתשלום:₪354.00');
    expect(box.nextElementSibling).toBe(screen.getByTestId('sq-save'));
    cleanup();
    render(<QuoteForm {...props()} />);
    expect(screen.getByTestId('sq-save-total').textContent).toBe('Total to pay:$354.00');
  });
});

describe('2026-11-09 · the quote-saved message stays 8 seconds with a close button', () => {
  const d = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  it('the timer uses the message hold, 2.7 seconds otherwise', () => {
    expect(d).toContain("setTimeout(() => setStatusMsg({ text: '', type: 'success' }), statusMsg.hold || 2700);");
    expect(d).toContain('}, [statusMsg.text, statusMsg.hold]);');
  });
  it('only the quote-saved message holds 8 seconds, and the toast then has a close button', () => {
    expect(d.match(/hold: 8000,/g)).toHaveLength(1);
    expect(d).toContain("type: 'success',\n        hold: 8000, // Owner 2026-11-09");
    expect(d).toContain('data-testid="status-toast-close"');
    expect(d).toContain("aria-label={isHebrew ? 'סגירת ההודעה' : 'Close message'}");
  });
});

describe('2026-11-09 · the message is centred (L-23 #8, Owner: "מאשר למרכז את ההודעה כולל שינוי ב-L-23")', () => {
  const d = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  it('its entry animation keeps translateX(-50%) and a phone wraps a long message', () => {
    expect(d).toContain('animation: statusToastIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;');
    expect(d).toContain('100% { transform: translateX(-50%) scale(1) translateY(0); opacity: 1; }');
    expect(d).toContain('.dash-status-toast { white-space: normal; border-radius: 16px; width: max-content; }');
  });
});
