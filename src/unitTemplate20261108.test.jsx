// Owner console 2026-11-08 (stage 4 of the one quote builder, typed: "מאשר את שלב 3 ... ואת שלב 4 (תבנית יחידה) לפי ההחלטות, כולל ... שינוי
// ב-L-09, L-17, ..."; decision 6): a unit template - saved from a unit's menu, added from "from a saved unit" as ONE copy
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { buildUnitTemplateContent, unitTemplateToRows, templateKind, templateSummary, templateToFormState, TEMPLATE_KIND_UNIT, TEMPLATE_SCHEMA } from './utils/quoteTemplates';
import { SaveTemplateDialog, TemplatePickerDialog } from './components/QuoteTemplateDialogs';

afterEach(cleanup);
const read = (p) => readFileSync(p, 'utf8');
const LINK = 'aaaaaaaa-0000-4000-8000-000000000001';
const FORM = {
  currency: 'ILS', priceBasis: 'excl_vat',
  sections: [{ key: 'u1', id: 'db-sec', name: 'דירה טיפוס א׳', repeat_count: 12 }, { key: 'u2', name: 'מחסן' }],
  items: [
    { id: 'db1', description: 'ריצוף', quantity: '1', unit_price: '120', section_key: 'u1', pricing_unit: 'm2', calculated_quantity: 12, quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ id: 'm1', width: 4, height: 3, unit: 'm', calculated_area: 12, label: 'סלון של משפחת כהן', is_pricing_driving: true }], specification: [{ label: 'צבע', value: 'לבן' }], price_link_id: LINK },
    { description: 'הובלה', quantity: '1', unit_price: '250', section_key: 'u1', _billing: 'fixed' },
    { description: 'מדף', quantity: '1', unit_price: '50', section_key: 'u2' },
  ],
};
const billing = (it) => (it._billing === 'fixed' ? 'fixed' : it.pricing_unit === 'm2' ? 'area' : 'units');

describe('the unit template content', () => {
  it('ONE unit with its rows: billing, numeric sizes (no place name), prices with currency + VAT basis; never ids, link, count, other units', () => {
    const c = buildUnitTemplateContent(FORM, 'u1', { prices: true, details: false }, billing);
    expect(c).toMatchObject({ schema: TEMPLATE_SCHEMA, kind: 'unit', sections: [{ key: 's1', name: 'דירה טיפוס א׳' }], currency: 'ILS', price_basis: 'excl_vat' });
    expect(c.items).toHaveLength(2);
    expect(c.items[0]).toEqual({ description: 'ריצוף', quantity: 1, unit_price: 120, pricing_unit: 'm2', calculated_quantity: 12, quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ width: 4, height: 3, unit: 'm', sort_order: 0, is_pricing_driving: true, calculated_area: 12 }], section_key: 's1' });
    expect(c.items[1]).toMatchObject({ description: 'הובלה', billing: 'fixed', unit_price: 250 });
    const text = JSON.stringify(c);
    for (const no of ['סלון של משפחת כהן', LINK, 'db1', 'db-sec', 'repeat_count', 'מדף', 'צבע']) expect(text).not.toContain(no);
  });
  it('details only when chosen; no prices -> no currency / VAT basis', () => {
    const c = buildUnitTemplateContent(FORM, 'u1', { prices: false, details: true }, billing);
    expect(c.items[0].specification).toEqual([{ label: 'צבע', value: 'לבן' }]);
    expect(c.items.some((it) => 'unit_price' in it)).toBe(false);
    expect(c.currency).toBeUndefined();
    expect(c.price_basis).toBeUndefined();
  });
  it('added as ONE new unit (count 1, a new key) with rows of that unit - no ids, no link, the sizes and the fixed amount kept', () => {
    const c = buildUnitTemplateContent(FORM, 'u1', { prices: true }, billing);
    const u = unitTemplateToRows(c, () => 'new-key');
    expect(u.section).toEqual({ key: 'new-key', id: null, name: 'דירה טיפוס א׳', repeat_count: 1 });
    expect(u.items[0]).toMatchObject({ description: 'ריצוף', unit_price: '120', section_key: 'new-key', pricing_unit: 'm2', calculated_quantity: 12, quantity_source: 'calculated' });
    expect(u.items[0].measurements).toEqual([{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }]);
    expect(u.items[1]).toMatchObject({ description: 'הובלה', _billing: 'fixed', unit_price: '250' });
    expect(u.items.every((it) => !('id' in it) && !('price_link_id' in it))).toBe(true);
    expect([u.currency, u.priceBasis]).toEqual(['ILS', 'excl_vat']);
  });
  it('the two kinds never mix: a unit template never opens as a quote, a quote template never adds a unit; the summary names the kind', () => {
    const unit = buildUnitTemplateContent(FORM, 'u1', {}, billing);
    expect(templateKind(unit)).toBe(TEMPLATE_KIND_UNIT);
    expect(templateKind({ schema: TEMPLATE_SCHEMA, items: [] })).toBe('quote');
    expect(templateToFormState(unit, () => 'k')).toBeNull();
    expect(unitTemplateToRows({ schema: TEMPLATE_SCHEMA, sections: [{ key: 's1', name: 'x' }], items: [] }, () => 'k')).toBeNull();
    expect(templateSummary(unit)).toMatchObject({ kind: 'unit', itemCount: 2, sectionCount: 1, subtotal: 120 * 12 + 250 });
  });
});

