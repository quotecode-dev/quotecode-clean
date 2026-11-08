// Owner console 2026-11-08 (night task, the one quote builder stage 2, design A + decisions 2 / 3): the row editor.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import QuoteRowsEditor from './components/QuoteRowsEditor';
import { blankRowItem } from './utils/quoteItemEntry';

afterEach(cleanup);
const SERVICES = [{ id: 7, name: 'ריצוף סלון', price: 120 }, { id: 8, name: 'התקנת פנלים', price: 24 }];
let last = null;
function Harness({ initial, international = false, isHebrew = true, sections = [] }) {
  const [items, setItems] = useState(initial);
  last = items;
  return <QuoteRowsEditor items={items} setItems={setItems} services={SERVICES} sections={sections} isHebrew={isHebrew} international={international} sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
}
const rowId = () => screen.getAllByTestId(/^qrow-r|^qrow-[0-9a-z]+$/)[0];

describe('the row editor', () => {
  it('a new row: quantity 1, units; picking a catalog item fills its name and price; the line total shows', () => {
    render(<Harness initial={[blankRowItem()]} />);
    const id = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]').dataset.testid.replace('qrow-item-', '');
    expect(screen.getByTestId(`qrow-billing-${id}`).value).toBe('units');
    expect(screen.getByTestId(`qrow-qty-${id}`).value).toBe('1');
    fireEvent.click(screen.getByTestId(`qrow-catalog-${id}`));
    fireEvent.pointerDown(screen.getByText('ריצוף סלון'));
    expect(last[0]).toMatchObject({ description: 'ריצוף סלון', unit_price: '120', isFromCatalog: true, quantity: '1' });
    expect(screen.getByTestId(`qrow-total-${id}`).textContent).toBe('₪120.00');
  });
  it('typing filters the catalog list; a name not in the catalog is simply typed', () => {
    render(<Harness initial={[blankRowItem()]} />);
    const input = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]');
    fireEvent.change(input, { target: { value: 'פנל' } });
    expect(screen.queryByText('ריצוף סלון')).toBeNull();
    expect(screen.getByText('התקנת פנלים')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'הובלה' } });
    expect(last[0]).toMatchObject({ description: 'הובלה', isFromCatalog: false });
  });
