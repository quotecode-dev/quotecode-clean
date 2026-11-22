// 2026-11-13: regression tests for the findings of the read-only reviewers on the new work area (product-flow, rtl-numeric, system-impact,
// scope-security) - each test is the scenario the reviewer described.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import { useState } from 'react';
import QuoteTreeEditor from './QuoteTreeEditor';
import { addHeadings, duplicateHeading } from './treeModel';
import { aiPlacesToSections } from '../../utils/aiQuoteDraftClient';
import { buildQuoteDraftSnapshot } from '../../utils/quoteDraftSnapshot';
import { parsePlaceTree } from '../../../supabase/functions/_shared/aiQuoteDraft.js';

afterEach(cleanup);
let state = null;
function Harness({ isHebrew = true, initialItems = [], initialSections = [], structure: s0, onSaveToCatalog = null, onSubmit = vi.fn((e) => e.preventDefault()), onSaveHeadingTemplate = null, onPendingChange = null }) {
  const [items, setItems] = useState(initialItems);
  const [sections, setSections] = useState(initialSections);
  const [structure, setStructure] = useState(s0 || (initialSections.some((x) => x.parent_key) ? 'tiered' : initialSections.length ? 'grouped' : 'simple'));
  state = { items, sections, setItems };
  return (
    <form onSubmit={onSubmit}>
      <QuoteTreeEditor isHebrew={isHebrew} international={false} items={items} setItems={setItems} sections={sections} setSections={setSections}
        services={[]} sym="₪" fmtMoney={(n) => Number(n || 0).toFixed(2)} structure={structure} onStructure={setStructure}
        onSaveToCatalog={onSaveToCatalog} onSaveHeadingTemplate={onSaveHeadingTemplate} onPendingChange={onPendingChange}
        renderRowEditor={(i) => <div data-testid="row-editor">{items[i]?.description}</div>} bottomBar={null} />
    </form>
  );
}
const form = (i = 0) => screen.getAllByTestId('qt-form')[i];
const nameOf = (f) => f.querySelector('input[id$="-name"]');
const type = (el, value) => fireEvent.change(el, { target: { value } });
const row = (desc) => ({ description: desc, quantity: '1', unit_price: '10', section_key: null });

describe('Enter never saves the quote', () => {
  // 2026-11-15 (the demo): Enter adds nothing - only "הוספה" adds; it never submits the form around the editor
  it('Enter in the add form adds nothing and never submits the form around the editor', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<Harness onSubmit={onSubmit} />);
    type(nameOf(form()), 'חלון'); type(form().querySelector('input[id$="-qty"]'), '2');
    fireEvent.keyDown(form().querySelector('input[id$="-qty"]'), { key: 'Enter' });
    expect(state.items).toHaveLength(0);
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(state.items.map((it) => it.description)).toEqual(['חלון']);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('edit and undo keep to the right row', () => {
  // 2026-11-15 (the demo's edit in place): the row turns into the add form, "עדכון השורה" updates THAT row, "ביטול העריכה" leaves it as it was
  it('a row added above the edited one never makes the update or the cancel touch another row', () => {
    render(<Harness initialItems={[row('א'), row('ב')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'פעולות' })[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'עריכה' }));
    const edit = screen.getByTestId('qt-edit-form');
    expect(edit.querySelector('h4').textContent).toBe('עריכת המוצר');
    expect(nameOf(edit).value).toBe('ב');
    act(() => { state.setItems((prev) => [row('ג'), ...prev]); });
    type(nameOf(screen.getByTestId('qt-edit-form')), 'ב2');
    fireEvent.click(within(screen.getByTestId('qt-edit-form')).getByTestId('qt-edit-save'));
    expect(state.items.map((it) => it.description)).toEqual(['ג', 'א', 'ב2']);
    fireEvent.click(screen.getAllByRole('button', { name: 'פעולות' })[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'עריכה' }));
    type(nameOf(screen.getByTestId('qt-edit-form')), 'זה לא יישמר');
    fireEvent.click(within(screen.getByTestId('qt-edit-form')).getByTestId('qt-edit-cancel'));
    expect(state.items.map((it) => it.description)).toEqual(['ג', 'א', 'ב2']);
  });
  it('the last change can be undone ("ביטול הפעולה האחרונה") only while nothing else changed - it never wipes later work', () => {
    render(<Harness initialItems={[row('א'), row('ב')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'פעולות' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'הסרה' }));
    expect(screen.getByTestId('qt-undo').textContent).toContain('העבודה הוסרה. אפשר לבטל את הפעולה.');
    type(nameOf(form()), 'ג'); type(form().querySelector('input[id$="-qty"]'), '1');
    fireEvent.click(within(form()).getByTestId('qt-add'));
    expect(screen.getByTestId('qt-undo').textContent).toContain('השורה נוספה להצעה.');
    expect(state.items.map((it) => it.description)).toEqual(['ב', 'ג']);
    fireEvent.click(within(screen.getByTestId('qt-undo')).getByRole('button', { name: 'ביטול הפעולה האחרונה' }));
    expect(state.items.map((it) => it.description)).toEqual(['ב']);
  });
  it('a row has only "עריכה" / "שכפול" / "הסרה" (the demo); a copy goes to the end of its place', () => {
    render(<Harness initialItems={[row('א'), row('ב')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'פעולות' })[0]);
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['עריכה', 'שכפול', 'הסרה']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'שכפול' }));
    expect(state.items.map((it) => it.description)).toEqual(['א', 'ב', 'א']);
  });
});

