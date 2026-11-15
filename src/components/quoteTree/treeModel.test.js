// 2026-11-13 (Owner: the manual quote of the 13/11 spec / demo): the editor's heading tree helpers.
import { describe, it, expect } from 'vitest';
import { parentOf, childrenOf, topHeadings, pathOf, depthOf, itemIndicesOf, lineTotal, headingTotal, renumber, addHeadings, removeHeading,
  duplicateHeading, moveHeading, structureOf, duplicateNames, sortServices } from './treeModel';

const S = [{ key: 'f', name: 'קומה 10', kind: 'floor', sort_order: 0 }, { key: 'a', name: 'דירה 22', kind: 'apartment', parent_key: 'f', sort_order: 1 },
  { key: 'r', name: 'סלון', kind: 'room', parent_key: 'a', sort_order: 2 }, { key: 'y', name: 'חצר', kind: 'section', sort_order: 3 }];
const I = [{ description: 'ניקיון', quantity: '1', unit_price: '300', section_key: 'f' }, { description: 'צביעה', quantity: '1', unit_price: '40', pricing_unit: 'm2', calculated_quantity: 25, section_key: 'r' },
  { description: 'פינוי', quantity: '2', unit_price: '50', section_key: null }, { description: 'בלי מחיר', quantity: '1', unit_price: '', section_key: 'r' }];

describe('the editor tree', () => {
  it('parents, children, top, path, depth', () => {
    expect(parentOf(S, 'r')).toBe('a');
    expect(childrenOf(S, 'a').map((s) => s.key)).toEqual(['r']);
    expect(topHeadings(S).map((s) => s.key)).toEqual(['f', 'y']);
    expect(pathOf(S, 'r').map((s) => s.name)).toEqual(['קומה 10', 'דירה 22', 'סלון']);
    expect(depthOf(S, 'r')).toBe(2);
  });
  it('a loop never hides a heading (both at the top)', () => {
    const L = [{ key: 'p', name: 'P', parent_key: 'q' }, { key: 'q', name: 'Q', parent_key: 'p' }];
    expect(topHeadings(L).map((s) => s.key).sort()).toEqual(['p', 'q']);
  });
  it('rows of a heading; rows of the whole quote', () => {
    expect(itemIndicesOf(I, S, 'r')).toEqual([1, 3]);
    expect(itemIndicesOf(I, S, null)).toEqual([2]);
  });
  it('line totals (an empty price is nothing, never 0 shown as a price) and heading totals with everything under them', () => {
    expect(lineTotal(I[1])).toBe(1000); expect(lineTotal(I[3])).toBe(0);
    expect(headingTotal(I, S, 'r')).toBe(1000); expect(headingTotal(I, S, 'f')).toBe(1300);
  });
  it('add headings (named or "<kind> N"), inside a parent, renumbered in pre-order', () => {
    const { sections, added } = addHeadings(S, { kind: 'room', names: ['מטבח', ''], parentKey: 'a' }, true);
    expect(added).toHaveLength(2);
    expect(childrenOf(sections, 'a').map((s) => s.name)).toEqual(['סלון', 'מטבח', 'חדר 3']);
    expect(sections.map((s) => s.sort_order)).toEqual(sections.map((_, i) => i));
    expect(renumber(sections).map((s) => s.name)).toEqual(['קומה 10', 'דירה 22', 'סלון', 'מטבח', 'חדר 3', 'חצר']);
  });
  it('remove: the sub-headings and the rows move up to the parent (never lost)', () => {
    const { sections, items } = removeHeading(S, I, 'a');
    expect(parentOf(sections, 'r')).toBe('f');
    expect(items).toHaveLength(4);
  });
  it('duplicate: the heading with everything under it, new keys, rows copied without ids and price-linked to their source (stage 3), right after it', () => {
    const { sections, items, copyKey } = duplicateHeading(S, [...I, { id: 'x1', description: 'ריצוף', quantity: '1', unit_price: '10', section_key: 'a', price_link_id: 'L' }], 'a', true);
    expect(sections.find((s) => s.key === copyKey).name).toBe('דירה 22 - עותק');
    // restore item 11: an unnamed heading's copy stays unnamed
    const un = duplicateHeading([{ key: 'u', name: '', sort_order: 0 }], [], 'u', true);
    expect(un.sections.find((s) => s.key === un.copyKey).name).toBe('');
    expect(childrenOf(sections, copyKey).map((s) => s.name)).toEqual(['סלון']);
    const copied = items.filter((it) => it.section_key === copyKey);
    expect(copied).toHaveLength(1); expect(copied[0].id).toBeUndefined(); expect(copied[0].price_link_id).toBe('L');
    // a row with no link gets a new one shared with its copy; rows outside the heading are untouched
    const room = items.filter((it) => it.description === 'צביעה');
    expect(room).toHaveLength(2); expect(room[0].price_link_id).toBeTruthy(); expect(room[0].price_link_id).toBe(room[1].price_link_id);
    expect(items.find((it) => it.description === 'ניקיון').price_link_id).toBeUndefined();
    expect(renumber(sections).map((s) => s.name).slice(0, 5)).toEqual(['קומה 10', 'דירה 22', 'סלון', 'דירה 22 - עותק', 'סלון']);
  });
  it('move up / down among siblings only', () => {
    expect(topHeadings(moveHeading(S, 'y', -1)).map((s) => s.key)).toEqual(['y', 'f']);
    expect(moveHeading(S, 'f', -1)).toBe(S);
  });
  it('the structure a quote opens in', () => {
    expect(structureOf(S)).toBe('tiered'); expect(structureOf([{ key: 'x', name: 'X' }])).toBe('grouped'); expect(structureOf([])).toBe('simple');
  });
  it('names differ among siblings; the same name under another parent is fine', () => {
    expect(duplicateNames(S, 'a', ['סלון', 'מטבח', 'מטבח'])).toEqual([0, 2]);
    expect(duplicateNames(S, 'y', ['סלון'])).toEqual([]);
  });
  it('the catalog list sorted by language, numbers naturally', () => {
    expect(sortServices([{ name: 'חלון 10' }, { name: 'חלון 2' }, { name: 'אסלה' }], true).map((s) => s.name)).toEqual(['אסלה', 'חלון 2', 'חלון 10']);
    expect(sortServices([{ name: 'Window 10' }, { name: 'window 2' }, { name: 'Door' }], false).map((s) => s.name)).toEqual(['Door', 'window 2', 'Window 10']);
  });
});
