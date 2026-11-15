// 2026-11-13 (Owner: the headings are a TREE floor -> apartment -> room; NO "× N" in a new quote; typed and voice create the same
// structure): the AI smart quote tree mode. Every legacy path (no structure / structure without tree) keeps today's answer - the existing
// suites (aiStructureUq1112, aiIdenticalPlaces20261112, aiQuoteDraft.*) guard it.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { validateDraftRequest, buildDraftMessages, draftResponseSchema, parseDraftModelOutput, countWrittenFor, sanitizeDraftResponse,
  AI_QUOTE_DRAFT_CONTRACT_VERSION, DRAFT_RESPONSE_SCHEMA, DRAFT_RESPONSE_SCHEMA_STRUCTURED, locateEvidence, normalizeCatalog } from '../supabase/functions/_shared/aiQuoteDraft.js';

const noChanges = { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null };
const line = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, place: null, room: null, ...o });
const pl = (key, kind, name, parent, evidence, o = {}) => ({ key, kind, name, parent, evidence, count: 1, identical: 'no', ...o });
const P = (text, out, he = true, catalog = []) => parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], changes: noChanges, ...out }), catalog, text, null, { structure: true, tree: true, isHebrew: he });
const tree = (r) => r.places.map((p) => [p.name, p.kind, p.parent ? r.places.find((q) => q.key === p.parent).name : null]);
const where = (r, i) => r.places.find((p) => p.key === r.items[i].place)?.name ?? null;

describe('the request and the prompt: tree is an opt-in on top of structure', () => {
  it('tree only with structure; an old browser gets exactly today', () => {
    expect(validateDraftRequest({ description: 'ריצוף 40 מ״ר', tree: true }).value).toEqual({ description: 'ריצוף 40 מ״ר' });
    expect(validateDraftRequest({ description: 'ריצוף 40 מ״ר', structure: true, tree: true }).value).toEqual({ description: 'ריצוף 40 מ״ר', structure: true, tree: true });
    expect(draftResponseSchema(false)).toBe(DRAFT_RESPONSE_SCHEMA);
    expect(draftResponseSchema(true)).toBe(DRAFT_RESPONSE_SCHEMA_STRUCTURED);
    expect(draftResponseSchema(true, true).schema.properties.places.items.required).toEqual(expect.arrayContaining(['parent', 'evidence']));
    const legacy = buildDraftMessages({ description: 'x x x x x', isHebrew: true, catalog: [], structure: true })[0].content;
    const t = buildDraftMessages({ description: 'x x x x x', isHebrew: true, catalog: [], structure: true, tree: true })[0].content;
    expect(legacy).toContain('Identical places are ONE entry'); expect(t).not.toContain('Identical places are ONE entry');
    expect(t).toContain('A number written AFTER the place word is part of its NAME'); expect(t).toContain('never translate, rephrase');
    expect(buildDraftMessages({ description: 'x x x x x', isHebrew: true, catalog: [] })[0].content).not.toContain('places (the headings');
  });
});

