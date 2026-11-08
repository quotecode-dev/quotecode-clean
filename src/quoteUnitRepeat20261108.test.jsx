// Owner console 2026-11-08 (stage 3 of the one quote builder, typed: "מאשר את שלב 3 (דירות זהות ומחיר משותף) ... כולל מיגרציה ושינוי
// ב-L-09, L-17, L-24, L-25, L-26, L-27, L-28"): identical units (quote_sections.repeat_count) and a shared price (quote_items.price_link_id)
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import QuoteRowsEditor from './components/QuoteRowsEditor';
import { normalizeRepeatCount, sectionRepeatOf, withWeightedActiveQuantities } from './utils/professionalQuoteItem';
import { calculateQuoteFinancials } from './utils/regionConfig';
import { isFinancialChange } from './utils/financialEdit';
import { buildCustomerPresentationModel, buildEditorPresentationModel } from './utils/quotePresentationModel';
import { buildPreviewQuoteData } from './components/quotePresentation/buildPreviewQuoteData';
import { buildTemplateContent, templateSummary, templateToFormState } from './utils/quoteTemplates';
import { serverFingerprintFromQuote } from './utils/quoteDraft';
import { sanitizeQuoteContext, buildQuoteContextBlock } from '../supabase/functions/chat-ai/quoteContext';
import { answerAppDialog } from './test/appDialog';

afterEach(cleanup);
const read = (p) => readFileSync(p, 'utf8');

