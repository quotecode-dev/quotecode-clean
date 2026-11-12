// Task 21: the AI quote-draft contract shared by the ai-quote-draft Edge Function and the dashboard dialog.
// Task 33 (contract v2): quantities / units of the user's text are invariants; a missing quantity stays visibly missing (never a silent 1);
// derived quantities only from numbers of the text; catalog price only with a verified price unit; unassigned measures are reported.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import {
  AI_QUOTE_DRAFT_CONTRACT_VERSION, MAX_DRAFT_ITEMS, DRAFT_RESPONSE_SCHEMA, validateDraftRequest, normalizeCatalog, buildDraftMessages, parseDraftModelOutput,
  sanitizeDraftResponse, extractMeasures, catalogNameUnit,
} from './aiQuoteDraft.js';

const CATALOG = [{ id: 7, name: 'חלון אלומיניום 120×100', price: 1450 }, { id: 9, name: 'רשת', price: '80' }, { id: 10, name: '   ', price: 5 }];
const OWNER = 'ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר, פירוק ריצוף קיים';
const line = (o) => ({ description: 'x', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, ...o });

describe('request validation - the browser sends only the job description', () => {
  it('accepts a trimmed description and drops every other field', () => {
    const r = validateDraftRequest({ description: '  החלפת 3 חלונות  ', userId: 'x', market: 'International', isHebrew: false });
    expect(r).toEqual({ ok: true, value: { description: 'החלפת 3 חלונות' } });
  });
  it('rejects non-objects, too short and too long descriptions', () => {
    expect(validateDraftRequest(null).ok).toBe(false);
    expect(validateDraftRequest([]).ok).toBe(false);
    expect(validateDraftRequest({ description: 'abc' }).reason).toBe('description_too_short');
    expect(validateDraftRequest({ description: 'x'.repeat(2001) }).reason).toBe('description_too_long');
  });
});

