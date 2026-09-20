import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// First-LIVE landing truth: AI Chat is a real, signed-in-workflow feature;
// paid upgrade/checkout does not exist yet and must not be promised.
const read = (f) => readFileSync(join(cwd(), 'src', 'pages', f), 'utf8');
const he = read('LandingLocal.jsx');
const en = read('LandingGlobal.jsx');

describe('Landing first-LIVE feature truth', () => {
  it('HE: advertises the AI assistant inside authenticated workflows and states paid upgrades are unavailable', () => {
    expect(he).toContain('עוזר AI בתוך העבודה');
    expect(he).toContain('שדרוג למסלול בתשלום ותשלום מקוון אינם זמינים כרגע');
    expect(he).not.toContain('זו העדפה בלבד שתילקח בחשבון בהמשך');
    expect(he).not.toContain('אם לא רוכשים מנוי בתום התקופה');
  });
  it('EN: advertises the AI assistant inside authenticated workflows and states paid upgrades are unavailable', () => {
    expect(en).toContain('AI Assistant Inside Your Workflow');
    expect(en).toContain('Paid upgrades and online checkout are not currently available');
    expect(en).not.toContain("it's only a preference we'll take into account later");
    expect(en).not.toContain('subscribe by the end of the trial');
  });
  it('neither landing claims invoicing or automatic billing/payment collection', () => {
    for (const raw of [he, en]) {
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(src).not.toMatch(/we(?:'|’)ll charge you automatically|automatic(?:ally)? (?:bill|charge)|חיוב אוטומטי/i);
    }
  });
  it('trial -> FREE truth is preserved in both languages', () => {
    expect(he).toContain('עובר אוטומטית למסלול החינמי (FREE)');
    expect(en).toContain('automatically moves to the FREE tier');
  });
});