describe('the unit count - one helper, applied once', () => {
  it('a whole number 1..999; anything else counts once', () => {
    expect([1, 2, 12, 999].map(normalizeRepeatCount)).toEqual([1, 2, 12, 999]);
    expect([0, 1000, 1.5, -3, '', null, undefined, 'x'].map(normalizeRepeatCount)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });
  it('a row joins its unit (editor or saved shape); no unit = 1', () => {
    const sections = [{ key: 'a', id: 'A', repeat_count: 12 }];
    expect(sectionRepeatOf({ section_key: 'a' }, sections)).toBe(12);
    expect(sectionRepeatOf({ section_id: 'A' }, sections, { itemKeyField: 'section_id', sectionKeyField: 'id' })).toBe(12);
    expect(sectionRepeatOf({ section_key: null }, sections)).toBe(1);
    expect(sectionRepeatOf({ section_key: 'gone' }, sections)).toBe(1);
  });
  it('the quote total: 12 copies of a 2,530 unit + an unassigned 100 row = 30,460; discount and VAT once on the weighted sum', () => {
    const sections = [{ key: 'a', name: 'דירה טיפוס א׳', repeat_count: 12 }];
    const items = [
      { description: 'ריצוף', quantity: '1', unit_price: '2000', section_key: 'a' },
      { description: 'צבע', quantity: '1', unit_price: '530', section_key: 'a' },
      { description: 'הובלה', quantity: '1', unit_price: '100', section_key: null },
    ];
    const r = calculateQuoteFinancials({ country: 'Local', currency: 'ILS', clientType: 'business', items: withWeightedActiveQuantities(items, sections), discount: 10 });
    expect(r.enteredSubtotal).toBe(30460);
    expect(r.discountAmount).toBeCloseTo(3046, 2);
    // at 1 the totals are exactly the totals of before
    const one = calculateQuoteFinancials({ country: 'Local', currency: 'ILS', clientType: 'business', items: withWeightedActiveQuantities(items, [{ key: 'a', repeat_count: 1 }]), discount: 10 });
    expect(one.enteredSubtotal).toBe(2630);
  });
  it('a change of the count alone is a financial change (the save recalculates); the same count is not', () => {
    const items = [{ id: 'i', quantity: '1', unit_price: '100', section_key: 'S' }];
    const saved = [{ id: 'i', quantity: 1, unit_price: 100, section_id: 'S' }];
    const base = { items, discount: 0, clientType: 'business', savedItems: saved, savedDiscount: 0, savedClientType: 'business' };
    expect(isFinancialChange({ ...base, sections: [{ key: 'S', repeat_count: 3 }], savedSections: [{ id: 'S', repeat_count: 2 }] }).changed).toBe(true);
    expect(isFinancialChange({ ...base, sections: [{ key: 'S', repeat_count: 2 }], savedSections: [{ id: 'S', repeat_count: 2 }] }).changed).toBe(false);
    // an old quote / a caller without sections: exactly the previous rule
    expect(isFinancialChange(base).changed).toBe(false);
  });
});

describe('the customer quote and the preview', () => {
  const sections = [{ id: 'A', name: 'דירה טיפוס א׳', repeat_count: 12 }, { id: 'B', name: 'דירה 7' }];
  const items = [
    { description: 'ריצוף', quantity: 1, price: 2000, total_price: 2000, section_id: 'A' },
    { description: 'צבע', quantity: 1, price: 530, total_price: 530, section_id: 'A' },
    { description: 'מטבח', quantity: 1, price: 900, total_price: 900, section_id: 'B' },
  ];
  it('a unit keeps ONE copy as its subtotal, all copies as unitTotal; the quote subtotal counts each copy once', () => {
    const m = buildCustomerPresentationModel(items, sections);
    expect(m.units.map((u) => [u.title, u.subtotal, u.repeatCount, u.unitTotal])).toEqual([['דירה טיפוס א׳', 2530, 12, 30360], ['דירה 7', 900, 1, 900]]);
    expect(m.quoteSubtotal).toBe(31260);
  });
  it('without counts every model is exactly the previous one (unitTotal = subtotal)', () => {
    const m = buildCustomerPresentationModel(items, sections.map(({ id, name }) => ({ id, name })));
    expect(m.quoteSubtotal).toBe(3430);
    expect(m.units.every((u) => u.repeatCount === 1 && u.unitTotal === u.subtotal)).toBe(true);
  });
  it('the editor model weights by the editor join (section_key / key)', () => {
    const m = buildEditorPresentationModel([{ description: 'x', quantity: '2', unit_price: '50', section_key: 'k' }], [{ key: 'k', name: 'דירה', repeat_count: 3 }]);
    expect([m.units[0].subtotal, m.units[0].unitTotal, m.quoteSubtotal]).toEqual([100, 300, 300]);
  });
  it('the customer page renders "name × N", the per-copy line and the total of all copies; at 1 the old toggle string', () => {
    for (const [f, perUnit, times] of [['src/pages/PublicQuote.jsx', 'לכל יחידה', "<span style={{ whiteSpace: 'nowrap' }}>× <bdi dir=\"ltr\" className=\"pf-num\">{section.repeatCount}</bdi></span>"],
      ['src/pages/PublicQuoteEn.jsx', 'per unit', "<bdi dir=\"ltr\" className=\"pf-num\" style={{ whiteSpace: 'nowrap' }}>× {section.repeatCount}</bdi>"]]) {
      const s = read(f);
      expect(s).toContain("if (!(section.repeatCount > 1)) return `${section.title} ${chevron}`;");
      expect(s).toContain(times);
      expect(s).toContain("className=\"pq-unit-note\" style={{ display: 'block', fontWeight: 400, whiteSpace: 'nowrap' }}");
      expect(s).toContain(perUnit);
      expect(s).not.toMatch(/formatWholeMoney\(section\.subtotal\)\}<\/span><\/td>\s*<\/tr>/);
    }
  });
  it('the preview data and the public function carry repeat_count ONLY above 1 (every existing response unchanged)', () => {
    const d = buildPreviewQuoteData({ editor: { sections: [{ key: 'a', name: 'X', repeat_count: 12 }, { key: 'b', name: 'Y', repeat_count: 1 }], items: [] } });
    expect(d.quoteData.sections).toEqual([{ id: 'a', name: 'X', repeat_count: 12 }, { id: 'b', name: 'Y' }]);
    expect(read('supabase/functions/get-public-quote/index.ts')).toContain('quote_sections ( id, name, sort_order, repeat_count )');
    expect(read('supabase/functions/get-public-quote/index.ts')).toContain('...(Number.isInteger(s.repeat_count) && s.repeat_count > 1 ? { repeat_count: s.repeat_count } : {})');
    expect(read('supabase/functions/get-public-quote/publicAccess.ts')).toContain('...(Number.isInteger(s.repeat_count) && (s.repeat_count as number) > 1 ? { repeat_count: s.repeat_count as number } : {})');
    for (const f of ['supabase/functions/get-public-quote/index.ts', 'supabase/functions/get-public-quote/publicAccess.ts']) {
      expect(read(f)).not.toContain('price_link_id');
    }
  });
  it('the chat reads a line as one copy x N and reconciles the weighted sum', () => {
    const ctx = sanitizeQuoteContext({ id: 'q', total: 30360, quote_sections: [{ id: 'A', name: 'דירה טיפוס א׳', repeat_count: 12 }],
      quote_items: [{ description: 'ריצוף', quantity: 1, unit_price: 2000, total_price: 2000, section_id: 'A' }, { description: 'צבע', quantity: 1, unit_price: 530, total_price: 530, section_id: 'A' }] });
    expect(ctx.financialReconciliation).toMatchObject({ computedFromItems: 30360, reconciles: true });
    const block = buildQuoteContextBlock(ctx);
    expect(block).toContain('דירה טיפוס א׳ x 12 identical copies');
    expect(block).toContain('line total 2000 per copy, x 12 identical copies of its section');
  });
});