// Owner console 2026-11-08 (restore item 03 of docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md): a billing change asks first again
  it('area in Israel: metres by default, length x width -> m², the same stored shape as the item window', async () => {
    render(<Harness initial={[{ ...blankRowItem(), description: 'ריצוף', unit_price: '120' }]} />);
    const id = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]').dataset.testid.replace('qrow-item-', '');
    fireEvent.change(screen.getByTestId(`qrow-billing-${id}`), { target: { value: 'area' } });
    expect(await answerAppDialog(true)).toContain('שינוי היחידה דורש בדיקה מחדש של המחיר');
    await waitFor(() => expect(screen.getByTestId(`qrow-sizeunit-${id}`)).toBeTruthy());
    expect(screen.getByTestId(`qrow-sizeunit-${id}`).value).toBe('m');
    fireEvent.change(screen.getByTestId(`qrow-w-${id}`), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId(`qrow-h-${id}`), { target: { value: '3' } });
    expect(last[0]).toMatchObject({ pricing_unit: 'm2', calculated_quantity: 12, quantity_source: 'calculated', calculation_method: 'area' });
    expect(last[0].measurements).toEqual([{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }]);
    expect(screen.getByTestId(`qrow-total-${id}`).textContent).toBe('₪1440.00');
    expect(screen.getByTestId(`qrow-calc-${id}`).textContent).toBe('12.00 מ״ר');
  });
  it('abroad: feet by default, sq ft', async () => {
    render(<Harness isHebrew={false} international initial={[{ ...blankRowItem(), description: 'Tiling', unit_price: '9' }]} />);
    const id = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]').dataset.testid.replace('qrow-item-', '');
    fireEvent.change(screen.getByTestId(`qrow-billing-${id}`), { target: { value: 'area' } });
    expect(await answerAppDialog(true)).toContain('Changing the unit requires reviewing the price');
    await waitFor(() => expect(screen.getByTestId(`qrow-sizeunit-${id}`)).toBeTruthy());
    expect(screen.getByTestId(`qrow-sizeunit-${id}`).value).toBe('ft');
    fireEvent.change(screen.getByTestId(`qrow-w-${id}`), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId(`qrow-h-${id}`), { target: { value: '10' } });
    expect(last[0]).toMatchObject({ pricing_unit: 'sq_ft', calculated_quantity: 120 });
    expect(screen.getByTestId(`qrow-calc-${id}`).textContent).toBe('120.00 sq ft');
  });
  it('a fixed amount has no quantity field; decision 3: an old "1, no unit" line opens as a fixed amount', () => {
    render(<Harness initial={[{ id: 'old', description: 'הובלה', quantity: '1', unit_price: '250', isFromCatalog: false, section_key: null }]} />);
    expect(screen.getByTestId('qrow-billing-old').value).toBe('fixed');
    expect(screen.queryByTestId('qrow-qty-old')).toBeNull();
    expect(screen.getByTestId('qrow-total-old').textContent).toBe('₪250.00');
    expect(last[0]).toEqual({ id: 'old', description: 'הובלה', quantity: '1', unit_price: '250', isFromCatalog: false, section_key: null }); // opening changes nothing
  });
  it('the three-dot menu: duplicate (a new line, no id), move to a unit, remove; "add row" appends a blank row', () => {
    render(<Harness sections={[{ key: 'u30', name: 'דירה 30' }]} initial={[{ id: 'a', description: 'ריצוף', quantity: '2', unit_price: '100', isFromCatalog: false, section_key: null }]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-a'));
    fireEvent.click(screen.getByText('שכפול שורה'));
    expect(last).toHaveLength(2);
    expect(last[1].id).toBeUndefined();
    expect(last[1]).toMatchObject({ description: 'ריצוף', quantity: '2' });
    fireEvent.click(screen.getByTestId('qrow-menu-a'));
    fireEvent.change(screen.getByDisplayValue('ללא יחידה'), { target: { value: 'u30' } });
    expect(last[0].section_key).toBe('u30');
    fireEvent.click(screen.getByTestId('qrow-menu-a'));
    fireEvent.click(screen.getByText('הסרת שורה'));
    expect(last).toHaveLength(1);
    fireEvent.click(screen.getByTestId('qrow-add'));
    expect(last[1]).toEqual(blankRowItem());
  });
  it('typing keeps the row (its key and focus) - the item object is replaced, the row is not remounted', () => {
    render(<Harness initial={[blankRowItem()]} />);
    const input = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]');
    input.focus();
    fireEvent.change(input, { target: { value: 'א' } });
    const again = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]');
    expect(again).toBe(input);
    expect(rowId()).toBeTruthy();
  });
});

describe('decision 2 for saved metric lines', () => {
  it('a saved area line opens in metres (4 x 3 m, not 400 x 300 cm) and an untouched open changes nothing; an edit stores the same metres', () => {
    const saved = { id: 's', description: 'ריצוף', quantity: '1', unit_price: '120', isFromCatalog: false, section_key: null, pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }], calculated_quantity: 12 };
    render(<Harness initial={[saved]} />);
    expect(screen.getByTestId('qrow-sizeunit-s').value).toBe('m');
    expect([screen.getByTestId('qrow-w-s').value, screen.getByTestId('qrow-h-s').value]).toEqual(['4', '3']);
    expect(last[0]).toBe(last[0]); // untouched
    expect(last[0]).toEqual(saved);
    fireEvent.change(screen.getByTestId('qrow-price-s'), { target: { value: '130' } });
    expect(last[0]).toMatchObject({ unit_price: '130', calculated_quantity: 12, measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] });
  });
  it('the arrow opens the whole catalog even when the row already has a name', () => {
    render(<Harness initial={[{ id: 'n', description: 'ריצוף סלון', quantity: '1', unit_price: '120', isFromCatalog: true, section_key: null }]} />);
    fireEvent.click(screen.getByTestId('qrow-catalog-n'));
    expect(screen.getByTestId('qrow-catalog-list-n').querySelectorAll('[role="option"]')).toHaveLength(2);
  });
});

