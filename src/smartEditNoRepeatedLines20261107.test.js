import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, sanitizeQuoteSnapshot } from '../supabase/functions/_shared/aiQuoteDraft.js';

// Owner console 2026-11-07 (typed: "מאשר שבעריכה חכמה השרת יזרוק פריט שחוזר על שורה קיימת או שאין לו מילים מהבקשה, כולל שינוי ב-L-09 ו-L-22"):
// LIVE 2026-11-07, quote A100717 - "הוסיפו הנחה של 5%" returned the discount AND the quote's own two lines as new items.
const QUOTE = sanitizeQuoteSnapshot({ items: [{ description: 'ריצוף חדש', quantity: 12, unit: 'm2' }, { description: 'אסלה תלויה', quantity: 1, unit: 'unit' }], notes: '', discountPercent: 0 });
const item = (description, evidence = '', quantity = null, unit = null) => ({ description, evidence, quantity, unit, quantityBasis: quantity == null ? 'missing' : 'stated', derivation: null, missing: null, catalogId: null });
const out = (items, discountPercent = null) => JSON.stringify({ subject: 'הנחה', questions: [], items, changes: { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent } });

describe('smart edit: a new line never repeats an existing line and comes from the request', () => {
  it('the LIVE case: the discount stays, the two repeated existing lines are dropped', () => {
    const r = parseDraftModelOutput(out([item('ריצוף חדש'), item('אסלה תלויה')], 5), [], 'הוסיפו הנחה של 5%', QUOTE);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([]);
    expect(r.changes.discountPercent).toBe(5);
  });
  it('a line with no words of the request is dropped; a line the request names is kept', () => {
    const r = parseDraftModelOutput(out([item('צביעת קירות'), item('התקנת מזגן', 'התקנת מזגן', 1, 'unit')]), [], 'הוסיפו התקנת מזגן', QUOTE);
    expect(r.ok).toBe(true);
    expect(r.items.map((x) => x.description)).toEqual(['התקנת מזגן']);
  });
  it('a line the request names keeps working even when the model\'s evidence is not exact', () => {
    const r = parseDraftModelOutput(out([item('התקנת מזגן עילי', 'להתקין מזגן')]), [], 'תוסיפו גם מזגן עילי בסלון', QUOTE);
    expect(r.items.map((x) => x.description)).toEqual(['התקנת מזגן עילי']);
  });
  it('only repeated lines and nothing else -> empty (nothing to show), never the old lines again', () => {
    expect(parseDraftModelOutput(out([item('ריצוף חדש')]), [], 'משהו', QUOTE)).toEqual({ ok: false, code: 'empty' });
  });
  it('creating a quote (no current quote) is unchanged: a line without evidence is still offered', () => {
    const r = parseDraftModelOutput(out([item('ריצוף חדש')]), [], 'הצעה לשיפוץ אמבטיה', null);
    expect(r.ok).toBe(true);
    expect(r.items.map((x) => x.description)).toEqual(['ריצוף חדש']);
  });
});
