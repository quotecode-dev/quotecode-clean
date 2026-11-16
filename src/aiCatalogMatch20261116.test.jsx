// Owner console 2026-11-16 (typed): "מאשר שהשרת יתאים בעצמו שורה לפריט בקטלוג כשהמודל לא בחר, כדי שתיבת "להוסיף לקטלוג?" תהיה עקבית ..." +
// "מאשר שאלת כן/לא בהצעה החכמה כשההתאמה לקטלוג לא בטוחה: "האם זה המוצר X?" - כן מקשר לקטלוג, לא משאיר מוצר חדש עם הצעה להוסיף לקטלוג, בלי
// תשובה נכנס כמוצר חדש ...".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { parseDraftModelOutput, sanitizeDraftResponse, AI_QUOTE_DRAFT_CONTRACT_VERSION } from '../supabase/functions/_shared/aiQuoteDraft.js';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';

const SRC = 'הרכבת ריצוף חדש 40 מ״ר ופירוק ריצוף קיים 40 מ״ר';
const model = (items) => JSON.stringify({ subject: 'ריצוף', questions: [], changes: { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null }, items });
const line = (o) => ({ derivation: null, missing: null, catalogId: null, unitPrice: null, quantityBasis: 'stated', unit: 'm2', quantity: 40, ...o });
const CATALOG = [{ id: 38, name: 'הרכבת ריצוף', price: 400, price_basis: 'm2' }, { id: 12, name: 'ריצוף פורצלן', price: 150, price_basis: 'm2' }, { id: 5, name: 'צביעת קירות', price: 35, price_basis: 'm2' }];
const parse = (items, catalog = CATALOG) => parseDraftModelOutput(model(items), catalog, SRC, null);

