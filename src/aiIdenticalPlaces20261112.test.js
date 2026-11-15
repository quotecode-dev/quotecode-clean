// 2026-11-12 (Owner, option א after the uq1112 LIVE check): "two identical apartments, in each ..." came back from the real model as two
// places of 1 with every line twice - the second copy without a quantity, and in English every line without evidence (all quantities
// empty). The prompt now asks for ONE place × N with the lines once; the server merges identical copies (count written in the text, the same
// lines) into one place × N and keeps each line once. Anything else is left exactly as it was.
import { describe, it, expect } from 'vitest';
import { buildDraftMessages, parseDraftModelOutput, mergeIdenticalPlaceCopies } from '../supabase/functions/_shared/aiQuoteDraft.js';

const HE = 'שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר והחלפת אסלה בשירותים';
const EN = 'Two identical apartments, in each flooring in the kitchen 12 m2 and replace the toilet in the bathroom';
const line = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, place: null, room: null, ...o });
const apt = (key, o = {}) => ({ key, kind: 'apartment', name: '', count: 1, identical: 'yes', ...o });
const he = (place, o = {}) => [
  line({ description: 'ריצוף מטבח', evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place, room: 'kitchen', ...o }),
  line({ description: 'החלפת אסלה', evidence: 'החלפת אסלה בשירותים', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', place, room: 'bathroom', ...o }),
];
const en = (place, o = {}) => [
  line({ description: 'flooring in the kitchen', evidence: 'flooring in the kitchen 12 m2', quantity: 12, unit: 'm2', quantityBasis: 'stated', place, room: 'kitchen', ...o }),
  line({ description: 'replace the toilet in the bathroom', evidence: 'replace the toilet in the bathroom', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', place, room: 'bathroom', ...o }),
];
const parse = (out, text, isHebrew) => parseDraftModelOutput(JSON.stringify({ subject: 'x', questions: [], ...out }), [], text, null, { structure: true, isHebrew });
const view = (r) => r.items.map((i) => [i.place, i.quantity, i.unit, i.quantityBasis, i.missing]);

describe('the prompt: identical places are one entry with a count, the lines once', () => {
  it('only with the structure opt-in', () => {
    const withS = buildDraftMessages({ description: HE, isHebrew: true, catalog: [], structure: true })[0].content;
    expect(withS).toContain('Identical places are ONE entry with their count');
    expect(withS).toContain('Their work is listed ONCE');
    expect(withS).toContain('description is a short name of the WORK only, without the room or the place');
    expect(withS).toContain('in English it starts with a capital letter');
    expect(buildDraftMessages({ description: HE, isHebrew: true, catalog: [] })[0].content).not.toContain('Identical places are ONE entry');
  });
});

describe('the server: identical copies -> one place × N, each line once, the quantity filled', () => {
  it('Hebrew, the LIVE answer (two places of 1, the same evidence twice): one apartment × 2, 12 m² and 1 toilet, nothing missing', () => {
    const r = parse({ items: [...he('p1'), ...he('p2')], places: [apt('p1'), apt('p2')] }, HE, true);
    expect(r.places).toEqual([apt('p1', { count: 2 })]);
    expect(view(r)).toEqual([['p1', 12, 'm2', 'stated', null], ['p1', 1, 'unit', 'implied_single', null]]);
    expect(r.unassignedMeasures).toEqual([]);
    expect(r.questions).toEqual([]);
  });
  it('English, the copy of the first apartment without evidence: the copy that has it is kept - 12 m² and 1 toilet', () => {
    const r = parse({ items: [...en('p1', { evidence: '' }), ...en('p2')], places: [apt('p1'), apt('p2')] }, EN, false);
    expect(r.places).toEqual([apt('p1', { count: 2 })]);
    expect(view(r)).toEqual([['p1', 12, 'm2', 'stated', null], ['p1', 1, 'unit', 'implied_single', null]]);
    expect(r.unassignedMeasures).toEqual([]);
  });
  it('English, the model answers as the prompt now asks (one place × 2, the lines once): everything verified', () => {
    const r = parse({ items: en('p1'), places: [apt('p1', { count: 2 })] }, EN, false);
    expect(r.places).toEqual([apt('p1', { count: 2 })]);
    expect(view(r)).toEqual([['p1', 12, 'm2', 'stated', null], ['p1', 1, 'unit', 'implied_single', null]]);
  });
  it('no copy has evidence: still one apartment × 2 with the lines once, the quantity an honest gap (never guessed)', () => {
    const r = parse({ items: [...en('p1', { evidence: '' }), ...en('p2', { evidence: '' })], places: [apt('p1'), apt('p2')] }, EN, false);
    expect(r.places).toEqual([apt('p1', { count: 2 })]);
    expect(view(r)).toEqual([['p1', null, 'm2', 'missing', 'unverified'], ['p1', null, 'unit', 'missing', 'unverified']]);
  });
  it('three identical apartments: × 3', () => {
    const text = 'שלוש דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר והחלפת אסלה בשירותים';
    const r = parse({ items: [...he('p1'), ...he('p2'), ...he('p3')], places: [apt('p1'), apt('p2'), apt('p3')] }, text, true);
    expect(r.places).toEqual([apt('p1', { count: 3 })]);
    expect(r.items).toHaveLength(2);
  });
});

describe('the server leaves everything else exactly as it was', () => {
  const same = (places, items, text) => expect(mergeIdenticalPlaceCopies(places, items, text)).toEqual({ places, items });
  it('the count is not written in the text', () => same([apt('p1'), apt('p2')], [...he('p1'), ...he('p2')], 'דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר והחלפת אסלה בשירותים'));
  it('the copies do not hold the same lines', () => same([apt('p1'), apt('p2')], [...he('p1'), he('p2')[0]], HE));
  it('not said to be identical (no / unclear)', () => {
    same([apt('p1', { identical: 'no' }), apt('p2', { identical: 'no' })], [...he('p1'), ...he('p2')], HE);
    same([apt('p1', { identical: 'unclear' }), apt('p2', { identical: 'unclear' })], [...he('p1'), ...he('p2')], HE);
  });
  it('named places ("דירה 1" / "דירה 2"), different kinds, a copy with a count of its own', () => {
    same([apt('p1', { name: 'דירה 1' }), apt('p2', { name: 'דירה 2' })], [...he('p1'), ...he('p2')], HE);
    same([apt('p1'), apt('p2', { kind: 'floor' })], [...he('p1'), ...he('p2')], HE);
    same([apt('p1', { count: 2 }), apt('p2')], [...he('p1'), ...he('p2')], 'שתי דירות ועוד דירה, 3 דירות, ריצוף במטבח 12 מ״ר והחלפת אסלה בשירותים');
  });
  it('without the structure opt-in nothing is merged (an older browser sees the same answer)', () => {
    const r = parseDraftModelOutput(JSON.stringify({ subject: 'x', questions: [], items: [...he('p1'), ...he('p2')], places: [apt('p1'), apt('p2')] }), [], HE, null, {});
    expect(r.places).toBeUndefined();
    expect(r.items).toHaveLength(4);
  });
});