const ROWS = [
  { id: 't1', user_id: 'u', name: 'שיפוץ אמבטיה', content: { schema: TEMPLATE_SCHEMA, sections: [], items: [{ description: 'אריחים', quantity: 1, unit_price: 80 }] } },
  { id: 't2', user_id: 'u', name: 'דירה טיפוס א׳', content: { schema: TEMPLATE_SCHEMA, kind: 'unit', sections: [{ key: 's1', name: 'דירה טיפוס א׳' }], items: [{ description: 'ריצוף', quantity: 1, unit_price: 120, section_key: 's1' }] } },
];
const client = (rows = ROWS, inserted = []) => ({
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
    insert: (row) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: 'n1', ...row }, error: null }) }) }; },
  }),
});

describe('the template window - one screen for both kinds, used only where it belongs', () => {
  it('"from a saved unit" opens the unit templates; "add to the quote" hands over the unit content', async () => {
    const onUse = vi.fn();
    render(<TemplatePickerDialog isHebrew client={client()} userId="u" formatMoney={(v) => `₪${v}`} onClose={() => {}} onUse={onUse} kind="unit" />);
    await waitFor(() => expect(screen.getAllByTestId('template-option')).toHaveLength(1));
    expect(screen.getByText('הוספת יחידה מתבנית')).toBeTruthy(); // G7 (Owner 2026-11-08, the clarity fixes B3)
    // Owner console 2026-11-08 (restore item 13): the unit window shows only unit templates - no filter to the other kind
    expect(screen.queryByTestId('template-filter-quote')).toBeNull();
    fireEvent.click(screen.getByTestId('template-use'));
    expect(onUse).toHaveBeenCalledWith(ROWS[1].content);
    expect(screen.getByTestId('template-use').textContent).toBe('הוספה להצעה');
  });
  // Owner console 2026-11-08 (restore item 13 of docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md): each window shows, uses and deletes
  // only its own kind - the quote-template window lists only quote templates (as before stage 4), no filter to the unit templates
  it('the quote-template window lists only quote templates; there is no way to reach (or delete) a unit template from it', async () => {
    const onUse = vi.fn();
    render(<TemplatePickerDialog isHebrew={false} client={client()} userId="u" formatMoney={(v) => `$${v}`} onClose={() => {}} onUse={onUse} />);
    await waitFor(() => expect(screen.getAllByTestId('template-option')).toHaveLength(1));
    expect(screen.getByTestId('template-option').textContent).toBe('שיפוץ אמבטיה');
    expect(screen.queryByTestId('template-filter-unit')).toBeNull();
    expect(screen.queryByText('דירה טיפוס א׳')).toBeNull();
    expect(screen.getByTestId('template-use')).not.toBeDisabled();
  });
  it('no unit templates yet: a unit-specific empty line', async () => {
    render(<TemplatePickerDialog isHebrew client={client([ROWS[0]])} userId="u" formatMoney={(v) => v} onClose={() => {}} onUse={() => {}} kind="unit" />);
    await waitFor(() => expect(screen.getByTestId('template-list-empty').textContent).toContain('אין עדיין תבניות יחידה'));
  });
  it('save as unit template: the unit name is the default, prices / details are the only choices, the unit content is what is written', async () => {
    const inserted = [];
    render(<SaveTemplateDialog isHebrew client={client(ROWS, inserted)} userId="u" form={FORM} formatMoney={(v) => `₪${v}`} onClose={() => {}}
      unit={{ sectionKey: 'u1', name: 'דירה טיפוס א׳', rowBilling: billing }} />);
    expect(screen.getByText('שמירה כתבנית יחידה')).toBeTruthy();
    expect(screen.getByTestId('template-name').value).toBe('דירה טיפוס א׳');
    expect(screen.getByTestId('template-keep-prices')).toBeTruthy();
    expect(screen.getByTestId('template-keep-details')).toBeTruthy();
    expect(screen.queryByTestId('template-keep-texts')).toBeNull();
    expect(screen.getByTestId('template-never').textContent).toContain('שמות המקומות במידות');
    fireEvent.click(screen.getByTestId('template-save'));
    await waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toMatchObject({ user_id: 'u', name: 'דירה טיפוס א׳', content: { kind: 'unit', sections: [{ key: 's1', name: 'דירה טיפוס א׳' }] } });
    expect(inserted[0].content.items).toHaveLength(2);
  });
});

