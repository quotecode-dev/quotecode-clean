// Task 37 (Owner-approved copy corrections, 2026-10-12): the landing / terms / contact copy must be true on LIVE and TEST at once -
// no "without a trial" (LIVE signup grants a 14-day trial), no "registration is not active" (signup works), Free-10 and the paid plan
// stated as not active / not purchasable, prices kept; Terms legacy rights neutral; no new support SLA; the AI card states only what LIVE
// has. Written to FAIL before the change.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (rel) => readFileSync(join(cwd(), rel), 'utf8').replace(/^\s*\/\/.*$/gm, '');
const he = read('src/pages/LandingLocal.jsx');
const en = read('src/pages/LandingGlobal.jsx');
const terms = read('src/pages/Terms.jsx');
const contact = read('src/pages/Contact.jsx');

describe('L1 / L7: one meaning, true on LIVE and TEST', () => {
  it('HE', () => {
    expect(he).not.toMatch(/בלי תקופת ניסיון|ללא תקופת ניסיון/);
    expect(he).not.toMatch(/ההרשמה והחיוב עדיין אינם מופעלים/);
    expect(he).not.toMatch(/לבדיקה/);
    expect(he).toContain('מסלול 10 ההצעות החינמיות עדיין לא הופעל. תנאי החשבון הזמינים כעת מוצגים בתהליך ההרשמה. המסלול החדש בתשלום עדיין אינו זמין לרכישה, והמחירים מוצגים לידיעה בלבד.');
    expect(he).toContain('המחירים כוללים מע״מ');
  });
  it('EN', () => {
    expect(en).not.toMatch(/without a trial|no trial/i);
    expect(en).not.toMatch(/enrollment and billing are not active/i);
    expect(en).not.toMatch(/for review/i);
    expect(en).toContain('The 10-free-quotes plan is not active yet. The account terms available today are shown when you sign up. The new paid plan cannot be purchased yet, and the prices are shown for information only.');
  });
});

// Owner 2026-10-24 (typed L-14 + L-17): the FAQ states the server rule - counted at the first save with a customer and an item
describe('FAQ Free-10 as scannable points with every fact kept', () => {
  it.each([['he', he, ['10 הצעות מחיר חינם בסך הכול', 'אותה גרסה לאותו לקוח', 'שינוי הלקוח, שם הנמען או תוכן ההצעה', 'טיוטה ריקה ותצוגה מקדימה לא נספרות', 'מחיקת הצעה לא מחזירה אותה', 'בפעם הראשונה שהיא נשמרת עם לקוח ולפחות פריט אחד']],
    ['en', en, ['10 quotes in total', 'same version again for the same customer', 'Changing the customer, the recipient name or the quote content', 'An empty draft and previews never count', 'Deleting a quote does not give it back', 'the first time it is saved with a customer and at least one item']]])('%s', (_l, src, facts) => {
    const i = src.indexOf(_l === 'he' ? 'איך עובדות 10 ההצעות החינמיות?' : 'How do the 10 free quotes work?');
    const block = src.slice(i, src.indexOf('},', i));
    expect(block).toMatch(/<ul/);
    for (const f of facts) expect(block).toContain(f);
  });
  it('the points show a visible bullet marker (a global reset removes list markers)', () => {
    const css = readFileSync(join(cwd(), 'src', 'components', 'landing', 'landing.css'), 'utf8');
    expect(css).toMatch(/\.tl-faq-list \{[^}]*list-style: disc outside;[^}]*\}/);
  });
});

describe('AI card: only what LIVE has', () => {
  it('no "the quote in front of you" (the draft review is TEST only)', () => {
    expect(he).not.toContain('שאלו על ההצעה שלפניכם');
    expect(en).not.toContain('Ask about the quote in front of you');
    expect(he).toContain('שאלו על השלב שבו אתם נמצאים, או בקשו הכוונה.');
    expect(en).toContain('Ask about the step you are on or get guided help.');
  });
});

describe('Terms legacy rights: neutral, no style names as plans', () => {
  it('HE / EN', () => {
    expect(terms).not.toMatch(/קלאסיק, מודרן או ויזואל/);
    expect(terms).not.toMatch(/\(Classic, Modern or Visual\)/);
    expect(terms).toContain('זכויות קיימות במסלול קודם נשמרות ואינן משתנות אוטומטית.');
    expect(terms).toContain('Existing rights on an earlier plan are kept and do not change automatically.');
  });
});

describe('Contact: no new support time promise', () => {
  it('HE / EN', () => {
    expect(contact).not.toMatch(/24 שעות|24 hours/);
    expect(contact).toContain('פניות לתמיכה נענות בימי העבודה.');
    expect(contact).toContain('Support inquiries are answered on business days.');
  });
});
