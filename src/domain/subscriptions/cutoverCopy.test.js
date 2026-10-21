import { describe, it, expect } from 'vitest';
import { CUTOVER_COPY, freeBalanceText, cutoverCopyFor } from './cutoverCopy';

describe('prepared cutover copy (off)', () => {
  it('uses the Owner notice wording before consumption (change spec §5.1)', () => {
    expect(CUTOVER_COPY.he.consumptionWarning).toBe('פעולה זו תנצל הצעה אחת מתוך 10 ההצעות החינמיות שלכם');
  });
  it('market / language isolation: EN has no Hebrew / ILS; neither promises trial, unlimited, annual or a price', () => {
    const en = JSON.stringify(CUTOVER_COPY.en) + CUTOVER_COPY.en.balance(3);
    expect(en).not.toMatch(/[֐-׿]|₪|\bILS\b|\bNIS\b/);
    const all = JSON.stringify(CUTOVER_COPY) + CUTOVER_COPY.he.balance(3);
    expect(all).not.toMatch(/14|trial|ניסיון|unlimited|ללא הגבלה כלל|annual|שנתי|\d+\.\d{2}/i);
  });
  it('no fake balance: text only for a valid server Free-10 summary', () => {
    expect(freeBalanceText('he', { accountMode: 'free', freeQuotes: { limit: 10, consumed: 3, remaining: 7 } })).toBe('יתרה: 7 מתוך 10 הצעות חינם');
    expect(freeBalanceText('en', { accountMode: 'free', freeQuotes: { limit: 10, consumed: 10, remaining: 0 } })).toMatch(/used your 10 free quotes/);
    for (const bad of [null, undefined, {}, { accountMode: 'paid', freeQuotes: { limit: 10, remaining: 5 } }, { accountMode: 'free', freeQuotes: { limit: 20, remaining: 5 } },
      { accountMode: 'free', freeQuotes: { limit: 10, remaining: 11 } }, { accountMode: 'free', freeQuotes: { limit: 10, remaining: '7' } }, { activationPhase: 'off' }]) {
      expect(freeBalanceText('he', bad)).toBeNull();
    }
  });
  it('while off every surface keeps the legacy copy', () => {
    expect(cutoverCopyFor('off')).toBe('legacy');
    expect(cutoverCopyFor('prepared')).toBe('legacy');
    expect(cutoverCopyFor('enforced')).toBe('cutover');
  });
});
