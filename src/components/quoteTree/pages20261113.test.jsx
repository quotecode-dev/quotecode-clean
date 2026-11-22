// 2026-11-13 (Owner approved the plan after answers 1-8): the demo's in-page steps - the add step and the options page of a heading - and
// the restored "copy the works from the first", delete with content, the add-row placement of "from a saved template"
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { useState } from 'react';
import QuoteTreeEditor from './QuoteTreeEditor';
import { removeHeadingWithContent, copyRowsFromFirst, firstSiblingOf } from './treeModel';

afterEach(cleanup);
let state = null;
function Harness({ isHebrew = true, initialItems = [], initialSections = [], structure: s0, onPageChange = null, onAddFromTemplate = null, bottomBar = null }) {
  const [items, setItems] = useState(initialItems);
  const [sections, setSections] = useState(initialSections);
  const [structure, setStructure] = useState(s0 || (initialSections.some((x) => x.parent_key) ? 'tiered' : initialSections.length ? 'grouped' : 'simple'));
  state = { items, sections };
  return (
    <QuoteTreeEditor isHebrew={isHebrew} international={false} items={items} setItems={setItems} sections={sections} setSections={setSections}
      services={[]} sym="₪" fmtMoney={(n) => Number(n || 0).toFixed(2)} structure={structure} onStructure={setStructure}
      onPageChange={onPageChange} onAddFromTemplate={onAddFromTemplate}
      renderRowEditor={(i) => <div data-testid="row-editor">{items[i]?.description}</div>} bottomBar={bottomBar} />
  );
}
const type = (el, value) => fireEvent.change(el, { target: { value } });
const two = [{ key: 'a', name: 'דירה 31', kind: 'apartment', sort_order: 0 }, { key: 'b', name: 'דירה 32', kind: 'apartment', sort_order: 1 }];
const rowIn = (key, d, extra = {}) => ({ description: d, quantity: '1', unit_price: '10', section_key: key, ...extra });

describe('the tree helpers', () => {
  it('delete with content takes the sub-headings and their rows; nothing else', () => {
    const S = [{ key: 'a', name: 'A', sort_order: 0 }, { key: 'k', name: 'K', parent_key: 'a', sort_order: 1 }, { key: 'b', name: 'B', sort_order: 2 }];
    const r = removeHeadingWithContent(S, [rowIn('a', 'x'), rowIn('k', 'y'), rowIn('b', 'z'), rowIn(null, 'w')], 'a');
    expect(r.sections.map((s) => s.key)).toEqual(['b']);
    expect(r.items.map((it) => it.description)).toEqual(['z', 'w']);
  });
  it('copy from the first: from the first sibling, added to what is there, no ids and no price links', () => {
    expect(firstSiblingOf(two, 'a')).toBeNull();
    expect(firstSiblingOf(two, 'b').key).toBe('a');
    const items = [rowIn('a', 'צבע', { id: 'db1', price_link_id: 'p1', measurements: [{ id: 'm1', width: 1, height: 2 }] })];
    const next = copyRowsFromFirst(two, items, 'b');
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ description: 'צבע', section_key: 'b' });
    expect(next[1].id).toBeUndefined();
    expect(next[1].price_link_id).toBeUndefined();
    expect(next[1].measurements[0]).toEqual({ width: 1, height: 2 });
    // a heading that already has rows keeps them; the works of the first are added after them (the demo)
    expect(copyRowsFromFirst(two, next, 'b').map((it) => [it.description, it.section_key])).toEqual([['צבע', 'a'], ['צבע', 'b'], ['צבע', 'b']]);
    expect(copyRowsFromFirst(two, next, 'a')).toBe(next); // the first place has no first to copy from
  });
});

