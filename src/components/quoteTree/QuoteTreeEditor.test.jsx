// 2026-11-20/21 (Owner console, typed: the simple-quotes sketch TEKANGO-sketch-simple-quotes-2026-11-20 is the approved demo of the quote
// editor - "כולל כל שינויי ההתנהגות שבה, שורת ההקלדה מתחת לשורות והשמות "מחולקת לחלקים" / "חלקים בתוך חלקים""; L-07 / L-09 / L-14 / L-29
// only as needed): the work area itself, in Hebrew and in English - ONE entry row below the rows, the units of each market, the catalog
// search, the rows and their "⋯" menu (edit, duplicate, up, down, move, remove + undo), the "מבנה:" menu, the sections (the add panel in the
// page, the section's "⋯": add here / inside, rename in place, duplicate, copy the first, template, remove), the help "?" and English.
// It replaces the tests of the 13/11 editor (pages, chips, a form per heading). The QuoteForm wiring is in src/components/QuoteForm.test.jsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import { useState } from 'react';
import QuoteTreeEditor from './QuoteTreeEditor';

afterEach(cleanup);
let state = null;
function Harness({ isHebrew = true, international = false, initialItems = [], initialSections = [], structure: initialStructure, services = [], onSaveToCatalog = null,
  onPendingChange = null, onSaveHeadingTemplate = null, onSubmit = null }) {
  const [items, setItems] = useState(initialItems);
  const [sections, setSections] = useState(initialSections);
  const [structure, setStructure] = useState(initialStructure || (initialSections.some((s) => s.parent_key) ? 'tiered' : initialSections.length ? 'grouped' : 'simple'));
  state = { items, sections, structure, setItems };
  const ed = (
    <QuoteTreeEditor isHebrew={isHebrew} international={international} items={items} setItems={setItems} sections={sections} setSections={setSections}
      services={services} sym={isHebrew ? '₪' : '$'} fmtMoney={(n) => Number(n || 0).toFixed(2)} structure={structure} onStructure={setStructure}
      onSaveToCatalog={onSaveToCatalog} onPendingChange={onPendingChange} onSaveHeadingTemplate={onSaveHeadingTemplate} />
  );
  return onSubmit ? <form onSubmit={onSubmit}>{ed}</form> : ed;
}
const entry = () => screen.queryByTestId('qt-form') || screen.getByTestId('qt-edit-form');
const type = (el, value) => fireEvent.change(el, { target: { value } });
const fill = ({ name, method, qty, price }) => {
  if (name != null) type(screen.getByLabelText(/חיפוש מוצר|Product search/, { selector: 'input' }), name);
  if (method) fireEvent.change(document.getElementById('qt-f-unit'), { target: { value: method } });
  if (qty != null) type(document.getElementById('qt-f-qty'), qty);
  if (price != null) type(document.getElementById('qt-f-price'), price);
};
const add = () => fireEvent.click(within(entry()).getByTestId(/^qt-(add|edit-save)$/));
const rowNames = () => screen.queryAllByTestId('qt-row').map((r) => r.querySelector('.qt-row-name').textContent);
const openRowMenu = (i) => fireEvent.click(screen.getAllByTestId('qt-row-actions')[i]);
const menuLabels = () => [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((b) => b.querySelector('.qt-menu-label, b').textContent);
const row = (desc, extra = {}) => ({ description: desc, quantity: '1', unit_price: '10', section_key: null, ...extra });
const sec = (key, name, extra = {}) => ({ key, id: null, name, kind: 'apartment', parent_key: null, sort_order: 0, repeat_count: 1, ...extra });

describe('the entry row (one per quote, inside the table, below the rows)', () => {
  it('HE local: the pricing list, an empty quantity to start; the line total; a row added ABOVE the entry row with its sum', () => {
    render(<Harness />);
    expect([...document.getElementById('qt-f-unit').options].map((o) => o.textContent)).toEqual(['ליחידה', 'למ״ר', 'למטר', 'לשעה', 'ליום עבודה', 'לק״ג', 'מחיר גלובלי']);
    expect(document.getElementById('qt-f-qty').value).toBe('');
    expect(screen.getByTestId('qt-line-sum').textContent).toBe('טרם תומחר');
    fill({ name: 'צביעה', qty: '2', price: '150' });
    expect(screen.getByTestId('qt-line-sum').textContent).toBe('₪300.00');
    add();
    expect(state.items).toHaveLength(1);
    expect(rowNames()).toEqual(['צביעה']);
    const r = screen.getByTestId('qt-row');
    expect(r.querySelector('.qt-ir-s').textContent).toBe('₪300.00');
    // the entry row comes after the rows (the Owner: "שורת ההקלדה מתחת לשורות")
    expect(r.compareDocumentPosition(entry()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('qt-undo').textContent).toContain('השורה נוספה להצעה.');
  });
  it('a name and a quantity above 0 are required; an empty price is "not priced yet", never 0', () => {
    render(<Harness />);
    add();
    expect(screen.getByTestId('qt-form-error').textContent).toBe('כתבו מה עושים או איזה מוצר מוסיפים.');
    fill({ name: 'חלון', qty: '0' }); add();
    expect(screen.getByTestId('qt-form-error').textContent).toBe('הקלידו כמות או מידות גדולות מאפס.');
    fill({ qty: '1' }); add();
    expect(state.items[0].unit_price).toBe('');
    expect(screen.getByTestId('qt-row').querySelector('.qt-ir-s').textContent).toBe('טרם תומחר');
  });
  it('an area by its sizes (2 x 3 at 50 = 300) is stored as m² with its measurement', () => {
    render(<Harness />);
    fill({ name: 'ריצוף', method: 'area' });
    fireEvent.click(screen.getByTestId('qt-more'));
    fireEvent.click(screen.getByRole('button', { name: 'לפי מידות' }));
    type(screen.getByLabelText('אורך במטרים 1'), '2'); type(screen.getByLabelText('רוחב במטרים 1'), '3');
    fill({ price: '50' });
    expect(screen.getByTestId('qt-line-sum').textContent).toBe('₪300.00');
    add();
    expect(state.items[0]).toMatchObject({ pricing_unit: 'm2' });
    expect(Number(state.items[0].calculated_quantity)).toBe(6);
    expect(state.items[0].measurements).toHaveLength(1);
  });
  it('a half-typed size is refused, never counted as 0', () => {
    render(<Harness />);
    fill({ name: 'ריצוף', method: 'area', price: '50' });
    fireEvent.click(screen.getByTestId('qt-more'));
    fireEvent.click(screen.getByRole('button', { name: 'לפי מידות' }));
    type(screen.getByLabelText('אורך במטרים 1'), '2');
    add();
    expect(screen.getByTestId('qt-form-error').textContent).toBe('השלימו את כל המידות או הסירו מידה ריקה.');
    expect(state.items).toHaveLength(0);
  });
  it('a global price takes no quantity (the field is closed, "1") and is the row amount', () => {
    render(<Harness />);
    fill({ name: 'התקנה', method: 'fixed', price: '850' });
    expect(document.getElementById('qt-f-qty').disabled).toBe(true);
    expect(document.getElementById('qt-f-qty').placeholder).toBe('1');
    add();
    const r = screen.getByTestId('qt-row');
    expect(r.querySelector('.qt-ir-s').textContent).toBe('₪850.00');
    expect(r.querySelector('.qt-ir-q').textContent).toBe('—');
  });
  it('EN international: feet first and metres still available; EN local: m² and m only', () => {
    render(<Harness isHebrew={false} international />);
    expect([...document.getElementById('qt-f-unit').options].map((o) => o.textContent)).toEqual(['Per unit', 'Per sq ft', 'Per ft', 'Per m²', 'Per m', 'Per hour', 'Per work day', 'Per kg', 'Lump sum']);
    cleanup();
    render(<Harness isHebrew={false} />);
    expect([...document.getElementById('qt-f-unit').options].map((o) => o.textContent)).toEqual(['Per unit', 'Per m²', 'Per m', 'Per hour', 'Per work day', 'Per kg', 'Lump sum']);
  });
  it('"לשמור גם בקטלוג" only for a new name, unchecked; an empty price is never saved; the answer is said in the message', async () => {
    const onSaveToCatalog = vi.fn(async () => ({ ok: true }));
    render(<Harness onSaveToCatalog={onSaveToCatalog} services={[{ id: 's1', name: 'חלון', price: 100, price_basis: 'unit' }]} />);
    fill({ name: 'חלון' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    fill({ name: 'מחיצה', qty: '1' });
    expect(screen.getByRole('checkbox').checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    add();
    expect(onSaveToCatalog).not.toHaveBeenCalled();
    expect(screen.getByTestId('qt-undo').textContent).toContain('מוצר בלי מחיר לא נשמר בקטלוג.');
    fill({ name: 'מחיצה 2', qty: '1', price: '400' }); fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => { add(); });
    expect(onSaveToCatalog).toHaveBeenCalledWith(expect.objectContaining({ name: 'מחיצה 2', price: 400 }));
    expect(screen.getByTestId('qt-undo').textContent).toContain('השורה נוספה ונשמרה גם בקטלוג.');
  });
  it('Enter in the entry row adds nothing and never submits the form around the editor; typing is reported as a pending row', () => {
    const onSubmit = vi.fn((e) => e.preventDefault()); const onPendingChange = vi.fn();
    render(<Harness onSubmit={onSubmit} onPendingChange={onPendingChange} />);
    fill({ name: 'חלון', qty: '2' });
    expect(onPendingChange).toHaveBeenLastCalledWith(['כל ההצעה']);
    fireEvent.keyDown(document.getElementById('qt-f-qty'), { key: 'Enter' });
    expect(state.items).toHaveLength(0);
    add();
    expect(state.items.map((it) => it.description)).toEqual(['חלון']);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onPendingChange).toHaveBeenLastCalledWith([]);
  });
});

describe('the catalog search', () => {
  const services = [{ id: 'a', name: 'חלון 10', price: 10, price_basis: 'unit' }, { id: 'b', name: 'חלון 2', price: 20, price_basis: 'm2' }, { id: 'c', name: 'דלת', price: 30, price_basis: 'fixed' }];
  it('"+ הוספת מוצר חדש" first, then the names in order (numbers in their natural order); picking fills name, pricing and price - not the quantity', () => {
    render(<Harness services={services} />);
    fireEvent.click(document.getElementById('qt-f-name'));
    const list = screen.getByTestId('qt-catalog-list');
    expect([...list.querySelectorAll('button')].map((b) => b.querySelector('span')?.textContent || b.textContent)).toEqual(['+ הוספת מוצר חדש', 'דלת', 'חלון 2', 'חלון 10']);
    fireEvent.click(within(list).getByText('חלון 2'));
    expect(document.getElementById('qt-f-name').value).toBe('חלון 2');
    expect(document.getElementById('qt-f-unit').value).toBe('area');
    expect(document.getElementById('qt-f-price').value).toBe('20');
    expect(document.getElementById('qt-f-qty').value).toBe('');
  });
  it('"+ הוספת מוצר חדש" starts an empty new product, ticked to be saved in the catalog', () => {
    render(<Harness services={services} onSaveToCatalog={vi.fn()} />);
    fireEvent.click(document.getElementById('qt-f-name'));
    fireEvent.click(within(screen.getByTestId('qt-catalog-list')).getByText('+ הוספת מוצר חדש'));
    expect(document.getElementById('qt-f-name').placeholder).toBe('הקלידו שם למוצר החדש');
    fill({ name: 'מוצר חדש' });
    expect(screen.getByRole('checkbox').checked).toBe(true);
  });
  it('100 products: typing finds the one asked for', () => {
    render(<Harness services={Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, name: `מוצר ${i}`, price: i, price_basis: 'unit' }))} />);
    fireEvent.click(document.getElementById('qt-f-name'));
    type(document.getElementById('qt-f-name'), 'מוצר 57');
    expect([...screen.getByTestId('qt-catalog-list').querySelectorAll('li button > span:first-child')].map((s) => s.textContent)).toEqual(['מוצר 57']);
  });
});