describe('the editor and the Dashboard wiring', () => {
  it('the group menu offers "save as a template"; "from a saved template" is in the add bar (divided) and in the places window (regular)', () => {
    const f = read('src/components/QuoteForm.jsx');
    expect(f).toContain("{isHebrew ? 'שמירה כתבנית' : 'Save as a template'}");
    expect(f.split('data-testid="unit-from-template"').length - 1).toBe(1);
    expect(f).toContain("onFromTemplate={typeof onAddUnitFromTemplate === 'function' && structureMode !== 'divided'");
    expect(read('src/components/PlacesDialog.jsx')).toContain('data-testid="places-from-template"');
  });
  it('the Dashboard adds ONE unit at the end, asks on another currency / VAT basis, never changes a chosen client type', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain('const handleAddUnitTemplate = async (content) => {');
    expect(d).toContain("sort_order: (prev || []).reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), -1) + 1 }]);");
    expect(d).toContain("filter((it) => !(isUntouchedPlaceholderItem(it) && !it.section_key))");
    // Owner console 2026-11-08 (restore item 14): adding a unit never sets the quote's client type
    expect(d).not.toContain("if (stillPriced && isLocalIsraeliBusiness && !clientType && u.priceBasis) { const t = clientTypeForPriceBasis(u.priceBasis); if (t) setClientType(t); }");
    expect(d.slice(d.indexOf('const handleAddUnitTemplate'), d.indexOf('const handleDuplicateQuote'))).not.toContain('setClientType(');
    expect(d).toContain("if (u.items.some((it) => it.pricing_unit) && !canUseCapability('professional_quote.reuse')) { setLockedCapability('professional_quote.reuse'); return; }");
    expect(d).toContain("<TemplatePickerDialog isHebrew={isHebrew} client={supabase} userId={session.user.id} formatMoney={(v) => `${sym}${formatMoneyDisplay(v)}`} kind={TEMPLATE_KIND_UNIT}");
  });
});

