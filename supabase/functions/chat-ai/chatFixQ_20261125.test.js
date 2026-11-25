// Owner console 2026-11-25, typed: "מאשר תיקון 3ק בצ׳אט (שכפול וחלוקה לדירות), כולל שינוי ב-L-17"
// The live re-run of chatfix3-1125 found "האם יש שכפול הצעות?" and "לחלק הצעה לדירות וחדרים" unclassified (a clarifying question).
import { describe, it, expect } from 'vitest';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

describe('3ק: "is there / can I" duplication and dividing a quote are recognized', () => {
  it.each([
    ['האם יש שכפול הצעות?', 'quote_duplicate'],
    ['אפשר לשכפל את ההצעה?', 'quote_duplicate'],
    ['Is there quote duplication?', 'quote_duplicate'],
    ['Can I duplicate quotes?', 'quote_duplicate'],
    ['האם אפשר לחלק הצעה לדירות וחדרים?', 'measured_quote'],
    ['אפשר לפצל את ההצעה לקומות?', 'measured_quote'],
    ['Can I split a quote into apartments and rooms?', 'measured_quote'],
    ['Can I divide the quote into floors?', 'measured_quote'],
  ])('%s -> %s', (q, id) => {
    expect(classifyCapabilityIntent(q)).toBe(id);
  });

  it.each([
    // "how" questions keep their own route and steps (unchanged by 3ק)
    ['איך משכפלים הצעה?'],
    ['איך מחלקים הצעה לכמה דירות?'],
    ['How do I split a quote into rooms?'],
    // ("How do I duplicate a quote?" was already quote_duplicate before 3ק, through the older English pattern)
    // not about a quote
    ['איך משכפלים דירה עם כל העבודות שבה?'],
    ['How do I copy the quote link to text it myself?'],
    ['Can I duplicate a section in a quote?'],
  ])('%s is not newly classified by 3ק', (q) => {
    expect(['quote_duplicate', 'measured_quote']).not.toContain(classifyCapabilityIntent(q));
  });

  it('the recognized questions get the truthful answer with "included in every plan" in both languages', () => {
    for (const id of ['quote_duplicate', 'measured_quote']) {
      const he = resolveCapabilityTruthResponse(id, FACTS, true, 'free', false, 'Local');
      const en = resolveCapabilityTruthResponse(id, FACTS, false, 'free', false, 'International');
      expect(he.factPayload.truthStatus).toBe('AVAILABLE');
      expect(en.factPayload.truthStatus).toBe('AVAILABLE');
      expect(he.answer.endsWith(' כלול בכל המסלולים, גם בחינם.')).toBe(true);
      expect(en.answer.endsWith(' Included in every plan, Free too.')).toBe(true);
    }
  });
});
