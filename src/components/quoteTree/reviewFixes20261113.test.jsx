// 2026-11-13: regression tests for the findings of the read-only reviewers on the new work area (product-flow, rtl-numeric, system-impact,
// scope-security) - each test is the scenario the reviewer described.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { useState } from 'react';
import QuoteTreeEditor from './QuoteTreeEditor';
import { duplicateHeading } from './treeModel';
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


describe('the add form', () => {
  it('"+ add a new product" starts an empty new product (the demo) and keeps the cursor in the name', () => {
    render(<Harness />);
    type(nameOf(form()), 'חלון אלומיניום');
    fireEvent.click(nameOf(form()));
    fireEvent.click(screen.getByRole('button', { name: '+ הוספת מוצר חדש' }));
    expect(nameOf(form()).value).toBe('');
  });
});

describe('headings', () => {
  it('a second copy of the same heading is "- עותק 2"; an older heading of copies keeps its count in its copy', () => {
    const S = [{ key: 'a', name: 'דירה', sort_order: 0, repeat_count: 3 }];
    const r1 = duplicateHeading(S, [], 'a', true);
    const r2 = duplicateHeading(r1.sections, [], 'a', true);
    expect(r2.sections.map((x) => [x.name, x.repeat_count])).toEqual([['דירה', 3], ['דירה - עותק 2', 3], ['דירה - עותק', 3]]);
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
