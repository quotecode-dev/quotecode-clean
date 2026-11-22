// 2026-11-13 (Owner: the manual quote of the 13/11 spec / demo, typed L-05 ... L-29): the new work area itself, in Hebrew and in English -
// the add form under every heading, the units of each market, the catalog search, the add window (kind -> how many -> names), the
// navigation, the help circles and folding. The QuoteForm wiring is in src/components/QuoteForm.test.jsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import { useState } from 'react';
import QuoteTreeEditor from './QuoteTreeEditor';

afterEach(cleanup);
let state = null;
function Harness({ isHebrew = true, international = false, initialItems = [], initialSections = [], structure: initialStructure, services = [], onSaveToCatalog = null }) {
  const [items, setItems] = useState(initialItems);
  const [sections, setSections] = useState(initialSections);
  const [structure, setStructure] = useState(initialStructure || (initialSections.some((s) => s.parent_key) ? 'tiered' : initialSections.length ? 'grouped' : 'simple'));
  state = { items, sections, structure };
  return (
    <QuoteTreeEditor isHebrew={isHebrew} international={international} items={items} setItems={setItems} sections={sections} setSections={setSections}
      services={services} sym={isHebrew ? '₪' : '$'} fmtMoney={(n) => Number(n || 0).toFixed(2)} structure={structure} onStructure={setStructure}
      onSaveToCatalog={onSaveToCatalog} renderRowEditor={() => <div data-testid="row-editor" />} bottomBar={<div data-testid="bar" />} />
  );
}
const form = (i = 0) => screen.getAllByTestId('qt-form')[i];
const nameOf = (f) => f.querySelector('input[id$="-name"]');
const type = (el, value) => fireEvent.change(el, { target: { value } });
const fill = (f, { name, method, qty, price }) => {
  if (name != null) type(nameOf(f), name);
  if (method) fireEvent.change(f.querySelector('select'), { target: { value: method } });
  if (qty != null) type(f.querySelector('input[id$="-qty"]'), qty);
  if (price != null) type(f.querySelector('input[id$="-price"]'), price);
};

