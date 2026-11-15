// Owner round 1 (2026-10-15, Codex spec A1 / A5 / A6 + plan sections 3-4, approved: "זה מעולה"): the measured quote opens as one list with a
// local example; optional client contact details; the VAT basis; save / issue wording; a template in another currency.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QuoteForm from './components/QuoteForm';
import { buildTemplateContent, templateToFormState, templateCurrencyMismatch, withoutPrices } from './utils/quoteTemplates';
import { PRESENTATION_COPY } from './components/quotePresentation/presentationCopy';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
const blank = { description: '', quantity: '1', unit_price: '', isFromCatalog: false };
const props = (o = {}) => ({
  editingQuoteId: null, editingQuoteNumber: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: '', setClientName: vi.fn(), clientEmail: '', setClientEmail: vi.fn(), clientPhone: '', setClientPhone: vi.fn(),
  clientType: 'business', setClientType: vi.fn(), clientTaxId: '', setClientTaxId: vi.fn(), clientAddress: '', setClientAddress: vi.fn(),
  quoteSubject: '', setQuoteSubject: vi.fn(), attnName: '', setAttnName: vi.fn(), attnRole: '', setAttnRole: vi.fn(), currency: 'ILS',
  quoteStatus: 'draft', setQuoteStatus: vi.fn(), validUntil: '', setValidUntil: vi.fn(), discount: 0, setDiscount: vi.fn(), terms: '', setTerms: vi.fn(),
  warranty: '', setWarranty: vi.fn(), notes: '', setNotes: vi.fn(), items: [blank], setItems: vi.fn(), sections: [], setSections: vi.fn(), addSection: vi.fn(),
  renameSection: vi.fn(), removeSection: vi.fn(), quoteStructureMode: 'regular', setQuoteStructureMode: vi.fn(), projectName: '', setProjectName: vi.fn(),
  services: [], clients: [], isHebrew: true, isLocalIsraeliBusiness: true, t, sym: '₪', formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2),
  subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0, removeItem: vi.fn(), handleItemChange: vi.fn(), canUseAttachments: true, canUseProfessionalQuotes: true,
  businessDefaultProfessionalUnit: null, duplicateItem: vi.fn(), canUseProfessionalQuoteReuse: true, onOpenPricingModal: vi.fn(), quoteFiles: [], setQuoteFiles: vi.fn(), allUserAttachments: [],
  ...o,
});
function Stateful(o) {
  const [items, setItems] = useState([blank]);
  return <><QuoteForm {...props({ ...o, items, setItems })} /><output data-testid="items">{JSON.stringify(items)}</output></>;
}

// Owner console 2026-11-08 (design A + stage 2 of the one quote builder, typed incl. L-09 / L-23): the measured entry joined the one "הצעת מחיר"
// entry - every row chooses its billing, sizes are typed in the row; the local example (and its never-saved marker) left with the entry.
describe('A1 / A6: the measured quote is one list (now the rows of the one quote entry)', () => {
  it('an old internal measured entry opens the same rows: no rooms needed, rooms optional, area in the row', () => {
    const { unmount } = render(<QuoteForm {...props({ isMeasuredEntry: true, items: [{ ...blank, description: 'חלון', unit_price: '100' }] })} />);
    expect(screen.getByRole('textbox', { name: 'פריט' })).toBeTruthy();
    expect([...screen.getByRole('combobox', { name: 'אופן חיוב' }).options].map((o) => o.textContent)).toEqual(['סכום קבוע', 'יחידות', 'שטח', 'אורך', 'ק״ג', 'שעות', 'ימים']); // Owner console 2026-11-08 (restore item 01): kg / hours / days in every row again
    unmount();
    render(<Stateful isMeasuredEntry />);
    // 2026-11-12 (unified quote): the two add buttons replace the grouping link
    expect(screen.getByTestId('sq-add-work')).toBeTruthy();
    expect(screen.getByTestId('sq-add-places').textContent).toBe('+ הוספת דירה, חדר או קומה');
    expect(screen.queryByText('הוספת היחידה הראשונה')).toBeNull();
    expect(screen.queryByText('לא משויך')).toBeNull();
    // Owner console 2026-11-08 (restore item 07): the local example is offered again while the quote has no real line
    expect(screen.getByTestId('quote-show-example').textContent).toBe('הצגת דוגמה (לא נשמרת)');
  });

  it('the Dashboard opens the measured quote as a list, never saves the example and never sends its marker to the database', () => {
    const d = read('pages/Dashboard.jsx');
    expect(d).toMatch(/const handleCreateStructuredQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\('structured'\) === false\) return;\s*setMeasuredQuoteEntry\(true\);\s*\};/);
    expect(d).toContain('isMeasuredEntry={measuredQuoteEntry}');
    const save = d.slice(d.indexOf('async function handleSaveQuote(e)'), d.indexOf('resolveBlockers(SAVE_ATTEMPT_CODES);', d.indexOf('async function handleSaveQuote(e)')));
    expect(save).toContain('items.some((it) => it && it._localExample)');
    expect(save).toContain('return;');
    expect(d.slice(d.indexOf('const itemsPayload = itemsForPersist'), d.indexOf('const itemsPayload = itemsForPersist') + 3000)).not.toContain('_localExample');
  });
});

