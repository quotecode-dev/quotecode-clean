// Task 39 (Owner-approved Task 38 factual wording, LIVE version): privacy §3 names the AI provider (OpenAI) and the email provider
// (Resend); customer fields are not attached automatically, typed text is sent as written. Existing disclosures stay; the TEST-only
// addition (quote review / AI draft) is NOT on the LIVE page; no retention / training / region / DPA claim.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// the page text lives in single-quoted JS strings: compare the displayed text (\' -> ')
const src = readFileSync(join(cwd(), 'src', 'pages', 'Privacy.jsx'), 'utf8').split("\\'").join("'");
const HE = '„עוזר ה-AI של TEKANGO (בצ\'אט באתר ובתוך המערכת) מעביר את הטקסט שאתם כותבים לספק מודל שפה חיצוני (OpenAI) לצורך הפקת התשובה.';
const EN = 'The TEKANGO AI assistant (in the website chat and inside the app) sends the text you write to an external language-model provider (OpenAI) to produce its answer.';

describe('privacy §3 - LIVE AI / email disclosure', () => {
  it('HE: the approved LIVE wording is present in §3, after the existing disclosures', () => {
    const s3 = src.slice(src.indexOf("title: '3. שיתוף מידע עם צד שלישי'"), src.indexOf("title: '4. שימוש ב-Cookies'"));
    expect(s3).toContain('אנו מתחייבים לעולם לא למכור, לסחור או להשכיר את המידע שלך לצדדים שלישיים.');
    expect(s3).toContain(HE.slice(1));
    expect(s3).toContain('המערכת אינה מצרפת לשאלה באופן אוטומטי את פרטי הלקוחות שלכם (שם, אימייל, טלפון, כתובת).');
    expect(s3).toContain('טקסט שאתם מקלידים בעצמכם נשלח כפי שנכתב, ולכן אל תכללו בו פרטים שאינכם רוצים להעביר.');
    expect(s3).toContain('נשלחות באמצעות ספק שליחה חיצוני (Resend).');
  });
  it('EN: the approved LIVE wording is present in §3, after the existing disclosures', () => {
    const s3 = src.slice(src.indexOf("title: '3. Third-Party Sharing'"), src.indexOf("title: '4. Cookies'"));
    expect(s3).toContain('We promise never to sell, trade, or rent your personal information to third parties.');
    expect(s3).toContain(EN);
    expect(s3).toContain('The system does not automatically attach your customers\' details (name, email, phone, address) to a question.');
    expect(s3).toContain('are sent through an external sending provider (Resend).');
  });
  it('the TEST-only addition is not on the LIVE page; no retention / training / region / DPA claim', () => {
    expect(src).not.toMatch(/טיוטת הצעה בעזרת AI|AI quote draft|review of an open quote|בדיקה של הצעה פתוחה/);
    expect(src).not.toMatch(/\b(train(ing)? (on|with)|data region|DPA)\b|לאימון|אזור אחסון/i);
  });
});
