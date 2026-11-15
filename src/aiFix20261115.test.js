// 2026-11-15 (Owner video 15:31: "קומה 24, דירה 48, דירה 49, דירה 50. בכל דירה ..." came back without the floor, with 40 m² in apartment 48
// only and no price; Owner typed "מאשר את תיקון ההצעה החכמה (בכל דירה, מחיר אחרי כמות, קומה מעל הדירות, כמות אחת לשתי עבודות) ושחרור עד
// הלייב" + "לבדוק שכל האופציות האפשריות עובדות"): every way the model may answer the same text gives the same tree and lines, and the other
// structures keep their answer.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, buildDraftMessages } from '../supabase/functions/_shared/aiQuoteDraft.js';

const noChanges = { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null };
const line = (o) => ({ description: 'x', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, place: null, room: null, ...o });
const pl = (key, kind, name, parent, evidence, o = {}) => ({ key, kind, name, parent, evidence, count: 1, identical: 'no', ...o });
const P = (text, out, he = true, catalog = []) => parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], changes: noChanges, ...out }), catalog, text, null, { structure: true, tree: true, isHebrew: he });
const tree = (r) => r.places.map((p) => [p.name, p.kind, p.parent ? r.places.find((q) => q.key === p.parent).name : null]);
const rows = (r) => r.items.map((it) => [r.places.find((p) => p.key === it.place)?.name ?? null, it.description, it.quantity, it.unit, it.unitPrice, it.priceSource]);

const OWNER = 'קומה 24, דירה 48, דירה 49, דירה 50. בכל דירה צריך לפרק את הריצוף הקיים, 40 מטר לפי 200 שקל למטר, ולהרכיב ריצוף חדש. ההרכבה רק, הלקוח מביא את החומר, הרכבה לפי 400 שקל למטר.';
const APTS = [pl('a', 'apartment', 'דירה 48', null, 'דירה 48'), pl('b', 'apartment', 'דירה 49', null, 'דירה 49'), pl('c', 'apartment', 'דירה 50', null, 'דירה 50')];
const DISMANTLE = (place, o = {}) => line({ description: 'פירוק ריצוף קיים', evidence: 'לפרק את הריצוף הקיים, 40 מטר', quantity: 40, unit: 'm2', quantityBasis: 'stated', place, ...o });
const INSTALL = (place, o = {}) => line({ description: 'הרכבת ריצוף חדש', evidence: 'ולהרכיב ריצוף חדש. ההרכבה רק, הלקוח מביא את החומר, הרכבה לפי 400 שקל למטר', unit: 'm2', place, ...o });
const EXPECT_TREE = [['קומה 24', 'floor', null], ['דירה 48', 'apartment', 'קומה 24'], ['דירה 49', 'apartment', 'קומה 24'], ['דירה 50', 'apartment', 'קומה 24']];
const EXPECT_ROWS = ['דירה 48', 'דירה 49', 'דירה 50'].flatMap((apt) => [[apt, 'פירוק ריצוף קיים', 40, 'm2', 200, 'description'], [apt, 'הרכבת ריצוף חדש', 40, 'm2', 400, 'description']]);
const sorted = (r) => rows(r).sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(y[1]).localeCompare(String(x[1])));