describe('the add form', () => {
  it('"+ add a new product" starts an empty new product (the demo) and keeps the cursor in the name', () => {
    render(<Harness />);
    type(nameOf(form()), 'חלון אלומיניום');
    fireEvent.click(nameOf(form()));
    fireEvent.click(screen.getByRole('button', { name: '+ הוספת מוצר חדש' }));
    expect(nameOf(form()).value).toBe('');
  });
  it('a half-typed size is refused, never counted as 0', () => {
    render(<Harness />);
    const f = form();
    type(nameOf(f), 'ריצוף'); fireEvent.change(f.querySelector('select'), { target: { value: 'area' } }); type(f.querySelector('input[id$="-price"]'), '50');
    fireEvent.click(within(f).getByRole('button', { name: 'מידות ופירוט נוסף' }));
    fireEvent.click(within(f).getByRole('button', { name: 'לפי מידות' }));
    type(within(f).getByLabelText('אורך 1'), '2'); type(within(f).getByLabelText('רוחב 1'), '3');
    fireEvent.click(within(f).getByRole('button', { name: '+ מידה נוספת' }));
    type(within(f).getByLabelText('אורך 2'), '4');
    fireEvent.click(within(f).getByTestId('qt-add'));
    expect(screen.getByTestId('qt-form-error').textContent).toBe('השלימו את כל המידות או הסירו מידה ריקה.');
    expect(state.items).toHaveLength(0);
  });
  it('the catalog: an empty price is never saved as 0; a failed save is said', async () => {
    const onSaveToCatalog = vi.fn(async () => ({ ok: false }));
    render(<Harness onSaveToCatalog={onSaveToCatalog} />);
    type(nameOf(form()), 'מעקה'); type(form().querySelector('input[id$="-qty"]'), '1');
    fireEvent.click(within(form()).getByRole('checkbox'));
    await act(async () => { fireEvent.click(within(form()).getByTestId('qt-add')); });
    expect(onSaveToCatalog).not.toHaveBeenCalled();
    expect(form().textContent).toContain('מוצר בלי מחיר לא נשמר בקטלוג. השורה נוספה להצעה.');
    type(nameOf(form()), 'שער'); type(form().querySelector('input[id$="-qty"]'), '1'); type(form().querySelector('input[id$="-price"]'), '900');
    fireEvent.click(within(form()).getByRole('checkbox'));
    await act(async () => { fireEvent.click(within(form()).getByTestId('qt-add')); });
    expect(form().textContent).toContain('השמירה בקטלוג נכשלה. השורה נוספה להצעה.');
    expect(state.items.map((it) => it.description)).toEqual(['מעקה', 'שער']); // the demo: a new row at the end
  });
  it('a row typed in a heading that is folded stays; the editor reports it to the bar', () => {
    const onPendingChange = vi.fn();
    render(<Harness initialSections={[{ key: 'a', name: 'דירה 1', sort_order: 0 }]} onPendingChange={onPendingChange} />);
    type(nameOf(form(1)), 'צביעה');
    fireEvent.click(screen.getByTestId('qt-heading').querySelector('.qt-tri'));
    expect(nameOf(form(1)).value).toBe('צביעה');
    expect(onPendingChange).toHaveBeenLastCalledWith(['דירה 1']);
  });
});

