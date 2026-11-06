// Owner console 2026-11-06 (typed night-task approval incl. L-05, L-09, L-14, L-17; release B): "הצעה חכמה" and "עריכה חכמה" handle EVERY
// section of the quote - lines added / changed / removed (quantity, price, description), the notes and the discount. The Owner's example:
// "add 2 sentences to the notes" came back as item lines. Every number of a change must be written in the user's own request.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { parseDraftModelOutput, parseDraftChanges, sanitizeQuoteSnapshot, validateDraftRequest, buildDraftMessages } from '../supabase/functions/_shared/aiQuoteDraft.js';
import { aiQuoteSnapshot, applyDraftUpdateToItem, applyDraftNotes } from './utils/aiQuoteDraftClient';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';

afterEach(cleanup);
const QUOTE = sanitizeQuoteSnapshot({ items: [{ description: 'חלון אלומיניום', quantity: 3, unit: 'unit' }, { description: 'רשת', quantity: 2, unit: 'unit' }], notes: 'הערה קיימת', discountPercent: 0 });
const out = (changes, items = []) => JSON.stringify({ subject: '', questions: [], items, changes });

describe('the server: the changes, every number verified in the request', () => {
  it('the Owner\'s example: "add 2 sentences to the notes" is a notes change, never an item line', () => {
    const r = parseDraftModelOutput(out({ updates: [], deletes: [], notes: { action: 'append', text: 'העבודה תתבצע תוך שבוע.\nהאחריות לשנה.' }, discountPercent: null }), [], 'תוסיף 2 משפטים להערות: העבודה תתבצע תוך שבוע והאחריות לשנה', QUOTE);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([]);
    expect(r.changes.notes).toEqual({ action: 'append', text: 'העבודה תתבצע תוך שבוע.\nהאחריות לשנה.' });
  });
  it('a quantity / price / discount written in the request is kept; one the request never wrote is dropped (never guessed)', () => {
    const c = parseDraftChanges({ updates: [{ ref: 1, description: null, quantity: 4, unit: 'unit', unitPrice: 1500 }, { ref: 2, description: null, quantity: 7, unit: null, unitPrice: 99 }],
      deletes: [], notes: { action: 'none', text: '' }, discountPercent: 15 }, QUOTE, 'תשנה ל-4 חלונות במחיר 1500 ותן הנחה של 10%');
    expect(c.updates).toEqual([{ ref: 1, description: null, quantity: 4, unit: 'unit', unitPrice: 1500 }]); // ref 2: 7 and 99 were never written
    expect(c.discountPercent).toBeNull(); // 15 was never written (10 was)
    expect(parseDraftChanges({ updates: [], deletes: [], notes: null, discountPercent: 10 }, QUOTE, 'הנחה של 10%').discountPercent).toBe(10);
  });
  it('refs must exist; a line both changed and removed is only changed; an unchanged value is not a change', () => {
    const c = parseDraftChanges({ updates: [{ ref: 9, description: 'x', quantity: null, unit: null, unitPrice: null }, { ref: 1, description: 'חלון אלומיניום', quantity: 3, unit: null, unitPrice: null },
      { ref: 2, description: 'רשת נגד יתושים', quantity: null, unit: null, unitPrice: null }], deletes: [2, 9, 1], notes: { action: 'none', text: '' }, discountPercent: null }, QUOTE, 'תמחק את החלון, 3');
    expect(c.updates).toEqual([{ ref: 2, description: 'רשת נגד יתושים', quantity: null, unit: null, unitPrice: null }]);
    expect(c.deletes).toEqual([1]);
  });
  it('without an open quote no line can be changed or removed; notes / discount still can (a new quote)', () => {
    const c = parseDraftChanges({ updates: [{ ref: 1, description: 'x', quantity: null, unit: null, unitPrice: null }], deletes: [1], notes: { action: 'replace', text: 'תשלום מראש.' }, discountPercent: 5 }, null, 'הנחה 5%, הערה: תשלום מראש');
    expect(c).toEqual({ updates: [], deletes: [], notes: { action: 'replace', text: 'תשלום מראש.' }, discountPercent: 5 });
  });
  // Owner console 2026-11-06 (release C, L-14 / L-17): found on LIVE - "הוסיפו הנחה של 5%" came back as the discount AND as a notes line
  it('a discount request never touches the notes; a notes change needs the request to name the notes and is never the request itself', () => {
    const live = parseDraftChanges({ updates: [], deletes: [], notes: { action: 'append', text: 'הוסיפו הנחה של 5%' }, discountPercent: 5 }, QUOTE, 'הוסיפו הנחה של 5%');
    expect(live).toEqual({ updates: [], deletes: [], notes: null, discountPercent: 5 });
    const en = parseDraftChanges({ updates: [], deletes: [], notes: { action: 'append', text: 'A 5% discount.' }, discountPercent: 5 }, QUOTE, 'Add a 5% discount');
    expect(en).toEqual({ updates: [], deletes: [], notes: null, discountPercent: 5 });
    const copy = parseDraftChanges({ updates: [], deletes: [], notes: { action: 'append', text: 'תוסיף להערות: תשלום מראש' }, discountPercent: null }, QUOTE, 'תוסיף להערות: תשלום מראש');
    expect(copy.notes).toBeNull();
    expect(parseDraftChanges({ updates: [], deletes: [], notes: { action: 'append', text: 'Payment in advance.' }, discountPercent: null }, QUOTE, 'Add to the notes: payment in advance').notes)
      .toEqual({ action: 'append', text: 'Payment in advance.' });
  });
  it('nothing new and nothing changed is still "empty"', () => {
    expect(parseDraftModelOutput(out({ updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null }), [], 'משהו', QUOTE)).toEqual({ ok: false, code: 'empty' });
  });
  it('the request carries the open quote WITHOUT a price; the model sees the lines by ref and the notes', () => {
    const v = validateDraftRequest({ description: 'תוסיף הערה', quote: { items: [{ description: 'חלון', quantity: 3, unit: 'unit', unitPrice: 1450 }], notes: 'א', discountPercent: 5 } });
    expect(v.value.quote).toEqual({ items: [{ ref: 1, description: 'חלון', quantity: 3, unit: 'unit' }], notes: 'א', discountPercent: 5 });
    const msgs = buildDraftMessages({ description: 'תוסיף הערה', isHebrew: true, catalog: [], quote: v.value.quote });
    expect(JSON.parse(msgs[1].content).currentQuote).toEqual({ items: [{ ref: 1, description: 'חלון', quantity: 3, unit: 'unit' }], notes: 'א', discountPercent: 5 });
    expect(msgs[1].content).not.toContain('1450');
    expect(msgs[0].content).toMatch(/A request about the notes NEVER becomes an item/);
    expect(validateDraftRequest({ description: 'תוסיף הערה', quote: { items: Array.from({ length: 61 }, () => ({ description: 'x' })) } })).toEqual({ ok: false, reason: 'quote_invalid' });
  });
});