describe('prompt - catalog names/ids only, never prices; language from the server market', () => {
  it('never puts a price into the model input and states the output contract', () => {
    const msgs = buildDraftMessages({ description: 'job', isHebrew: true, catalog: normalizeCatalog(CATALOG) });
    expect(msgs[0].content).toContain('Hebrew');
    // release B (Owner 2026-11-06): the ONLY price the model may return is one the request writes for an existing line (verified in the text)
    expect(msgs[0].content).toContain('Never output a price, except unitPrice in changes.updates as written in the request.');
    expect(msgs[0].content).toContain('Never use 1 or a sum of other items as a guess');
    expect(msgs[1].content).not.toMatch(/1450|price/);
    expect(JSON.parse(msgs[1].content).catalog).toEqual([{ id: '7', name: 'חלון אלומיניום 120×100' }, { id: '9', name: 'רשת' }]);
    expect(buildDraftMessages({ description: 'job', isHebrew: false, catalog: [] })[0].content).toContain('English');
  });
  it('the provider schema is strict and carries unit / basis / missing per line - no price field at all', () => {
    expect(DRAFT_RESPONSE_SCHEMA.strict).toBe(true);
    const props = DRAFT_RESPONSE_SCHEMA.schema.properties.items.items.properties;
    expect(Object.keys(props).sort()).toEqual(['catalogId', 'derivation', 'description', 'evidence', 'missing', 'quantity', 'quantityBasis', 'unit']);
    // a NEW line never carries a price, total, VAT or discount; release B: only changes carry the user-written price / discount
    expect(JSON.stringify(DRAFT_RESPONSE_SCHEMA.schema.properties.items)).not.toMatch(/price|total|"vat|discount/i);
    expect(JSON.stringify({ ...DRAFT_RESPONSE_SCHEMA.schema.properties, changes: undefined })).not.toMatch(/price|total|"vat|discount/i);
    expect(Object.keys(DRAFT_RESPONSE_SCHEMA.schema.properties.changes.properties).sort()).toEqual(['deletes', 'discountPercent', 'notes', 'updates']);
  });
});

describe('numbers and units of the user text', () => {
  it('reads decimals, decimal commas, thousands and the unit written after the number (HE / EN)', () => {
    expect(extractMeasures(OWNER).map((m) => [m.value, m.unit, m.text])).toEqual([[40, 'm2', '40 מ״ר'], [22, 'm2', '22 מ״ר']]);
    expect(extractMeasures('12,5 מ"ר, 3 שעות, 2 ימי עבודה, 7.5 מטר אורך, 15 ק״ג').map((m) => [m.value, m.unit]))
      .toEqual([[12.5, 'm2'], [3, 'hour'], [2, 'day'], [7.5, 'linear_meter'], [15, 'kg']]);
    // Owner 2026-11-05 (L-17): sq ft is a unit of its own now
    expect(extractMeasures('1,200 sq ft deck and 35.5 m2 patio, 4 hours').map((m) => [m.value, m.unit])).toEqual([[1200, 'sq_ft'], [35.5, 'm2'], [4, 'hour']]);
  });
});

describe('Owner 2026-11-05 ("מאשר מספרים במילים ויחידות רגל מלאות לשוק הבינלאומי, כולל שינוי ב-L-09, L-14, L-15 ו-L-17")', () => {
  const read = (t) => extractMeasures(t).filter((m) => m.kind === 'number').map((m) => [m.value, m.unit]);
  it('a whole number phrase in Hebrew words is one number, with the unit said after it', () => {
    expect(read('צבע לכל הדירה, שמונים וחמש מטר. ריצוף חדש במטבח, שנים עשר מטר.')).toEqual([[85, 'meter'], [12, 'meter']]);
    expect(read('שלוש מאות ועשרים מטר רבוע')).toEqual([[320, 'm2']]);
    expect(read('מאה ועשר')).toEqual([[110, null]]);
    expect(read('אלף ומאתיים')).toEqual([[1200, null]]);
    expect(read('עשרים אלף')).toEqual([[20000, null]]);
    expect(read('חמש עשרה שעות')).toEqual([[15, 'hour']]);
    expect(read('שתיים וחצי ימי עבודה')).toEqual([[2.5, 'day']]);
  });
  it('the same in English words', () => {
    expect(read('eighty-five linear feet')).toEqual([[85, 'linear_ft']]);
    expect(read('two hundred and fifty sq ft')).toEqual([[250, 'sq_ft']]);
    expect(read('one hundred ten hours')).toEqual([[110, 'hour']]);
    expect(read('a thousand square feet')).toEqual([[1000, 'sq_ft']]);
    expect(read('one and a half days')).toEqual([[1.5, 'day']]);
  });
  it('two separate numbers are never glued into one', () => {
    expect(read('five six rooms')).toEqual([[5, null], [6, null]]);
    expect(read('עשרים חמש')).toEqual([[20, null], [5, null]]);
  });
  it('feet units: sq ft, linear ft, a foot length and an inch (HE / EN)', () => {
    expect(read('900 square feet, 40 linear ft, 12 ft, 6 inches')).toEqual([[900, 'sq_ft'], [40, 'linear_ft'], [12, 'foot'], [6, 'inch']]);
    expect(read('250 רגל רבועה, 30 רגל אורך')).toEqual([[250, 'sq_ft'], [30, 'linear_ft']]);
    expect(['Deck per sq ft', 'Fence / linear ft', 'ריצוף לרגל רבועה', 'Tiling per m2'].map(catalogNameUnit)).toEqual(['sq_ft', 'linear_ft', 'sq_ft', 'm2']);
  });
  it('a dictated phrase in words is verified exactly like digits (the Owner\'s video sentence)', () => {
    const desc = 'תכין לי הצעה לשיפוץ דירת שלושה חדרים: צבע לכל הדירה, שמונים וחמש מטר. ריצוף חדש במטבח, שנים עשר מטר. ופירוק והרכבה של ארון מטבח.';
    const r = parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], items: [
      line({ description: 'צבע לכל הדירה', evidence: 'צבע לכל הדירה, שמונים וחמש מטר', quantity: 85, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'ריצוף חדש במטבח', evidence: 'ריצוף חדש במטבח, שנים עשר מטר', quantity: 12, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'פירוק והרכבה של ארון מטבח', evidence: 'פירוק והרכבה של ארון מטבח', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' }),
    ] }), [], desc);
    // a bare "מטר" said for an area job stays square meters; nothing is "unverified"
    expect(r.items.map((i) => [i.quantity, i.unit, i.quantityBasis, i.missing])).toEqual([[85, 'm2', 'stated', null], [12, 'm2', 'stated', null], [1, 'unit', 'implied_single', null]]);
  });
  it('an explicit running meter stays a length; a bare meter the model read as a length stays a length', () => {
    const r = parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], items: [
      line({ description: 'פנלים', evidence: 'פנלים 12 מטר אורך', quantity: 12, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'כבל', evidence: 'כבל 30 מטר', quantity: 30, unit: 'linear_meter', quantityBasis: 'stated' }),
    ] }), [], 'פנלים 12 מטר אורך, כבל 30 מטר');
    expect(r.items.map((i) => i.unit)).toEqual(['linear_meter', 'linear_meter']);
  });
  it('feet x feet = sq ft; a meter and a foot never multiply', () => {
    const ok = parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], items: [
      line({ description: 'New deck', evidence: 'New deck 10 x 12 ft', quantity: 120, unit: 'sq_ft', quantityBasis: 'derived', derivation: '10 × 12' })] }), [], 'New deck 10 x 12 ft');
    expect(ok.items[0]).toMatchObject({ quantity: 120, unit: 'sq_ft', quantityBasis: 'derived', derivation: '10 × 12' });
    const mixed = parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], items: [
      line({ description: 'Deck', evidence: 'Deck 3 m by 10 ft', quantity: 30, unit: 'sq_ft', quantityBasis: 'derived', derivation: '3 × 10' })] }), [], 'Deck 3 m by 10 ft');
    expect(mixed.items[0]).toMatchObject({ quantity: null, missing: 'unverified' });
    const metricAsFeet = parseDraftModelOutput(JSON.stringify({ subject: 's', questions: [], items: [
      line({ description: 'Wall', evidence: 'Wall 4 x 2.5 m', quantity: 10, unit: 'sq_ft', quantityBasis: 'derived', derivation: '4 × 2.5' })] }), [], 'Wall 4 x 2.5 m');
    expect(metricAsFeet.items[0]).toMatchObject({ quantity: null, missing: 'unverified' });
  });
  it('the model may return the feet units', () => {
    expect(DRAFT_RESPONSE_SCHEMA.schema.properties.items.items.properties.unit.enum).toEqual(expect.arrayContaining(['sq_ft', 'linear_ft']));
    expect(buildDraftMessages({ description: 'job', isHebrew: false, catalog: [] })[0].content).toMatch(/never convert feet to meters/);
  });
  it('a Hebrew word that only starts like a unit is not a unit ("40 מרפסות" is not 40 m²)', () => {
    expect(extractMeasures('40 מרפסות, 3 שעונים, 2 יומנים').map((m) => m.unit)).toEqual([null, null, null]);
  });
  it('the price unit a catalog NAME declares', () => {
    expect(['ריצוף למ״ר', 'ריצוף מרפסת', 'Tiling per m2', 'עבודה לשעה', 'Labour hourly', 'צבע', 'הובלה ליום'].map(catalogNameUnit))
      .toEqual(['m2', null, 'm2', 'hour', 'hour', null, 'day']);
  });
});

