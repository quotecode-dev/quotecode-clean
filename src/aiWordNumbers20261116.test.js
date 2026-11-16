// Owner console 2026-11-16 (typed release line "... ומספרים במילים בהצעה החכמה ..."): the LIVE example 9 of 16/11 - the numbers written in
// words (a voice transcription); the model returned the apartments under a floor it did not return -> before, no heading at all.
import { describe, it, expect } from 'vitest';
import { parseDraftModelOutput, digitizePlaceNumbers } from '../supabase/functions/_shared/aiQuoteDraft.js';

const SRC = 'קומה עשרים וארבע, דירה ארבעים ושמונה, דירה ארבעים ותשע, דירה חמישים. בכל דירה צריך לפרק את הריצוף הקיים, ארבעים מטר לפי מאתיים שקל למטר, ולהרכיב ריצוף חדש. ההרכבה רק, הלקוח מביא את החומר, הרכבה לפי ארבע מאות שקל למטר.';
const item = (description, unitPrice, evidence, place, catalogId = null) => ({ description, unitPrice, evidence, quantity: 40, unit: 'm2', quantityBasis: 'stated', derivation: null, missing: null, catalogId, place, room: null });
const MODEL = {
  subject: 'ריצוף', questions: [], changes: { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null },
  items: ['dira_48', 'dira_49', 'dira_50'].map((p) => item('פירוק ריצוף קיים', 200, 'לפרק את הריצוף הקיים, ארבעים מטר לפי מאתיים שקל למטר', p))
    .concat(['dira_48', 'dira_49', 'dira_50'].map((p) => item('הרכבת ריצוף חדש', 400, 'להרכיב ריצוף חדש. ההרכבה רק, הלקוח מביא את החומר, הרכבה לפי ארבע מאות שקל למטר', p))),
  places: [['dira_48', 'דירה ארבעים ושמונה'], ['dira_49', 'דירה ארבעים ותשע'], ['dira_50', 'דירה חמישים']]
    .map(([key, name]) => ({ key, kind: 'apartment', name, count: 1, identical: 'no', parent: 'floor_24', evidence: name })),
};

describe('numbers in words in the smart quote (Owner 16/11)', () => {
  it('the LIVE example 9: floor 24 over apartments 48 / 49 / 50, every line in its apartment, the headings in digits', () => {
    const r = parseDraftModelOutput(JSON.stringify(MODEL), [], SRC, null, { structure: true, tree: true, isHebrew: true });
    const byKey = new Map(r.places.map((p) => [p.key, p]));
    const floor = r.places.find((p) => p.kind === 'floor');
    expect(floor && floor.name).toBe('קומה 24');
    const apts = r.places.filter((p) => p.kind === 'apartment');
    expect(apts.map((p) => p.name)).toEqual(['דירה 48', 'דירה 49', 'דירה 50']);
    expect(apts.every((p) => p.parent === floor.key)).toBe(true);
    expect(r.items).toHaveLength(6);
    expect(r.items.every((it) => byKey.get(it.place)?.kind === 'apartment')).toBe(true);
    // the places keep the user's own words as their evidence (the text is only read in digits)
    expect(floor.evidence).toBe('קומה עשרים וארבע');
    expect(apts[0].evidence).toBe('דירה ארבעים ושמונה');
  });
  it('digitizePlaceNumbers: only a number right after a place word; the spans map back to the user\'s words', () => {
    const d = digitizePlaceNumbers('קומה עשרים וארבע, דירה חמישים. צביעה שלושים מטר');
    expect(d.text).toBe('קומה 24, דירה 50. צביעה שלושים מטר');
    const at = d.text.indexOf('דירה 50');
    expect(d.toOld({ start: at, end: at + 'דירה 50'.length }).text).toBe('דירה חמישים');
    expect(digitizePlaceNumbers('Floor twenty four, apartment forty eight').text).toBe('Floor 24, apartment 48');
    expect(digitizePlaceNumbers('קומה 24, דירה 48')).toBeNull();
  });
});
