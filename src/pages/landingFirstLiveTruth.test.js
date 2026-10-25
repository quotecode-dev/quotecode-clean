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
    expect(he).toContain('עוזר חכם שמלווה אתכם בעבודה'); // Owner HE language edit 2026-10-06
    expect(he).toContain('עוזר ה-AI של TEKANGO');
    expect(he).toContain('המסלול החדש בתשלום עדיין אינו זמין לרכישה'); // Task 37: Owner-approved L1 wording (same fact)
    expect(he).not.toContain('זו העדפה בלבד שתילקח בחשבון בהמשך');
    expect(he).not.toContain('אם לא רוכשים מנוי בתום התקופה');
  });
  it('EN: advertises the AI assistant inside authenticated workflows and states paid upgrades are unavailable', () => {
    expect(en).toContain('AI Assistant Inside Your Workflow');
    expect(en).toContain('The new paid plan cannot be purchased yet'); // Task 37: Owner-approved L1 wording (same fact)
    expect(en).not.toContain("it's only a preference we'll take into account later");
    expect(en).not.toContain('subscribe by the end of the trial');
  });
  it('neither landing claims invoicing or automatic billing/payment collection', () => {
    for (const raw of [he, en]) {
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(src).not.toMatch(/we(?:'|’)ll charge you automatically|automatic(?:ally)? (?:bill|charge)|חיוב אוטומטי/i);
    }
  });
  // OD-01 (Owner 2026-10-07): the trial -> FREE story is replaced by Free-10; while it is not activated the landing must say
  // so and that a new account opens without a trial and without a plan assigned (no fake Free-10 entitlement, no Pro trial).
  it('Free-10 replaces the trial story and is stated as not yet activated (both languages)', () => {
    for (const src of [he, en]) expect(src).not.toMatch(/עובר אוטומטית למסלול החינמי|automatically moves to the FREE tier|For 14 days|במשך 14 יום/);
    expect(he).toContain('מסלול 10 ההצעות החינמיות עדיין לא הופעל'); // Task 37: Owner-approved L1 wording (no trial statement either way)
    expect(en).toContain('The 10-free-quotes plan is not active yet'); // Task 37: Owner-approved L1 wording
  });
});
