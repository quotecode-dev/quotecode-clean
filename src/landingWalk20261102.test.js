// Owner console 2026-11-02 (typed: "מאשר את התוכנית לתיקוני המעבר הרביעי וטקסט שירה, כולל שינוי ב-L-02, L-06, L-11, L-14, L-16, L-17 ו-L-22, שחרור עד הלייב"): the words of the English landing page after purchase abroad opened.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const page = readFileSync('src/pages/LandingGlobal.jsx', 'utf8');
describe('the English landing page', () => {
  it('never says the plan cannot be bought', () => {
    expect(page).not.toContain('Not available for purchase');
    expect(page).toContain("notice: 'Buy inside your account, in the plans window'");
  });
  it('the FAQ does not talk about Israel', () => {
    expect(page.split('\n').filter((l) => !l.trim().startsWith('//') && /Israeli VAT/.test(l))).toEqual([]);
  });
});