describe('the save, templates and draft baseline', () => {
  it('the save sends the count and the link by name; reads them with a fallback before the migration', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain('repeat_count: normalizeRepeatCount(s.repeat_count), // stage 3');
    expect(d).toContain("price_link_id: item.price_link_id || null, // stage 3: the internal shared-price group (null = unlinked)");
    expect(d).toContain(".select('id, name, sort_order, repeat_count')");
    expect(d).toContain('.select(`${richItemCols}, price_missing, price_link_id`)');
    expect(d).toContain('items: withWeightedActiveQuantities(items, sections), // stage 3');
    expect(d).toContain('sections, savedSections: authoritativeSections });');
  });
  it('a template keeps the count (only above 1), never the price link; the summary counts every copy', () => {
    const c = buildTemplateContent({ sections: [{ key: 'k', name: 'דירה', repeat_count: 4 }, { key: 'j', name: 'מחסן' }],
      items: [{ description: 'ריצוף', quantity: '1', unit_price: '100', section_key: 'k', price_link_id: 'aaaaaaaa-0000-4000-8000-000000000001' }, { description: 'מדף', quantity: '1', unit_price: '50', section_key: 'j' }] }, { prices: true });
    expect(c.sections).toEqual([{ key: 's1', name: 'דירה', repeat_count: 4 }, { key: 's2', name: 'מחסן' }]);
    expect(JSON.stringify(c)).not.toContain('price_link_id');
    expect(templateSummary(c).subtotal).toBe(450);
    let n = 0;
    expect(templateToFormState(c, () => `new-${(n += 1)}`).sections.map((s) => s.repeat_count)).toEqual([4, 1]);
  });
  it('a restored draft baseline is unchanged for a quote without counts / links, and notices one changed elsewhere', () => {
    const q = { id: 'q', quote_items: [{ id: 'i', unit_price: 1 }], quote_sections: [{ id: 's', name: 'A', sort_order: 0 }] };
    const plain = serverFingerprintFromQuote(q);
    expect(serverFingerprintFromQuote({ ...q, quote_sections: [{ id: 's', name: 'A', sort_order: 0, repeat_count: 1 }], quote_items: [{ id: 'i', unit_price: 1, price_link_id: null }] })).toBe(plain);
    expect(serverFingerprintFromQuote({ ...q, quote_sections: [{ id: 's', name: 'A', sort_order: 0, repeat_count: 3 }] })).not.toBe(plain);
  });
});

// ---- the shared price in the rows ----
let last = null;
function Harness({ initial, sections = [], international = false }) {
  const [items, setItems] = useState(initial);
  last = items;
  return <QuoteRowsEditor items={items} setItems={setItems} services={[]} sections={sections} isHebrew international={international} sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
}
const LINK = 'aaaaaaaa-0000-4000-8000-000000000001';
const row = (o) => ({ description: 'ריצוף', quantity: '1', unit_price: '100', isFromCatalog: false, section_key: null, price_link_id: LINK, ...o });
const SECTIONS = [{ key: 'u1', name: 'דירה 30' }, { key: 'u2', name: 'דירה 31', repeat_count: 4 }];

