// Task 35 (Codex independent review F1 / F2): a verbatim evidence span is NOT proof of attribution when it covers several jobs, and a
// product of numbers is NOT proof of a derived quantity without unit algebra. Written to FAIL before the fix, then kept as the contract.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, extractMeasures } from './aiQuoteDraft.js';

const L = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, ...o });
const parse = (items, text, catalog = []) => parseDraftModelOutput({ subject: '', questions: [], items }, catalog, text);
const one = (r) => ({ q: r.items[0].quantity, u: r.items[0].unit, m: r.items[0].missing });

describe('F1 - broad evidence covering several jobs', () => {
  const TEXT = 'ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר';
  it('exact review input: one line "parents" = 22 with evidence spanning both rooms -> never verified', () => {
    const r = parse([L({ description: 'ריצוף חדר הורים', quantity: 22, unit: 'm2', quantityBasis: 'stated', evidence: TEXT })], TEXT);
    expect(r.items[0].quantity).toBeNull();
    expect(['unverified', 'ambiguous']).toContain(r.items[0].missing);
  });
  it('the same broad span with the RIGHT number is attributed only through the line\'s own clause (40 for parents)', () => {
    expect(one(parse([L({ description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: TEXT })], TEXT))).toEqual({ q: 40, u: 'm2', m: null });
  });
  it('a broad span whose clauses do not single out the line stays ambiguous (no guess between 40 and 22)', () => {
    expect(one(parse([L({ description: 'ריצוף', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: TEXT })], TEXT)).m).toBe('ambiguous');
  });
  it('evidence that appears twice in the text is indistinct -> ambiguous', () => {
    const t = 'צביעת קיר 20 מ״ר בסלון וגם צביעת קיר 20 מ״ר בחדר';
    expect(one(parse([L({ description: 'צביעת קיר', quantity: 20, unit: 'm2', quantityBasis: 'stated', evidence: 'צביעת קיר 20 מ״ר' })], t)).m).toBe('ambiguous');
  });
  it('truncated evidence (cut inside a number or word) is not located', () => {
    expect(one(parse([L({ description: 'ריצוף חדר הורים', quantity: 4, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר הורים 4' })], TEXT)).m).toBe('unverified');
    expect(one(parse([L({ description: 'ריצוף', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר הור' })], TEXT)).m).toBe('unverified');
  });
  it('evidence may cut a word ending (live TEST: "…walls" copied as "…wall") but never a number', () => {
    const t = 'Paint 35 m2 of living room walls, agreed price $12 per m2, start on 10/15, call 555-1234567';
    expect(one(parse([L({ description: 'Paint living room walls', quantity: 35, unit: 'm2', quantityBasis: 'stated', evidence: 'Paint 35 m2 of living room wall' })], t))).toEqual({ q: 35, u: 'm2', m: null });
    expect(one(parse([L({ description: 'Paint living room walls', quantity: 3, unit: 'm2', quantityBasis: 'stated', evidence: 'Paint 3' })], t)).m).toBe('unverified');
    expect(one(parse([L({ description: 'Plaster', quantity: 12, unit: 'm2', quantityBasis: 'stated', evidence: 'Plaster 12' })], 'Plaster 12.5 m2')).m).toBe('unverified');
    // a long span whose mis-copied tail cuts the PHONE number (not a quantity) still binds the real quantity of its own clause
    expect(one(parse([L({ description: 'Paint living room walls', quantity: 35, unit: 'm2', quantityBasis: 'stated', evidence: t.slice(0, -1) })], t))).toEqual({ q: 35, u: 'm2', m: null });
  });
  it('broad evidence with a price / date / phone keeps the single real quantity', () => {
    const t = 'ריצוף 30 מ״ר בסלון, מחיר 120 ₪ למ״ר, ביצוע ב-15/10, טלפון 050-1234567';
    expect(one(parse([L({ description: 'ריצוף סלון', quantity: 30, unit: 'm2', quantityBasis: 'stated', evidence: t })], t))).toEqual({ q: 30, u: 'm2', m: null });
  });
  it('one clause with two different units: the claimed unit picks the one compatible measure; EN works the same', () => {
    const t = '4 שעות עבודת חשמלאי ו-12 מ״ר טיח';
    expect(one(parse([L({ description: 'עבודת חשמלאי', quantity: 4, unit: 'hour', quantityBasis: 'stated', evidence: t })], t))).toEqual({ q: 4, u: 'hour', m: null });
    const e = 'Tile the master bedroom 40 m2, tile the kids room 22 m2';
    expect(one(parse([L({ description: 'Master bedroom tiling', quantity: 22, unit: 'm2', quantityBasis: 'stated', evidence: e })], e)).q).toBeNull();
    expect(one(parse([L({ description: 'Master bedroom tiling', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: e })], e)).q).toBe(40);
  });
  it('number words still count, inside their own clause', () => {
    const t = 'התקנת שלושה מזגנים בחדרים, ושני ברזים במטבח';
    expect(one(parse([L({ description: 'התקנת מזגנים', quantity: 3, unit: 'unit', quantityBasis: 'stated', evidence: t })], t))).toEqual({ q: 3, u: 'unit', m: null });
    expect(one(parse([L({ description: 'התקנת מזגנים', quantity: 2, unit: 'unit', quantityBasis: 'stated', evidence: t })], t)).q).toBeNull();
  });
});

describe('F2 - derived quantities need unit algebra, not only a product', () => {
  const CAB = 'התקנת ארון ברוחב 2 מטר וגובה 3 מטר';
  it('exact review input: 2 m x 3 m = 6 "hours" -> never verified', () => {
    const r = parse([L({ description: 'התקנת ארון', quantity: 6, unit: 'hour', quantityBasis: 'derived', derivation: '2 * 3', evidence: CAB })], CAB);
    expect(r.items[0].quantity).toBeNull();
    expect(r.items[0].missing).not.toBeNull();
  });
  it('length x length is an area: 6 m² with the derivation shown', () => {
    expect(parse([L({ description: 'התקנת ארון', quantity: 6, unit: 'm2', quantityBasis: 'derived', derivation: '2 × 3', evidence: CAB })], CAB).items[0]).toMatchObject({ quantity: 6, unit: 'm2', quantityBasis: 'derived' });
  });
  it.each(['linear_meter', 'kg', 'day', 'unit', null])('length x length is never "%s"', (unit) => {
    expect(parse([L({ description: 'התקנת ארון', quantity: 6, unit, quantityBasis: 'derived', derivation: '2 × 3', evidence: CAB })], CAB).items[0].quantity).toBeNull();
  });
  it('a dimension pair "A על B ס״מ" converts exactly from centimeters (120 x 100 cm = 1.2 m²)', () => {
    const t = 'החלפת חלון 120 על 100 ס״מ';
    expect(extractMeasures(t).filter((m) => m.kind === 'number').map((m) => [m.value, m.unit])).toEqual([[120, 'cm'], [100, 'cm']]);
    const r = parse([L({ description: 'החלפת חלון', quantity: 1.2, unit: 'm2', quantityBasis: 'derived', derivation: '120 × 100', evidence: t })], t);
    expect(r.items[0]).toMatchObject({ quantity: 1.2, unit: 'm2', derivation: '1.2 × 1' });
    expect(parse([L({ description: 'החלפת חלון', quantity: 12000, unit: 'm2', quantityBasis: 'derived', derivation: '120 × 100', evidence: t })], t).items[0].quantity).toBeNull();
  });
  it('area x count (or a count in the product) is not created without an explicit charge', () => {
    const t = 'צביעת 3 קירות בגודל 4 על 2.5 מטר';
    expect(parse([L({ description: 'צביעת קירות', quantity: 30, unit: 'm2', quantityBasis: 'derived', derivation: '3 × 4 × 2.5', evidence: t })], t).items[0].quantity).toBeNull();
  });
  it('bare numbers without a length unit are not dimensions', () => {
    const t = 'ריצוף 3x2';
    expect(parse([L({ description: 'ריצוף', quantity: 6, unit: 'm2', quantityBasis: 'derived', derivation: '3 × 2', evidence: t })], t).items[0].quantity).toBeNull();
  });
});

describe('catalog: the exact product of THIS line', () => {
  const catalog = [{ id: 1, name: 'התקנת חלון אלומיניום', price: 900 }, { id: 2, name: 'ריצוף פרקט', price: 150 }, { id: 3, name: 'עבודה שעתית', price: 120 }];
  it('a generic shared word ("התקנת", "עבודה") is not proof; a different material is a negative', () => {
    const t = 'התקנת מזגן, ריצוף קרמיקה 20 מ״ר, עבודה 3 שעות';
    const r = parse([
      L({ description: 'התקנת מזגן', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', evidence: 'התקנת מזגן', catalogId: '1' }),
      L({ description: 'ריצוף קרמיקה', quantity: 20, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף קרמיקה 20 מ״ר', catalogId: '2' }),
      L({ description: 'עבודה', quantity: 3, unit: 'hour', quantityBasis: 'stated', evidence: 'עבודה 3 שעות', catalogId: '3' }),
    ], t, catalog);
    expect(r.items.map((i) => i.catalogId)).toEqual([null, null, null]);
  });
  it('the same product with word forms / final letters still matches (התקנת 2 מזגנים <-> התקנת מזגן)', () => {
    const t = 'התקנת 2 מזגנים';
    const r = parse([L({ description: 'התקנת מזגנים', quantity: 2, unit: 'unit', quantityBasis: 'stated', evidence: t, catalogId: '9' })], t, [{ id: 9, name: 'התקנת מזגן', price: 450 }]);
    expect(r.items[0]).toMatchObject({ unitPrice: 450, priceSource: 'catalog' });
  });
});
