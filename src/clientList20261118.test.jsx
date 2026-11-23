// 2026-11-18 (Owner console, typed: "מאשר שינוי בנוסח רשימת הלקוחות מהדמו של 13/11: "רשימת הלקוחות" / "Client list", שחרור עד הלייב"):
// the empty choice of the existing-client list reads "רשימת הלקוחות" / "Client list" - the longer wording was cut at phone width in both
// languages. Nothing else in the list changes: "+ add a new client" stays first, the saved clients follow, the empty choice stays hidden.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import QuoteForm from './components/QuoteForm';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
const props = (o = {}) => ({
  editingQuoteId: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: '', setClientName: vi.fn(), clientEmail: '', setClientEmail: vi.fn(), clientPhone: '', setClientPhone: vi.fn(), clientType: 'business', setClientType: vi.fn(),
  clientTaxId: '', setClientTaxId: vi.fn(), clientAddress: '', setClientAddress: vi.fn(), quoteSubject: '', setQuoteSubject: vi.fn(), attnName: '', setAttnName: vi.fn(), attnRole: '', setAttnRole: vi.fn(),
  currency: 'ILS', quoteStatus: 'draft', setQuoteStatus: vi.fn(), validUntil: '', setValidUntil: vi.fn(), discount: 0, setDiscount: vi.fn(), terms: '', setTerms: vi.fn(), warranty: '', setWarranty: vi.fn(), notes: '', setNotes: vi.fn(),
  items: [{ description: 'Aluminum window', quantity: '1', unit_price: '300', isFromCatalog: false, section_key: null }], setItems: vi.fn(), sections: [], setSections: vi.fn(), addSection: vi.fn(), renameSection: vi.fn(), removeSection: vi.fn(),
  quoteStructureMode: 'regular', setQuoteStructureMode: vi.fn(), projectName: '', setProjectName: vi.fn(), services: [], clients: [], isHebrew: true, isLocalIsraeliBusiness: true, t, sym: '₪',
  formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2), subtotal: 300, discountAmount: 0, taxAmount: 0, totalAmount: 300,
  removeItem: vi.fn(), handleItemChange: vi.fn(), canUseAttachments: true, canUseProfessionalQuotes: true, duplicateItem: vi.fn(), canUseProfessionalQuoteReuse: true, quoteFiles: [], setQuoteFiles: vi.fn(), allUserAttachments: [],
  ...o,
});
const clients = [{ id: 'c1', company_name: 'Saved Co', client_type: 'business' }];

describe('the existing-client list wording (Owner 18/11)', () => {
  for (const [isHebrew, empty, add] of [[true, 'רשימת הלקוחות', '+ הוספת לקוח חדש'], [false, 'Client list', '+ Add a new client']]) {
    it(`${isHebrew ? 'Hebrew' : 'English'}: the empty choice reads "${empty}", shown while no client is chosen; the list order is unchanged`, () => {
      render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn(), isHebrew, clients, ...(isHebrew ? {} : { isLocalIsraeliBusiness: false, sym: '$', currency: 'USD' }) })} />);
      const sel = screen.getByTestId('sq-client-existing');
      const opts = [...sel.querySelectorAll('option')];
      expect(opts.map((o) => o.textContent)).toEqual([add, empty, 'Saved Co']);
      expect(opts[1].value).toBe('');
      expect(opts[1].disabled && opts[1].hidden).toBe(true);
      expect(sel.value).toBe('');
      expect(sel.textContent).not.toMatch(/אפשר לבחור לקוח קיים|Pick a saved client/);
    });
  }
});
