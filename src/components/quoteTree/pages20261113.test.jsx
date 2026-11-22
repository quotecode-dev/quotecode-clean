// 2026-11-13 (Owner approved the plan after answers 1-8): the demo's in-page steps - the add step and the options page of a heading - and
// the restored "copy the works from the first", delete with content, the add-row placement of "from a saved template"
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { removeHeadingWithContent, copyRowsFromFirst, firstSiblingOf } from './treeModel';

afterEach(cleanup);
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