describe('the browser: the change applied to the form', () => {
  it('the snapshot: real lines only, never a price to the server, the line objects kept for the apply', () => {
    const a = { description: 'חלון', quantity: '3', unit_price: '1450' }; const b = { description: '', quantity: '1', unit_price: '' };
    const s = aiQuoteSnapshot([a, b], 'הערה', '10', (it) => !!it.description);
    expect(s.snapshot).toEqual({ items: [{ ref: 1, description: 'חלון', quantity: 3, unit: null, unitPrice: 1450 }], notes: 'הערה', discountPercent: 10 });
    expect(s.real).toEqual([a]);
    expect(aiQuoteSnapshot([b], '', '', (it) => !!it.description).empty).toBe(true);
  });
  it('a quantity goes where the line keeps it (plain / calculated / measured); a price and a description replace; a new unit reshapes the line', () => {
    expect(applyDraftUpdateToItem({ description: 'ידית', quantity: '1', unit_price: '40' }, { quantity: 3, unitPrice: 45, description: null })).toEqual({ description: 'ידית', quantity: '3', unit_price: '45' });
    expect(applyDraftUpdateToItem({ description: 'חשמלאי', quantity: '1', unit_price: '100', pricing_unit: 'hour', calculated_quantity: 5 }, { quantity: 7.5 }).calculated_quantity).toBe(7.5);
    expect(applyDraftUpdateToItem({ description: 'ריצוף', quantity: '1', unit_price: '90', pricing_unit: 'm2', calculated_quantity: 20, quantity_source: 'calculated', measurements: [{ width: 4, height: 5 }] }, { quantity: 24 }))
      .toMatchObject({ calculated_quantity: 24, quantity_source: 'manual', calculation_method: 'manual' });
    expect(applyDraftUpdateToItem({ description: 'צבע', quantity: '1', unit_price: '30' }, { quantity: 85, unit: 'm2' })).toMatchObject({ pricing_unit: 'm2', calculated_quantity: 85, unit_price: '30', description: 'צבע' });
    expect(applyDraftUpdateToItem({ description: 'א', quantity: '2', unit_price: '5' }, { description: 'ב' }).description).toBe('ב');
  });
  it('the notes: append on a new line, replace, clear', () => {
    expect(applyDraftNotes('קיים', { action: 'append', text: 'חדש' })).toBe('קיים\nחדש');
    expect(applyDraftNotes('', { action: 'append', text: 'חדש' })).toBe('חדש');
    expect(applyDraftNotes('קיים', { action: 'replace', text: 'חדש' })).toBe('חדש');
    expect(applyDraftNotes('קיים', { action: 'clear', text: '' })).toBe('');
  });
});

