// Task 34 (Codex independent review, finding 1): a quantity must be bound to the job / evidence it comes from - not to "some number in the text".
// The model is never the authority for the binding: every check below is about the USER'S TEXT, by position.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, extractMeasures, locateEvidence } from './aiQuoteDraft.js';

const L = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, ...o });
const parse = (items, text, catalog = []) => parseDraftModelOutput({ subject: '', questions: [], items }, catalog, text);
const rows = (r) => r.items.map((i) => [i.description, i.quantity, i.unit, i.missing]);
const TEXT = 'ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר';

describe('reproduction: swapped quantities between jobs (failed before the fix)', () => {
  it('option ב: the model\'s numbers stand as it wrote them (both are written in the text); the user reviews the lines', () => {
    const r = parse([
      L({ description: 'ריצוף חדר הורים', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדר ילדים', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], TEXT);
    const kept = r.items.filter((i) => i.quantity != null).map((i) => [i.description, i.quantity]);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(kept).toEqual([['ריצוף חדר הורים', 22], ['ריצוף חדר ילדים', 40]]);
  });
});

describe('quantity bound to its own evidence', () => {
  it('correct evidence: 40 and 22 stay on their own rooms', () => {
    const r = parse([
      L({ description: 'ריצוף חדר הורים', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדר ילדים', evidence: 'ריצוף חדר ילדים 22 מ"ר', quantity: 22, unit: 'm2', quantityBasis: 'stated' }), // other quote mark: still found
    ], TEXT);
    expect(rows(r)).toEqual([['ריצוף חדר הורים', 40, 'm2', null], ['ריצוף חדר ילדים', 22, 'm2', null]]);
    expect(r.items.map((i) => i.evidence)).toEqual(['ריצוף חדר הורים 40 מ״ר', 'ריצוף חדר ילדים 22 מ״ר']);
    expect(r.unassignedMeasures).toEqual([]);
  });
  it('option ב: quantities the model swapped stand as written by it (both numbers are in the text); nothing is left unassigned', () => {
    const r = parse([
      L({ description: 'ריצוף חדר הורים', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדר ילדים', evidence: 'ריצוף חדר ילדים 22 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], TEXT);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(rows(r)).toEqual([['ריצוף חדר הורים', 22, 'm2', null], ['ריצוף חדר ילדים', 40, 'm2', null]]);
    expect(r.unassignedMeasures).toEqual([]);
  });
  it('option ב: swapped evidence - the model\'s numbers stand (written in the text)', () => {
    const r = parse([
      L({ description: 'ריצוף חדר הורים', evidence: 'ריצוף חדר ילדים 22 מ״ר', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדר ילדים', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], TEXT);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(r.items.map((i) => [i.quantity, i.missing])).toEqual([[22, null], [40, null]]);
  });
  it('option ב: no evidence / evidence not in the text / the same evidence twice - a number written in the text stands; one never written stays empty', () => {
    const r = parse([
      L({ description: 'ריצוף חדר הורים', evidence: '', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדר ילדים', evidence: 'ריצוף חדר ילדים 23 מ״ר', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
    ], TEXT);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(r.items.map((i) => [i.quantity, i.missing])).toEqual([[40, null], [22, null]]);
    expect(parse([L({ description: 'ריצוף', evidence: '', quantity: 35, unit: 'm2', quantityBasis: 'stated' })], TEXT).items[0]).toMatchObject({ quantity: null, missing: 'unverified' });
    const twice = parse([
      L({ description: 'ריצוף', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ליטוש', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], TEXT);
    expect(twice.items.map((i) => [i.quantity, i.missing])).toEqual([[40, null], [40, null]]);
  });
  it('equal numbers in two jobs: each line uses ITS occurrence; one occurrence is never used twice', () => {
    const text = 'צביעת סלון 20 מ״ר, ריצוף מטבח 20 מ״ר';
    const r = parse([
      L({ description: 'צביעת סלון', evidence: 'צביעת סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף מטבח', evidence: 'ריצוף מטבח 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated' }),
    ], text);
    expect(rows(r)).toEqual([['צביעת סלון', 20, 'm2', null], ['ריצוף מטבח', 20, 'm2', null]]);
    // only the painting line is drafted: the tiling "20 מ״ר" is NOT counted as used just because the same value was used elsewhere
    const one = parse([L({ description: 'צביעת סלון', evidence: 'צביעת סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated' })], text);
    expect(one.unassignedMeasures).toEqual(['20 מ״ר']);
  });
  it('a price, a date and a phone number next to a quantity are never a quantity', () => {
    const text = 'ריצוף 30 מ״ר במחיר 120 ₪ למ״ר, ביצוע ב-15/10, טלפון 050-1234567, הנחה 10%';
    expect(extractMeasures(text).map((m) => [m.value, m.kind])).toEqual([[30, 'number'], [120, 'price'], [15, 'date'], [10, 'date'], [50, 'id'], [1234567, 'id'], [10, 'percent']]);
    const ev = 'ריצוף 30 מ״ר במחיר 120 ₪ למ״ר, ביצוע ב-15/10, טלפון 050-1234567, הנחה 10%';
    for (const q of [120, 15, 10, 1234567]) expect(parse([L({ description: 'ריצוף', evidence: ev, quantity: q, unit: 'm2', quantityBasis: 'stated' })], text).items[0].missing).toBe('unverified');
    expect(parse([L({ description: 'ריצוף', evidence: ev, quantity: 30, unit: 'm2', quantityBasis: 'stated' })], text).items[0].quantity).toBe(30);
  });
  it('different units on different lines: the unit written in the text at that position wins over the model', () => {
    const text = '4 שעות עבודת חשמלאי, 12 מ״ר טיח';
    const r = parse([
      L({ description: 'עבודת חשמלאי', evidence: '4 שעות עבודת חשמלאי', quantity: 4, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'טיח', evidence: '12 מ״ר טיח', quantity: 12, unit: 'hour', quantityBasis: 'stated' }),
    ], text);
    expect(rows(r)).toEqual([['עבודת חשמלאי', 4, 'hour', null], ['טיח', 12, 'm2', null]]);
  });
  it('option ב: a quantity the model gives a job stands when it is written in the text; an implied single piece is 1', () => {
    const text = 'פירוק ריצוף קיים, וריצוף חדש 40 מ״ר';
    const r = parse([
      L({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף חדש', evidence: 'ריצוף חדש 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], text);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(rows(r)).toEqual([['פירוק ריצוף קיים', 40, 'm2', null], ['ריצוף חדש', 40, 'm2', null]]);
    expect(parse([L({ description: 'ריצוף חדש', evidence: 'ריצוף חדש 40 מ״ר', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' })], text).items[0].quantity).toBe(1);
  });
  it('EN: the same rule (option ב: the model\'s numbers stand when written in the text; own evidence kept, reordered lines)', () => {
    const text = 'Tile the master bedroom 40 m2, tile the kids room 22 m2';
    const ok = parse([
      L({ description: 'Kids room tiling', evidence: 'tile the kids room 22 m2', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'Master bedroom tiling', evidence: 'Tile the master bedroom 40 m2', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], text);
    expect(rows(ok)).toEqual([['Kids room tiling', 22, 'm2', null], ['Master bedroom tiling', 40, 'm2', null]]);
    const swap = parse([
      L({ description: 'Master bedroom tiling', evidence: 'Tile the master bedroom 40 m2', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'Kids room tiling', evidence: 'tile the kids room 22 m2', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], text);
    // Owner 2026-11-15 (option ב): the model's number stands when it is written in the text - the line is reviewed before it is added
    expect(swap.items.map((i) => [i.quantity, i.missing])).toEqual([[22, null], [40, null]]);
  });
  it('derived dimensions count only for the line whose evidence holds them', () => {
    const text = 'צביעת קיר בסלון 4 על 2.5 מטר, ותקרה במטבח 3 על 3 מטר';
    const r = parse([
      L({ description: 'צביעת קיר בסלון', evidence: 'צביעת קיר בסלון 4 על 2.5 מטר', quantity: 10, unit: 'm2', quantityBasis: 'derived', derivation: '4 × 2.5' }),
      L({ description: 'צביעת תקרה במטבח', evidence: 'תקרה במטבח 3 על 3 מטר', quantity: 10, unit: 'm2', quantityBasis: 'derived', derivation: '4 × 2.5' }),
    ], text);
    expect(r.items.map((i) => [i.quantity, i.derivation, i.missing])).toEqual([[10, '4 × 2.5', null], [null, null, 'unverified']]);
    const ceiling = parse([L({ description: 'צביעת תקרה במטבח', evidence: 'תקרה במטבח 3 על 3 מטר', quantity: 9, unit: 'm2', quantityBasis: 'derived', derivation: '3 × 3' })], text);
    expect(ceiling.items[0].quantity).toBe(9); // two distinct "3" occurrences inside its own span
  });
  it('a catalog match must belong to THIS line (a word of another job in the text is not enough)', () => {
    const text = 'ריצוף 30 מ״ר, צביעת קירות 50 מ״ר';
    const catalog = [{ id: 5, name: 'צביעה למ״ר', price: 35 }, { id: 6, name: 'ריצוף למ״ר', price: 120 }];
    const r = parse([
      L({ description: 'ריצוף', evidence: 'ריצוף 30 מ״ר', quantity: 30, unit: 'm2', quantityBasis: 'stated', catalogId: '5' }),
      L({ description: 'צביעת קירות', evidence: 'צביעת קירות 50 מ״ר', quantity: 50, unit: 'm2', quantityBasis: 'stated', catalogId: '5' }),
    ], text, catalog);
    expect(r.items.map((i) => [i.description, i.unitPrice, i.priceSource])).toEqual([['ריצוף', null, 'none'], ['צביעת קירות', 35, 'catalog']]);
  });
  it('reordered text with two Hebrew prefix letters ("ובחדר ההורים") still binds each room to its own number (live TEST finding)', () => {
    const text = '22 מ״ר ריצוף בחדר הילדים, ובחדר ההורים ריצוף של 40 מ״ר';
    const r = parse([
      L({ description: 'ריצוף בחדר הילדים', evidence: '22 מ״ר ריצוף בחדר הילדים', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
      L({ description: 'ריצוף בחדר ההורים', evidence: 'ובחדר ההורים ריצוף של 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    ], text);
    expect(r.items.map((i) => [i.quantity, i.missing])).toEqual([[22, null], [40, null]]);
    expect(r.unassignedMeasures).toEqual([]);
  });
  it('locateEvidence ignores whitespace / quote-mark differences but never matches a different text', () => {
    expect(locateEvidence(TEXT, 'ריצוף  חדר  הורים 40 מ"ר')?.text).toBe('ריצוף חדר הורים 40 מ״ר');
    expect(locateEvidence(TEXT, 'ריצוף חדר הורים 45 מ״ר')).toBeNull();
    expect(locateEvidence(TEXT, 'ab')).toBeNull();
  });
});