describe('rows and their "⋯" menu', () => {
  it('a simple quote: edit, duplicate, up, down, remove; the first cannot go up, the last cannot go down', () => {
    render(<Harness initialItems={[row('א'), row('ב')]} />);
    openRowMenu(0);
    expect(menuLabels()).toEqual(['עריכה', 'שכפול', 'הזזה למעלה', 'הזזה למטה', 'הסרה']);
    expect(screen.getByTestId('qt-row-up').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('qt-row-down'));
    expect(rowNames()).toEqual(['ב', 'א']);
    openRowMenu(1);
    expect(screen.getByTestId('qt-row-down').disabled).toBe(true);
  });
  it('duplicate puts the copy right after the row (no id, no price link); remove can be undone exactly', () => {
    render(<Harness initialItems={[row('א', { id: 'x', price_link_id: 'l' }), row('ב')]} />);
    openRowMenu(0); fireEvent.click(screen.getByTestId('qt-row-duplicate'));
    expect(rowNames()).toEqual(['א', 'א', 'ב']);
    expect(state.items[1].id).toBeUndefined(); expect(state.items[1].price_link_id).toBeUndefined();
    openRowMenu(2); fireEvent.click(screen.getByTestId('qt-row-remove'));
    expect(rowNames()).toEqual(['א', 'א']);
    expect(screen.getByTestId('qt-undo').textContent).toContain('השורה הוסרה.');
    fireEvent.click(screen.getByRole('button', { name: 'ביטול הפעולה האחרונה' }));
    expect(rowNames()).toEqual(['א', 'א', 'ב']);
  });
  it('edit: the row goes into the entry row; "הוספה" puts the SAME row back changed (a row added above it never moves the edit); clearing leaves it as it was', () => {
    render(<Harness initialItems={[row('א'), row('ב')]} />);
    fireEvent.click(screen.getAllByTestId('qt-row')[1].querySelector('.qt-row-name'));
    expect(document.getElementById('qt-f-name').value).toBe('ב');
    expect(screen.getByTestId('qt-edit-form')).toBeTruthy();
    act(() => { state.setItems((prev) => [row('ג'), ...prev]); });
    fill({ name: 'ב2' }); add();
    expect(state.items.map((it) => it.description)).toEqual(['ג', 'א', 'ב2']);
    openRowMenu(1); fireEvent.click(screen.getByTestId('qt-row-edit'));
    fill({ name: 'שונה' });
    fireEvent.click(screen.getByTestId('qt-edit-cancel'));
    expect(state.items.map((it) => it.description)).toEqual(['ג', 'א', 'ב2']);
    expect(screen.getByTestId('qt-form')).toBeTruthy();
  });
  it('a quantity keeps its unit outside the number isolate (the phone line "2 יח׳ × ₪10.00")', () => {
    render(<Harness initialItems={[row('א', { quantity: '2' })]} />);
    const sub = screen.getByTestId('qt-row').querySelector('.qt-ir-sub');
    expect(sub.querySelector('bdi.pf-num').textContent).toBe('2');
    expect(sub.textContent).toBe('2 יח׳ × ₪10.00');
  });
});

