// Owner console 2026-11-08 (typed: "מאשר להחזיר הכול למה שהיה ואת תיקוני הבהירות של קודקס בתוך המסך הקיים ... כולל שינוי ב-L-02 ... L-28,
// שחרור עד הלייב"): release 2 - the rows return to the behaviour of the item window before PR #190 (4f1592f2), items 01-06, 09, 16, 17 of
// docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md, inside the existing screen.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import QuoteRowsEditor from './components/QuoteRowsEditor';
import { blankRowItem, rowEntry } from './utils/quoteItemEntry';
import { answerAppDialog } from './test/appDialog';

afterEach(cleanup);
const SERVICES = [{ id: 7, name: 'ריצוף סלון', price: 120 }];
let last = null;
function H({ initial, ...rest }) {
  const [items, setItems] = useState(initial);
  last = items;
  return <QuoteRowsEditor items={items} setItems={setItems} services={SERVICES} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} {...rest} />;
}
const newId = () => screen.getByTestId('quote-rows-editor').querySelector('[data-testid^="qrow-item-"]').dataset.testid.replace('qrow-item-', '');
const line = (o) => ({ id: 'x', description: 'עבודה', quantity: '1', unit_price: '100', isFromCatalog: false, section_key: null, ...o });

describe('01 · kg / hours / days in every row', () => {
  it('the billing list holds every type of the approved unit set, in the spec order', () => {
    render(<H initial={[blankRowItem()]} />);
    const opts = [...screen.getByTestId(`qrow-billing-${newId()}`).querySelectorAll('option')].map((o) => [o.value, o.textContent]);
    expect(opts).toEqual([['fixed', 'סכום קבוע'], ['units', 'יחידות'], ['area', 'שטח'], ['linear', 'אורך'], ['kg', 'ק״ג'], ['hour', 'שעות'], ['day', 'ימים']]);
  });
  it('a new row by the hour: 2.5 hours x 80 = 200, stored exactly as the smart quote stores an hour line', () => {
    render(<H initial={[blankRowItem()]} />);
    const id = newId();
    fireEvent.change(screen.getByTestId(`qrow-billing-${id}`), { target: { value: 'hour' } });
    fireEvent.change(screen.getByTestId(`qrow-qty-${id}`), { target: { value: '2.5' } });
    fireEvent.change(screen.getByTestId(`qrow-price-${id}`), { target: { value: '80' } });
    expect(last[0]).toMatchObject({ quantity: '2.5', unit_price: '80', pricing_unit: 'hour', quantity_source: 'manual', calculated_quantity: 2.5 });
    expect(screen.getByTestId(`qrow-total-${id}`).textContent).toBe('₪200.00');
    expect(screen.getByText('שעה')).toBeTruthy();
  });
  it('a saved kg line opens as kg with its charged amount; a price edit keeps the amount', () => {
    render(<H initial={[line({ id: 'k', pricing_unit: 'kg', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 12.75 })]} />);
    expect(screen.getByTestId('qrow-billing-k').value).toBe('kg');
    expect(screen.getByTestId('qrow-qty-k').value).toBe('12.75');
    fireEvent.change(screen.getByTestId('qrow-price-k'), { target: { value: '4' } });
    expect(last[0]).toMatchObject({ pricing_unit: 'kg', calculated_quantity: 12.75, unit_price: '4' });
  });
});

describe('02 · "I already know the area / length" beside the sizes', () => {
  it('shown beside the sizes (not in the row menu) and back to sizes from a known amount', () => {
    render(<H initial={[line({ id: 'a', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] })]} />);
    expect(screen.getByTestId('qrow-sizemode-a').textContent).toBe('השטח כבר ידוע?');
    fireEvent.click(screen.getByTestId('qrow-menu-a'));
    expect(screen.getByRole('menu').textContent).not.toContain('ידוע');
  });
});