describe("the Owner's text - every way the model may answer it gives the floor, three apartments and both works with quantity and price in each", () => {
  it('the model as in the video: no floor, the work listed in each apartment (only the first verifiable)', () => {
    const r = P(OWNER, { places: APTS, items: [DISMANTLE('a'), INSTALL('a'), DISMANTLE('b'), INSTALL('b'), DISMANTLE('c'), INSTALL('c')] });
    expect(tree(r)).toEqual(EXPECT_TREE);
    expect(sorted(r)).toEqual(EXPECT_ROWS);
    expect(r.items.every((it) => it.quantityBasis === 'stated' && !it.missing)).toBe(true);
  });
  it('the model lists the work in apartment 48 only', () => {
    const r = P(OWNER, { places: APTS, items: [DISMANTLE('a'), INSTALL('a')] });
    expect(tree(r)).toEqual(EXPECT_TREE);
    expect(sorted(r)).toEqual(EXPECT_ROWS);
  });
  it('the model nests the apartments under the floor and lists the work once under the floor', () => {
    const r = P(OWNER, { places: [pl('f', 'floor', 'קומה 24', null, 'קומה 24'), ...APTS.map((p) => ({ ...p, parent: 'f' }))], items: [DISMANTLE('f'), INSTALL('f')] });
    expect(tree(r)).toEqual(EXPECT_TREE);
    expect(sorted(r)).toEqual(EXPECT_ROWS);
  });
  it('the model gives the floor but leaves the apartments at the top, the work with no place', () => {
    const r = P(OWNER, { places: [pl('f', 'floor', 'קומה 24', null, 'קומה 24'), ...APTS], items: [DISMANTLE(null), INSTALL(null)] });
    expect(tree(r)).toEqual(EXPECT_TREE);
    expect(sorted(r)).toEqual(EXPECT_ROWS);
  });
  it('the install line with short evidence: the quantity of the same sentence, no price (none written in its clause)', () => {
    const r = P(OWNER, { places: APTS, items: [DISMANTLE('a'), line({ description: 'הרכבת ריצוף חדש', evidence: 'ולהרכיב ריצוף חדש', unit: 'm2', place: 'a' })] });
    const inst = r.items.filter((it) => it.description === 'הרכבת ריצוף חדש');
    expect(inst).toHaveLength(3);
    expect(inst.every((it) => it.quantity === 40 && it.unit === 'm2')).toBe(true);
  });
  it('the prompt tells the model about the floor and "in each"', () => {
    const sys = buildDraftMessages({ description: OWNER, isHebrew: true, catalog: [], structure: true, tree: true })[0].content;
    expect(sys).toContain('is a place of kind "floor" and the parent of each of them');
    expect(sys).toContain('list that work once for EACH of those places');
  });
});