describe('the tree from the text', () => {
  it('flat: no places', () => {
    const r = P('ריצוף 40 מ״ר ופירוק ריצוף קיים', { places: [], items: [line({ description: 'ריצוף', evidence: 'ריצוף 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' })] });
    expect(r.places).toEqual([]); expect(r.items[0].place).toBe(null); expect(r.items[0].quantity).toBe(40);
  });
  it('דירה 32 (סלון, מטבח) and דירה 33 (סלון): 5 headings, nested, each line in its own room with its own quantity', () => {
    const text = 'דירה 32 עם סלון ומטבח: ריצוף סלון 20 מ״ר, ריצוף מטבח 10 מ״ר. דירה 33 עם סלון: ריצוף סלון 25 מ״ר';
    const r = P(text, {
      places: [pl('p1', 'apartment', 'דירה 32', null, 'דירה 32'), pl('p2', 'room', 'סלון', 'p1', 'סלון'), pl('p3', 'room', 'מטבח', 'p1', 'מטבח'),
        pl('p4', 'apartment', 'דירה 33', null, 'דירה 33'), pl('p5', 'room', 'סלון', 'p4', 'סלון')],
      items: [line({ description: 'ריצוף', evidence: 'ריצוף סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'p2' }),
        line({ description: 'ריצוף', evidence: 'ריצוף מטבח 10 מ״ר', quantity: 10, unit: 'm2', quantityBasis: 'stated', place: 'p3' }),
        line({ description: 'ריצוף', evidence: 'ריצוף סלון 25 מ״ר', quantity: 25, unit: 'm2', quantityBasis: 'stated', place: 'p5' })] });
    expect(tree(r)).toEqual([['דירה 32', 'apartment', null], ['סלון', 'room', 'דירה 32'], ['מטבח', 'room', 'דירה 32'], ['דירה 33', 'apartment', null], ['סלון', 'room', 'דירה 33']]);
    expect(r.items.map((it) => [it.quantity, it.quantityBasis])).toEqual([[20, 'stated'], [10, 'stated'], [25, 'stated']]);
    expect(r.items[2].place).toBe('p5'); expect(r.places.every((p) => p.count === 1)).toBe(true);
  });
  it('the same work and quantity in two apartments: each in its own place, neither ambiguous', () => {
    const text = 'דירה 32: ריצוף סלון 20 מ״ר. דירה 33: ריצוף סלון 20 מ״ר';
    const r = P(text, { places: [pl('a', 'apartment', 'דירה 32', null, 'דירה 32'), pl('b', 'apartment', 'דירה 33', null, 'דירה 33')],
      items: [line({ description: 'ריצוף סלון', evidence: 'ריצוף סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
        line({ description: 'ריצוף סלון', evidence: 'ריצוף סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'b' })] });
    expect(r.items.map((it) => [where({ ...r, items: r.items }, r.items.indexOf(it)), it.quantity, it.quantityBasis])).toEqual([['דירה 32', 20, 'stated'], ['דירה 33', 20, 'stated']]);
  });
  it('קומה 10 with 4 identical apartments, each living room + kitchen: 4 separate apartments (no × N), each with its rooms and lines', () => {
    const text = 'קומה 10 עם 4 דירות זהות, בכל אחת סלון ומטבח: צביעת סלון 30 מ״ר, ריצוף מטבח 8 מ״ר';
    const r = P(text, {
      places: [pl('f', 'floor', 'קומה 10', null, 'קומה 10'), pl('a', 'apartment', '', 'f', '4 דירות', { count: 4, identical: 'yes' }),
        pl('r1', 'room', 'סלון', 'a', 'סלון'), pl('r2', 'room', 'מטבח', 'a', 'מטבח')],
      items: [line({ description: 'צביעה', evidence: 'צביעת סלון 30 מ״ר', quantity: 30, unit: 'm2', quantityBasis: 'stated', place: 'r1' }),
        line({ description: 'ריצוף', evidence: 'ריצוף מטבח 8 מ״ר', quantity: 8, unit: 'm2', quantityBasis: 'stated', place: 'r2' })] });
    const apts = r.places.filter((p) => p.kind === 'apartment');
    expect(apts.map((p) => p.name)).toEqual(['דירה 1', 'דירה 2', 'דירה 3', 'דירה 4']);
    expect(r.places.every((p) => p.count === 1)).toBe(true);
    expect(apts.every((a) => r.places.filter((p) => p.parent === a.key).map((p) => p.name).join() === 'סלון,מטבח')).toBe(true);
    expect(r.items).toHaveLength(8);
    expect(r.items.every((it) => it.quantityBasis === 'stated')).toBe(true);
    expect(r.questions).toEqual([]);
  });
  it('4 apartments without "identical": copies 2-4 empty and a question (never guessed)', () => {
    const text = 'קומה 10 עם 4 דירות: צביעת סלון 30 מ״ר';
    const r = P(text, { places: [pl('f', 'floor', 'קומה 10', null, 'קומה 10'), pl('a', 'apartment', '', 'f', '4 דירות', { count: 4, identical: 'unclear' })],
      items: [line({ description: 'צביעה', evidence: 'צביעת סלון 30 מ״ר', quantity: 30, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(r.places.filter((p) => p.kind === 'apartment')).toHaveLength(4);
    expect(r.items).toHaveLength(1);
    expect(r.questions[0]).toContain('4');
  });
  it('two kids rooms: "שני חדרי ילדים, בכל אחד" -> חדר ילדים 1 + 2; named one by one -> two rooms, never merged', () => {
    const r = P('שני חדרי ילדים, בכל אחד צביעה 12 מ״ר', { places: [pl('k', 'room', 'חדר ילדים', null, 'שני חדרי ילדים', { count: 2, identical: 'yes' })],
      items: [line({ description: 'צביעה', evidence: 'צביעה 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'k' })] });
    expect(r.places.map((p) => p.name)).toEqual(['חדר ילדים 1', 'חדר ילדים 2']);
    expect(r.items.map((it) => it.quantity)).toEqual([12, 12]);
    const r2 = P('חדר ילדים 1: צביעה 12 מ״ר, חדר ילדים 2: צביעה 14 מ״ר', { places: [pl('k1', 'room', 'חדר ילדים 1', null, 'חדר ילדים 1'), pl('k2', 'room', 'חדר ילדים 2', null, 'חדר ילדים 2')],
      items: [line({ description: 'צביעה', evidence: 'צביעה 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'k1' }),
        line({ description: 'צביעה', evidence: 'צביעה 14 מ״ר', quantity: 14, unit: 'm2', quantityBasis: 'stated', place: 'k2' })] });
    expect(r2.places.map((p) => p.name)).toEqual(['חדר ילדים 1', 'חדר ילדים 2']); expect(r2.items.map((it) => it.quantity)).toEqual([12, 14]);
  });
  it('"שתי דירות זהות" -> two separate apartments, the lines in each (Owner: no × N); EN with m² in the text and m2 in the evidence is verified', () => {
    const r = P('שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר', { places: [pl('a', 'apartment', '', null, 'שתי דירות זהות', { count: 2, identical: 'yes' })],
      items: [line({ description: 'ריצוף', evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    // 2026-11-15 (Owner round 2, item 2): the kitchen written for the work is a heading inside each apartment (the room is never lost)
    expect(r.places.map((p) => [p.name, p.count])).toEqual([['דירה 1', 1], ['מטבח', 1], ['דירה 2', 1], ['מטבח', 1]]);
    expect(r.items.map((it) => [r.places.find((p) => p.key === it.place)?.name, it.quantity, it.quantityBasis])).toEqual([['מטבח', 12, 'stated'], ['מטבח', 12, 'stated']]);
    expect(r.places.find((p) => p.key === r.items[1].place).parent).toBe('a~2');
    const e = P('Two identical apartments, in each flooring in the kitchen 12 m² and replace the toilet', { places: [pl('a', 'apartment', '', null, 'Two identical apartments', { count: 2, identical: 'yes' })],
      items: [line({ description: 'Flooring', evidence: 'flooring in the kitchen 12 m2', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'a' })] }, false);
    expect(e.places.map((p) => p.name)).toEqual(['Apartment 1', 'Kitchen', 'Apartment 2', 'Kitchen']); // the kitchen written for the work (15/11 round 2)
    expect(e.items.map((it) => [it.quantity, it.quantityBasis])).toEqual([[12, 'stated'], [12, 'stated']]);
  });
  it('nothing invented: a floor the text never names is dropped (its line goes up), a wrong name is cleared, a loop / wrong order goes to the top', () => {
    const r = P('דירה 32: צביעה 40 מ״ר. חצר: דשא סינטטי 25 מ״ר', {
      places: [pl('f', 'floor', 'קומה 1', null, 'קומה 1'), pl('a', 'apartment', 'דירה 34', 'f', 'דירה 32'), pl('y', 'section', 'חצר', 'a', 'חצר')],
      items: [line({ description: 'צביעה', evidence: 'צביעה 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(r.places.map((p) => [p.kind, p.name])).toEqual([['apartment', ''], ['section', 'חצר']]);
    expect(r.places[0].parent).toBe(null);
  });
  it('the count is bound to the plural word: "דירה 32" is a name, "4 דירות" is a count', () => {
    expect(countWrittenFor('4 דירות', 'apartment', 4)).toBe(true);
    expect(countWrittenFor('two identical apartments', 'apartment', 2)).toBe(true);
    expect(countWrittenFor('שני חדרי ילדים', 'room', 2)).toBe(true);
    expect(countWrittenFor('דירה 32 ו-33', 'apartment', 32)).toBe(false);
    expect(countWrittenFor('קומה 10 עם 4 דירות', 'floor', 10)).toBe(false);
    expect(countWrittenFor('ריצוף 2 מ״ר בדירה', 'apartment', 2)).toBe(false);
  });
  it('evidence with unit forms only in tree mode (legacy unchanged)', () => {
    expect(locateEvidence('tile 12 m²', 'tile 12 m2')).toBe(null);
    expect(locateEvidence('tile 12 m²', 'tile 12 m2', [], { unitForms: true })?.text).toBe('tile 12 m²');
  });
});

describe('the browser keeps the tree only when the server says tree', () => {
  it('tree places with parent and evidence; a parent of a wrong rank goes to the top; the legacy shape unchanged', () => {
    const base = { contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, subject: 's', questions: [], unassignedMeasures: [], changes: { updates: [], deletes: [], notes: null, discountPercent: null },
      items: [{ description: 'a', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', place: 'a~2' }] };
    const t = sanitizeDraftResponse({ ...base, tree: true, places: [{ key: 'a', kind: 'apartment', name: 'דירה 1', parent: null, evidence: 'x', count: 1, identical: 'no' },
      { key: 'r', kind: 'room', name: 'מטבח', parent: 'a', evidence: 'מטבח', count: 1, identical: 'no' }, { key: 'f', kind: 'floor', name: 'ק', parent: 'r', evidence: '', count: 1, identical: 'no' }] });
    expect(t.tree).toBe(true);
    expect(t.places.map((p) => [p.key, p.parent])).toEqual([['a', null], ['r', 'a'], ['f', null]]);
    expect(t.items[0].place).toBe('a~2');
    const l = sanitizeDraftResponse({ ...base, places: [{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }] });
    expect(l.places).toEqual([{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }]); expect('tree' in l).toBe(false);
  });
});

describe('the browser applies the tree: new headings appended, nested, each line in its own heading, no × N', async () => {
  const { aiPlacesToSections, draftPlacePath, draftPlaceRows } = await import('./utils/aiQuoteDraftClient');
  const places = [{ key: 'a', kind: 'apartment', name: 'דירה 32', parent: null, count: 1, identical: 'no' }, { key: 'r', kind: 'room', name: 'מטבח', parent: 'a', count: 1, identical: 'no' },
    { key: 'b', kind: 'apartment', name: '', parent: null, count: 1, identical: 'no' }];
  it('rows in tree order with depth; the path of a line', () => {
    expect(draftPlaceRows(places).map((r) => [r.place.key, r.depth])).toEqual([['a', 0], ['r', 1], ['b', 0]]);
    expect(draftPlacePath(places, 'r').map((p) => p.name)).toEqual(['דירה 32', 'מטבח']);
    expect(draftPlacePath(places, null)).toEqual([]);
  });
  it('appended after 2 existing headings (untouched), parent_key mapped, a nameless one named by its kind and its siblings (2 apartments already there -> דירה 3), a line of no heading stays at the root', () => {
    const existing = [{ key: 'e1', name: 'X', sort_order: 0 }, { key: 'e2', name: 'Y', sort_order: 1, kind: 'apartment' }];
    const lines = [{ place: 'r' }, { place: null }];
    const out = aiPlacesToSections(places, lines, [{ description: 'ריצוף' }, { description: 'פינוי' }], existing, { isHebrew: true, stamp: 't' });
    expect(out.sections.map((s) => [s.name, s.kind, s.parent_key, s.sort_order])).toEqual([['דירה 32', 'apartment', null, 2], ['מטבח', 'room', 'tmp_section_t_0', 3], ['דירה 3', 'apartment', null, 4]]);
    expect(out.sections.every((s) => !('repeat_count' in s))).toBe(true);
    expect(out.items.map((it) => it.section_key)).toEqual(['tmp_section_t_1', null]);
  });
  it('a group the server could not expand (count 25) becomes 25 headings - no limit of 20, no × N', () => {
    const out = aiPlacesToSections([{ key: 'g', kind: 'apartment', name: '', parent: null, count: 25, identical: 'yes' }], [{ place: 'g' }], [{ description: 'x' }], [], { stamp: 's' });
    expect(out.sections).toHaveLength(25);
    expect(out.items).toHaveLength(25);
  });
  it('the editor asks a new quote for the tree (source)', () => {
    const dash = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
    // 2026-11-13 (product-flow review 15): an empty quote asks for the tree when it is edited too
    expect(dash).toContain("s.empty ? { structure: true, tree: true } : { quote: s.snapshot }");
    expect(dash).toContain("places.some((p) => p && 'parent' in p)");
  });
});

// 2026-11-14 (Owner "א"): the function normalizes the catalog and the parser normalizes it again - the price basis survives, so a
// catalog price per m² reaches the m² lines of the tree (before: "catalog_unit_unverified", an empty price)
describe('the catalog price basis through the function path (normalized twice)', () => {
  it('a catalog row per m² gives its price to an m² line in every apartment and room', () => {
    const text = 'קומה 3 עם שתי דירות. דירה 5 עם סלון: ריצוף סלון 20 מ״ר. דירה 6 עם סלון: ריצוף סלון 18 מ״ר';
    const catalog = normalizeCatalog([{ id: 'c1', name: 'ריצוף', price: 150, price_basis: 'm2' }]); // as ai-quote-draft/index.ts does
    expect(catalog[0].basis).toBe('m2');
    expect(normalizeCatalog(catalog)[0].basis).toBe('m2');
    const r = P(text, { places: [pl('f', 'floor', 'קומה 3', null, 'קומה 3'), pl('a', 'apartment', 'דירה 5', 'f', 'דירה 5'), pl('r1', 'room', 'סלון', 'a', 'סלון'),
      pl('b', 'apartment', 'דירה 6', 'f', 'דירה 6'), pl('r2', 'room', 'סלון', 'b', 'סלון')],
    items: [line({ description: 'ריצוף', evidence: 'ריצוף סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'r1', catalogId: 'c1' }),
      line({ description: 'ריצוף', evidence: 'ריצוף סלון 18 מ״ר', quantity: 18, unit: 'm2', quantityBasis: 'stated', place: 'r2', catalogId: 'c1' })] }, true, catalog);
    expect(r.items.map((it) => [it.quantity, it.unitPrice, it.priceSource])).toEqual([[20, 150, 'catalog'], [18, 150, 'catalog']]);
  });
});