// Owner console 2026-11-08 (stage 2, typed: "מאשר השלמת שלב 2 של בונה ההצעה לפי התוכנית, כולל שינוי ב-L-09, L-14, L-15, L-17, L-23 ..."): the row
// takes over the quick "Edit price and quantity" window - the same price / quantity grammar (utils/itemPrice.js) and the same "an untouched
// quantity is never rewritten" rule; details for the customer, extra sizes and a known area open inside the row.
import { getProfessionalUnitLabel } from './utils/professionalQuoteItem';
import { answerAppDialog } from './test/appDialog';
import { waitFor, act } from '@testing-library/react';
function Harness2({ initial, ...rest }) {
  const [items, setItems] = useState(initial);
  last = items;
  return <QuoteRowsEditor items={items} setItems={setItems} services={SERVICES} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} {...rest} />;
}
const line = (o) => ({ id: 'x', description: 'עבודה', quantity: '1', unit_price: '100', isFromCatalog: false, section_key: null, ...o });

describe('the row price and quantity (the former quick window)', () => {
  it('a missing price shows a dash, never a free line; an intentional 0 shows 0.00', () => {
    render(<Harness2 initial={[line({ id: 'a', unit_price: '' }), line({ id: 'b', unit_price: '0' })]} />);
    expect(screen.getByTestId('qrow-total-a').textContent).toBe('—');
    expect(screen.getByTestId('qrow-total-b').textContent).toBe('₪0.00');
  });
  it('an invalid price is refused at the field with a message and the line keeps its price; a valid one is stored', () => {
    render(<Harness2 initial={[line({ id: 'a' })]} />);
    for (const bad of ['1,2', 'abc', '-5', '12.345', '99,5']) {
      fireEvent.change(screen.getByTestId('qrow-price-a'), { target: { value: bad } });
      expect(screen.getByText('מחיר לא תקין - מספר עם נקודה, למשל 1200.50')).toBeTruthy();
      expect(last[0].unit_price).toBe('100');
    }
    fireEvent.change(screen.getByTestId('qrow-price-a'), { target: { value: '1,200.50' } });
    expect(screen.queryByText('מחיר לא תקין - מספר עם נקודה, למשל 1200.50')).toBeNull();
    expect(last[0].unit_price).toBe('1200.5');
  });
  it('an hourly line: 7.5 hours x 100 = 750, the hours stay hours (the amount where the line keeps it)', () => {
    render(<Harness2 initial={[line({ id: 'h', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 6 })]} />);
    expect(screen.getByTestId('qrow-qty-h').value).toBe('6');
    expect(screen.getByText(getProfessionalUnitLabel('hour', true))).toBeTruthy();
    fireEvent.change(screen.getByTestId('qrow-qty-h'), { target: { value: '7.5' } });
    expect(last[0]).toMatchObject({ pricing_unit: 'hour', quantity_source: 'manual', calculated_quantity: 7.5 });
    expect(screen.getByTestId('qrow-total-h').textContent).toBe('₪750.00');
  });
  it('a plain line: quantity 1 -> 3 is stored as text like the item window', async () => {
    render(<Harness2 initial={[line({ id: 'p', description: 'אסלה', unit_price: '40' })]} />);
    fireEvent.change(screen.getByTestId('qrow-billing-p'), { target: { value: 'units' } });
    expect(await answerAppDialog(true)).toContain('שינוי שיטת התמחור עלול לשנות את משמעות הסכומים הקיימים');
    await waitFor(() => expect(screen.getByTestId('qrow-qty-p')).toBeTruthy());
    fireEvent.change(screen.getByTestId('qrow-qty-p'), { target: { value: '3' } });
    expect(last[0].quantity).toBe('3');
    expect(screen.getByTestId('qrow-total-p').textContent).toBe('₪120.00');
  });
  it('an invalid quantity is refused with a message and nothing changes; an emptied box stays empty and says so', () => {
    render(<Harness2 initial={[line({ id: 'q', quantity: '2' })]} />);
    for (const bad of ['0', '-1', 'abc', '1,5', '1.1234567']) {
      fireEvent.change(screen.getByTestId('qrow-qty-q'), { target: { value: bad } });
      expect(screen.getByText('כמות לא תקינה - מספר גדול מ-0')).toBeTruthy();
      expect(last[0].quantity).toBe('2');
    }
    fireEvent.change(screen.getByTestId('qrow-qty-q'), { target: { value: '' } });
    expect(screen.queryByText('כמות לא תקינה - מספר גדול מ-0')).toBeNull();
    fireEvent.blur(screen.getByTestId('qrow-qty-q'));
    // Owner console 2026-11-08 (restore item 05): an emptied quantity stays empty and says so - it never becomes 1 by itself
    expect(screen.getByText('יש להזין כמות גדולה מ-0')).toBeTruthy();
    expect(last[0]).toMatchObject({ quantity: '2', _invalid: true });
  });
  it('an untouched quantity never blocks a price edit and is never rewritten (a stored 0, a kg amount)', () => {
    render(<Harness2 initial={[line({ id: 'z', quantity: '0' }), line({ id: 'k', pricing_unit: 'kg', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 2.5 })]} />);
    fireEvent.change(screen.getByTestId('qrow-price-z'), { target: { value: '150' } });
    expect(last[0]).toMatchObject({ unit_price: '150', quantity: '0' });
    fireEvent.change(screen.getByTestId('qrow-price-k'), { target: { value: '8' } });
    expect(last[1]).toMatchObject({ unit_price: '8', pricing_unit: 'kg', calculated_quantity: 2.5 });
  });
  it('Enter in the price of a named row adds the next row right after it, focused; an unnamed row adds nothing', () => {
    render(<Harness2 initial={[line({ id: 'a' }), line({ id: 'b', description: '' })]} />);
    fireEvent.keyDown(screen.getByTestId('qrow-price-a'), { key: 'Enter' });
    expect(last).toHaveLength(3);
    expect(last[1]).toEqual(blankRowItem(null));
    expect(document.activeElement).toBe(screen.getAllByRole('textbox', { name: 'פריט' })[1]);
    fireEvent.keyDown(screen.getByTestId('qrow-price-b'), { key: 'Enter' });
    expect(last).toHaveLength(3);
  });
});

