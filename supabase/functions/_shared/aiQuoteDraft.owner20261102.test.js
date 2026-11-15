// Owner console 2026-11-02 (typed: "מאשר את התוכנית לתיקון 4 התקלות בהצעה החכמה, שחרור עד הלייב"). Found on LIVE with a real dictation: 5 of 5 runs for the comma, while typed digits in English passed 10 of 10.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, extractMeasures, catalogNameUnit } from './aiQuoteDraft.js';

const L = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, ...o });
const parse = (items, text, catalog = []) => parseDraftModelOutput({ subject: '', questions: [], items }, catalog, text);
const CAT = [{ id: 1, name: 'ריצוף חדש למ"ר', price: 320 }];
const TOILET = L({ description: 'אסלה תלויה', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', evidence: 'ואסלה תלויה' });

describe('the units a person says', () => {
  it.each(['12 מטר רבוע', '12 מטרים רבועים', '12 מטר מרובע', '12 מ״ר'])('%s is a square meter', (t) => {
    expect(extractMeasures(t)[0]).toMatchObject({ value: 12, unit: 'm2' });
  });
  it('a plain meter stays a meter', () => {
    expect(extractMeasures('12 מטר רצפה')[0]).toMatchObject({ value: 12, unit: 'meter' });
  });
  it('a catalog name with "מטר רבוע" declares a square meter', () => {
    expect(catalogNameUnit('ריצוף למטר רבוע')).toBe('m2');
  });
  it('a number said as a word keeps its unit, and the price of a per-square-meter item', () => {
    const text = 'Bathroom. Twelve square meters of new tile and a wall-hung toilet.';
    expect(extractMeasures(text).find((m) => m.value === 12)).toMatchObject({ unit: 'm2', word: true });
    const r = parse([L({ description: 'new tile', quantity: 12, unit: 'm2', quantityBasis: 'stated', evidence: 'Twelve square meters of new tile', catalogId: 2 })], text, [{ id: 2, name: 'New tile per square meter', price: 180 }]);
    expect(r.items[0]).toMatchObject({ quantity: 12, unit: 'm2', unitPrice: 180, priceSource: 'catalog' });
  });
});

describe('the comma of a dictation', () => {
  const stated = (evidence) => L({ description: 'ריצוף חדש', quantity: 12, unit: 'm2', quantityBasis: 'stated', evidence, catalogId: 1 });
  it('"ריצוף חדש, 12 מטר מרובע": the quantity and the price stay on the line, nothing is left unassigned', () => {
    const text = 'אמבטיה, ריצוף חדש, 12 מטר מרובע ואסלה תלויה.';
    const r = parse([stated('ריצוף חדש, 12 מטר מרובע'), TOILET], text, CAT);
    expect(r.items[0]).toMatchObject({ quantity: 12, unit: 'm2', quantityBasis: 'stated', missing: null, unitPrice: 320 });
    expect(r.unassignedMeasures).toEqual([]);
  });
  it('the measure first: "12 מטר מרובע, ריצוף חדש"', () => {
    const r = parse([stated('12 מטר מרובע, ריצוף חדש')], 'אמבטיה, 12 מטר מרובע, ריצוף חדש.', CAT);
    expect(r.items[0]).toMatchObject({ quantity: 12, missing: null });
  });
  it('still never a guess: a clause with words of its own keeps its number', () => {
    const r = parse([stated('ריצוף חדש, 12 מטר מרובע צביעה')], 'ריצוף חדש, 12 מטר מרובע צביעה', CAT);
    expect(r.items[0].quantity).toBeNull();
  });
  it('still never a swap: two rooms, each with its own quantity', () => {
    const text = 'ריצוף חדר הורים, 40 מ״ר, ריצוף חדר ילדים, 22 מ״ר';
    const r = parse([
      L({ description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר הורים, 40 מ״ר' }),
      L({ description: 'ריצוף חדר ילדים', quantity: 22, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר ילדים, 22 מ״ר' }),
    ], text);
    expect(r.items.map((i) => i.quantity)).toEqual([40, 22]);
    const swapped = parse([
      L({ description: 'ריצוף חדר הורים', quantity: 22, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר הורים, 40 מ״ר' }),
      L({ description: 'ריצוף חדר ילדים', quantity: 40, unit: 'm2', quantityBasis: 'stated', evidence: 'ריצוף חדר ילדים, 22 מ״ר' }),
    ], text);
    expect(swapped.items.map((i) => i.quantity)).toEqual([null, null]);
  });
});
