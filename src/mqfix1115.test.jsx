// 2026-11-15 (Owner typed "מאשר את 7 התיקונים כולל שינוי ב-L-01, L-09, L-15 ושחרור עד הלייב", after the Codex demo-compliance review and the
// Owner's phone video): the VAT notice at the top of the client step, a chosen client's contact details folded, the phone keyboard (the
// bottom bar and the calculator step aside), the sidebar name / e-mail slide (law 50 amendment of 15/11), the structure help opening below.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QuoteForm from './components/QuoteForm';
import SlideText from './components/SlideText';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.classList.remove('pf-typing'); });

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

describe('3 · the VAT notice is at the top of the client step (Owner answer א)', () => {
  it('Israel, business client: the notice comes before the client fields; International: none', () => {
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn(), clientName: 'Synthetic Co' })} />);
    const notice = screen.getByTestId('sq-vat-notice');
    const existing = screen.getByTestId('sq-client-existing');
    expect(notice.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(screen.getByTestId('sq-client-tax-id')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId('sq-vat-notice')).toHaveLength(1);
    cleanup();
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn(), isHebrew: false, isLocalIsraeliBusiness: false, sym: '$', currency: 'USD' })} />);
    expect(screen.queryByTestId('sq-vat-notice')).toBeNull();
  });
});

describe('2 · a chosen existing client keeps its contact details folded (the demo, Codex D02)', () => {
  it('picking a saved client with a phone and an e-mail does not open "פרטי קשר"', () => {
    const setClientEmail = vi.fn(); const setClientPhone = vi.fn();
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn(), setClientEmail, setClientPhone, clients: [{ id: 'c1', company_name: 'Saved Co', email: 'x@y.co', phone: '050-0000000', client_type: 'business' }] })} />);
    fireEvent.change(screen.getByTestId('sq-client-existing'), { target: { value: 'c1' } });
    expect(setClientEmail).toHaveBeenCalledWith('x@y.co');
    expect(setClientPhone).toHaveBeenCalledWith('050-0000000');
    expect(screen.getByTestId('sq-client-contact-toggle').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('4 · typing on a phone: the bottom bar and the calculator step aside', () => {
  it('a focused field on a phone sets html.pf-typing; leaving it clears it; a desktop never sets it', async () => {
    const original = window.matchMedia;
    const mm = (matches) => { window.matchMedia = (q) => ({ matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };
    mm(true);
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn() })} />);
    const input = screen.getByTestId('sq-client-tax-id');
    act(() => { input.focus(); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(true);
    await act(async () => { input.blur(); await new Promise((r) => setTimeout(r, 5)); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(false);
    cleanup();
    mm(false);
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn() })} />);
    act(() => { screen.getByTestId('sq-client-tax-id').focus(); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(false);
    window.matchMedia = original;
  });
  it('the CSS hides the bottom bar and the calculator button only on a phone while typing', () => {
    expect(read('src/index.css')).toContain('@media (max-width: 768px) { html.pf-typing .mobile-bottom-nav, html.pf-typing .pf-calc-fab { display: none !important; } }');
  });
});

describe('5 · a long sidebar name / e-mail slides (Owner 15/11 + the law 50 amendment)', () => {
  it('a text longer than its box gets data-slide-text and a distance by the direction; a short text stays still', () => {
    const sw = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('pf-slide') ? 300 : 0; });
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('box') ? 160 : 0; });
    render(<div dir="rtl"><SlideText className="box" dir="rtl">עסק עם שם ארוך מאוד מאוד</SlideText></div>);
    const span = document.querySelector('.pf-slide');
    expect(span.hasAttribute('data-slide-text')).toBe(true);
    expect(span.className).toContain('pf-slide--on');
    expect(span.style.getPropertyValue('--pf-slide-x')).toBe('140px');
    cleanup();
    render(<SlideText className="box" dir="ltr">A very long English business name</SlideText>);
    expect(document.querySelector('.pf-slide').style.getPropertyValue('--pf-slide-x')).toBe('-140px');
    cleanup(); sw.mockRestore(); cw.mockRestore();
    render(<SlideText className="box">Short</SlideText>);
    expect(document.querySelector('.pf-slide').hasAttribute('data-slide-text')).toBe(false);
  });
  it('the sidebar card uses it for the name and the e-mail, without an ellipsis; reduced motion wraps instead', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain('<SlideText className="dash-sidebar-user-bizname"');
    expect(d).toContain('<SlideText className="dash-sidebar-user-name"');
    expect(d).not.toMatch(/\.dash-sidebar-user-(bizname|name) \{[^}]*text-overflow: ellipsis/);
    expect(d).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('1 / 6 / 7 · remove the last row, no 20 limit, the help opens below when there is no room', () => {
  it('the editor source', () => {
    const tree = read('src/components/quoteTree/QuoteTreeEditor.jsx');
    expect(tree).toContain('onRemove={() => removeRow(i)}');
    expect(tree).not.toMatch(/n <= 20/);
    expect(tree).not.toContain('max="20"');
    expect(tree).toContain("className={below ? 'qt-pop qt-pop--below' : 'qt-pop'}");
    expect(read('src/components/quoteTree/quoteTree.css')).toContain('.qt-structure .qt-pop.qt-pop--below, .qt-pop.qt-pop--below { top: calc(100% + 8px); bottom: auto; }');
  });
});
