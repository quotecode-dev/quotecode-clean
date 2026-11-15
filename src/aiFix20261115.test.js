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
  it('"שתי דירות זהות, בכל אחת" (counted): דירה 1 + דירה 2, the kitchen (written for the work) inside each, the line in each', () => {
    const r = P('שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר', { places: [pl('a', 'apartment', '', null, 'שתי דירות זהות', { count: 2, identical: 'yes' })],
      items: [line({ description: 'ריצוף', evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'a' })] });
    expect(r.places.map((p) => p.name)).toEqual(['דירה 1', 'מטבח', 'דירה 2', 'מטבח']);
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

// 2026-11-15 round 2 (Owner typed "מאשר סבב תיקון שני ... לפי 7 הסעיפים" + the price decision): the model answers SEEN on LIVE in the 8 examples
describe('round 2 - the answers the real model gave on LIVE', () => {
  it('example 3: "שלוש דירות זהות, בכל אחת מטבח ושירותים" - the model gave no places and every line 3 times: 3 apartments, kitchen + toilets in each', () => {
    const text = 'שלוש דירות זהות, בכל אחת מטבח ושירותים. במטבח ריצוף 12 מ״ר, בשירותים החלפת אסלה והחלפת אינטרפוץ.';
    const three = (o) => [line(o), line({ ...o, evidence: '' }), line({ ...o, evidence: '' })];
    const r = P(text, { places: [], items: [...three({ description: 'ריצוף', evidence: 'במטבח ריצוף 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated' }),
      ...three({ description: 'החלפת אסלה', evidence: 'בשירותים החלפת אסלה', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' }),
      ...three({ description: 'החלפת אינטרפוץ', evidence: 'והחלפת אינטרפוץ', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' })] });
    expect(r.places.filter((p) => p.kind === 'apartment').map((p) => p.name)).toEqual(['דירה 1', 'דירה 2', 'דירה 3']);
    expect(r.items).toHaveLength(9);
    const apt = (it) => { let p = r.places.find((q) => q.key === it.place); while (p && p.kind !== 'apartment') p = r.places.find((q) => q.key === p.parent); return p?.name; };
    expect(['דירה 1', 'דירה 2', 'דירה 3'].map((a) => r.items.filter((it) => apt(it) === a).map((it) => [it.description, it.quantity]))).toEqual(Array(3).fill([['ריצוף', 12], ['החלפת אסלה', 1], ['החלפת אינטרפוץ', 1]]));
    expect(r.items.filter((it) => it.description === 'ריצוף').every((it) => r.places.find((p) => p.key === it.place).name === 'מטבח')).toBe(true);
  });
  it('example 4: rooms written for the works become headings inside דירה 7; "1200 ש״ח לכל העבודה" is one price for the whole job', () => {
    const text = 'דירה 7: בסלון ריצוף 30 מ״ר לפי 150 ש״ח למטר, בחדר השינה פרקט 14 מ״ר לפי 220 ש״ח למטר. בנוסף פינוי פסולת 1200 ש״ח לכל העבודה.';
    const r = P(text, { places: [pl('a', 'apartment', 'דירה 7', null, 'דירה 7')], items: [
      line({ description: 'ריצוף', evidence: 'בסלון ריצוף 30 מ״ר', quantity: 30, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
      line({ description: 'פרקט', evidence: 'בחדר השינה פרקט 14 מ״ר', quantity: 14, unit: 'm2', quantityBasis: 'stated', place: 'a' }),
      line({ description: 'פינוי פסולת', evidence: 'פינוי פסולת 1200 ש״ח לכל העבודה', place: 'a' })] });
    expect(tree(r)).toEqual([['דירה 7', 'apartment', null], ['סלון', 'room', 'דירה 7'], ['חדר השינה', 'room', 'דירה 7']].map((x, i) => (i === 2 ? ['חדר שינה', 'room', 'דירה 7'] : x)));
    expect(rows(r)).toEqual([['סלון', 'ריצוף', 30, 'm2', 150, 'description'], ['חדר שינה', 'פרקט', 14, 'm2', 220, 'description'], ['דירה 7', 'פינוי פסולת', 1, 'unit', 1200, 'description']]);
  });
  it('example 6: "2 בסלון ו-1 בכל אחד משני חדרי השינה, 3500 ש״ח למזגן" - חדר שינה 1/2, quantities 2/1/1, the written price wins over the catalog', () => {
    const text = 'התקנת 4 מזגנים: 2 בסלון ו-1 בכל אחד משני חדרי השינה, 3500 ש״ח למזגן כולל צנרת.';
    const catalog = [{ id: 'c1', name: 'התקנת מזגן', price: 1200 }];
    const r = P(text, { places: [pl('s', 'room', 'סלון', null, 'סלון'), pl('r1', 'room', 'חדר 1', null, 'חדרי השינה'), pl('r2', 'room', 'חדר 2', null, 'חדרי השינה')], items: [
      line({ description: 'התקנת מזגן', evidence: 'התקנת 4 מזגנים: 2 בסלון', quantity: 2, unit: 'unit', quantityBasis: 'stated', place: 's', catalogId: 'c1' }),
      line({ description: 'התקנת מזגן', evidence: '1 בכל אחד משני חדרי השינה, 3500 ש״ח למזגן', quantity: 1, unit: 'unit', quantityBasis: 'stated', place: 'r1', catalogId: 'c1' }),
      line({ description: 'התקנת מזגן', evidence: '1 בכל אחד משני חדרי השינה, 3500 ש״ח למזגן', quantity: 1, unit: 'unit', quantityBasis: 'stated', place: 'r2', catalogId: 'c1' })] }, true, catalog);
    expect(r.places.map((p) => p.name)).toEqual(['סלון', 'חדר שינה 1', 'חדר שינה 2']);
    expect(rows(r).map((x) => [x[0], x[2]])).toEqual([['סלון', 2], ['חדר שינה 1', 1], ['חדר שינה 2', 1]]);
    expect(r.items.filter((it) => it.unitPrice === 3500 && it.priceSource === 'description').length).toBeGreaterThanOrEqual(2);
  });
  it('example 7 (EN): the model gave no places and every line 3 times - the floors and apartments from the text, both works in each apartment', () => {
    const text = 'Two floors. Floor 1: apartment 1A and apartment 1B. Floor 2: apartment 2A. In each apartment replace 6 outlets at $45 each and paint 80 sq ft of walls at $3 per sq ft.';
    const three = (o) => [line(o), line({ ...o, evidence: '' }), line({ ...o, evidence: '' })];
    const r = P(text, { places: [], items: [...three({ description: 'Outlet replacement', evidence: 'replace 6 outlets at $45 each', quantity: 6, unit: 'unit', quantityBasis: 'stated' }),
      ...three({ description: 'Wall painting', evidence: 'paint 80 sq ft of walls at $3 per sq ft', quantity: 80, unit: 'sq_ft', quantityBasis: 'stated' })] }, false);
    expect(tree(r)).toEqual([['Floor 1', 'floor', null], ['apartment 1A', 'apartment', 'Floor 1'], ['apartment 1B', 'apartment', 'Floor 1'], ['Floor 2', 'floor', null], ['apartment 2A', 'apartment', 'Floor 2']]);
    expect(sorted(r).filter((x) => x[1] === 'Outlet replacement').map((x) => [x[0], x[2], x[4]])).toEqual([['apartment 1A', 6, 45], ['apartment 1B', 6, 45], ['apartment 2A', 6, 45]]);
    expect(sorted(r).filter((x) => x[1] === 'Wall painting').map((x) => [x[0], x[2], x[4]])).toEqual([['apartment 1A', 80, 3], ['apartment 1B', 80, 3], ['apartment 2A', 80, 3]]);
  });
  it('example 8 (EN): "Install quartz countertop" keeps its own 30 sq ft although "install" is also in another line', () => {
    const text = 'Kitchen remodel: remove the old cabinets, install 12 linear ft of new cabinets at $250 per linear ft, and a quartz countertop of 30 sq ft at $70 per sq ft.';
    const r = P(text, { places: [], items: [line({ description: 'Remove old cabinets', evidence: 'remove the old cabinets' }),
      line({ description: 'Install new cabinets', evidence: 'install 12 linear ft of new cabinets', quantity: 12, unit: 'linear_ft', quantityBasis: 'stated' }),
      line({ description: 'Install quartz countertop', evidence: 'a quartz countertop of 30 sq ft', quantity: 30, unit: 'sq_ft', quantityBasis: 'stated' })] }, false);
    expect(rows(r).map((x) => [x[1], x[2], x[4]])).toEqual([['Remove old cabinets', null, null], ['Install new cabinets', 12, 250], ['Install quartz countertop', 30, 70]]);
  });
  // the exact answers of the real model on LIVE 2026-11-15 (diagnostics of the test account)
  it('LIVE example 7 (EN): long keys "apartment_1A"/"apartment_1B" and place/line evidence written in Hebrew - every apartment keeps its own lines', () => {
    const text = 'Two floors. Floor 1: apartment 1A and apartment 1B. Floor 2: apartment 2A. In each apartment replace 6 outlets at $45 each and paint 80 sq ft of walls at $3 per sq ft.';
    const apts = ['apartment_1A', 'apartment_1B', 'apartment_2A'];
    const r = P(text, { places: [pl('floor_1', 'floor', 'Floor 1', null, 'קומה 1: דירה 1A ודירה 1B'), pl('apartment_1A', 'apartment', 'apartment 1A', 'floor_1', 'דירה 1A'), pl('apartment_1B', 'apartment', 'apartment 1B', 'floor_1', 'דירה 1B'),
      pl('floor_2', 'floor', 'Floor 2', null, 'קומה 2: דירה 2A'), pl('apartment_2A', 'apartment', 'apartment 2A', 'floor_2', 'דירה 2A')],
    items: [...apts.map((place) => line({ description: 'Outlet replacement', evidence: 'בכל דירה להחליף 6 שקעים', quantity: 6, unit: 'unit', quantityBasis: 'stated', place })),
      ...apts.map((place) => line({ description: 'Wall painting', evidence: 'בכל דירה לצבוע 80 רגל רבוע קירות', quantity: 80, unit: 'sq_ft', quantityBasis: 'stated', place }))] }, false);
    expect(tree(r)).toEqual([['Floor 1', 'floor', null], ['apartment 1A', 'apartment', 'Floor 1'], ['apartment 1B', 'apartment', 'Floor 1'], ['Floor 2', 'floor', null], ['apartment 2A', 'apartment', 'Floor 2']]);
    expect(sorted(r).map((x) => [x[0], x[1], x[2], x[4]])).toEqual(['apartment 1A', 'apartment 1B', 'apartment 2A'].flatMap((a) => [[a, 'Wall painting', 80, 3], [a, 'Outlet replacement', 6, 45]]));
    // law 49: the model's quote was translated - the window still shows the user's OWN words around the number (as the Hebrew one does)
    expect(r.items.map((it) => it.evidence)).toEqual([...Array(3).fill('In each apartment replace 6 outlets at $45 each'), ...Array(3).fill('paint 80 sq ft of walls at $3 per sq ft')]);
    for (const it of r.items) expect(text.includes(it.evidence)).toBe(true);
  });
  it('LIVE example 10 (EN): the lines name their place by NAME ("apartment 48" for key "p2") - the floor, three apartments, both works with their prices in each', () => {
    const text = 'Floor 24, apartment 48, apartment 49, apartment 50. In each apartment remove the existing tiles, 40 m² at $20 per sq m, and install new tiles. Installation only, the client brings the material, installation at $40 per sq m.';
    const names = ['apartment 48', 'apartment 49', 'apartment 50'];
    const r = P(text, { places: [pl('p1', 'floor', 'Floor 24', null, 'Floor 24'), ...names.map((n, i) => pl(`p${i + 2}`, 'apartment', n, 'p1', n, { identical: 'yes' }))],
      items: [...names.map((place) => line({ description: 'Remove existing tiles', evidence: 'In each apartment remove the existing tiles, 40 m²', quantity: 40, unit: 'm2', quantityBasis: 'stated', place })),
        ...names.map((place) => line({ description: 'Install new tiles', evidence: 'and install new tiles. Installation only, the client brings the material, installation at $40 per sq m.', quantity: 40, unit: 'm2', quantityBasis: 'stated', place }))] }, false);
    expect(tree(r)).toEqual([['Floor 24', 'floor', null], ['apartment 48', 'apartment', 'Floor 24'], ['apartment 49', 'apartment', 'Floor 24'], ['apartment 50', 'apartment', 'Floor 24']]);
    expect(sorted(r).map((x) => [x[0], x[1], x[2], x[4]])).toEqual(names.flatMap((a) => [[a, 'Remove existing tiles', 40, 20], [a, 'Install new tiles', 40, 40]]));
  });
});

describe('round 2 - "להוסיף לקטלוג?" and the diagnostics (source)', () => {
  it('the review window asks to add a priced product that is not in the catalog; the ticked ones are saved on "Add to the quote"', async () => {
    const fs = await import('node:fs');
    const d = fs.readFileSync('src/components/AiQuoteDraftDialog.jsx', 'utf8');
    expect(d).toContain("addToCatalog: 'להוסיף לקטלוג?'");
    expect(d).toContain("addToCatalog: 'Add to the catalog?'");
    expect(d).toContain("{typeof saveToCatalog === 'function' && !line.original.catalogName && line.unitPrice != null && (");
    expect(d).toContain('await saveToCatalog({ name: String(l.description).trim(), price: l.unitPrice, method: methodOf(l.unit), international });');
    expect(fs.readFileSync('src/pages/Dashboard.jsx', 'utf8')).toContain('saveToCatalog={saveQuoteRowToCatalog}');
  });
  it('the model\'s raw answer goes to the two test accounts only', async () => {
    const fs = await import('node:fs');
    const f = fs.readFileSync('supabase/functions/ai-quote-draft/index.ts', 'utf8');
    expect(f).toContain("const DIAGNOSTIC_ACCOUNTS = ['tekangoisrael@gmail.com', 'tekangointernational@gmail.com'];");
    expect(f).toContain('if (DIAGNOSTIC_ACCOUNTS.includes(userEmail))');
  });
});
