// Owner console 2026-11-25 night task, typed approvals:
//   "מאשר תיקון he-24 בצ׳אט (מוסיפים לקוח בלי להכין הצעה), כולל שינוי ב-L-17"
//   "מאשר להחליף בצ׳אט את המשפט 'עדיין לא הוחלט אילו מסלולים' ב'כלול בכל המסלולים, גם בחינם' לחמש היכולות, כולל שינוי ב-L-14 ו-L-17"
//   "מאשר ב: צעדים בשורות נפרדות בחלון הצ׳אט, כולל שינוי ב-L-25"
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { ALL_PLANS_SUBSCRIPTION_CAPABILITIES } from '../_shared/productTruthContract.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

describe('he-24: "without preparing a quote" is not creating a quote', () => {
  it.each([
    ['איך מוסיפים לקוח בלי להכין הצעה?'],
    ['איך מוסיפים לקוח ללא הכנת הצעה?'],
    ['אפשר לשמור לקוח מבלי להכין הצעה?'],
  ])('%s is not quote_create', (q) => {
    expect(classifyCapabilityIntent(q)).not.toBe('quote_create');
  });
  it.each([
    ['איך מכינים הצעת מחיר חדשה?'],
    ['איך להכין הצעה?'],
    ['הכנת הצעה ללקוח חדש'],
  ])('%s is still quote_create', (q) => {
    expect(classifyCapabilityIntent(q)).toBe('quote_create');
  });
});

describe('the five capabilities: "included in every plan, Free too" instead of "not decided"', () => {
  const FIVE = ['quote_edit', 'quote_duplicate', 'measured_quote', 'professional_reuse', 'owner_whatsapp_share'];
  it('they are exactly the capabilities whose subscription capability is in every plan', () => {
    const ids = AI_FACTS.capabilities.filter((c) => ALL_PLANS_SUBSCRIPTION_CAPABILITIES.includes(c.subscriptionCapabilityId)).map((c) => c.id).sort();
    expect(ids).toEqual([...FIVE].sort());
  });
  it.each(FIVE)('%s: AVAILABLE, the new sentence in both languages, for every plan and market, never "not decided"', (id) => {
    for (const plan of [null, 'free', 'package']) for (const market of ['Local', 'International']) {
      const he = resolveCapabilityTruthResponse(id, FACTS, true, plan, false, market);
      const en = resolveCapabilityTruthResponse(id, FACTS, false, plan, false, market);
      expect(he.factPayload.truthStatus).toBe('AVAILABLE');
      expect(en.factPayload.truthStatus).toBe('AVAILABLE');
      expect(he.answer.endsWith(' כלול בכל המסלולים, גם בחינם.')).toBe(true);
      expect(en.answer.endsWith(' Included in every plan, Free too.')).toBe(true);
      expect(he.answer).not.toMatch(/הוחלט|בהכנה/);
      expect(en.answer).not.toMatch(/undecided|being prepared/);
    }
  });
  it('attachments stay SMART PACK, and a capability outside the list gets no plan sentence', () => {
    expect(resolveCapabilityTruthResponse('attachments', FACTS, true, 'free', false, 'Local').factPayload.truthStatus).toBe('SMART_PACK');
    const calc = resolveCapabilityTruthResponse('editor_calculator', FACTS, true, 'free', false, 'Local').answer;
    expect(calc).not.toMatch(/כלול בכל המסלולים/);
  });
});

describe('steps on separate lines in the chat window (L-25)', () => {
  it('the answer bubble keeps the line breaks of an assistant answer; the user bubble is unchanged', () => {
    const w = readFileSync('src/AIChatWidget.jsx', 'utf8');
    expect(w).toContain("whiteSpace: msg.role === 'assistant' ? 'pre-line' : undefined,");
  });
});