describe('model output validation (Owner example: ריצוף 40 / 22 מ״ר + פירוק without an area)', () => {
  const ownerOutput = (extra = {}) => ({ subject: 'ריצוף', questions: ['מה שטח הריצוף לפירוק?'], items: [
    line({ description: 'ריצוף חדר הורים 40 מ״ר', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 40, unit: 'm2', quantityBasis: 'stated', catalogId: null }),
    line({ description: 'ריצוף חדר ילדים', evidence: 'ריצוף חדר ילדים 22 מ״ר', quantity: 22, unit: 'm2', quantityBasis: 'stated' }),
    line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים', quantity: 62, unit: 'm2', quantityBasis: 'derived', derivation: '40 + 22' }),
  ], ...extra });

  it('keeps 40 m² and 22 m² on their rooms, strips the repeated measure, and never invents the dismantling area (no 62, no 1)', () => {
    const r = parseDraftModelOutput(ownerOutput(), [], OWNER);
    expect(r.ok).toBe(true);
    expect(r.items.map((i) => [i.description, i.quantity, i.unit, i.quantityBasis])).toEqual([
      ['ריצוף חדר הורים', 40, 'm2', 'stated'],
      ['ריצוף חדר ילדים', 22, 'm2', 'stated'],
      ['פירוק ריצוף קיים', null, 'm2', 'missing'],
    ]);
    expect(r.items[2].missing).toBe('unverified'); // Task 34: a derivation not provable from its own evidence is an unverified gap
    expect(r.questions).toEqual(['מה שטח הריצוף לפירוק?']);
    expect(r.unassignedMeasures).toEqual([]);
    expect(r.items.every((i) => i.unitPrice === null && i.priceSource === 'none')).toBe(true);
  });

  it('a "stated" quantity that is not in the text, or a silent 1, becomes a visible gap', () => {
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'ריצוף חדר הורים', evidence: 'ריצוף חדר הורים 40 מ״ר', quantity: 45, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים', quantity: 1, unit: 'm2', quantityBasis: 'stated' }),
    ] }, [], OWNER);
    expect(r.items.map((i) => [i.quantity, i.quantityBasis, i.missing])).toEqual([[null, 'missing', 'unverified'], [null, 'missing', 'unverified']]);
    expect(r.unassignedMeasures).toEqual(['40 מ״ר', '22 מ״ר']);
  });

  it('a derived quantity needs a shown multiplication of numbers of the text whose product matches', () => {
    const text = 'צביעת קיר 4 על 2.5 מטר, טיח לקיר 3x2';
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'צביעת קיר', evidence: 'צביעת קיר 4 על 2.5 מטר', quantity: 10, unit: 'm2', quantityBasis: 'derived', derivation: '4 × 2.5' }),
      line({ description: 'טיח', evidence: 'טיח לקיר 3x2', quantity: 7, unit: 'm2', quantityBasis: 'derived', derivation: '3 × 2' }),
      line({ description: 'שפכטל', evidence: 'טיח לקיר 3x2', quantity: 6, unit: 'm2', quantityBasis: 'derived', derivation: '3 × 2' }),
      line({ description: 'ניקיון', evidence: 'צביעת קיר 4 על 2.5 מטר', quantity: 20, unit: 'm2', quantityBasis: 'derived', derivation: '4 × 5' }),
    ] }, [], text);
    expect(r.items.map((i) => [i.quantity, i.quantityBasis, i.derivation])).toEqual([[10, 'derived', '4 × 2.5'], [null, 'missing', null], [null, 'missing', null], [null, 'missing', null]]); // the 3rd reuses a span another line holds
  });

  it('implied single piece only as quantity 1 of countable units; decimals stay decimals', () => {
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'התקנת מזגן', evidence: 'התקנת מזגן', quantity: 1, unit: null, quantityBasis: 'implied_single' }),
      line({ description: 'ריצוף מרפסת', evidence: 'ריצוף מרפסת', quantity: 1, unit: 'm2', quantityBasis: 'implied_single' }),
      line({ description: 'פרקט', evidence: 'פרקט 12,5 מ״ר', quantity: '12,5', unit: 'm2', quantityBasis: 'stated' }),
    ] }, [], 'התקנת מזגן וריצוף מרפסת, פרקט 12,5 מ״ר');
    expect(r.items.map((i) => [i.quantity, i.unit, i.quantityBasis])).toEqual([[1, 'unit', 'implied_single'], [null, 'm2', 'missing'], [12.5, 'm2', 'stated']]);
  });

  it('binds a catalog price ONLY for the caller own row of the same product with a verified price unit', () => {
    const catalog = [{ id: 1, name: 'ריצוף למ״ר', price: 120 }, { id: 2, name: 'ריצוף', price: 3500 }, { id: 3, name: 'צביעה', price: 900 }, { id: 4, name: 'חלון אלומיניום', price: 1450 }];
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', quantityBasis: 'stated', catalogId: '1' }), // m² row: verified
      line({ description: 'ריצוף חדר ילדים', quantity: 22, unit: 'm2', quantityBasis: 'stated', catalogId: '2' }), // "per item" row on an area: unverified
      line({ description: 'פירוק ריצוף קיים', quantity: null, unit: 'm2', quantityBasis: 'missing', catalogId: '3' }), // not the same product
      line({ description: 'חלון אלומיניום', quantity: 3, unit: 'unit', quantityBasis: 'stated', catalogId: '4' }), // count row: verified
      line({ description: 'invented id', quantity: null, quantityBasis: 'missing', catalogId: '12345' }),
    ] }, catalog, `${OWNER}, 3 חלונות אלומיניום`);
    expect(r.items.map((i) => [i.unitPrice, i.priceSource, i.catalogId])).toEqual([
      [120, 'catalog', 1], [null, 'catalog_unit_unverified', 2], [null, 'none', null], [1450, 'catalog', 4], [null, 'none', null],
    ]);
    expect(r.items[0].catalogName).toBe('ריצוף למ״ר');
  });

  it('the same-product guard accepts word forms ("Tile" / "Tiling per m2" - live TEST finding) and still rejects an unrelated pick', () => {
    const catalog = [{ id: 1, name: 'Tiling per m2', price: 45 }, { id: 2, name: 'Window cleaning', price: 30 }];
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'Tile the master bedroom', quantity: 40, unit: 'm2', quantityBasis: 'stated', catalogId: '1' }),
      line({ description: 'Tile the kids room', quantity: 22, unit: 'm2', quantityBasis: 'stated', catalogId: '2' }),
    ] }, catalog, 'Tile the master bedroom 40 m2, tile the kids room 22 m2');
    expect(r.items.map((i) => [i.unitPrice, i.priceSource])).toEqual([[45, 'catalog'], [null, 'none']]);
  });

  it('a removed repeated quantity leaves no dangling connector behind (live TEST finding)', () => {
    const r = parseDraftModelOutput({ subject: '', questions: [], items: [
      line({ description: 'טיח בחדר הרחצה בשטח של 12.5 מ״ר', evidence: 'טיח 12.5 מ״ר בחדר הרחצה', quantity: 12.5, unit: 'm2', quantityBasis: 'stated' }),
      line({ description: 'עבודת חשמלאי במשך 4 שעות', evidence: '4 שעות עבודת חשמלאי', quantity: 4, unit: 'hour', quantityBasis: 'stated' }),
      line({ description: 'Electrician work for', evidence: 'צביעת 3 חדרים', quantity: 3, unit: 'unit', quantityBasis: 'stated' }),
    ] }, [], 'צביעת 3 חדרים, טיח 12.5 מ״ר בחדר הרחצה, 4 שעות עבודת חשמלאי');
    expect(r.items.map((i) => i.description)).toEqual(['טיח בחדר הרחצה', 'עבודת חשמלאי', 'Electrician work']);
  });

  it('caps the list, drops empty lines and fails closed on malformed or empty output', () => {
    const many = Array.from({ length: 30 }, (_, i) => line({ description: `line ${i}` }));
    expect(parseDraftModelOutput({ items: [line({ description: '   ' }), ...many] }, [], 'job').items).toHaveLength(MAX_DRAFT_ITEMS);
    expect(parseDraftModelOutput('not json', CATALOG)).toEqual({ ok: false, code: 'malformed' });
    expect(parseDraftModelOutput('{"items": "x"}', CATALOG)).toEqual({ ok: false, code: 'malformed' });
    expect(parseDraftModelOutput('{"items": []}', CATALOG)).toEqual({ ok: false, code: 'empty' });
  });
});

