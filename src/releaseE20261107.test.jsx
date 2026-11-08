// Owner console 2026-11-07 (typed: "מאשר את שחרור ד׳ ושחרור ה׳ לפי ההמלצות, סעיף 3 לספור, סעיף 9 בלי אזור זמן, כולל שינוי ב-L-01, L-05, L-06,
// L-09, L-11, L-12, L-14, L-17, L-22" + "מאשר את התוכנית לשחרור ה׳ ואחריו שחרור ד׳ כפי שהוצגה"): release E - the usage line in the chat and
// through the review, a unit-only smart-edit change, the English terms without a time zone, the quick price window's tax word by market.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { parseDraftChanges, requestNamesUnit, sanitizeQuoteSnapshot, sanitizeDraftResponse, AI_QUOTE_DRAFT_CONTRACT_VERSION } from '../supabase/functions/_shared/aiQuoteDraft.js';
import { applyDraftUpdateToItem } from './utils/aiQuoteDraftClient';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';

afterEach(cleanup);
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('F03: a unit-only smart-edit change', () => {
  const QUOTE = sanitizeQuoteSnapshot({ items: [{ description: 'ריצוף', quantity: 12, unit: 'm2' }, { description: 'הובלה', quantity: 3, unit: 'kg' }], notes: '', discountPercent: 0 });
  it('kept, with the quantity unchanged, when the request names the new unit', () => {
    const c = parseDraftChanges({ updates: [{ ref: 2, quantity: 3, unit: 'hour', unitPrice: null, description: null }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'תשנה את היחידה של שורה 2 לשעות');
    expect(c.updates).toEqual([{ ref: 2, description: null, quantity: null, unit: 'hour', unitPrice: null }]);
    const en = parseDraftChanges({ updates: [{ ref: 2, quantity: null, unit: 'hour' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'Change the unit of line 2 to hours');
    expect(en.updates[0].unit).toBe('hour');
  });
  it('dropped when the request does not name that unit, or when the unit does not change', () => {
    expect(parseDraftChanges({ updates: [{ ref: 2, quantity: null, unit: 'hour' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'הוסיפו הנחה של 5%').updates).toEqual([]);
    expect(parseDraftChanges({ updates: [{ ref: 2, quantity: null, unit: 'kg' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'השורה השנייה בקילו').updates).toEqual([]);
  });
  it('a quantity change keeps working as before (quantity + its unit)', () => {
    const c = parseDraftChanges({ updates: [{ ref: 1, quantity: 15, unit: 'm2' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'הריצוף 15 מ״ר');
    expect(c.updates).toEqual([{ ref: 1, description: null, quantity: 15, unit: 'm2', unitPrice: null }]);
  });
  it('the unit words: a word start or after a Hebrew prefix letter; never inside another word', () => {
    expect(requestNamesUnit('לשעות', 'hour')).toBe(true);
    expect(requestNamesUnit('ביחידות', 'unit')).toBe(true);
    expect(requestNamesUnit('per day please', 'day')).toBe(true);
    expect(requestNamesUnit('מרפסת', 'm2')).toBe(false);
    expect(requestNamesUnit('weekdays', 'day')).toBe(false);
  });
  it('the browser keeps the unit-only change the server sent (the response check does not drop it)', () => {
    const d = sanitizeDraftResponse({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, subject: '', items: [], questions: [], unassignedMeasures: [],
      changes: { updates: [{ ref: 2, description: null, quantity: null, unit: 'hour', unitPrice: null }], deletes: [], notes: null, discountPercent: null } });
    expect(d.changes.updates).toEqual([{ ref: 2, description: null, quantity: null, unit: 'hour', unitPrice: null }]);
  });
  it('applied in the form: the new unit, the same quantity, the price kept', () => {
    const item = { description: 'הובלה', quantity: '3', unit_price: '200', pricing_unit: 'kg' };
    const next = applyDraftUpdateToItem(item, { ref: 2, description: null, quantity: null, unit: 'hour', unitPrice: null });
    expect(next.pricing_unit).toBe('hour');
    expect(Number(next.calculated_quantity ?? next.quantity)).toBe(3);
    expect(next.unit_price).toBe('200');
  });
});

describe('F01: the usage line', () => {
  it('the AI smart quote / smart edit: the line stays visible while the result is reviewed', async () => {
    const readUsage = vi.fn().mockResolvedValueOnce({ percentLeft: 40, unlimited: false }).mockResolvedValue({ percentLeft: 38, unlimited: false });
    const requestDraft = vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: [], items: [
      { description: 'חלון', quantity: 3, unit: 'unit', quantityBasis: 'stated', derivation: null, missing: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none' }] }));
    render(<AiQuoteDraftDialog isOpen isHebrew sym="₪" formatMoneyDisplay={(n) => Number(n).toFixed(2)} onClose={vi.fn()} onApply={vi.fn()} onOpenChat={vi.fn()} requestDraft={requestDraft} readUsage={readUsage} />);
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-usage').textContent).toBe('נשארו לכם 40% משימוש חכם פלוס החודש'));
    fireEvent.change(screen.getByLabelText('מה העבודה?'), { target: { value: 'החלפת 3 חלונות בסלון' } });
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-usage').textContent).toBe('נשארו לכם 38% משימוש חכם פלוס החודש'));
    expect(screen.getByText('טיוטה מוצעת — בדקו לפני שמוסיפים')).toBeTruthy();
  });
  it('the smart quote reads the line again after a dictation; the quote from a file keeps it in its review', () => {
    const dialog = src('./components/AiQuoteDraftDialog.jsx');
    expect(dialog).toMatch(/function handleVoiceText\(text\) \{\n {4}refreshUsage\(\);/);
    const file = src('./components/QuoteFromFileDialog.jsx');
    const review = file.slice(file.indexOf('{t.reviewHint}</p>'));
    expect(review.slice(0, 600)).toMatch(/data-testid="quote-from-file-allowance"/);
  });
  it('the chat: the same line, read on open, after every answer and after a dictation; wired on the dashboard', () => {
    const chat = src('./AIChatWidget.jsx');
    expect(chat).toMatch(/useEffect\(\(\) => \{ if \(isOpen\) refreshChatUsage\(\); \}, \[isOpen\]\);/);
    expect(chat).toMatch(/finally \{ setTranscribing\(false\); refreshChatUsage\(\); \}/);
    expect(chat).toMatch(/applyIfCurrent\(\(\) => setLoading\(false\)\);\n {6}refreshChatUsage\(\);/);
    expect(chat).toMatch(/smartPackUsageText\(chatUsage, isHebrew\) && <div data-testid="ai-chat-usage"/);
    expect(src('./pages/Dashboard.jsx').match(/<AIChatWidget [^>]*readUsage=\{readSmartPackUsage\}/g)).toHaveLength(2);
  });
});

describe('F04 / F05: market wording', () => {
  it('the English terms: the monthly allowance renews on the 1st, no time zone named', () => {
    const terms = src('./pages/Terms.jsx');
    expect(terms).toContain('renews on the 1st of each month');
    expect(terms).not.toContain('calendar month (Israel time)');
  });
  // Owner console 2026-11-08 (stage 2 of the one quote builder, typed incl. L-09 / L-17): the quick price window and its totals note are gone -
  // the price is edited in the row; the row editor still gets the account market (never the display language)
  it('the quote rows get the account market for their size units (never the display language)', () => {
    expect(src('./components/QuoteForm.jsx')).toContain('international={isLocalIsraeliBusiness === false}');
    expect(src('./components/QuoteForm.jsx')).not.toContain('EditItemPriceDialog');
  });
});