describe('inside the row: a known area, more sizes, details for the customer', () => {
  it('a saved known area opens as area / known amount (36 m²); an untouched open changes nothing; an edit keeps the shape', () => {
    const known = line({ id: 'k', unit_price: '35', pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: 36 });
    render(<Harness2 initial={[known]} />);
    expect(screen.getByTestId('qrow-billing-k').value).toBe('area');
    // restore item 02: the size-mode switch sits beside the amount again (not in the row menu)
    expect(screen.getByTestId('qrow-sizemode-k').dataset.mode).toBe('known');
    expect(screen.getByTestId('qrow-sizemode-k').textContent).toBe('חזרה להזנת מידות');
    expect(screen.getByTestId('qrow-known-k').value).toBe('36');
    expect(last[0]).toBe(known);
    fireEvent.change(screen.getByTestId('qrow-known-k'), { target: { value: '40' } });
    expect(last[0]).toMatchObject({ id: 'k', quantity: '1', pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: 40 });
    expect(screen.getByTestId('qrow-total-k').textContent).toBe('₪1400.00');
  });
  it('"another size" adds a size line; both count (4 x 3 + 2 x 2 = 16 m²)', async () => {
    render(<Harness2 initial={[line({ id: 's', description: 'ריצוף', unit_price: '10' })]} />);
    fireEvent.change(screen.getByTestId('qrow-billing-s'), { target: { value: 'area' } });
    await answerAppDialog(true);
    await waitFor(() => expect(screen.getByTestId('qrow-w-s')).toBeTruthy());
    fireEvent.change(screen.getByTestId('qrow-w-s'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('qrow-h-s'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('qrow-moresize-s'));
    const extra = screen.getByTestId('qrow-extrasizes-s');
    const [w, h] = extra.querySelectorAll('input[inputmode="decimal"]');
    fireEvent.change(w, { target: { value: '2' } });
    fireEvent.change(h, { target: { value: '2' } });
    expect(last[0].calculated_quantity).toBe(16);
    expect(last[0].measurements).toHaveLength(2);
    expect(screen.getByTestId('qrow-total-s').textContent).toBe('₪160.00');
  });
  it('details for the customer open from the row menu and are stored as the specification (empty lines dropped)', () => {
    render(<Harness2 initial={[line({ id: 'd' })]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-d'));
    fireEvent.click(screen.getByText('פרטים ללקוח'));
    fireEvent.change(screen.getByLabelText('שם הפרט, למשל צבע'), { target: { value: 'צבע' } });
    fireEvent.change(screen.getByLabelText('הערך, למשל לבן'), { target: { value: 'לבן' } });
    expect(last[0].specification).toEqual([{ label: 'צבע', value: 'לבן' }]);
  });
  it('a catalog pick reports the item for its catalog picture (the existing media path)', () => {
    const onCatalogItemAdded = vi.fn();
    render(<Harness2 initial={[blankRowItem()]} onCatalogItemAdded={onCatalogItemAdded} />);
    fireEvent.click(screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-catalog-"]'));
    fireEvent.pointerDown(screen.getByText('התקנת פנלים'));
    expect(onCatalogItemAdded).toHaveBeenCalledWith(8, expect.objectContaining({ description: 'התקנת פנלים', unit_price: '24' }));
  });
  it('without the measured capability area / length show the capability notice and the row stays as it was', () => {
    const onMeasuredLocked = vi.fn();
    render(<Harness2 initial={[line({ id: 'm' })]} canUseMeasured={false} onMeasuredLocked={onMeasuredLocked} />);
    fireEvent.change(screen.getByTestId('qrow-billing-m'), { target: { value: 'area' } });
    expect(onMeasuredLocked).toHaveBeenCalled();
    expect(last[0].pricing_unit).toBeUndefined();
  });
  it('leaving area with sizes asks first; "no" keeps the sizes', async () => {
    const sized = line({ id: 'w', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] });
    render(<Harness2 initial={[sized]} />);
    fireEvent.change(screen.getByTestId('qrow-billing-w'), { target: { value: 'units' } });
    // restore item 03: a saved line asks the item window's question (4f1592f2 AddItemWizard destructiveConversionConfirm)
    expect(await answerAppDialog(false)).toContain('שינוי שיטת התמחור עלול לשנות את משמעות הסכומים הקיימים');
    await waitFor(() => expect(last[0]).toBe(sized));
  });
});

// Owner console 2026-11-08 (stage 2): the read-only reviewers' findings (test-qa, system-impact, rtl-numeric), each locked by a test
import { readFileSync } from 'node:fs';
describe('reviewer findings, fixed', () => {
  it('a line changed from outside with the same id (the smart edit) is shown at once and never undone by the next keystroke', () => {
    const saved = line({ id: 'x', unit_price: '100' });
    let setOuter = null;
    function Outer() {
      const [items, setItems] = useState([saved]);
      setOuter = setItems; last = items;
      return <QuoteRowsEditor items={items} setItems={setItems} services={SERVICES} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
    }
    render(<Outer />);
    act(() => setOuter((prev) => [{ ...prev[0], unit_price: '120' }]));
    expect(screen.getByTestId('qrow-price-x').value).toBe('120');
    fireEvent.change(screen.getByTestId('qrow-item-x'), { target: { value: 'עבודה חדשה' } });
    expect(last[0]).toMatchObject({ description: 'עבודה חדשה', unit_price: '120' });
  });
  it('sizes -> known amount starts from the current amount; back to sizes counts the sizes again (a conversion, never a stale manual 0)', () => {
    const area = line({ id: 'a', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 20,
      measurements: [{ width: 5, height: 4, unit: 'm', calculated_area: 20, label: '', is_pricing_driving: true }] });
    render(<Harness2 initial={[area]} />);
    expect(screen.getByTestId('qrow-sizemode-a').textContent).toBe('השטח כבר ידוע?'); // restore item 02: beside the sizes
    fireEvent.click(screen.getByTestId('qrow-sizemode-a'));
    expect(screen.getByTestId('qrow-known-a').value).toBe('20');
    expect(last[0]).toMatchObject({ quantity_source: 'manual', calculated_quantity: 20 });
    fireEvent.click(screen.getByTestId('qrow-sizemode-a'));
    expect(last[0]).toMatchObject({ quantity_source: 'calculated', calculated_quantity: 20 });
    expect(screen.getByTestId('qrow-total-a').textContent).toBe('₪200.00');
  });
  it('an hourly line switched to area takes the sizes (4 x 5 = 20), never the old 3 hours', async () => {
    render(<Harness2 initial={[line({ id: 'h', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 3 })]} />);
    fireEvent.change(screen.getByTestId('qrow-billing-h'), { target: { value: 'area' } });
    await answerAppDialog(true);
    await waitFor(() => expect(screen.getByTestId('qrow-w-h')).toBeTruthy());
    fireEvent.change(screen.getByTestId('qrow-w-h'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('qrow-h-h'), { target: { value: '5' } });
    expect(last[0]).toMatchObject({ pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 20 });
  });
  it('changing the size unit converts the typed sizes (4 x 3 m -> 400 x 300 cm, still 12 m²)', () => {
    const area = line({ id: 'c', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] });
    render(<Harness2 initial={[area]} />);
    fireEvent.change(screen.getByTestId('qrow-sizeunit-c'), { target: { value: 'cm' } });
    expect([screen.getByTestId('qrow-w-c').value, screen.getByTestId('qrow-h-c').value]).toEqual(['400', '300']);
    expect(last[0].calculated_quantity).toBe(12);
  });
  it('metres -> feet with a price asks first ("no" keeps metres)', async () => {
    render(<Harness2 initial={[line({ id: 'f', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] })]} international />);
    fireEvent.change(screen.getByTestId('qrow-sizeunit-f'), { target: { value: 'ft' } });
    expect(await answerAppDialog(false)).toContain('רגל');
    expect(screen.getByTestId('qrow-sizeunit-f').value).toBe('m');
    expect(last[0].pricing_unit).toBe('m2');
  });
  it('a price-only edit of an hours line keeps its stored quantity column', () => {
    render(<Harness2 initial={[line({ id: 'k', quantity: '1', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 2.5 })]} />);
    fireEvent.change(screen.getByTestId('qrow-price-k'), { target: { value: '90' } });
    expect(last[0]).toMatchObject({ quantity: '1', calculated_quantity: 2.5, unit_price: '90' });
  });
  it('opening "details for the customer" changes nothing until something is typed', () => {
    const plain = line({ id: 'd' });
    render(<Harness2 initial={[plain]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-d'));
    fireEvent.click(screen.getByText('פרטים ללקוח'));
    expect(last[0]).toBe(plain);
  });
  it('the sizes read left to right in Hebrew too, the measured amount isolates only the number, the catalog shows money', () => {
    render(<Harness2 initial={[line({ id: 's', unit_price: '10', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] }), blankRowItem()]} />);
    expect(screen.getByTestId('qrow-w-s').parentElement.style.direction).toBe('ltr');
    const calc = screen.getByTestId('qrow-calc-s');
    expect(calc.textContent).toBe('12.00 מ״ר');
    expect(calc.querySelector('bdi').textContent).toBe('12.00');
    fireEvent.click(screen.getByTestId('quote-rows-editor').querySelectorAll('[data-testid^="qrow-catalog-"]')[1]);
    expect(screen.getAllByText('₪120.00').some((el) => el.closest('[role="listbox"]'))).toBe(true);
  });
  it('the save counts a move up / down of saved lines (sort_order) and never lets a blank row make a save financial', () => {
    const d = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(d).toContain("section_id, calculation_method, sort_order, quote_item_measurements");
    expect(d).toContain('const formItems = excludeUntouchedPlaceholderItems(items);');
    expect(d).toContain("const orderChanged = formIdsMappingSafe && authoritativeItems.every((a) => a.sort_order != null) && formIds.join('|') !== savedOrder.join('|');");
    expect(d).toContain('itemsStructurallyChanged = formIdsMappingSafe && (orderChanged || formItems.some((formItem) => {');
  });
});

// Owner console 2026-11-08 (stage 2, the eye check of the real screen): a fixed amount stays a fixed amount when the row is drawn again
describe('the chosen billing survives a redraw', () => {
  it('a new row set to a fixed amount reopens as a fixed amount (and 1 unit as units); the mark is screen-only', () => {
    const { unmount } = render(<Harness2 initial={[blankRowItem()]} />);
    const id = screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]').dataset.testid.replace('qrow-item-', '');
    fireEvent.change(screen.getByTestId('qrow-item-' + id), { target: { value: 'הובלה' } });
    fireEvent.change(screen.getByTestId('qrow-billing-' + id), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByTestId('qrow-price-' + id), { target: { value: '250' } });
    const fixed = last[0];
    expect(fixed).toMatchObject({ description: 'הובלה', quantity: '1', unit_price: '250', _billing: 'fixed' });
    unmount();
    render(<Harness2 initial={[fixed, { ...line({ id: 'u', unit_price: '9' }), _billing: 'units' }]} />);
    expect(screen.getAllByRole('combobox', { name: 'סוג חיוב' }).map((el) => el.value)).toEqual(['fixed', 'units']);
  });
  it('the save payload never carries the screen mark', () => {
    const d = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    const payload = d.slice(d.indexOf('const itemsPayload = itemsForPersist'), d.indexOf('const currentItemIds = new Set('));
    expect(payload).not.toContain('_billing');
    expect(payload).not.toMatch(/\.\.\.item[,\s}]/); // every saved field is named (itemPricePayload is a named helper)
  });
});