// the reviewer's findings (test-qa): the price questions and the round trip through the REAL row editor rules
import { unitTemplatePriceQuestions } from './utils/quoteTemplates';
import { rowEntry } from './utils/quoteItemEntry';
describe('reviewer findings, fixed (stage 4)', () => {
  const unit = (o = {}) => ({ items: [{ unit_price: '100' }], currency: 'ILS', priceBasis: 'excl_vat', ...o });
  it('the price questions: currency mismatch / unknown; in Israel the VAT basis against the chosen client type; abroad no VAT question', () => {
    expect(unitTemplatePriceQuestions(unit(), { currency: 'ILS', isLocal: true, clientType: 'business' })).toEqual({ currency: null, basis: null });
    expect(unitTemplatePriceQuestions(unit(), { currency: 'ILS', isLocal: true, clientType: 'private' })).toEqual({ currency: null, basis: 'mismatch' });
    expect(unitTemplatePriceQuestions(unit({ priceBasis: null }), { currency: 'ILS', isLocal: true, clientType: 'business' })).toEqual({ currency: null, basis: 'unknown' });
    expect(unitTemplatePriceQuestions(unit({ priceBasis: 'incl_vat' }), { currency: 'ILS', isLocal: true, clientType: null })).toEqual({ currency: null, basis: null });
    expect(unitTemplatePriceQuestions(unit({ currency: 'USD', priceBasis: null }), { currency: 'ILS', isLocal: true, clientType: 'business' })).toEqual({ currency: 'mismatch', basis: null });
    expect(unitTemplatePriceQuestions(unit({ currency: null }), { currency: 'ILS', isLocal: true, clientType: 'business' })).toEqual({ currency: 'unknown', basis: null });
    expect(unitTemplatePriceQuestions(unit({ currency: 'USD', priceBasis: null }), { currency: 'USD', isLocal: false, clientType: null })).toEqual({ currency: null, basis: null });
    expect(unitTemplatePriceQuestions(unit({ items: [{ unit_price: '' }], currency: 'EUR' }), { currency: 'ILS', isLocal: true })).toEqual({ currency: null, basis: null });
  });
  it('round trip through the row editor: a saved fixed row, 3 units, a fractional 2.5, a known area, a length, sq ft, a size outside the price', () => {
    const rows = [
      { id: 'a', description: 'Fixed', quantity: '1', unit_price: '250', section_key: 'u' },
      { description: 'Three', quantity: '3', unit_price: '10', section_key: 'u' },
      { description: 'Half', quantity: '2.5', unit_price: '10', section_key: 'u' },
      { description: 'Known', quantity: '1', unit_price: '10', section_key: 'u', pricing_unit: 'm2', calculated_quantity: 14, quantity_source: 'manual', calculation_method: 'manual' },
      { description: 'Length', quantity: '1', unit_price: '10', section_key: 'u', pricing_unit: 'linear_meter', calculated_quantity: 6, quantity_source: 'calculated', calculation_method: 'linear',
        measurements: [{ width: 6, height: '', unit: 'm', calculated_area: 6, label: '', is_pricing_driving: true }] },
      { description: 'Feet', quantity: '1', unit_price: '9', section_key: 'u', pricing_unit: 'sq_ft', calculated_quantity: 120, quantity_source: 'calculated', calculation_method: 'area',
        measurements: [{ width: 12, height: 10, unit: 'ft', calculated_area: 120, label: 'Den', is_pricing_driving: true }, { width: 2, height: 2, unit: 'ft', calculated_area: 4, label: 'Closet', is_pricing_driving: false }] },
    ];
    const form = { sections: [{ key: 'u', name: 'Unit' }], items: rows, currency: 'USD' };
    const c = buildUnitTemplateContent(form, 'u', { prices: true }, (it) => rowEntry(it, true).pricingMethod);
    const back = unitTemplateToRows(c, () => 'n').items;
    const before = rows.map((it) => rowEntry(it, true));
    const after = back.map((it) => rowEntry(it, true));
    expect(after.map((e) => e.pricingMethod)).toEqual(before.map((e) => e.pricingMethod));
    expect(after.map((e) => [e.useManualQty, e.measureUnit])).toEqual(before.map((e) => [e.useManualQty, e.measureUnit]));
    expect(back[2]).toMatchObject({ quantity: '1', calculated_quantity: 2.5 });
    expect(back[5].measurements.map((m) => [m.width, m.height, m.unit, m.label, m.is_pricing_driving])).toEqual([[12, 10, 'ft', '', true], [2, 2, 'ft', '', false]]);
  });
});