describe('the add step is a page in the screen (the demo)', () => {
  it('"→ חזרה", the question as a title, "להמשך" / "הוספה להצעה", "חזרה ללא שמירה"; the work area is hidden (kept) and the bar is gone', () => {
    const onPageChange = vi.fn();
    render(<Harness structure="grouped" onPageChange={onPageChange} bottomBar={<div data-testid="the-bar" />} />);
    expect(screen.getByTestId('the-bar')).toBeTruthy();
    fireEvent.click(screen.getByTestId('qt-add-first'));
    const page = screen.getByTestId('qt-wizard');
    expect(page.querySelector('h3').textContent).toBe('מה מוסיפים להצעה?');
    expect(screen.getByTestId('qt-page-back').textContent).toBe('→ חזרה');
    expect(screen.getByTestId('qt-page-close').textContent).toBe('חזרה ללא שמירה');
    expect(screen.getByTestId('qt-form').closest('.qt-card').hidden).toBe(true);
    expect(screen.queryByTestId('the-bar')).toBeNull();
    expect(onPageChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByTestId('qt-kind-apartment'));
    expect(page.querySelector('h3').textContent).toBe('כמה דירות להוסיף להצעה?');
    expect(screen.getByText('מספר הדירות')).toBeTruthy();
    type(screen.getByTestId('qt-count'), '2');
    fireEvent.click(within(page).getByRole('button', { name: 'להמשך' }));
    expect(page.querySelector('h3').textContent).toBe('מה השם או המספר של כל דירה?');
    expect(screen.getByText('שם או מספר הדירה 1')).toBeTruthy();
    expect(screen.getByTestId('qt-name-0').getAttribute('placeholder')).toBe('למשל: דירה 33');
    type(screen.getByTestId('qt-name-0'), 'דירה 31');
    type(screen.getByTestId('qt-name-1'), 'דירה 32');
    fireEvent.click(screen.getByTestId('qt-wizard-create'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 31', 'דירה 32']);
    expect(screen.queryByTestId('qt-wizard')).toBeNull();
    expect(onPageChange).toHaveBeenLastCalledWith(false);
  });
  it('"חזרה ללא שמירה" adds nothing; a row typed and not added blocks the add step (the demo) and stays as typed', () => {
    render(<Harness structure="grouped" />);
    fireEvent.click(screen.getByTestId('qt-add-first'));
    fireEvent.click(screen.getByTestId('qt-kind-room'));
    fireEvent.click(screen.getByTestId('qt-page-close'));
    expect(state.sections).toEqual([]);
    type(screen.getByTestId('qt-form').querySelector('input[id$="-name"]'), 'חלון');
    fireEvent.click(screen.getByTestId('qt-add-first'));
    expect(screen.queryByTestId('qt-wizard')).toBeNull();
    expect(screen.getByTestId('qt-block').textContent).toBe('השורה עדיין לא נוספה. לחצו ״הוספה״ או ״ניקוי השורה״ לפני המעבר.');
    expect(screen.getByTestId('qt-form').querySelector('input[id$="-name"]').value).toBe('חלון');
  });
  it('English: the same page, mirrored words', () => {
    render(<Harness isHebrew={false} structure="grouped" />);
    fireEvent.click(screen.getByTestId('qt-add-first'));
    expect(screen.getByTestId('qt-wizard').querySelector('h3').textContent).toBe('What goes in the quote?');
    expect(screen.getByTestId('qt-page-back').textContent).toBe('← Back');
    expect(screen.getByTestId('qt-page-close').textContent).toBe('Back without saving');
  });
});

describe('the options page of a heading (the demo\'s "⋯")', () => {
  it('the name and "שמירת השם"; duplicate; copy from the first (added, kept); delete with content + undo; no repeat field, no one price', () => {
    render(<Harness initialSections={two} initialItems={[rowIn('a', 'צבע')]} />);
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]);
    const page = screen.getByTestId('qt-heading-options');
    expect(page.querySelector('h3').textContent).toBe('אפשרויות לדירה 32');
    expect(page.querySelectorAll('input')).toHaveLength(1);
    expect(page.textContent).not.toMatch(/חוזרות|איך מחשבים/);
    expect(screen.getByTestId('qt-head-duplicate').textContent).toBe('שכפול דירה');
    expect(screen.getByTestId('qt-head-delete').textContent).toBe('מחיקת דירה עם התוכן');
    expect(screen.getByTestId('unit-copy-first').textContent).toBe('העתקת עבודות מהדירה הראשונה');
    fireEvent.click(screen.getByTestId('unit-copy-first'));
    expect(state.items.filter((it) => it.section_key === 'b').map((it) => it.description)).toEqual(['צבע']);
    expect(screen.queryByTestId('qt-heading-options')).toBeNull();
    expect(screen.getByTestId('qt-undo').textContent).toContain('העבודות נוספו. התוכן שהיה כאן נשמר.');
    // on the first heading the button says it is the first one (the demo)
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[0]);
    fireEvent.click(screen.getByTestId('unit-copy-first'));
    expect(screen.getByTestId('qt-page-error').textContent).toBe('זה המקום הראשון ברשימה. פתחו מקום אחר כדי להעתיק אליו.');
    fireEvent.click(screen.getByTestId('qt-page-close'));
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]);
    // rename, refused when taken, kept otherwise; back with an unsaved name is refused (the demo)
    type(screen.getByTestId('qt-rename'), 'דירה 31');
    fireEvent.click(screen.getByTestId('qt-save-name'));
    expect(screen.getByTestId('qt-page-error').textContent).toBe('תנו לכל כותרת שם שונה, כדי שיהיה קל לזהות אותה.');
    fireEvent.click(screen.getByTestId('qt-page-back'));
    expect(screen.getByTestId('qt-page-error').textContent).toBe('יש שינויים שטרם נשמרו. שמרו אותם, או לחצו ״חזרה ללא שמירה״.');
    type(screen.getByTestId('qt-rename'), 'דירה 40');
    fireEvent.click(screen.getByTestId('qt-save-name'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 31', 'דירה 40']);
    // delete with content, then undo
    fireEvent.click(screen.getAllByTestId('qt-heading-actions')[1]);
    fireEvent.click(screen.getByTestId('qt-head-delete'));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 31']);
    expect(state.items.map((it) => it.section_key)).toEqual(['a']);
    expect(screen.getByTestId('qt-undo').textContent).toContain('המקום הוסר עם התוכן שלו. אפשר לבטל את הפעולה.');
    fireEvent.click(within(screen.getByTestId('qt-undo')).getByRole('button', { name: 'ביטול הפעולה האחרונה' }));
    expect(state.sections.map((s) => s.name)).toEqual(['דירה 31', 'דירה 40']);
  });
  it('English: "Options for", "Duplicate the apartment", "Delete the apartment with its content"', () => {
    render(<Harness isHebrew={false} initialSections={[{ key: 'a', name: 'Apartment 31', kind: 'apartment', sort_order: 0 }]} />);
    fireEvent.click(screen.getByTestId('qt-heading-actions'));
    expect(screen.getByTestId('qt-heading-options').querySelector('h3').textContent).toBe('Options for Apartment 31');
    expect(screen.getByText('Apartment name')).toBeTruthy();
    expect(screen.getByTestId('qt-head-duplicate').textContent).toBe('Duplicate the apartment');
    expect(screen.getByTestId('qt-head-delete').textContent).toBe('Delete the apartment with its content');
  });
});

describe('"from a saved template" sits in the add row (Owner 2026-11-13: "למה להוסיף סתם שורות?")', () => {
  it('the button is in the same row as "+ add another kind"', () => {
    render(<Harness initialSections={two} onAddFromTemplate={vi.fn()} />);
    expect(screen.getByTestId('unit-from-template').parentElement).toBe(screen.getByTestId('qt-add-other').parentElement);
  });
});
