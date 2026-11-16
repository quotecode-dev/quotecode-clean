// Owner console 2026-11-16 (typed: "מאשר תיקון ההצעה החכמה כשהמודל מחזיר מקומות שלא בטקסט או שורות בלי מקום: קומות ודירות מהטקסט ושיוך
// השורות לפי "בכל דירה" ..."): the two REAL model answers on LIVE 0201164c for the English text with numbers in words.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, placeRef } from '../supabase/functions/_shared/aiQuoteDraft.js';

const EN = 'Floor twenty four, apartment forty eight, apartment forty nine, apartment fifty. In each apartment remove the existing tiles, forty square meters at twenty dollars per square meter, and install new tiles. Installation only, the client brings the material, installation at forty dollars per square meter.';
const changes = { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null };
const line = (description, unitPrice, evidence, place) => ({ description, unitPrice, evidence, quantity: 40, unit: 'm2', quantityBasis: 'stated', derivation: null, missing: null, catalogId: null, place, room: null });
const REMOVE = 'remove the existing tiles, forty square meters at twenty dollars per square meter';
const INSTALL = 'installation at forty dollars per square meter';
const pl = (key, kind, name, parent, evidence) => ({ key, kind, name, count: 1, identical: 'no', parent, evidence });
// run 1 (1440): the places in the text's own words, the lines pointing at the places by NAME ("apartment 48")
const RUN1 = { subject: 'Tile removal and installation', questions: [], changes,
  places: [pl('p1', 'floor', 'Floor twenty four', null, 'Floor twenty four'), pl('p2', 'apartment', 'apartment forty eight', 'p1', 'apartment forty eight'),
    pl('p3', 'apartment', 'apartment forty nine', 'p1', 'apartment forty nine'), pl('p4', 'apartment', 'apartment fifty', 'p1', 'apartment fifty')],
  items: ['48', '49', '50'].map((n) => line('Remove existing tiles', 20, REMOVE, `apartment ${n}`)).concat(['48', '49', '50'].map((n) => line('Install new tiles', 40, INSTALL, `apartment ${n}`))) };
// run 2 (390): the apartments named in HEBREW for an English text (not in the text), only the floor's evidence found
const RUN2 = { subject: 'Tile removal and installation', questions: [], changes,
  places: [pl('apartment_48', 'apartment', 'דירה 48', 'floor_24', 'דירה 48'), pl('apartment_49', 'apartment', 'דירה 49', 'floor_24', 'דירה 49'),
    pl('apartment_50', 'apartment', 'דירה 50', 'floor_24', 'דירה 50'), pl('floor_24', 'floor', 'קומה 24', null, 'Floor twenty four')],
  items: ['48', '49', '50'].map((n) => line('Remove existing tiles', 20, REMOVE, `apartment_${n}`)).concat(['48', '49', '50'].map((n) => line('Install new tiles', 40, INSTALL, `apartment_${n}`))) };

const shape = (model) => {
  const r = parseDraftModelOutput(JSON.stringify(model), [], EN, null, { structure: true, tree: true, isHebrew: false });
  const name = (k) => r.places.find((p) => p.key === k)?.name ?? null;
  return { places: r.places.map((p) => [p.name, name(p.parent)]), lines: r.items.map((i) => [i.description, name(i.place)]) };
};
const WANT_PLACES = [['Floor 24', null], ['Apartment 48', 'Floor 24'], ['Apartment 49', 'Floor 24'], ['Apartment 50', 'Floor 24']];
const WANT_LINES = ['48', '49', '50'].map((n) => ['Remove existing tiles', `Apartment ${n}`]).concat(['48', '49', '50'].map((n) => ['Install new tiles', `Apartment ${n}`]));

describe('places the model names differently from the text (Owner 16/11)', () => {
  it('lines pointing at a place by its name in words ("apartment 48" = "apartment forty eight") go to that apartment', () => {
    const s = shape(RUN1);
    expect(s.places).toEqual(WANT_PLACES);
    expect(s.lines).toEqual(WANT_LINES);
  });
  it('apartments the model wrote in another language: the text\'s own apartments, every line in its apartment, the floor not doubled', () => {
    const s = shape(RUN2);
    expect([...s.places].sort()).toEqual([...WANT_PLACES].sort());
    expect(s.lines).toEqual(WANT_LINES);
  });
  it('placeRef: the same place by kind and number in any language, in words or digits', () => {
    expect(placeRef('apartment forty eight')).toBe('apartment|48');
    expect(placeRef('דירה 48')).toBe('apartment|48');
    expect(placeRef('Apartment 48')).toBe('apartment|48');
    expect(placeRef('Floor twenty four')).toBe('floor|24');
    expect(placeRef('קומה 24')).toBe('floor|24');
    expect(placeRef('Apartment 1A')).toBe('apartment|1a');
    expect(placeRef('Kitchen')).toBeNull();
  });
});
