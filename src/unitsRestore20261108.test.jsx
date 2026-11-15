// Owner console 2026-11-08 (typed: "מאשר להחזיר הכול למה שהיה ... כולל שינוי ב-L-02 ... L-28, שחרור עד הלייב" + "תמשיך עם השחרור עד הסוף,
// הכל כולל הכל"): release 3 - items 07, 11, 13, 14 of docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md return to their earlier behaviour
// (07 / 13 / 14: before stage 2-4, 4f1592f2 and be91943d; 11: stage 2, 78c2edaa); the protections 10 and 12 stay as they are.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import QuoteRowsEditor from './components/QuoteRowsEditor';

afterEach(cleanup);
const read = (p) => readFileSync(p, 'utf8');
let last = null;
function H({ initial }) {
  const [items, setItems] = useState(initial);
  last = items;
  return <QuoteRowsEditor items={items} setItems={setItems} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
}
const EXAMPLE = { description: 'חלון אלומיניום (דוגמה)', quantity: '1', unit_price: '600', isFromCatalog: false, section_key: null, pricing_unit: 'm2',
  quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 2,
  measurements: [{ width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true }], _localExample: true };

describe('07 · the local measurement example', () => {
  it('the form offers it while the quote has no real line, with the item window\'s own line (100 x 200 cm at 600 per m²)', () => {
    const src = read('src/components/QuoteForm.jsx');
    // 2026-11-12 (the demo): inside the work card - the example while there is no real line
    expect(src).toContain('{!hasRealItems ? (');
    expect(src).toContain("{isHebrew ? 'הצגת דוגמה (לא נשמרת)' : 'Show an example (not saved)'}");
    expect(src).toMatch(/measurements: \[\{ width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true \}\], _localExample: true/);
    // the save still refuses the example (the existing guard)
    expect(read('src/pages/Dashboard.jsx')).toContain('if (items.some((it) => it && it._localExample)) {');
  });
  it('the example row carries its mark and its removal; removing it leaves a row to type in', () => {
    render(<H initial={[EXAMPLE]} />);
    expect(screen.getByTestId('quote-example-badge').textContent).toContain('דוגמה · לא נשמרת');
    expect(screen.getByText('₪1200.00')).toBeTruthy(); // 2 m² x 600
    fireEvent.click(screen.getByTestId('quote-remove-example'));
    expect(last).toHaveLength(1);
    expect(last[0]._localExample).toBeUndefined();
    expect(last[0].description).toBe('');
  });
  it('editing the example turns it into an ordinary line of the user\'s own (as in the item window)', () => {
    render(<H initial={[EXAMPLE]} />);
    const name = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]');
    fireEvent.change(name, { target: { value: 'חלון סלון' } });
    expect(last[0]._localExample).toBeUndefined();
    expect(last[0]).toMatchObject({ description: 'חלון סלון', pricing_unit: 'm2', calculated_quantity: 2 });
  });
});

describe('11 / 13 / 14 · units and templates', () => {
  it('11: a copy of an unnamed unit keeps an empty name; a named unit\'s copy is "<name> - עותק"', () => {
    const src = read('src/components/QuoteForm.jsx');
    expect(src).toContain("const name = section.name ? (isHebrew ? `${section.name} - עותק` : `${section.name} - copy`) : '';");
    expect(src).not.toContain("(isHebrew ? 'עותק' : 'Copy')");
  });
  it('13: each template window is fixed to its own kind (no filter to the other kind)', () => {
    const src = read('src/components/QuoteTemplateDialogs.jsx');
    expect(src).toContain("const filter = kind === TEMPLATE_KIND_UNIT ? TEMPLATE_KIND_UNIT : 'quote';");
    expect(src).not.toContain("chip(TEMPLATE_KIND_UNIT, C.filterUnits)");
  });
  it('14: adding a unit never sets the client type', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d.slice(d.indexOf('const handleAddUnitTemplate'), d.indexOf('const handleDuplicateQuote'))).not.toContain('setClientType(');
  });
});