describe('the other structures - "in each" with rooms, English, counted identical places, own work before "each", flat', () => {
  it('"בכל חדר" with the rooms of one apartment', () => {
    const text = 'דירה 12 עם סלון, מטבח וחדר שינה. בכל חדר צביעה 30 מ״ר לפי 25 שקל למטר';
    const r = P(text, { places: [pl('a', 'apartment', 'דירה 12', null, 'דירה 12'), pl('r1', 'room', 'סלון', 'a', 'סלון'), pl('r2', 'room', 'מטבח', 'a', 'מטבח'), pl('r3', 'room', 'חדר שינה', 'a', 'חדר שינה')],
      items: [line({ description: 'צביעה', evidence: 'צביעה 30 מ״ר', quantity: 30, unit: 'm2', quantityBasis: 'stated', place: 'r1' })] });
    expect(rows(r)).toEqual([['סלון', 'צביעה', 30, 'm2', 25, 'description'], ['מטבח', 'צביעה', 30, 'm2', 25, 'description'], ['חדר שינה', 'צביעה', 30, 'm2', 25, 'description']]);
  });
  it('English: "Floor 3, apartment 5 and apartment 6. In each apartment ..." - the floor over both, the work and price in each', () => {
    const text = 'Floor 3, apartment 5 and apartment 6. In each apartment remove the old tiles, 20 m² at $15 per sq m';
    const r = P(text, { places: [pl('a', 'apartment', 'apartment 5', null, 'apartment 5'), pl('b', 'apartment', 'apartment 6', null, 'apartment 6')],
      items: [line({ description: 'Tile removal', evidence: 'remove the old tiles, 20 m²', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'a' })] }, false);
    expect(tree(r)).toEqual([['Floor 3', 'floor', null], ['apartment 5', 'apartment', 'Floor 3'], ['apartment 6', 'apartment', 'Floor 3']]);
    expect(rows(r)).toEqual([['apartment 5', 'Tile removal', 20, 'm2', 15, 'description'], ['apartment 6', 'Tile removal', 20, 'm2', 15, 'description']]);
  });
  it('a place\'s own work written before "בכל דירה" stays its own; only the work after it is copied', () => {
    const text = 'דירה 32: ריצוף 20 מ״ר. דירה 33: ריצוף 25 מ״ר. בכל דירה גם צביעה 50 מ״ר';
    const r = P(text, { places: [pl('a', 'apartment', 'דירה 32', null, 'דירה 32'), pl('b', 'apartment', 'דירה 33', null, 'דירה 33')],
      items: [line({ description: 'ריצוף', evidence: 'ריצוף 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
        line({ description: 'ריצוף', evidence: 'ריצוף 25 מ״ר', quantity: 25, unit: 'm2', quantityBasis: 'stated', place: 'b' }),
        line({ description: 'צביעה', evidence: 'צביעה 50 מ״ר', quantity: 50, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(rows(r).map((x) => x.slice(0, 3))).toEqual([['דירה 32', 'ריצוף', 20], ['דירה 33', 'ריצוף', 25], ['דירה 32', 'צביעה', 50], ['דירה 33', 'צביעה', 50]]);
  });
  it('"שתי דירות זהות, בכל אחת" (counted) keeps today\'s answer: דירה 1 + דירה 2, the line in each', () => {
    const r = P('שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר', { places: [pl('a', 'apartment', '', null, 'שתי דירות זהות', { count: 2, identical: 'yes' })],
      items: [line({ description: 'ריצוף', evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(r.places.map((p) => p.name)).toEqual(['דירה 1', 'דירה 2']);
    expect(r.items.map((it) => it.quantity)).toEqual([12, 12]);
  });
  it('named apartments without "each": nothing is copied, each keeps its own work', () => {
    const r = P('דירה 32: ריצוף סלון 20 מ״ר. דירה 33: צביעה 40 מ״ר', { places: [pl('a', 'apartment', 'דירה 32', null, 'דירה 32'), pl('b', 'apartment', 'דירה 33', null, 'דירה 33')],
      items: [line({ description: 'ריצוף סלון', evidence: 'ריצוף סלון 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
        line({ description: 'צביעה', evidence: 'צביעה 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated', place: 'b' })] });
    expect(rows(r).map((x) => x.slice(0, 3))).toEqual([['דירה 32', 'ריצוף סלון', 20], ['דירה 33', 'צביעה', 40]]);
  });
  it('a floor the text does not name is never added; a floor with no place after it adds nothing', () => {
    const r = P('דירה 32: צביעה 40 מ״ר', { places: [pl('a', 'apartment', 'דירה 32', null, 'דירה 32')], items: [line({ description: 'צביעה', evidence: 'צביעה 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(tree(r)).toEqual([['דירה 32', 'apartment', null]]);
    const r2 = P('צביעת חדר מדרגות בקומה 3, 40 מ״ר', { places: [], items: [line({ description: 'צביעת חדר מדרגות', evidence: 'צביעת חדר מדרגות בקומה 3, 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' })] });
    expect(r2.places).toEqual([]);
  });
  it('a price after the quantity in a plain quote (no places)', () => {
    const r = P('ריצוף 40 מ״ר לפי 120 שקל למטר ופירוק אסלה', { places: [], items: [line({ description: 'ריצוף', evidence: 'ריצוף 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'פירוק אסלה', evidence: 'פירוק אסלה', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' })] });
    expect(rows(r)).toEqual([[null, 'ריצוף', 40, 'm2', 120, 'description'], [null, 'פירוק אסלה', 1, 'unit', null, 'none']]);
  });
  it('another job is never given a shared quantity: "ריצוף 40 מ״ר ותיקון סדקים" leaves the cracks without a quantity', () => {
    const r = P('דירה 5: ריצוף 40 מ״ר ותיקון סדקים', { places: [pl('a', 'apartment', 'דירה 5', null, 'דירה 5')], items: [line({ description: 'ריצוף', evidence: 'ריצוף 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
      line({ description: 'תיקון סדקים', evidence: 'תיקון סדקים', place: 'a' })] });
    expect(r.items[1].quantity).toBe(null);
  });
  it('a price written for one work never goes to the next work ("40 מ״ר, ולהרכיב ... 400 למטר" keeps 400 for the install)', () => {
    const r = P('פירוק ריצוף 40 מ״ר, הרכבת ריצוף חדש לפי 400 שקל למטר', { places: [], items: [line({ description: 'פירוק ריצוף', evidence: 'פירוק ריצוף 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'הרכבת ריצוף חדש', evidence: 'הרכבת ריצוף חדש לפי 400 שקל למטר', unit: 'm2' })] });
    expect(r.items[0].unitPrice).toBe(null);
    expect(r.items[1].unitPrice).toBe(400);
  });
});
