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
    expect(msgs[0].content).toContain('Never output prices');
    expect(msgs[0].content).toContain('Never use 1 or a sum of other items as a guess');
    expect(msgs[1].content).not.toMatch(/1450|price/);
    expect(JSON.parse(msgs[1].content).catalog).toEqual([{ id: '7', name: 'חלון אלומיניום 120×100' }, { id: '9', name: 'רשת' }]);
    expect(buildDraftMessages({ description: 'job', isHebrew: false, catalog: [] })[0].content).toContain('English');
  });
  it('the provider schema is strict and carries unit / basis / missing per line - no price field at all', () => {
    expect(DRAFT_RESPONSE_SCHEMA.strict).toBe(true);
    const props = DRAFT_RESPONSE_SCHEMA.schema.properties.items.items.properties;
    expect(Object.keys(props).sort()).toEqual(['catalogId', 'derivation', 'description', 'evidence', 'missing', 'quantity', 'quantityBasis', 'unit']);
    expect(JSON.stringify(DRAFT_RESPONSE_SCHEMA)).not.toMatch(/price|total|"vat|discount/i);
  });
});

describe('numbers and units of the user text', () => {
  it('reads decimals, decimal commas, thousands and the unit written after the number (HE / EN)', () => {
    expect(extractMeasures(OWNER).map((m) => [m.value, m.unit, m.text])).toEqual([[40, 'm2', '40 מ״ר'], [22, 'm2', '22 מ״ר']]);
    expect(extractMeasures('12,5 מ"ר, 3 שעות, 2 ימי עבודה, 7.5 מטר אורך, 15 ק״ג').map((m) => [m.value, m.unit]))
      .toEqual([[12.5, 'm2'], [3, 'hour'], [2, 'day'], [7.5, 'linear_meter'], [15, 'kg']]);
    expect(extractMeasures('1,200 sq ft deck and 35.5 m2 patio, 4 hours').map((m) => [m.value, m.unit])).toEqual([[1200, null], [35.5, 'm2'], [4, 'hour']]);
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
    expect(d).toEqual({ subject: 's', questions: ['q?'], unassignedMeasures: ['22 מ״ר'], items: [
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
  it('verifies the JWT in the gateway and in code, and reads with the caller JWT (RLS), never the service role', () => {
    expect(config).toMatch(/\[functions\.ai-quote-draft\]\r?\nenabled = true[\s\S]{0,400}?verify_jwt = true/);
    expect(src).toContain('caller.auth.getUser()');
    expect(src).not.toMatch(/SERVICE_ROLE/);
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
