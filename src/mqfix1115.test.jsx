// 2026-11-15 (Owner typed "מאשר את 7 התיקונים כולל שינוי ב-L-01, L-09, L-15 ושחרור עד הלייב", after the Codex demo-compliance review and the
// Owner's phone video): the VAT notice at the top of the client step, a chosen client's contact details folded, the phone keyboard (the
// bottom bar and the calculator step aside), the sidebar name / e-mail slide (law 50 amendment of 15/11), the structure help opening below.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QuoteForm from './components/QuoteForm';
import EllipsisText from './components/EllipsisText';

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
    // the bar comes back only after the tap that left the field is over (400 ms)
    await act(async () => { input.blur(); await new Promise((r) => setTimeout(r, 50)); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(true);
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(false);
    cleanup();
    mm(false);
    render(<QuoteForm {...props({ flowStep: 'client', onFlowStep: vi.fn() })} />);
    act(() => { screen.getByTestId('sq-client-tax-id').focus(); });
    expect(document.documentElement.classList.contains('pf-typing')).toBe(false);
    window.matchMedia = original;
  });
  it('the CSS hides the bottom bar only on a phone while typing (Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-07 / L-09 / L-19 / L-23 / L-26 / L-29 ... only as needed): no floating calculator any more)', () => {
    expect(read('src/index.css')).toContain('@media (max-width: 768px) { html.pf-typing .mobile-bottom-nav { display: none !important; } }');
    // the field keeps its place in the page content; the browser's own scroll anchoring is off while the user is in the form (one anchor)
    expect(read('src/index.css')).toContain('@media (max-width: 768px) { html.pf-anchor, html.pf-anchor .dash-main-content { overflow-anchor: none; } }');
    const qf = read('src/components/QuoteForm.jsx');
    expect(qf).toContain('const d = posOf(field) - rel;');
    expect(qf).toContain("html.classList.add('pf-anchor');");
  });
});

// 5 replaced by the Owner (console 2026-11-19, typed: "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות כמו בתמונות, ... ושחרור עד
// הלייב" + the law 50 change "שם או טקסט ארוך שמסתיים בשלוש נקודות ומוצג במלואו בריחוף או בלחיצה אינו נחשב מילה חתוכה"): nothing slides any more
describe('5 · a long sidebar name / e-mail ends with "…" and shows whole in the bubble (Owner 19/11)', () => {
  const fire = (el, type, pointerType) => { const ev = new Event(type, { bubbles: true, cancelable: true }); ev.pointerType = pointerType; el.dispatchEvent(ev); };
  it('a shortened text: a tap opens the bubble with the whole text and does not reach the card under it; a mouse hover shows it (the browser tooltip is muted by the inner empty title)', () => {
    const sw = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('box') ? 300 : 0; });
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('box') ? 160 : 0; });
    const onCard = vi.fn();
    render(<div dir="rtl" onClick={onCard}><EllipsisText className="box" dir="rtl" text="עסק עם שם ארוך מאוד מאוד" /></div>);
    const box = document.querySelector('.box');
    expect(box.getAttribute('data-full-text')).toBe('עסק עם שם ארוך מאוד מאוד');
    expect(box.getAttribute('title')).toBe('עסק עם שם ארוך מאוד מאוד');
    act(() => { fire(box, 'pointerdown', 'touch'); box.click(); });
    expect(screen.getByRole('tooltip').textContent).toBe('עסק עם שם ארוך מאוד מאוד');
    expect(onCard).not.toHaveBeenCalled();
    act(() => { fire(box, 'pointerdown', 'touch'); box.click(); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { fire(box, 'pointerover', 'mouse'); });
    expect(screen.getByRole('tooltip').textContent).toBe('עסק עם שם ארוך מאוד מאוד');
    expect(box.getAttribute('title')).toBe('עסק עם שם ארוך מאוד מאוד');
    expect(box.firstElementChild.getAttribute('title')).toBe('');
    act(() => { fire(box, 'pointerout', 'mouse'); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(box.getAttribute('title')).toBe('עסק עם שם ארוך מאוד מאוד');
    cleanup(); sw.mockRestore(); cw.mockRestore();
    // a text that fits: no bubble, the tap reaches the card as before
    const onCard2 = vi.fn();
    render(<div onClick={onCard2}><EllipsisText className="box" text="Short" /></div>);
    act(() => { fire(document.querySelector('.box'), 'pointerdown', 'touch'); document.querySelector('.box').click(); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onCard2).toHaveBeenCalledTimes(1);
  });
  it('the sidebar card uses it for the name and the e-mail; no slide rule is left', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain('<EllipsisText as="div" className="dash-sidebar-user-bizname"');
    expect(d).toContain('<EllipsisText as="div" className="dash-sidebar-user-name" text={session.user.email}>');
    expect(d).not.toContain('SlideText');
    expect(d).not.toMatch(/\.pf-slide/);
  });
});

describe('1 / 6 / 7 · remove the last row, no 20 limit, the help opens below when there is no room', () => {
  it('the editor source', () => {
    const tree = read('src/components/quoteTree/QuoteTreeEditor.jsx');
    // Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-07 / L-09 / L-19 / L-23 / L-26 / L-29 ... only as needed): every row's "⋯" has Remove (also the only row); undo brings it back
    expect(tree).toContain("onClick: run(() => removeRow(i)), danger: true, testId: 'qt-row-remove'");
    expect(tree).not.toMatch(/n <= 20/);
    expect(tree).not.toContain('max="20"');
    expect(tree).toContain("className={below ? 'qt-pop qt-pop--below' : 'qt-pop'}");
    expect(read('src/components/quoteTree/quoteTree.css')).toContain('.qt-pop--below { top: calc(100% + 6px); bottom: auto; }');
  });
});