describe('the server matches the catalog itself when the model chose nothing', () => {
  it('one catalog row with all its words in the line = this product (the same every run)', () => {
    const r = parse([line({ description: 'הרכבת ריצוף חדש', evidence: 'הרכבת ריצוף חדש 40 מ״ר' })]);
    expect(r.items[0].catalogId).toBe(38);
    expect(r.items[0].catalogName).toBe('הרכבת ריצוף');
    expect(r.items[0].catalogSuggestion).toBeUndefined();
  });
  it('a row that only partly fits is a suggestion (the user is asked), never a silent match', () => {
    const r = parse([line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים 40 מ״ר' })]);
    expect(r.items[0].catalogId).toBeNull();
    // two rows share "ריצוף" - of equals, the one that is not another kind of work ("הרכבת ..." for a removal) is asked about; its price
    // only for this line's unit, no price was written
    expect(r.items[0].catalogSuggestion).toMatchObject({ id: 12, name: 'ריצוף פורצלן', unitPrice: 150 });
    const one = parse([line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים 40 מ״ר' })], [CATALOG[1], CATALOG[2]]);
    expect(one.items[0].catalogSuggestion).toMatchObject({ id: 12, name: 'ריצוף פורצלן', unitPrice: 150 });
  });
  it('no row shares a specific word: no match and no question', () => {
    const r = parse([line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים 40 מ״ר' })], [{ id: 5, name: 'צביעת קירות', price: 35, price_basis: 'm2' }]);
    expect(r.items[0].catalogId).toBeNull();
    expect(r.items[0].catalogSuggestion).toBeUndefined();
  });
  it('a row for another kind of work is never a sure match - only asked about ("Tile installation" for a removal line)', () => {
    const en = parseDraftModelOutput(model([line({ description: 'Remove existing tiles', evidence: 'remove the existing tiles, 40 m²' }), line({ description: 'Install new tiles', evidence: 'install new tiles, 40 m²' })]),
      [{ id: 1, name: 'Tile installation', price: 40, price_basis: 'm2' }], 'Remove the existing tiles, 40 m², and install new tiles, 40 m².', null);
    expect(en.items[0].catalogId).toBeNull();
    expect(en.items[0].catalogSuggestion).toMatchObject({ id: 1, name: 'Tile installation' });
    expect(en.items[1].catalogId).toBe(1);
  });
  it('the browser keeps the suggestion through its own shape check', () => {
    const r = parse([line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים 40 מ״ר' })]);
    const s = sanitizeDraftResponse({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, items: r.items, changes: r.changes, questions: [], unassignedMeasures: [] });
    expect(s.items[0].catalogSuggestion).toEqual({ id: 12, name: 'ריצוף פורצלן', basis: 'm2', unitPrice: 150 });
  });
});

describe('"האם זה המוצר X?" in the review window', () => {
  const L = (o) => ({ quantity: 40, unit: 'm2', quantityBasis: 'stated', derivation: null, missing: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none', ...o });
  const DRAFT = { status: 'ok', subject: 'ריצוף', questions: [], unassignedMeasures: [], items: [
    L({ description: 'פירוק ריצוף קיים', unitPrice: 200, priceSource: 'description', catalogSuggestion: { id: 12, name: 'ריצוף פורצלן', unitPrice: null, basis: 'm2' } }),
  ] };
  const open = async (over = {}) => {
    const p = { isOpen: true, isHebrew: true, sym: '₪', formatMoneyDisplay: (n) => Number(n).toFixed(2), onClose: vi.fn(), onApply: vi.fn(), onOpenChat: vi.fn(), requestDraft: vi.fn(async () => DRAFT), saveToCatalog: vi.fn(async () => {}), ...over };
    render(<AiQuoteDraftDialog {...p} />);
    fireEvent.change(screen.getByLabelText('מה העבודה?'), { target: { value: 'פירוק ריצוף קיים 40 מ״ר לפי 200' } });
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-catalog-question')).toBeTruthy());
    return p;
  };
  it('asks the question, no "add to the catalog?" box before an answer; without an answer the line is a new product', async () => {
    const p = await open();
    expect(screen.getByTestId('ai-quote-draft-catalog-question').textContent).toContain('האם זה המוצר „ריצוף פורצלן”?');
    expect(screen.queryByTestId('ai-quote-draft-to-catalog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה/ }));
    expect(p.onApply.mock.calls[0][0][0].catalogId).toBeNull();
    expect(p.saveToCatalog).not.toHaveBeenCalled();
  });
  it('"כן" links the line to the catalog product (the written price stays)', async () => {
    const p = await open();
    fireEvent.click(screen.getByTestId('ai-quote-draft-catalog-yes'));
    expect(screen.queryByTestId('ai-quote-draft-to-catalog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה/ }));
    expect(p.onApply.mock.calls[0][0][0]).toMatchObject({ catalogId: 12, unitPrice: 200 });
  });
  it('"לא" keeps a new product and offers "להוסיף לקטלוג?"', async () => {
    const p = await open();
    fireEvent.click(screen.getByTestId('ai-quote-draft-catalog-no'));
    expect(screen.getByTestId('ai-quote-draft-to-catalog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה/ }));
    expect(p.onApply.mock.calls[0][0][0].catalogId).toBeNull();
  });
  it('English: "Is this the product “X”?" with Yes / No', async () => {
    const p = { isOpen: true, isHebrew: false, sym: '$', formatMoneyDisplay: (n) => Number(n).toFixed(2), onClose: vi.fn(), onApply: vi.fn(), onOpenChat: vi.fn(), requestDraft: vi.fn(async () => ({ ...DRAFT, items: [{ ...DRAFT.items[0], description: 'Remove existing tiles', catalogSuggestion: { id: 12, name: 'Porcelain flooring', unitPrice: null, basis: 'm2' } }] })) };
    render(<AiQuoteDraftDialog {...p} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Remove the existing tiles 40 m² at $20' } });
    fireEvent.click(screen.getByRole('button', { name: /Create a draft with AI/ }));
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-catalog-question').textContent).toContain('Is this the product “Porcelain flooring”?'));
    expect(screen.getByTestId('ai-quote-draft-catalog-yes').textContent).toBe('Yes');
    expect(screen.getByTestId('ai-quote-draft-catalog-no').textContent).toBe('No');
  });
});