describe('headings', () => {
  it('names stay distinct: an empty slot never takes a name already used; rename to a taken name is refused', () => {
    const one = addHeadings([{ key: 'a', name: 'דירה 2', kind: 'apartment', sort_order: 0 }], { kind: 'apartment', names: [''] }, true);
    expect(one.sections.map((x) => x.name)).toEqual(['דירה 2', 'דירה 3']);
    const two = addHeadings([], { kind: 'apartment', names: ['דירה 2', ''] }, true);
    expect(two.sections.map((x) => x.name)).toEqual(['דירה 2', 'דירה 3']);
    const topics = addHeadings([], { kind: 'section', names: [''] }, true);
    expect(topics.sections[0].name).toBe('נושא 1');
    render(<Harness initialSections={[{ key: 'a', name: 'דירה 1', sort_order: 0 }, { key: 'b', name: 'דירה 2', sort_order: 1 }]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]);
    // 2026-11-13 (the demo's options page): the name is changed on the heading's options page
    type(screen.getByTestId('qt-rename'), 'דירה 1');
    fireEvent.click(screen.getByTestId('qt-save-name'));
    expect(screen.getByTestId('qt-page-error').textContent).toBe('תנו לכל כותרת שם שונה, כדי שיהיה קל לזהות אותה.');
    expect(state.sections.map((x) => x.name)).toEqual(['דירה 1', 'דירה 2']);
  });
  it('a second copy of the same heading is "- עותק 2"; an older heading of copies keeps its count in its copy', () => {
    const S = [{ key: 'a', name: 'דירה', sort_order: 0, repeat_count: 3 }];
    const r1 = duplicateHeading(S, [], 'a', true);
    const r2 = duplicateHeading(r1.sections, [], 'a', true);
    expect(r2.sections.map((x) => [x.name, x.repeat_count])).toEqual([['דירה', 3], ['דירה - עותק 2', 3], ['דירה - עותק', 3]]);
  });
  it('a heading of identical copies offers no "add inside"; a heading with sub-headings offers no template (it would drop them)', () => {
    render(<Harness structure="tiered" onSaveHeadingTemplate={vi.fn()} initialSections={[{ key: 'x', name: 'טיפוס א', sort_order: 0, repeat_count: 4 },
      { key: 'a', name: 'דירה 22', sort_order: 1 }, { key: 'k', name: 'מטבח', parent_key: 'a', sort_order: 2 }]}
      initialItems={[{ description: 'דלת', quantity: '1', unit_price: '5', section_key: 'a' }]} />);
    const [copies, apt] = screen.getAllByTestId('qt-heading');
    expect(within(copies).queryAllByTestId('qt-add-inside').filter((b) => b.closest('[data-testid="qt-heading"]') === copies)).toHaveLength(0);
    expect(within(apt).getAllByTestId('qt-add-inside').length).toBeGreaterThan(0);
    fireEvent.click(within(apt).getAllByTestId('qt-heading-actions')[0]);
    expect(screen.getByTestId('qt-heading-options')).toBeTruthy();
    expect(screen.queryByTestId('qt-head-template')).toBeNull();
  });
  it('back to the client with a row not added yet is blocked with the demo\'s sentence until it is added or cleared', () => {
    const onBack = vi.fn();
    function B() {
      const [items, setItems] = useState([]); const [sections, setSections] = useState([]);
      return <QuoteTreeEditor isHebrew international={false} items={items} setItems={setItems} sections={sections} setSections={setSections} services={[]} sym="₪"
        fmtMoney={(n) => String(n)} structure="simple" onStructure={() => {}} onBackToClient={onBack} renderRowEditor={() => null} bottomBar={null} />;
    }
    render(<B />);
    type(nameOf(form()), 'צביעה');
    fireEvent.click(screen.getByTestId('qt-back'));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('qt-block').textContent).toBe('הוסיפו את השורה או נקו אותה לפני המעבר.');
    fireEvent.click(screen.getByTestId('qt-back'));
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('qt-clear'));
    fireEvent.click(screen.getByTestId('qt-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it('a path is shown in the UI direction with every name isolated (a Latin first name never flips it)', () => {
    render(<Harness initialSections={[{ key: 'f', name: 'Floor 10', sort_order: 0 }, { key: 'a', name: 'דירה 22', parent_key: 'f', sort_order: 1 }]} />);
    const to = screen.getAllByTestId('qt-form-to')[2];
    expect(to.textContent).toBe('אל: Floor 10 ← דירה 22');
    const path = to.querySelector('span[dir]');
    expect(path.getAttribute('dir')).toBe('rtl');
    expect([...path.querySelectorAll('bdi')].map((b) => b.textContent)).toEqual(['Floor 10', 'דירה 22']);
  });
  it('a quantity keeps its unit outside the number isolate; "× N" keeps the sign outside', () => {
    render(<Harness initialSections={[{ key: 'x', name: 'טיפוס א', sort_order: 0, repeat_count: 12 }]}
      initialItems={[{ description: 'ריצוף', quantity: '1', unit_price: '10', pricing_unit: 'm2', calculated_quantity: 6, section_key: 'x' }]} />);
    const qtyCell = screen.getAllByTestId('qt-row')[0].querySelectorAll('.qt-num')[0];
    expect(qtyCell.querySelector('bdi').textContent).toBe('6.00');
    expect(qtyCell.textContent).toBe('6.00 מ״ר');
    const name = screen.getByTestId('qt-heading').querySelector('.qt-head-name');
    expect(name.textContent).toBe('טיפוס א × 12');
    expect(name.querySelectorAll('bdi')[1].textContent).toBe('12');
  });
  it('the help circle stays open after a tap (hover + focus + click arrive together on a phone)', () => {
    render(<Harness />);
    const help = screen.getAllByTestId('qt-help')[0];
    fireEvent.mouseEnter(help.parentElement); fireEvent.focus(help); fireEvent.click(help);
    expect(screen.getByTestId('qt-help-pop')).toBeTruthy();
  });
});

