// Task 35 (Codex F4): a line whose price was never entered must not silently become a free line. Written to FAIL before the fix.
//   editor: unit_price '' / null = missing, '0' / 0 = an intentional free line;
//   saved:  quote_items.price_missing === true (forward-only column) - a historical 0 is never reinterpreted as missing;
//   save:   the payload carries price_missing; unit_price stays the NOT NULL numeric 0 for a missing price (totals = partial);
//   output: every customer channel warns with the exact lines and the partial total; the policy (confirm | block) is ONE constant.
import { describe, it, expect } from 'vitest';
import { isItemPriceMissing, missingPriceItems, missingPriceOutputNotice, MISSING_PRICE_OUTPUT_POLICY } from './quoteCompleteness';
import { itemPricePayload, formPriceFromSavedItem } from './itemPrice';

describe('missing price vs intentional 0', () => {
  it('editor items: "" / null / undefined = missing; 0 / "0" = intentional; a priced line is priced', () => {
    expect(['', null, undefined].map((p) => isItemPriceMissing({ description: 'x', unit_price: p }))).toEqual([true, true, true]);
    expect([0, '0', '0.00', 12, '12.5'].map((p) => isItemPriceMissing({ description: 'x', unit_price: p }))).toEqual([false, false, false, false, false]);
  });
  it('saved rows: only price_missing === true is missing (historical 0 stays an intentional 0)', () => {
    expect(isItemPriceMissing({ description: 'x', unit_price: 0, price_missing: true })).toBe(true);
    expect(isItemPriceMissing({ description: 'x', unit_price: 0 })).toBe(false);
    expect(isItemPriceMissing({ description: 'x', unit_price: 0, price_missing: false })).toBe(false);
  });
  it('the untouched default row and nameless rows are not "missing price" lines', () => {
    const items = [{ description: '', quantity: '1', unit_price: '' }, { description: 'ריצוף', unit_price: '' }, { description: 'צבע', unit_price: '0' }];
    expect(missingPriceItems(items).map((i) => i.description)).toEqual(['ריצוף']);
  });
});

describe('save payload (F4: never a silent 0)', () => {
  it('a missing price is sent as price_missing=true with the NOT NULL numeric 0 and a 0 line total', () => {
    expect(itemPricePayload({ unit_price: '' }, 3)).toEqual({ unit_price: 0, total_price: 0, price_missing: true });
    expect(itemPricePayload({ unit_price: null }, 1)).toEqual({ unit_price: 0, total_price: 0, price_missing: true });
  });
  it('an intentional 0 and a real price are sent with price_missing=false', () => {
    expect(itemPricePayload({ unit_price: '0' }, 2)).toEqual({ unit_price: 0, total_price: 0, price_missing: false });
    expect(itemPricePayload({ unit_price: '12.5' }, 4)).toEqual({ unit_price: 12.5, total_price: 50, price_missing: false });
  });
  it('load: a saved missing price returns to the form as "" (missing), a saved 0 / price stays as stored', () => {
    expect(formPriceFromSavedItem({ unit_price: 0, price_missing: true })).toBe('');
    expect(formPriceFromSavedItem({ unit_price: 0, price_missing: false })).toBe(0);
    expect(formPriceFromSavedItem({ unit_price: 0 })).toBe(0); // column not there yet / historical row
    expect(formPriceFromSavedItem({ unit_price: 99 })).toBe(99);
  });
});

describe('customer output notice (copy / WhatsApp / email / public_share / final_pdf / final_print)', () => {
  const quote = { total: 1000, currency: 'ILS', quote_items: [
    { description: 'ריצוף חדר הורים', unit_price: 100, price_missing: false },
    { description: 'פירוק ריצוף קיים', unit_price: 0, price_missing: true },
    { description: 'פינוי פסולת', unit_price: 0, price_missing: true },
    { description: 'מתנה', unit_price: 0, price_missing: false },
  ] };
  it('names the exact lines, the count and that the total is partial (HE / EN)', () => {
    const he = missingPriceOutputNotice(quote, { isHebrew: true });
    expect(he.count).toBe(2);
    expect(he.text).toContain('2 פריטים ללא מחיר');
    expect(he.text).toContain('„פירוק ריצוף קיים”');
    expect(he.text).toContain('„פינוי פסולת”');
    expect(he.text).toContain('חלקי');
    expect(he.text).not.toContain('מתנה');
    const en = missingPriceOutputNotice(quote, { isHebrew: false });
    expect(en.text).toContain('2 items without a price');
    expect(en.text).toContain('partial');
  });
  it('no missing line -> no notice (an intentional 0 never warns); the decision model is one explicit constant', () => {
    expect(missingPriceOutputNotice({ total: 5, quote_items: [{ description: 'מתנה', unit_price: 0 }] }, { isHebrew: true })).toBeNull();
    expect(['confirm', 'block']).toContain(MISSING_PRICE_OUTPUT_POLICY);
    expect(missingPriceOutputNotice(quote, { isHebrew: true, policy: 'block' }).blocked).toBe(true);
    expect(missingPriceOutputNotice(quote, { isHebrew: true, policy: 'confirm' }).blocked).toBe(false);
  });
  it('lists at most 3 names and says how many more', () => {
    const many = { total: 1, quote_items: ['א', 'ב', 'ג', 'ד', 'ה'].map((d) => ({ description: `עבודה ${d}`, unit_price: 0, price_missing: true })) };
    const n = missingPriceOutputNotice(many, { isHebrew: true });
    expect(n.count).toBe(5);
    expect(n.text).toContain('ועוד 2');
  });
});