describe('the dialog: the changes are listed, ticked by default, applied only when ticked (HE)', () => {
  const currentQuote = { items: [{ ref: 1, description: 'חלון אלומיניום', quantity: 3, unit: 'unit', unitPrice: 1450 }, { ref: 2, description: 'רשת', quantity: 2, unit: 'unit', unitPrice: 80 }], notes: 'קיים', discountPercent: 0 };
  const changes = { updates: [{ ref: 1, description: null, quantity: 4, unit: 'unit', unitPrice: 1500 }], deletes: [2], notes: { action: 'append', text: 'העבודה תתבצע תוך שבוע.' }, discountPercent: 10 };
  it('notes-only and line changes without new lines can be applied; an unticked change is left out', async () => {
    const onApply = vi.fn();
    render(<AiQuoteDraftDialog isOpen isHebrew sym="₪" formatMoneyDisplay={(n) => Number(n).toFixed(2)} onClose={vi.fn()} onApply={onApply} onOpenChat={vi.fn()}
      editMode quoteLabel="A1040" currentQuote={currentQuote} requestDraft={vi.fn(async () => ({ status: 'ok', subject: '', items: [], questions: [], unassignedMeasures: [], changes }))} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'תשנה ל-4 חלונות במחיר 1500, תמחק את הרשת, תוסיף הערה והנחה של 10%' } });
    fireEvent.click(screen.getByRole('button', { name: /AI/ }));
    const rows = await screen.findAllByTestId('ai-quote-draft-change');
    expect(rows.map((r) => r.textContent)).toEqual([
      '„חלון אלומיניום”: כמות: 4 (במקום 3); מחיר: ₪1500.00 (במקום ₪1450.00)',
      'מחיקת השורה „רשת”',
      'הוספה להערות: העבודה תתבצע תוך שבוע.',
      'הנחה: 10%',
    ]);
    expect(screen.queryByTestId('ai-quote-draft-lines')).toBeNull(); // no new lines - no empty list
    fireEvent.click(rows[1].querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: 'החלת השינויים בהצעה' }));
    expect(onApply).toHaveBeenCalledWith([], '', [
      { kind: 'update', ref: 1, description: null, quantity: 4, unit: 'unit', unitPrice: 1500 },
      { kind: 'notes', action: 'append', text: 'העבודה תתבצע תוך שבוע.' },
      { kind: 'discount', percent: 10 },
    ]);
  });
});

describe('the dialog never shows a line change for a line it does not know', () => {
  it('no open quote (a new quote): only the notes / discount changes are listed', async () => {
    render(<AiQuoteDraftDialog isOpen isHebrew sym="₪" formatMoneyDisplay={(n) => Number(n).toFixed(2)} onClose={vi.fn()} onApply={vi.fn()} onOpenChat={vi.fn()}
      currentQuote={null} requestDraft={vi.fn(async () => ({ status: 'ok', subject: '', items: [], questions: [], unassignedMeasures: [],
        changes: { updates: [{ ref: 1, description: null, quantity: 4, unit: null, unitPrice: null }], deletes: [2], notes: { action: 'replace', text: 'תשלום מראש.' }, discountPercent: null } }))} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'הערה: תשלום מראש' } });
    fireEvent.click(screen.getByRole('button', { name: /AI/ }));
    const rows = await screen.findAllByTestId('ai-quote-draft-change');
    expect(rows.map((r) => r.dataset.kind)).toEqual(['notes']);
  });
});

describe('the dashboard wiring', () => {
  const src = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  it('L-05: "עריכה חכמה" checks SMART PACK at the click, before the quote or the dialog opens', () => {
    const at = src.indexOf('const handleAiEditClick = async (quote) => {');
    expect(src.slice(at, at + 400)).toMatch(/if \(!smartPackAllowed\) \{ setLockedCapability\('smart_pack'\); return; \}\s+if \(isQuoteImmutable\(quote\)\)/);
  });
  it('the request carries the open quote taken at that moment; the apply changes exactly those lines, the notes and the discount', () => {
    expect(src).toContain('requestDraft={requestAiDraftForForm}');
    expect(src).toContain('currentQuote={aiCurrentQuote}');
    expect(src).toMatch(/const real = aiSnapshotRef\.current\?\.real \|\| \[\];/);
    expect(src).toMatch(/if \(notesChange\) setNotes\(\(prev\) => applyDraftNotes\(prev, notesChange\)\);/);
    expect(src).toMatch(/if \(discountChange\) setDiscount\(String\(discountChange\.percent\)\);/);
  });
});