describe('the smart quote, the review snapshot, the model keys', () => {
  it('sub-places are made under EVERY copy of their parent; lines repeat only through identical copies', () => {
    const places = [{ key: 'a', kind: 'apartment', name: '', parent: null, count: 2, identical: 'yes' }, { key: 'k', kind: 'room', name: 'מטבח', parent: 'a', count: 1, identical: 'no' }];
    const out = aiPlacesToSections(places, [{ place: 'k' }], [{ description: 'ארונות' }], [], { stamp: 't' });
    const apts = out.sections.filter((x) => x.kind === 'apartment');
    const kitchens = out.sections.filter((x) => x.kind === 'room');
    expect(apts).toHaveLength(2);
    expect(kitchens.map((x) => x.parent_key)).toEqual(apts.map((x) => x.key));
    expect(out.items.map((it) => it.section_key).sort()).toEqual(kitchens.map((x) => x.key).sort());
    const notSame = aiPlacesToSections([{ ...places[0], identical: 'no' }, places[1]], [{ place: 'k' }], [{ description: 'ארונות' }], [], { stamp: 'u' });
    expect(notSame.items).toHaveLength(1);
  });
  it('"improve this quote" names a heading by its whole path', () => {
    const snap = buildQuoteDraftSnapshot({ subject: 's', sections: [{ key: 'a', name: 'דירה 22' }, { key: 'k', name: 'מטבח', parent_key: 'a' }],
      items: [{ description: 'ארונות', quantity: '1', unit_price: '5', section_key: 'k' }] });
    expect(JSON.stringify(snap)).toContain('דירה 22 > מטבח');
  });
  it('a model place key with "~" (the server copy-key mark) is dropped', () => {
    const src = 'דירה 32 ודירה 33';
    const out = parsePlaceTree([{ key: 'a~2', kind: 'apartment', name: 'דירה 32', evidence: 'דירה 32' }, { key: 'b', kind: 'apartment', name: 'דירה 33', evidence: 'דירה 33' }], src);
    const keys = (out.places || []).map((p) => p.key);
    expect(keys).not.toContain('a~2');
    expect(keys).toContain('b');
  });
});
