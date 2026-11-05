// Owner console 2026-11-05 (typed: "מאשר הסרת השורה "אחרי 10 ההצעות החינמיות" מכרטיס המסלול בתוך המערכת, דפי הנחיתה בלי שינוי, כולל שינוי
// ב-L-01 ו-L-22, שחרור עד הלייב"): the Free-10 line is gone from the in-system package card (the plans window, the Settings plans card
// and the Free-10 window read this one model), in both languages and markets; the landing pages keep theirs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pricingModalModel } from './domain/subscriptions/pricingModalModel';

const card = (isHebrew, market) => pricingModalModel({ isHebrew, market, accountCurrency: market === 'IL' ? null : 'USD', estimateRate: null })
  .plans.find((p) => p.id === 'all_inclusive');

describe('the in-system package card', () => {
  for (const isHebrew of [true, false]) {
    for (const market of ['IL', 'INTERNATIONAL']) {
      it(`${isHebrew ? 'HE' : 'EN'} ${market}: no Free-10 line, the renewal line stays`, () => {
        const lines = card(isHebrew, market).lines;
        expect(lines.join(' | ')).not.toMatch(/החינמיות|free quotes/);
        expect(lines).toEqual([isHebrew ? 'המנוי החודשי מתחדש כל חודש, והשנתי כל שנה' : 'The monthly plan renews every month, the annual plan every year']);
      });
    }
  }
  it('the landing pages keep their Free-10 line', () => {
    expect(readFileSync('src/pages/LandingLocal.jsx', 'utf8')).toContain('`אחרי ${FREE_QUOTES_TOTAL} ההצעות החינמיות`');
    expect(readFileSync('src/pages/LandingGlobal.jsx', 'utf8')).toContain('`After the ${FREE_QUOTES_TOTAL} free quotes`');
  });
});
