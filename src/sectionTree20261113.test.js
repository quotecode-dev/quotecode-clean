// 2026-11-13 (Owner: "מוצר מוגמר"; typed L-05 ... L-29 for the 13/11 spec): the heading tree in the data layer, and the four LIVE bugs of
// the 12/11 release - the kind and the room were erased on reopen + save, the preview showed no rooms / kind, a template dropped them.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildPreviewQuoteData } from './components/quotePresentation/buildPreviewQuoteData';
import { buildTemplateContent, templateToFormState } from './utils/quoteTemplates';

const read = (p) => fs.readFileSync(p, 'utf8'); // relative to the repo root (vitest cwd), as the other source checks

describe('the preview carries the kind, the room and the parent heading (the same shape get-public-quote returns)', () => {
  it('kind / parent only when set; a parent that is not in the preview is dropped; a row keeps its room', () => {
    const d = buildPreviewQuoteData({ editor: {
      sections: [{ key: 'f', name: 'קומה 10', kind: 'floor' }, { key: 'a', name: 'דירה 22', kind: 'apartment', parent_key: 'f' },
        { key: 'r', name: 'סלון', kind: 'room', parent_key: 'a' }, { key: 'x', name: 'בלי סוג' }, { key: 'o', name: 'יתום', parent_key: 'gone' }],
      items: [{ description: 'צביעה', quantity: '2', unit_price: '10', section_key: 'r', room: 'kitchen' }] } });
    expect(d.quoteData.sections).toEqual([
      { id: 'f', name: 'קומה 10', kind: 'floor' }, { id: 'a', name: 'דירה 22', kind: 'apartment', parent_id: 'f' },
      { id: 'r', name: 'סלון', kind: 'room', parent_id: 'a' }, { id: 'x', name: 'בלי סוג' }, { id: 'o', name: 'יתום' }]);
    expect(d.quoteData.items[0].room).toBe('kitchen');
  });
  it('a quote without kinds / parents / rooms keeps exactly the shape it had', () => {
    const d = buildPreviewQuoteData({ editor: { sections: [{ key: 'a', name: 'X', repeat_count: 3 }], items: [{ description: 'y', quantity: '1', unit_price: '5' }] } });
    expect(d.quoteData.sections).toEqual([{ id: 'a', name: 'X', repeat_count: 3 }]);
    expect('room' in d.quoteData.items[0]).toBe(false);
  });
});

describe('a template keeps the kind, the room and the tree', () => {
  it('round trip: new keys, the same nesting, kinds and rooms', () => {
    const form = { quoteStructureMode: 'divided',
      sections: [{ key: 'k1', name: 'קומה 1', kind: 'floor' }, { key: 'k2', name: 'דירה 3', kind: 'apartment', parent_key: 'k1' }, { key: 'k3', name: 'מטבח', kind: 'room', parent_key: 'k2' }],
      items: [{ description: 'ריצוף', quantity: '12', unit_price: '100', section_key: 'k3' }, { description: 'ישן', quantity: '1', unit_price: '1', section_key: 'k2', room: 'bathroom' }] };
    const content = buildTemplateContent(form);
    expect(content.sections).toEqual([{ key: 's1', name: 'קומה 1', kind: 'floor' }, { key: 's2', name: 'דירה 3', kind: 'apartment', parent_key: 's1' }, { key: 's3', name: 'מטבח', kind: 'room', parent_key: 's2' }]);
    expect(content.items[1].room).toBe('bathroom');
    let n = 0;
    const st = templateToFormState(content, () => `new${n += 1}`);
    expect(st.sections.map((s) => [s.key, s.kind, s.parent_key || null])).toEqual([['new1', 'floor', null], ['new2', 'apartment', 'new1'], ['new3', 'room', 'new2']]);
    expect(st.items[0].section_key).toBe('new3');
    expect(st.items[1].room).toBe('bathroom');
  });
  it('a template saved before 13/11 (no kind / parent / room) opens exactly as before', () => {
    let n = 0;
    const st = templateToFormState({ schema: buildTemplateContent({ sections: [], items: [] }).schema, sections: [{ key: 's1', name: 'A' }], items: [{ description: 'x', quantity: 1, section_key: 's1' }] }, () => `n${n += 1}`);
    expect(st.sections).toEqual([{ key: 'n1', id: null, name: 'A', sort_order: 0, repeat_count: 1 }]);
    expect('room' in st.items[0]).toBe(false);
  });
});

describe('the editor load / duplicate / save keep the kind, the room and the parent (source)', () => {
  const dash = read('src/pages/Dashboard.jsx');
  it('reopen: the kind and the parent of every heading, the room of every row', () => {
    expect(dash).toContain("...(s.kind ? { kind: s.kind } : {}), ...(s.parent_section_id ? { parent_key: s.parent_section_id } : {}) })));");
    expect(dash).toContain("...(typeof item.room === 'string' && item.room ? { room: item.room } : {}),");
  });
  it('duplicate: the kind, and the parent mapped to the new key', () => {
    expect(dash).toContain("_parentId && sectionIdToNewKey.has(_parentId) ? { ...s, parent_key: sectionIdToNewKey.get(_parentId) } : s");
  });
  it('save: parent_client_key by key, never a key that left the quote', () => {
    expect(dash).toContain('parent_client_key: s.parent_key && s.parent_key !== s.key && currentSectionKeys.has(s.parent_key) ? s.parent_key : null,');
  });
  it('the server: the parent enters the public response and the frozen documents ONLY when set', () => {
    expect(read('supabase/functions/get-public-quote/index.ts')).toContain("...(typeof s.parent_section_id === 'string' && s.parent_section_id ? { parent_id: s.parent_section_id } : {}) })),");
    expect(read('supabase/functions/get-public-quote/publicAccess.ts').split("UUID_RE.test(s.parent_id) ? { parent_id: s.parent_id as string } : {}) })),").length).toBe(3);
  });
});
