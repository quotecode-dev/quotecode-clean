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
  // Owner console 2026-10-25 (typed L-06 ... "להפעלת הרכישה בישראל"): HE = buying inside the account; EN = still not purchasable
  it('HE: advertises the AI assistant inside authenticated workflows and says where the paid package is bought', () => {
    expect(he).toContain('עוזר חכם שמלווה אתכם בעבודה'); // Owner HE language edit 2026-10-06
    expect(he).toContain('עוזר ה-AI של TEKANGO');
    expect(he).toContain('את המנוי בתשלום רוכשים בתוך החשבון, בחלון המסלולים');
    expect(he).not.toContain('עדיין אינו זמין לרכישה');
    expect(he).not.toContain('זו העדפה בלבד שתילקח בחשבון בהמשך');
    expect(he).not.toContain('אם לא רוכשים מנוי בתום התקופה');
  });
  it('EN: advertises the AI assistant inside authenticated workflows and states paid upgrades are unavailable', () => {
    expect(en).toContain('AI Assistant Inside Your Workflow');
    expect(en).toContain('The paid package cannot be purchased yet');
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
  it('Free-10 replaces the trial story; no "active" / "not active" status line about it (both languages, Owner 2026-10-25)', () => {
    for (const src of [he, en]) expect(src).not.toMatch(/עובר אוטומטית למסלול החינמי|automatically moves to the FREE tier|For 14 days|במשך 14 יום/);
    expect(he).not.toMatch(/פעיל עכשיו|פעיל מההרשמה|ההטבה פעילה|המסלולים פעילים/);
    expect(en).not.toMatch(/Active now|active from sign-up|free quotes are active/i);
    for (const src of [he, en]) expect(src).not.toMatch(/עדיין לא הופעל|not active yet/);
  });
});