describe('plan section 3: client details and the VAT basis', () => {
  it('contact details are one optional toggle; the Tax ID stays visible; client type explains VAT (Israel)', () => {
    render(<QuoteForm {...props()} />);
    expect(screen.queryByPlaceholderText('לדוגמה: שמעון לוי')).toBeNull();
    // Owner console 2026-11-09 (L-09 named in the approval): a business client's tax ID label is marked "(חובה)"
    expect(screen.getByText('ח״פ / עוסק / ת״ז (חובה)')).toBeTruthy();
    // Owner console 2026-11-11 (typed): the exact VAT notice for the chosen client type replaces the general sentence
    expect(screen.queryByTestId('sq-client-type-vat-help')).toBeNull();
    expect(screen.getByTestId('sq-vat-notice').textContent).toBe('שימו לב: הסכומים ללקוח עסקי הינם ללא מע״מ, והמע״מ יתווסף למחיר הסופי');
    fireEvent.click(screen.getByTestId('sq-client-contact-toggle'));
    expect(screen.getByPlaceholderText('לדוגמה: שמעון לוי')).toBeTruthy();
  });

  it('existing contact details are never hidden', () => {
    render(<QuoteForm {...props({ clientEmail: 'a@b.co' })} />);
    expect(screen.getByTestId('sq-client-contact-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  // 2026-11-12 (the demo summary, Owner-approved): the VAT notice at the top says how the prices are meant (it replaced the summary line)
  it('the totals say how the prices are meant: business before VAT, private including VAT; nothing for International', () => {
    render(<QuoteForm {...props({ clientType: 'business' })} />);
    expect(screen.getByTestId('sq-vat-notice').textContent).toContain('ללא מע״מ');
    cleanup();
    render(<QuoteForm {...props({ clientType: 'private' })} />);
    expect(screen.getByTestId('sq-vat-notice').textContent).toContain('כולל מע״מ');
    cleanup();
    render(<QuoteForm {...props({ isHebrew: false, isLocalIsraeliBusiness: false, sym: '$', currency: 'USD' })} />);
    expect(screen.queryByTestId('sq-vat-notice')).toBeNull();
    expect(screen.queryByTestId('sq-client-type-vat-help')).toBeNull();
  });
});

describe('plan section 4: save and issue wording', () => {
  it('a new quote saved by the server is a draft in the account; a failed save mentions the device only when the local copy exists', () => {
    const d = read('pages/Dashboard.jsx');
    expect(d).not.toContain('הצעת המחיר הופקה ונשמרה בענן בהצלחה');
    expect(d).toContain('הטיוטה נשמרה בחשבון. סה״כ:');
    expect(d).toContain("const keptLocally = quoteDraft.status === 'saved';");
    expect(d).toContain('לא הצלחנו לשמור בחשבון. הטקסט נשמר במכשיר; נסו שוב.');
  });
  it('issuing says it sends no email and that sharing comes after', () => {
    expect(PRESENTATION_COPY.he.issueHint).toContain('הנפקה אינה שולחת מייל. לאחר ההנפקה אפשר לשתף.');
    expect(PRESENTATION_COPY.en.issueHint).toContain('Issuing does not send an email. You can share the quote after it is issued.');
  });
});

describe('Owner 2026-10-15 (David): the price step points to the item, the discount is a 0-100 percentage', () => {
  it('with no item: the price step says where the price goes and opens the item window', () => {
    render(<Stateful />);
    // 2026-11-12 (the demo): the work card says where the work and the prices appear; its button opens the work window; the discount is in the quote details
    expect(screen.getByTestId('sq-empty-work').textContent).toContain('כאן יופיעו העבודות והמחירים.');
    fireEvent.click(screen.getByTestId('sq-add-work'));
    expect(screen.getByTestId('work-item-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('sq-more-details-toggle'));
    expect(screen.getByText('הנחה על כל ההצעה (%)')).toBeTruthy();
    expect(screen.getByTestId('sq-discount').getAttribute('inputmode')).toBe('decimal');
  });
  it('with a real item the hint is gone', () => {
    render(<QuoteForm {...props({ items: [{ description: 'Window', quantity: '1', unit_price: '300', isFromCatalog: false }] })} />);
    expect(screen.queryByTestId('sq-price-needs-item')).toBeNull();
  });
  it('a discount outside 0-100 (the amount typed into it) is flagged next to the field, and the save refuses it', () => {
    render(<QuoteForm {...props({ discount: '2650' })} />);
    fireEvent.click(screen.getByTestId('sq-more-details-toggle'));
    expect(screen.getByRole('alert').textContent).toBe('הנחה יכולה להיות בין 0 ל־100.');
    expect(screen.getByTestId('sq-discount').getAttribute('aria-invalid')).toBe('true');
    cleanup();
    render(<QuoteForm {...props({ discount: '10' })} />);
    expect(screen.queryByText('הנחה יכולה להיות בין 0 ל־100.')).toBeNull();
    const d = read('pages/Dashboard.jsx');
    expect(d).toContain('if (!Number.isFinite(d) || d < 0 || d > 100) {');
    expect(d).toContain('ההנחה צריכה להיות בין 0 ל־100 אחוז. את המחיר רושמים במוצר או בעבודה (שלב 2).');
  });
});

describe('A5: a template in another currency', () => {
  const form = { items: [{ description: 'Glass', quantity: '2', unit_price: '150' }], sections: [], currency: 'USD' };
  it('kept prices remember their currency; no prices -> no currency', () => {
    expect(buildTemplateContent(form).currency).toBe('USD');
    expect(buildTemplateContent(form, { prices: false }).currency).toBeUndefined();
  });
  it('a different quote currency is a mismatch; the same currency or an old template without one is not', () => {
    const f = templateToFormState(buildTemplateContent(form), () => 'k');
    expect(f.currency).toBe('USD');
    expect(templateCurrencyMismatch(f, 'ILS')).toBe(true);
    expect(templateCurrencyMismatch(f, 'USD')).toBe(false);
    const legacy = templateToFormState({ ...buildTemplateContent(form), currency: undefined }, () => 'k');
    expect(templateCurrencyMismatch(legacy, 'ILS')).toBe(false);
    expect(withoutPrices(f.items)).toEqual([{ ...f.items[0], unit_price: '' }]);
  });
  it('the Dashboard asks before removing prices, and the empty picker points to a standard quote', () => {
    const d = read('pages/Dashboard.jsx');
    expect(d).toContain('if (templateCurrencyMismatch(f, currency))');
    expect(d).toContain('templateItems = withoutPrices(f.items);');
    // Owner console 2026-11-08 (stage 2, typed incl. L-09): the one entry is now "הצעת מחיר" - the empty picker names it
    expect(read('components/QuoteTemplateDialogs.jsx')).toContain("empty: 'אין עדיין תבניות. אפשר ליצור הצעת מחיר ולשמור אותה כתבנית.'");
  });
});
