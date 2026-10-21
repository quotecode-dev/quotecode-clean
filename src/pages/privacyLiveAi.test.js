// Task 39 (Owner-approved Task 38 factual wording, LIVE version): privacy §3 names the AI provider (OpenAI) and the email provider
// (Resend); customer fields are not attached automatically, typed text is sent as written. Existing disclosures stay; the TEST-only
// addition (quote review / AI draft) is NOT on the LIVE page; no retention / training / region / DPA claim.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// the page text lives in single-quoted JS strings: compare the displayed text (\' -> ')
const src = readFileSync(join(cwd(), 'src', 'pages', 'Privacy.jsx'), 'utf8').split("\\'").join("'");
// Owner console 2026-10-21 (typed L-12): the exact disclosure - text, attached screenshots, voice, and account data the user asks about
// (client name / contact / email / phone) go to OpenAI; the old "not attached automatically" line is gone
const HE = '„עוזר ה-AI של TEKANGO (בצ\'אט באתר ובתוך המערכת) מעביר לספק מודל שפה חיצוני (OpenAI) את מה שנדרש להפקת התשובה: את הטקסט שאתם כותבים, צילום מסך שאתם מצרפים לשאלה, ובשימוש בקול גם את ההקלטה (לתמלול) ואת טקסט התשובה (להקראה).';
const EN = 'The TEKANGO AI assistant (in the website chat and inside the app) sends an external language-model provider (OpenAI) what it needs to produce its answer: the text you write, a screenshot you attach to a question, and, when you use voice, the recording (for transcription) and the answer text (for reading aloud).';

describe('privacy §3 - LIVE AI / email disclosure', () => {
  it('HE: the approved LIVE wording is present in §3, after the existing disclosures', () => {
    const s3 = src.slice(src.indexOf("title: '3. שיתוף מידע עם צד שלישי'"), src.indexOf("title: '4. שימוש ב-Cookies'"));
    expect(s3).toContain('אנו מתחייבים לעולם לא למכור את המידע שלכם, לסחור בו או להשכיר אותו לצדדים שלישיים.');
    expect(s3).toContain(HE.slice(1));
    expect(s3).toContain('הוא שולף מהחשבון את הנתונים הרלוונטיים ומעביר אותם לספק לצורך התשובה, ובהם גם פרטי לקוח כמו שם, איש קשר, מייל וטלפון.');
    expect(s3).toContain('העוזר שולף נתונים מהחשבון רק כשאתם שואלים עליהם, והוא אינו משנה נתונים. אל תכללו בטקסט או בצילום פרטים שאינכם רוצים להעביר.');
    expect(s3).not.toContain('אינה מצרפת לשאלה באופן אוטומטי');
    expect(s3).toContain('נשלחות באמצעות ספק שליחה חיצוני (Resend).');
  });
  it('EN: the approved LIVE wording is present in §3, after the existing disclosures', () => {
    const s3 = src.slice(src.indexOf("title: '3. Third-Party Sharing'"), src.indexOf("title: '4. Cookies'"));
    expect(s3).toContain('We promise never to sell, trade, or rent your personal information to third parties.');
    expect(s3).toContain(EN);
    expect(s3).toContain('it retrieves the relevant data from your account and sends it to the provider for the answer, including client details such as name, contact person, email and phone.');
    expect(s3).not.toContain('does not automatically attach');
    expect(s3).toContain('are sent through an external sending provider (Resend).');
  });
  it('the TEST-only addition is not on the LIVE page; no retention / training / region / DPA claim', () => {
    expect(src).not.toMatch(/טיוטת הצעה בעזרת AI|AI quote draft|review of an open quote|בדיקה של הצעה פתוחה/);
    expect(src).not.toMatch(/\b(train(ing)? (on|with)|data region|DPA)\b|לאימון|אזור אחסון/i);
  });
});