describe('the shared price after duplicating a unit (decision 5)', () => {
  it('a new price in a linked row asks; "update all" reprices the linked rows by their own amounts; undo restores every row', () => {
    render(<Harness sections={SECTIONS} initial={[row({ id: 'a', section_key: 'u1' }), row({ id: 'b', section_key: 'u2', quantity: '2' }), row({ id: 'c', price_link_id: null })]} />);
    const price = screen.getByTestId('qrow-price-a');
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: '120' } });
    fireEvent.blur(price);
    const ask = screen.getByTestId('qrow-linkask-a');
    expect(ask.textContent).toContain('המחיר השתנה ל-₪120.00. לעדכן גם את השורה המקושרת?');
    expect(screen.getByTestId('qrow-link-all-a').textContent).toBe('עדכון גם שם');
    expect(ask.textContent).toContain('דירה 31');
    expect(ask.textContent).toContain('כולל 4 יחידות זהות');
    fireEvent.click(screen.getByTestId('qrow-link-all-a'));
    expect(last.map((it) => String(it.unit_price))).toEqual(['120', '120', '100']);
    expect(last[1]).toMatchObject({ id: 'b', price_link_id: LINK, quantity: '2' });
    expect(last[2].price_link_id).toBeNull();
    expect(screen.getByTestId('qrow-price-undo').textContent).toContain('עודכן מחיר מקושר אחד');
    fireEvent.click(screen.getByText('ביטול עדכון המחירים'));
    expect(last.map((it) => String(it.unit_price))).toEqual(['100', '100', '100']);
    expect(last[0].price_link_id).toBe(LINK);
  });
  it('"only here" keeps the other rows; "cancel" returns this row to its previous price', () => {
    render(<Harness sections={SECTIONS} initial={[row({ id: 'a', section_key: 'u1' }), row({ id: 'b', section_key: 'u2' })]} />);
    const price = screen.getByTestId('qrow-price-a');
    fireEvent.focus(price); fireEvent.change(price, { target: { value: '130' } }); fireEvent.blur(price);
    fireEvent.click(screen.getByTestId('qrow-link-here-a'));
    expect(last.map((it) => String(it.unit_price))).toEqual(['130', '100']);
    expect(last[0].price_link_id).toBe(LINK);
    fireEvent.focus(price); fireEvent.change(price, { target: { value: '140' } }); fireEvent.blur(price);
    fireEvent.click(screen.getByTestId('qrow-link-cancel-a'));
    expect(String(last[0].unit_price)).toBe('130');
  });
  it('an unlinked row, an empty or an unchanged price never asks', () => {
    render(<Harness initial={[row({ id: 'a', price_link_id: null }), row({ id: 'b', price_link_id: null })]} />);
    const price = screen.getByTestId('qrow-price-a');
    fireEvent.focus(price); fireEvent.change(price, { target: { value: '150' } }); fireEvent.blur(price);
    expect(screen.queryByTestId('qrow-linkask-a')).toBeNull();
  });
  it('a manual row copy starts unlinked; another billing basis asks and unlinks', async () => {
    render(<Harness sections={SECTIONS} initial={[row({ id: 'a', section_key: 'u1' }), row({ id: 'b', section_key: 'u2' })]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-a'));
    fireEvent.click(screen.getByText('שכפול שורה'));
    expect(last[1].price_link_id).toBeUndefined();
    fireEvent.change(screen.getByTestId('qrow-billing-a'), { target: { value: 'area' } });
    expect(await answerAppDialog(true)).toContain('ינתק אותה מהקישור');
    expect(last[0].price_link_id).toBeUndefined();
    expect(last[0].pricing_unit).toBe('m2');
  });
  it('a price edit of the same basis keeps the link through the row builder', () => {
    render(<Harness initial={[row({ id: 'a' }), row({ id: 'b' })]} />);
    fireEvent.change(screen.getByTestId('qrow-item-a'), { target: { value: 'ריצוף חדש' } });
    expect(last[0]).toMatchObject({ description: 'ריצוף חדש', price_link_id: LINK });
  });
});

// the read-only reviewers' findings (test-qa, rtl-numeric), each locked by a test
import { applyDraftUpdateToItem } from './utils/aiQuoteDraftClient';
describe('reviewer findings, fixed (stage 3)', () => {
  it('a smart edit that changes a linked row\'s unit leaves the shared-price group (the save would be refused otherwise)', () => {
    const it0 = { id: 'a', description: 'ריצוף', quantity: '1', unit_price: '100', price_link_id: LINK };
    const next = applyDraftUpdateToItem(it0, { unit: 'm2' });
    expect(next.pricing_unit).toBe('m2');
    expect(next.price_link_id).toBeUndefined();
    // a price-only smart edit keeps it
    expect(applyDraftUpdateToItem(it0, { unitPrice: 120 }).price_link_id).toBe(LINK);
  });
  it('the chat get_quote tool says a unit line is one copy x N', () => {
    const s = read('supabase/functions/chat-ai/chatTools.ts');
    expect(s).toContain('quote_sections ( id, name, repeat_count ), quote_items ( description, quantity, unit_price, total_price, section_id )');
    expect(s).toContain('return n > 1 ? { unit: s.name || null, identical_copies: n, line_total_is_per_copy: true } : {};');
  });
  it('the customer unit total comes from the stored quantities and prices x N (the same sum as the stored subtotal), never rounded lines x N', () => {
    const rows = [{ description: 'ריצוף', quantity: 1, calculated_quantity: 3.333, pricing_unit: 'm2', price: 45.5, total_price: 151.65, section_id: 'A' }];
    const m = buildCustomerPresentationModel(rows, [{ id: 'A', name: 'דירה', repeat_count: 12 }]);
    const stored = calculateQuoteFinancials({ items: withWeightedActiveQuantities([{ quantity: 1, calculated_quantity: 3.333, pricing_unit: 'm2', unit_price: 45.5, section_key: 'k' }], [{ key: 'k', repeat_count: 12 }]), discount: 0 }).enteredSubtotal;
    expect(m.units[0].unitTotal).toBe(stored);
    expect(m.units[0].subtotal).toBe(151.65);
  });
  it('the database refuses an older app\'s save of a unit of identical copies (it would store the totals of one copy)', () => {
    const s = read('supabase/migrations/20261108200000_quote_unit_repeat_and_price_link.sql');
    expect(s).toContain("IF NOT (v_section ? 'repeat_count') AND EXISTS (");
    expect(s).toContain("RAISE EXCEPTION 'This quote has identical units - refresh the app to save it' USING ERRCODE = '22023';");
  });
});