describe('03 · a billing change is asked first', () => {
  it('a saved line asks the item window question; "no" keeps the line', async () => {
    const saved = line({ id: 's' });
    render(<H initial={[saved]} />);
    fireEvent.change(screen.getByTestId('qrow-billing-s'), { target: { value: 'hour' } });
    expect(await answerAppDialog(false)).toBe('אופן החיוב ישתנה. בדקו את הכמות והזינו מחיר לבסיס החדש.');
    await waitFor(() => expect(last[0]).toBe(saved));
  });
  it('a new row with a typed price asks before the price is read for another unit; a new row without a price does not ask', async () => {
    render(<H initial={[{ ...blankRowItem(), description: 'צבע', unit_price: '50' }, blankRowItem()]} />);
    const ids = [...screen.getByTestId('quote-rows-editor').querySelectorAll('[data-testid^="qrow-item-"]')].map((n) => n.dataset.testid.replace('qrow-item-', ''));
    fireEvent.change(screen.getByTestId(`qrow-billing-${ids[1]}`), { target: { value: 'day' } });
    expect(last[1]).toMatchObject({ pricing_unit: 'day' });
    fireEvent.change(screen.getByTestId(`qrow-billing-${ids[0]}`), { target: { value: 'day' } });
    expect(await answerAppDialog(true)).toBe('אופן החיוב ישתנה. בדקו את הכמות והזינו מחיר לבסיס החדש.');
    await waitFor(() => expect(last[0]).toMatchObject({ pricing_unit: 'day', unit_price: '50' }));
  });
});

describe('04 / 05 · nothing is stored with its previous value', () => {
  it('a started size without its pair marks the row (the save refuses it) and says so once the row is left; complete sizes store it', async () => {
    render(<H initial={[line({ id: 'w', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] })]} />);
    fireEvent.change(screen.getByTestId('qrow-h-w'), { target: { value: '' } });
    expect(last[0]._invalid).toBe(true);
    expect(last[0].calculated_quantity).toBe(12); // the stored line is untouched - and the save refuses the marked line
    fireEvent.blur(screen.getByTestId('qrow-h-w'));
    await waitFor(() => expect(screen.getByTestId('qrow-sizeerr-w').textContent).toBe('יש להזין רוחב גדול מ-0'));
    fireEvent.change(screen.getByTestId('qrow-h-w'), { target: { value: '5' } });
    expect(last[0]._invalid).toBeUndefined();
    expect(last[0]).toMatchObject({ calculated_quantity: 20 });
  });
  it('sizes that round to 0.00 are refused with the item window message', async () => {
    render(<H initial={[line({ id: 't', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 12,
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }] })]} />);
    fireEvent.change(screen.getByTestId('qrow-sizeunit-t'), { target: { value: 'cm' } });
    fireEvent.change(screen.getByTestId('qrow-w-t'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('qrow-h-t'), { target: { value: '1' } });
    fireEvent.blur(screen.getByTestId('qrow-h-t'));
    expect(last[0]._invalid).toBe(true);
    await waitFor(() => expect(screen.getByTestId('qrow-sizeerr-t').textContent).toContain('מתעגלת לאפס'));
  });
  it('an invalid price marks the line while the row shows it (the save refuses); a row that opens again shows the stored line, unmarked', async () => {
    const { unmount } = render(<H initial={[line({ id: 'p' })]} />);
    fireEvent.change(screen.getByTestId('qrow-price-p'), { target: { value: '12,5' } });
    expect(last[0]).toMatchObject({ unit_price: '100', _invalid: true });
    expect(screen.getByTestId('qrow-total-p').textContent).toBe('—'); // no amount for a value that is not what is stored
    const marked = last[0];
    unmount();
    render(<H initial={[marked]} />);
    expect(screen.getByTestId('qrow-price-p').value).toBe('100');
    await waitFor(() => expect(last[0]._invalid).toBeUndefined());
    expect(rowEntry(marked, false).unitPrice).toBe('100');
  });
  it('an emptied quantity stays empty and says so (never becomes 1 by itself); the line is marked', () => {
    render(<H initial={[line({ id: 'q', quantity: '2' })]} />);
    fireEvent.change(screen.getByTestId('qrow-qty-q'), { target: { value: '' } });
    fireEvent.blur(screen.getByTestId('qrow-qty-q'));
    expect(screen.getByTestId('qrow-qty-q').value).toBe('');
    expect(screen.getByTestId('qrow-qtyempty-q').textContent).toBe('יש להזין כמות גדולה מ-0');
    expect(last[0]).toMatchObject({ quantity: '2', _invalid: true });
    fireEvent.change(screen.getByTestId('qrow-qty-q'), { target: { value: '3' } });
    expect(screen.queryByTestId('qrow-qtyempty-q')).toBeNull();
    expect(last[0]).toMatchObject({ quantity: '3' });
    expect(last[0]._invalid).toBeUndefined();
  });
  it('a line changed from outside (the smart edit) shows the new values and drops a stale mark', async () => {
    let setOuter = null;
    function Outer() { const [items, setItems] = useState([line({ id: 'o' })]); setOuter = setItems; last = items; return <QuoteRowsEditor items={items} setItems={setItems} services={SERVICES} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />; }
    render(<Outer />);
    fireEvent.change(screen.getByTestId('qrow-price-o'), { target: { value: 'abc' } });
    expect(last[0]._invalid).toBe(true);
    act(() => setOuter((prev) => [{ ...prev[0], unit_price: '150' }]));
    await waitFor(() => expect(last[0]._invalid).toBeUndefined());
    expect(screen.getByTestId('qrow-price-o').value).toBe('150');
  });
  it('the save refuses a marked row before anything is written', () => {
    const src = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(src).toMatch(/if \(items\.some\(\(it\) => it && it\._invalid\)\) \{\s*saveBlock\('QUOTE_INCOMPLETE_ITEMS', isHebrew \? 'תקנו את השדות המסומנים ונסו לשמור שוב\.'/);
  });
});