describe('the add form', () => {
  it('HE local: the pricing list, an empty quantity to start, a row added under the form with its sum', () => {
    render(<Harness />);
    const f = form();
    expect([...f.querySelector('select').options].map((o) => o.textContent)).toEqual(['ליחידה', 'למ״ר', 'למטר', 'לשעה', 'ליום עבודה', 'לק״ג', 'מחיר גלובלי']);
    expect(f.querySelector('input[id$="-qty"]').value).toBe('');
    expect(f.querySelector('input[id$="-qty"]').getAttribute('placeholder')).toBe("מס' יחידות"); // 2026-11-15: the demo's placeholders
    expect(f.querySelector('input[id$="-price"]').getAttribute('placeholder')).toBe('מחיר ליחידה');
    fill(f, { name: 'חלון', qty: '3', price: '100' });
    expect(f.textContent).toContain('סכום השורה: ₪300.00');
    fireEvent.click(within(f).getByTestId('qt-add'));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ description: 'חלון', quantity: '3', unit_price: '100', section_key: null });
    expect(screen.getAllByTestId('qt-row')[0].querySelector('.qt-sum').textContent).toBe('₪300.00');
    expect(f.querySelector('input[id$="-qty"]').value).toBe(''); // the form is ready for the next row
  });
  it('a name and a quantity above 0 are required; an empty price is "not priced yet", never 0', () => {
    render(<Harness />);
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(screen.getByTestId('qt-form-error').textContent).toBe('כתבו מה עושים או איזה מוצר מוסיפים.');
    fill(form(), { name: 'צביעה' });
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(screen.getByTestId('qt-form-error').textContent).toBe('הקלידו כמות או מידות גדולות מאפס.');
    fill(form(), { qty: '2' });
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(state.items[0].unit_price).toBe('');
    expect(screen.getAllByTestId('qt-row')[0].textContent).toContain('טרם תומחר');
  });
  it('an area by its sizes (2 x 3 at 50 = 300) is stored as m² with its measurement', () => {
    render(<Harness />);
    const f = form();
    fill(f, { name: 'ריצוף', method: 'area', price: '50' });
    fireEvent.click(within(f).getByRole('button', { name: 'מידות ופירוט נוסף' }));
    // the demo: "השטח כבר ידוע" / "לפי מידות" - by sizes the quantity field gives way to the sizes
    fireEvent.click(within(f).getByRole('button', { name: 'לפי מידות' }));
    expect(f.querySelector('input[id$="-qty"]')).toBeNull();
    type(within(f).getByLabelText('אורך 1'), '2');
    type(within(f).getByLabelText('רוחב 1'), '3');
    expect(f.textContent).toContain('סכום השורה: ₪300.00');
    fireEvent.click(within(f).getByTestId('qt-add'));
    expect(state.items[0]).toMatchObject({ pricing_unit: 'm2', calculated_quantity: 6, unit_price: '50' });
  });
  it('a global price has no quantity field and is the row amount', () => {
    render(<Harness />);
    const f = form();
    fill(f, { name: 'הובלה', method: 'fixed', price: '450' });
    expect(f.querySelector('input[id$="-qty"]')).toBeNull();
    fireEvent.click(within(f).getByTestId('qt-add'));
    expect(state.items[0]._billing).toBe('fixed');
    expect(screen.getAllByTestId('qt-row')[0].querySelector('.qt-sum').textContent).toBe('₪450.00');
  });
  it('EN international: feet first and metres still available; each stores its own unit', () => {
    render(<Harness isHebrew={false} international />);
    const f = form();
    expect([...f.querySelector('select').options].map((o) => o.textContent)).toEqual(['Per unit', 'Per sq ft', 'Per ft', 'Per m²', 'Per m', 'Per hour', 'Per work day', 'Per kg', 'Lump sum']);
    fill(f, { name: 'Deck', method: 'area', qty: '120', price: '9' });
    expect(f.querySelector('input[id$="-qty"]').getAttribute('placeholder')).toBe('Sq ft'); // 2026-11-15: the short English placeholder (never cut in the demo's field width)
    fireEvent.click(within(f).getByTestId('qt-add'));
    fill(form(), { name: 'Tiles', method: 'area_m', qty: '12', price: '40' });
    expect(form().querySelector('input[id$="-qty"]').getAttribute('placeholder')).toBe('m²');
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(state.items.map((it) => [it.description, it.pricing_unit])).toEqual([['Deck', 'sq_ft'], ['Tiles', 'm2']]); // the demo: a new row at the end
  });
  it('EN local: area and length say m² and m (never feet)', () => {
    render(<Harness isHebrew={false} />);
    expect([...form().querySelector('select').options].map((o) => o.textContent)).toEqual(['Per unit', 'Per m²', 'Per m', 'Per hour', 'Per work day', 'Per kg', 'Lump sum']);
  });
  it('"also save to the catalog" only for a new name, unchecked; the result is said under the form', async () => {
    const onSaveToCatalog = vi.fn(async () => ({ ok: true }));
    render(<Harness onSaveToCatalog={onSaveToCatalog} />);
    const f = form();
    fill(f, { name: 'מעקה', method: 'linear', qty: '4', price: '300' });
    const box = within(f).getByRole('checkbox');
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    await act(async () => { fireEvent.click(within(f).getByTestId('qt-add')); });
    expect(onSaveToCatalog).toHaveBeenCalledWith({ name: 'מעקה', price: 300, method: 'linear', international: false });
    expect(f.textContent).toContain('נשמר גם בקטלוג');
  });
});

describe('the catalog search', () => {
  const services = [{ id: 's3', name: 'חלון 10', price: 900 }, { id: 's1', name: 'חלון 2', price: 500, price_basis: 'm2' }, { id: 's2', name: 'אסלה', price: 700 }];
  it('"+ add a new product" first, then the names in order (numbers in their natural order); picking fills name, pricing and price - not the quantity', () => {
    render(<Harness services={services} />);
    const input = nameOf(form());
    fireEvent.click(input);
    const options = within(screen.getByTestId('qt-catalog-list')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['+ הוספת מוצר חדש', 'אסלה₪700.00 ליחידה', 'חלון 2₪500.00 למ״ר', 'חלון 10₪900.00 ליחידה']); // the demo: the price with its pricing word
    type(input, '10');
    expect(within(screen.getByTestId('qt-catalog-list')).getAllByRole('option')).toHaveLength(2);
    type(input, 'חלון');
    fireEvent.click(screen.getByRole('button', { name: /חלון 2/ }));
    expect(input.value).toBe('חלון 2');
    expect(form().querySelector('select').value).toBe('area');
    expect(form().querySelector('input[id$="-price"]').value).toBe('500');
    expect(form().querySelector('input[id$="-qty"]').value).toBe('');
  });
  it('100 products: typing finds the one asked for', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, name: `Product ${i + 1}`, price: i + 1 }));
    render(<Harness isHebrew={false} services={many} />);
    const input = nameOf(form());
    fireEvent.click(input);
    type(input, 'Product 73');
    expect(within(screen.getByTestId('qt-catalog-list')).getAllByRole('option').map((o) => o.textContent)).toEqual(['+ Add a new product', 'Product 73$73.00 Per unit']);
  });
});