describe('public quote page (DTO items carry "price"; only the explicit flag counts)', () => {
  it('a DTO without the flag never warns (historical / intentional 0); a flagged line does', async () => {
    const { publicItemsForNotice } = await import('./quoteCompleteness');
    const dto = [{ description: 'ריצוף', price: 100 }, { description: 'פינוי', price: 0 }, { description: 'מתנה', price: 0 }];
    expect(missingPriceOutputNotice({ total: 100 }, { isHebrew: true, items: publicItemsForNotice(dto) })).toBeNull();
    const flagged = missingPriceOutputNotice({ total: 100 }, { isHebrew: true, items: publicItemsForNotice([...dto.slice(0, 1), { description: 'פינוי', price: 0, price_missing: true }]) });
    expect(flagged.count).toBe(1);
    expect(flagged.text).toContain('„פינוי”');
    expect(flagged.text).toContain('פריט אחד ללא מחיר');
    expect(missingPriceOutputNotice({ total: 1 }, { isHebrew: false, items: publicItemsForNotice([{ description: 'x', price: 0, price_missing: true }]) }).text).toContain('1 item without a price');
  });
});

// Task 36 (Owner, section A): the customer message (copy / WhatsApp) of a quote with unpriced lines says the total is partial, in the
// QUOTE's language, on its own line (never inside the LTR-isolated {total} value); an ordinary quote's message is unchanged.
describe('share message: partial total line', () => {
  it('adds one line in the quote language only when a line is flagged', async () => {
    const { appendPartialTotalNote } = await import('./quoteCompleteness');
    const flagged = { quote_items: [{ description: 'א', unit_price: 100 }, { description: 'ב', unit_price: 0, price_missing: true }] };
    const plain = { quote_items: [{ description: 'א', unit_price: 100 }, { description: 'מתנה', unit_price: 0 }] };
    expect(appendPartialTotalNote('MSG', plain, true)).toBe('MSG');
    expect(appendPartialTotalNote('MSG', flagged, true)).toBe('MSG\n\nשימו לב: הסכום בהצעה חלקי - יש בה פריטים שטרם תומחרו.');
    expect(appendPartialTotalNote('MSG', flagged, false)).toBe('MSG\n\nPlease note: the quote total is partial - some items are not priced yet.');
  });
});

// Task 36 (Owner, section A): quote -> template -> new quote keeps a missing price missing (Number('') is 0 - it must not become a free 0)
describe('template round trip', () => {
  it('a missing price stays missing; an intentional 0 stays 0', async () => {
    const { buildTemplateContent, templateToFormState } = await import('./quoteTemplates');
    let k = 0;
    const content = buildTemplateContent({ items: [{ description: 'חסר', quantity: '2', unit_price: '' }, { description: 'מתנה', quantity: '1', unit_price: '0' }, { description: 'רגיל', quantity: '1', unit_price: '50' }], sections: [] });
    const back = templateToFormState(content, () => `k${k++}`).items;
    expect(back.map((i) => [i.description, i.unit_price])).toEqual([['חסר', ''], ['מתנה', '0'], ['רגיל', '50']]);
  });
});

// Task 37 (Owner D1 = block): customer output is blocked until every required price is entered; the notice names the lines and the way
// to complete them; an intentional 0 is not missing and never blocks.
describe('D1 = block (Owner decision 2026-10-12)', () => {
  it('the policy constant is block and the default notice is a block', () => {
    expect(MISSING_PRICE_OUTPUT_POLICY).toBe('block');
    const q = { total: 5, quote_items: [{ description: 'פינוי', unit_price: 0, price_missing: true }] };
    const he = missingPriceOutputNotice(q, { isHebrew: true });
    expect(he.blocked).toBe(true);
    expect(he.text).toContain('„פינוי”');
    expect(he.text).toContain('ערוך מחיר');
    expect(he.text).not.toContain('להמשיך בכל זאת');
    const en = missingPriceOutputNotice(q, { isHebrew: false });
    expect(en.blocked).toBe(true);
    expect(en.text).toContain('Edit price');
    expect(missingPriceOutputNotice({ total: 5, quote_items: [{ description: 'מתנה', unit_price: 0 }] }, { isHebrew: true })).toBeNull();
  });
});