describe('the "מבנה:" menu and the sections', () => {
  it('one menu with the three structures, their new names and an example under each; choosing one removes nothing', () => {
    render(<Harness initialItems={[row('א')]} />);
    fireEvent.click(screen.getByTestId('qt-structure'));
    expect(['simple', 'grouped', 'tiered'].map((k) => screen.getByTestId(`qt-structure-${k}`).querySelector('b').textContent)).toEqual(['הצעה פשוטה', 'מחולקת לחלקים', 'חלקים בתוך חלקים']);
    expect(screen.getByTestId('qt-structure-grouped').querySelector('small').textContent).toBe('למשל: דירה 1, דירה 2, חצר');
    expect(screen.getByTestId('qt-structure-simple').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('qt-structure-grouped'));
    expect(state.structure).toBe('grouped');
    expect(rowNames()).toEqual(['א']);
    expect(screen.getByTestId('qt-add-first').textContent).toContain('הוספת חלק: דירה, קומה, חדר או נושא אחר');
  });
  it('the add panel in the page: kind -> how many (1 to 100) -> names (an empty name = a name in order; distinct among siblings)', () => {
    render(<Harness structure="grouped" initialSections={[]} />);
    fireEvent.click(screen.getByTestId('qt-add-first'));
    fireEvent.click(screen.getByTestId('qt-kind-apartment'));
    expect(screen.getByTestId('qt-count').value).toBe('1');
    type(screen.getByTestId('qt-count'), '0'); fireEvent.click(screen.getByTestId('qt-count-next'));
    expect(screen.getByTestId('qt-wizard').textContent).toContain('כתבו מספר שלם, 1 ומעלה.');
    type(screen.getByTestId('qt-count'), '101'); fireEvent.click(screen.getByTestId('qt-count-next'));
    expect(screen.getByTestId('qt-wizard').textContent).toContain('אפשר להוסיף עד 100 בכל פעם.');
    type(screen.getByTestId('qt-count'), '2'); fireEvent.click(screen.getByTestId('qt-count-next'));
    type(screen.getByTestId('qt-name-0'), 'דירה 7'); type(screen.getByTestId('qt-name-1'), 'דירה 7');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(screen.getByTestId('qt-names-error').textContent).toBe('יש כבר חלק בשם הזה באותה רמה. תנו לכל אחד שם שונה.');
    type(screen.getByTestId('qt-name-1'), '');
    fireEvent.click(screen.getByTestId('qt-page-back'));
    fireEvent.click(screen.getByTestId('qt-count-next'));
    expect(screen.getByTestId('qt-name-0').value).toBe('דירה 7');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 7', 'דירה 2']);
  });
  it('the entry row goes with the chosen section ("אל: דירה 1"); a row added there belongs to it; "+ הוספת עבודה לכל ההצעה" brings it back', async () => {
    render(<Harness initialSections={[sec('h1', 'דירה 1'), sec('h2', 'דירה 2', { sort_order: 1 })]} />);
    expect(screen.getByTestId('qt-form-to').textContent).toBe('אל: כל ההצעה');
    fireEvent.click(screen.getAllByTestId('qt-heading')[1].querySelector('.qt-hn'));
    expect(screen.getByTestId('qt-form-to').textContent).toBe('אל: דירה 2');
    expect(screen.getAllByTestId('qt-heading')[1].contains(entry())).toBe(true);
    fill({ name: 'חלון', qty: '1', price: '5' }); add();
    expect(state.items[0].section_key).toBe('h2');
    fireEvent.click(screen.getByTestId('qt-target-whole'));
    expect(screen.getByTestId('qt-form-to').textContent).toBe('אל: כל ההצעה');
  });
  it('a path is shown in the UI direction with the names in their order (a Latin name never flips it)', () => {
    render(<Harness initialSections={[sec('f', 'קומה 1', { kind: 'floor' }), sec('a', 'Kitchen', { parent_key: 'f', kind: 'room' })]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading')[1].querySelector('.qt-hn'));
    const to = screen.getByTestId('qt-form-to');
    expect(to.textContent).toBe('אל: קומה 1‏ ← ‏Kitchen'); // a direction mark on both sides of the arrow
    expect(to.querySelector('[dir]').getAttribute('dir')).toBe('rtl');
  });
  it('the section "⋯": add here, add inside (only with sections within sections, never for copies), rename, duplicate, copy the first, template, remove', () => {
    const onSaveHeadingTemplate = vi.fn();
    render(<Harness structure="tiered" onSaveHeadingTemplate={onSaveHeadingTemplate} initialItems={[row('ריצוף', { section_key: 'h1' })]}
      initialSections={[sec('h1', 'דירה 1'), sec('h2', 'דירה 2', { sort_order: 1, repeat_count: 3 })]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[0]);
    expect(menuLabels()).toEqual(['הוספת עבודה או מוצר כאן', 'הוספת חלק בתוך', 'שינוי שם', 'שכפול עם התוכן', 'העתקת עבודות מהראשון', 'שמירה כתבנית', 'הסרה עם התוכן']);
    expect(screen.getByTestId('unit-copy-first').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('qt-head-template'));
    expect(onSaveHeadingTemplate).toHaveBeenCalledWith(expect.objectContaining({ key: 'h1' }));
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]);
    expect(screen.queryByTestId('qt-add-inside')).toBeNull(); // a heading of identical copies
    expect(screen.queryByTestId('qt-head-template')).toBeNull(); // nothing in it
    cleanup();
    render(<Harness structure="grouped" initialSections={[sec('h1', 'דירה 1')]} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    expect(screen.queryByTestId('qt-add-inside')).toBeNull();
  });
  it('rename in place: an empty or a taken name is refused; a good one is kept', () => {
    render(<Harness initialSections={[sec('h1', 'דירה 1'), sec('h2', 'דירה 2', { sort_order: 1 })]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]); fireEvent.click(screen.getByTestId('qt-head-rename'));
    type(screen.getByTestId('qt-rename'), 'דירה 1'); fireEvent.click(screen.getByTestId('qt-save-name'));
    expect(screen.getByTestId('qt-block').textContent).toContain('יש כבר חלק בשם הזה באותה רמה.');
    type(screen.getByTestId('qt-rename'), 'דירה 9'); fireEvent.click(screen.getByTestId('qt-save-name'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 1', 'דירה 9']);
  });
  it('duplicate with content opens the copy\'s name for renaming; remove with content can be undone', () => {
    render(<Harness initialItems={[row('ריצוף', { section_key: 'h1' })]} initialSections={[sec('h1', 'דירה 1')]} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions')); fireEvent.click(screen.getByTestId('qt-head-duplicate'));
    expect(screen.getByTestId('qt-rename').value).toBe('דירה 1 - עותק');
    expect(state.items.filter((it) => it.description === 'ריצוף')).toHaveLength(2);
    fireEvent.click(screen.getByText('ביטול'));
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[0]); fireEvent.click(screen.getByTestId('qt-head-delete'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 1 - עותק']);
    fireEvent.click(screen.getByRole('button', { name: 'ביטול הפעולה האחרונה' }));
    expect(state.sections).toHaveLength(2);
  });
  it('a row moves to another section through "העברה לחלק אחר" (the current place is marked and closed)', () => {
    render(<Harness initialItems={[row('ריצוף')]} initialSections={[sec('h1', 'דירה 1')]} />);
    openRowMenu(0); fireEvent.click(screen.getByTestId('qt-row-move'));
    const sheet = screen.getByTestId('qt-move-sheet');
    expect(within(sheet).getByText(/כאן עכשיו/).closest('button').disabled).toBe(true);
    fireEvent.click(within(sheet).getByText('דירה 1'));
    expect(state.items[0].section_key).toBe('h1');
  });
  it('folding a section hides its rows and keeps them', () => {
    render(<Harness initialItems={[row('ריצוף', { section_key: 'h1' })]} initialSections={[sec('h1', 'דירה 1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'סגירה דירה 1' }));
    expect(screen.queryByTestId('qt-row')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'פתיחה דירה 1' }));
    expect(rowNames()).toEqual(['ריצוף']);
  });
});

describe('the "?" of the columns and English', () => {
  it('the "?" opens one explanation under the entry row and closes it on a second tap', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByTestId('qt-help-pricing')[0]);
    expect(document.querySelector('.qt-helpbox').textContent).toBe('בחרו על מה משלמים: יחידות, שטח, אורך, זמן, משקל או מחיר לכל העבודה.');
    fireEvent.click(screen.getAllByTestId('qt-help-pricing')[0]);
    expect(document.querySelector('.qt-helpbox')).toBeNull();
  });
  it('English mirrors Hebrew: left to right, the same structures and words', () => {
    render(<Harness isHebrew={false} />);
    expect(screen.getByTestId('qt-editor').getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByTestId('qt-structure'));
    expect(['simple', 'grouped', 'tiered'].map((k) => screen.getByTestId(`qt-structure-${k}`).querySelector('b').textContent)).toEqual(['Simple quote', 'In sections', 'Sections within sections']);
    expect(screen.getByTestId('qt-form-to').textContent).toBe('To: Whole quote');
    expect(screen.getByTestId('qt-line-sum').textContent).toBe('Not priced yet');
  });
});