describe('headings: the add window, navigation, folding', () => {
  it('kind -> how many (empty, a whole number from 1) -> names (distinct among siblings); back keeps what was typed', () => {
    render(<Harness structure="grouped" />);
    fireEvent.click(screen.getByTestId('qt-add-first'));
    fireEvent.click(screen.getByTestId('qt-kind-apartment'));
    const dialog = screen.getByTestId('qt-wizard');
    expect(dialog.querySelector('h3').textContent).toBe('כמה דירות להוסיף להצעה?');
    expect(screen.getByTestId('qt-count').value).toBe('');
    expect(screen.getByTestId('qt-count').getAttribute('placeholder')).toBe('הקלידו את מספר הדירות');
    // "להמשך" waits for a whole number from 1 (2026-11-15, spec 13/11 section 4: no 20 limit)
    type(screen.getByTestId('qt-count'), '0');
    expect(within(dialog).getByRole('button', { name: 'להמשך' })).toBeDisabled();
    type(screen.getByTestId('qt-count'), '2.5');
    expect(within(dialog).getByRole('button', { name: 'להמשך' })).toBeDisabled();
    type(screen.getByTestId('qt-count'), '21');
    expect(within(dialog).getByRole('button', { name: 'להמשך' })).not.toBeDisabled();
    expect(screen.getByTestId('qt-count').hasAttribute('max')).toBe(false);
    type(screen.getByTestId('qt-count'), '2');
    fireEvent.click(within(dialog).getByRole('button', { name: 'להמשך' }));
    type(screen.getByTestId('qt-name-0'), 'דירה 32');
    type(screen.getByTestId('qt-name-1'), 'דירה 32');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(screen.getByTestId('qt-names-error').textContent).toBe('תנו לכל כותרת שם שונה, כדי שיהיה קל לזהות אותה.');
    fireEvent.click(screen.getByTestId('qt-page-back'));
    expect(screen.getByTestId('qt-count').value).toBe('2');
    fireEvent.click(within(dialog).getByRole('button', { name: 'להמשך' }));
    expect(screen.getByTestId('qt-name-0').value).toBe('דירה 32');
    // every name is required (the demo)
    type(screen.getByTestId('qt-name-1'), '');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(screen.getByTestId('qt-names-error').textContent).toBe('כתבו שם לכל דירה.');
    type(screen.getByTestId('qt-name-1'), 'דירה 33');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(state.sections.map((s) => [s.name, s.kind])).toEqual([['דירה 32', 'apartment'], ['דירה 33', 'apartment']]);
    // the add-more button follows the kind of the last top heading
    expect(screen.getByTestId('qt-add-same').textContent).toBe('+ הוספת דירה');
  });
  it('each heading has its own full add form ("אל: דירה 32 ← מטבח"); a row added there belongs to that heading only', () => {
    render(<Harness initialSections={[{ key: 'a', name: 'דירה 32', kind: 'apartment', sort_order: 0 }, { key: 'k', name: 'מטבח', kind: 'room', parent_key: 'a', sort_order: 1 }, { key: 'b', name: 'דירה 33', kind: 'apartment', sort_order: 2 }]} />);
    expect(screen.getAllByTestId('qt-form-to').map((el) => el.textContent)).toEqual(['אל: כל ההצעה', 'אל: דירה 32', 'אל: דירה 32 ← מטבח', 'אל: דירה 33']);
    const kitchen = screen.getAllByTestId('qt-form')[2];
    fill(kitchen, { name: 'ארונות', qty: '1', price: '8000' });
    fireEvent.click(within(kitchen).getByTestId('qt-add'));
    expect(state.items[0].section_key).toBe('k');
  });
  it('a row not added yet in one form blocks working in another place (the demo\'s sentence); the typed row stays', () => {
    render(<Harness initialSections={[{ key: 'a', name: 'דירה 32', sort_order: 0 }, { key: 'b', name: 'דירה 33', sort_order: 1 }]} />);
    const [, a, b] = screen.getAllByTestId('qt-form');
    fill(a, { name: 'צביעה' });
    fireEvent.pointerDown(nameOf(b));
    expect(screen.getByTestId('qt-block').textContent).toBe('הוסיפו את השורה הנוכחית או נקו אותה לפני עבודה בדירה אחרת.');
    expect(nameOf(a).value).toBe('צביעה');
    // moving elsewhere is blocked too, until the row is added or cleared
    fireEvent.click(screen.getAllByTestId('qt-nav-heading')[1]);
    expect(screen.getByTestId('qt-block').textContent).toBe('הוסיפו את השורה או נקו אותה לפני המעבר.');
    fireEvent.click(within(a).getByTestId('qt-clear'));
    expect(screen.queryByTestId('qt-block')).toBeNull();
  });
  it('"whole quote" and one chip per top heading; a chip selects (nothing changes); back goes to the parent, then the whole quote', () => {
    render(<Harness initialSections={[{ key: 'f', name: 'קומה 10', kind: 'floor', sort_order: 0 }, { key: 'a', name: 'דירה 22', kind: 'apartment', parent_key: 'f', sort_order: 1 }]} />);
    expect(screen.getAllByTestId(/qt-nav-/).map((el) => el.textContent)).toEqual(['כל ההצעה', 'קומה 10']);
    const before = state.sections;
    fireEvent.click(screen.getAllByTestId('qt-nav-heading')[0]);
    expect(state.sections).toBe(before);
    expect(screen.getByTestId('qt-back').textContent).toBe('חזרה לכל ההצעה');
    fireEvent.click(screen.getAllByTestId('qt-heading')[1].querySelector('.qt-head-name'));
    expect(screen.getByTestId('qt-back').textContent).toBe('חזרה לקומה 10');
  });
  it('"+ add a heading inside" only in "floors, apartments and rooms"; it adds under that heading', () => {
    const { unmount } = render(<Harness structure="grouped" initialSections={[{ key: 'a', name: 'דירה 22', kind: 'apartment', sort_order: 0 }]} />);
    expect(screen.queryByTestId('qt-add-inside')).toBeNull();
    unmount();
    render(<Harness structure="tiered" initialSections={[{ key: 'a', name: 'דירה 22', kind: 'apartment', sort_order: 0 }]} />);
    fireEvent.click(screen.getByTestId('qt-add-inside'));
    expect(screen.getByTestId('qt-wizard').querySelector('h3').textContent).toBe('מה מוסיפים בתוך דירה 22?');
    fireEvent.click(screen.getByTestId('qt-kind-room'));
    type(screen.getByTestId('qt-count'), '1');
    fireEvent.click(within(screen.getByTestId('qt-wizard')).getByRole('button', { name: 'להמשך' }));
    type(screen.getByTestId('qt-name-0'), 'סלון');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(state.sections.find((s) => s.name === 'סלון').parent_key).toBe('a');
  });
  it('a top heading has the big triangle, a heading inside it the small one; folding hides and keeps the content', () => {
    render(<Harness initialSections={[{ key: 'a', name: 'דירה 22', sort_order: 0 }, { key: 'k', name: 'מטבח', parent_key: 'a', sort_order: 1 }]}
      initialItems={[{ description: 'ארונות', quantity: '1', unit_price: '10', section_key: 'k' }]} />);
    const [top, sub] = screen.getAllByTestId('qt-heading').map((h) => h.querySelector('.qt-tri'));
    expect(top.className).toContain('qt-tri--top');
    expect(sub.className).toContain('qt-tri--sub');
    // folding hides the body but keeps it (and anything typed in its forms) on the page
    const body = () => screen.getAllByTestId('qt-heading')[0].querySelector('.qt-body');
    fireEvent.click(top);
    expect(body().hidden).toBe(true);
    expect(screen.getAllByTestId('qt-row')).toHaveLength(1);
    expect(state.items).toHaveLength(1);
    fireEvent.click(top);
    expect(body().hidden).toBe(false);
  });
  it('the help circle explains and never chooses: it opens on click and closes with Escape', () => {
    render(<Harness />);
    const help = screen.getAllByTestId('qt-help')[1];
    fireEvent.click(help);
    expect(screen.getByTestId('qt-help-pop').textContent).toBe('לכל דירה, קומה, חדר או נושא כותרת נפרדת, ומתחתיה המוצרים שלה.');
    expect(state.structure).toBe('simple');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('qt-help-pop')).toBeNull();
  });
  it('English mirrors Hebrew: the same structure buttons, the same steps, left to right', () => {
    render(<Harness isHebrew={false} structure="grouped" />);
    expect(screen.getByTestId('qt-editor').getAttribute('dir')).toBe('ltr');
    expect(['simple', 'grouped', 'tiered'].map((k) => screen.getByTestId(`qt-structure-${k}`).textContent)).toEqual(['Simple quote', 'By apartments', 'Floors, apartments, rooms']);
    fireEvent.click(screen.getByTestId('qt-add-first'));
    fireEvent.click(screen.getByTestId('qt-kind-floor'));
    expect(screen.getByTestId('qt-wizard').querySelector('h3').textContent).toBe('How many floors to add to the quote?');
  });
});