describe('06 · the business recommendation', () => {
  it('the recommended type comes first with its mark; the new row still starts as units', () => {
    render(<H initial={[blankRowItem()]} recommendedMethod="area" />);
    const sel = screen.getByTestId(`qrow-billing-${newId()}`);
    expect(sel.querySelector('option').textContent).toBe('שטח · מומלץ');
    expect(sel.value).toBe('units');
  });
});

describe('09 · a catalog pick fills the billing type too', () => {
  it('on an hours row with a price: asked first, then units x 1 at the catalog price', async () => {
    render(<H initial={[line({ id: 'c', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 3 })]} />);
    fireEvent.click(screen.getByTestId('qrow-catalog-c'));
    fireEvent.pointerDown(screen.getByText('ריצוף סלון'));
    expect(await answerAppDialog(true)).toBe('אופן החיוב ישתנה. בדקו את הכמות והזינו מחיר לבסיס החדש.');
    await waitFor(() => expect(last[0]).toMatchObject({ description: 'ריצוף סלון', unit_price: '120', quantity: '1', isFromCatalog: true }));
    // the item window started every catalog line at quantity 1
    expect(last[0].pricing_unit).toBeUndefined();
    expect(screen.getByTestId('qrow-billing-c').value).toBe('units');
  });
  it('on a units row the catalog line starts at quantity 1 too', () => {
    render(<H initial={[line({ id: 'u', quantity: '4' })]} />);
    fireEvent.click(screen.getByTestId('qrow-catalog-u'));
    fireEvent.pointerDown(screen.getByText('ריצוף סלון'));
    expect(last[0]).toMatchObject({ description: 'ריצוף סלון', unit_price: '120', quantity: '1' });
  });
});

describe('16 · a quantity set by the smart edit', () => {
  it('opens as a known amount with its sizes for reference; a price edit keeps both', () => {
    const smart = line({ id: 'm', unit_price: '10', pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 13.5,
      measurements: [{ width: 4.5, height: 3, unit: 'm', calculated_area: 13.5, label: '', is_pricing_driving: true }] });
    render(<H initial={[smart]} />);
    expect(screen.getByTestId('qrow-known-m').value).toBe('13.5');
    expect(screen.getByTestId('qrow-refsizes-m').textContent).toContain('מידות לעיון');
    fireEvent.change(screen.getByTestId('qrow-price-m'), { target: { value: '12' } });
    expect(last[0]).toMatchObject({ unit_price: '12', quantity_source: 'manual', calculated_quantity: 13.5 });
    expect(last[0].measurements).toEqual(smart.measurements);
  });
});

describe('17 · the only line has no Remove', () => {
  it('one line: no Remove in its menu; two lines: Remove is there', () => {
    const { unmount } = render(<H initial={[line({ id: 'o' })]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-o'));
    expect(screen.queryByText('הסרת שורה')).toBeNull();
    unmount();
    render(<H initial={[line({ id: 'o' }), line({ id: 'p' })]} />);
    fireEvent.click(screen.getByTestId('qrow-menu-o'));
    expect(screen.getByText('הסרת שורה')).toBeTruthy();
  });
});