describe('browser re-check of the server response', () => {
  it('keeps only contract fields of a matching contract version; a missing basis never shows a quantity', () => {
    const d = sanitizeDraftResponse({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, subject: 's', questions: ['q?', 5], unassignedMeasures: ['22 מ״ר'], items: [
      { description: 'a', quantity: 2, unit: 'm2', quantityBasis: 'stated', unitPrice: '10', catalogId: 7, catalogName: 'A', priceSource: 'catalog', total: 999 },
      { description: 'b', quantity: 1, unit: 'bogus', quantityBasis: 'missing', unitPrice: null, priceSource: 'catalog' },
      { description: '' },
    ] });
    expect(d).toEqual({ subject: 's', questions: ['q?'], unassignedMeasures: ['22 מ״ר'], changes: { updates: [], deletes: [], notes: null, discountPercent: null }, items: [
      { description: 'a', quantity: 2, unit: 'm2', quantityBasis: 'stated', derivation: null, missing: null, evidence: null, unitPrice: 10, catalogId: 7, catalogName: 'A', priceSource: 'catalog' },
      { description: 'b', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, evidence: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none' },
    ] });
    expect(sanitizeDraftResponse({ contractVersion: 1, items: [{ description: 'a', quantity: 1 }] })).toBeNull();
    expect(sanitizeDraftResponse({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, items: [] })).toBeNull();
  });
});

describe('ai-quote-draft Edge Function source guards', () => {
  const src = fs.readFileSync(path.resolve(HERE, '../ai-quote-draft/index.ts'), 'utf8');
  const config = fs.readFileSync(path.resolve(HERE, '../../config.toml'), 'utf8');
  it('verifies the JWT in the gateway and in code, and reads with the caller JWT (RLS); the service role only finishes the usage meter', () => {
    expect(config).toMatch(/\[functions\.ai-quote-draft\]\r?\nenabled = true[\s\S]{0,400}?verify_jwt = true/);
    expect(src).toContain('caller.auth.getUser()');
    // Owner 2026-11-06 (the SMART PACK usage meter): the service-role client exists ONLY for smart_pack_usage_finish
    expect(src.match(/SERVICE_ROLE/g)).toHaveLength(1);
    expect([...src.matchAll(/\badmin\b/g)].length).toBe([...src.matchAll(/finishMeter\(admin,/g)].length + 1);
    expect(src).toMatch(/from\('services'\)\.select\('id, name, price'\)\.eq\('user_id', userId\)/);
    expect(src).toMatch(/from\('business_settings'\)\.select\('country'\)\.eq\('user_id', userId\)/);
  });
  it('is read-only: no insert/update/upsert/delete/rpc and no logging of the description', () => {
    expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(src).not.toMatch(/console\.(log|info|warn|error)/);
  });
  it('derives the language from business_settings.country only and refuses an unresolved market', () => {
    expect(src).toContain("const isHebrew = country === 'Local';");
    expect(src).toContain("'market_unresolved'");
    expect(src).not.toMatch(/body\.(isHebrew|language|market|userId)/);
  });
});

// Owner 2026-11-11 (finding 3, option ב): a price the user wrote goes to its line ("from your description"); a written quantity is kept
import { parseDraftModelOutput as parseOwnerPrices, extractMeasures as measuresOf } from './aiQuoteDraft.js';
describe('prices written in the description (Owner 2026-11-11)', () => {
  const text = 'התקנת 3 מזגנים 2500 כל אחד, ריצוף 40 מ"ר ב-120 למטר, פירוק ריצוף קיים';
  const item = (o) => ({ derivation: null, missing: null, catalogId: null, ...o });
  const raw = { subject: 'עבודות', questions: [], changes: { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null }, items: [
    item({ description: 'התקנת מזגנים', evidence: 'התקנת 3 מזגנים 2500 כל אחד', quantity: 3, unit: 'unit', quantityBasis: 'stated' }),
    item({ description: 'ריצוף', evidence: 'ריצוף 40 מ"ר ב-120 למטר', quantity: 40, unit: 'm2', quantityBasis: 'stated' }),
    item({ description: 'פירוק ריצוף קיים', evidence: 'פירוק ריצוף קיים', quantity: null, unit: null, quantityBasis: 'missing', missing: 'השטח' }),
  ] };
  it('a per-unit price is a price, never a quantity; "כל אחד" is not the number one', () => {
    expect(measuresOf('ריצוף 40 מ"ר ב-120 למטר').map((m) => [m.value, m.kind])).toEqual([[40, 'number'], [120, 'price']]);
    expect(measuresOf('התקנת 3 מזגנים 2500 כל אחד').map((m) => [m.value, m.kind])).toEqual([[3, 'number'], [2500, 'price']]);
  });
  it('each line keeps its written quantity and takes its own written price; a line without one has none', () => {
    const out = parseOwnerPrices(JSON.stringify(raw), [], text);
    expect(out.items.map((i) => [i.quantity, i.unitPrice, i.priceSource])).toEqual([[3, 2500, 'description'], [40, 120, 'description'], [null, null, 'none']]);
  });
  it('a catalog price wins over a written one', () => {
    const r2 = { ...raw, items: [item({ description: 'התקנת מזגן', evidence: 'התקנת מזגן 2500 ש"ח', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', catalogId: 'c1' })] };
    const out = parseOwnerPrices(JSON.stringify(r2), [{ id: 'c1', name: 'התקנת מזגן', price: 1900 }], 'התקנת מזגן 2500 ש"ח');
    expect([out.items[0].unitPrice, out.items[0].priceSource]).toEqual([1900, 'catalog']);
  });
  it('a total of several pieces is never divided (no per-unit words) - no price', () => {
    const r3 = { ...raw, items: [item({ description: 'התקנת מזגנים', evidence: 'התקנת 3 מזגנים 7500 ש"ח', quantity: 3, unit: 'unit', quantityBasis: 'stated' })] };
    const out = parseOwnerPrices(JSON.stringify(r3), [], 'התקנת 3 מזגנים 7500 ש"ח');
    expect([out.items[0].quantity, out.items[0].unitPrice]).toEqual([3, null]);
  });
});
