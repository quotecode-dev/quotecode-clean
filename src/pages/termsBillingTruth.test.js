// Terms §4 billing truth (Owner unified instruction 2026-10-07, 4.b.6) + subscriptions cutover (OD-01..OD-08, OD-11, OD-16):
// Terms / Privacy state only approved facts. No payment exists, so they must not promise a no-refund rule, a cancellation mechanism or
// an end-of-cycle rule; payment terms are not decided (OPEN-09/12). Task 27: §249 (+ the Owner's 2026-10-11 amendment) DECIDED the
// commercial model - one all-inclusive package after Free-10, billed monthly or annually and renewing (IL ₪30 / ₪306 incl. VAT;
// INTERNATIONAL $18 / $184) - so the package and its two prices are stated; the old three style plans are only existing rights. The retired 14-day
// trial is gone (OD-01). Open branches are marked "not decided, published before activation" - never an invented policy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
const terms = stripComments(readFileSync(join(cwd(), 'src', 'pages', 'Terms.jsx'), 'utf8'));
const privacy = stripComments(readFileSync(join(cwd(), 'src', 'pages', 'Privacy.jsx'), 'utf8'));
// the two language branches of the `t = isHebrew ? {...} : {...}` object
const split = (src) => { const i = src.indexOf('} : {'); return { he: src.slice(src.indexOf('const t = isHebrew'), i), en: src.slice(i, src.indexOf('return (')) }; };
const T = split(terms);
const P = split(privacy);

describe('Terms §4 billing truth', () => {
  it('no non-refundable / cancellation / end-of-cycle promise (HE + EN)', () => {
    expect(terms).not.toMatch(/non-refundable|end of your current billing cycle|cancel at any time|cancel anytime/i);
    expect(terms).not.toMatch(/לא יינתנו החזרים|בתום תקופת החיוב|ניתן לבטל בכל עת/);
  });
  // Task 39 (Owner-approved Terms, published on LIVE): the availability sentence states the true state (Free-10 stays prepared -
  // Owner option A, 2026-10-14); cancellation / refunds are DECIDED (section 6) - never "not decided".
  // Owner console 2026-10-25 (typed L-12 / L-14 ... "להפעלת הרכישה בישראל"): the Free plan and buying are active in Israel; abroad not open
  it('states the facts: Free active; purchase open in Israel only (by card through PayPlus); cancellation terms decided', () => {
    expect(T.he).toContain('זמינות כיום: מסלול החינם ורכישת המנוי פעילים. את המנוי רוכשים בתוך החשבון, בחלון המסלולים, בכרטיס אשראי בדף תשלום מאובטח של ספק התשלום פיי פלוס (PayPlus).');
    expect(T.en).toContain('Availability today: the Free plan is active. Subscription purchase is open for accounts in Israel only; for accounts outside Israel, subscription purchase and online payment are not open yet, and no payment is collected from them through the Service.');
    expect(T.he).not.toMatch(/עדיין אינם פעילים/);
    expect(T.he).toContain('6. ביטול מנוי והחזרים');
    expect(T.en).toContain('You can ask to cancel a subscription at any time by email');
    expect(terms).not.toMatch(/cancellation terms for paid plans have not been decided|ביטול, החזרים וחיוב יחסי/);
  });
});

describe('Terms §4 - subscriptions cutover facts (OD-01..OD-08, OD-16)', () => {
  it('no trial, no legacy plan names, no unlimited, no monthly quote counter (HE + EN)', () => {
    for (const src of [terms, privacy]) {
      expect(src).not.toMatch(/\btrial\b|14[- ]day|14 ימים|ניסיון|unlimited|ללא הגבלה|per month quotes|הצעות בחודש/i);
      expect(src).not.toMatch(/\b(?:Basic|Pro|BASIC|PRO)\b(?:\s+plan)?/); // plan names (the English word "basic" in prose is fine)
    }
  });
  it('HE: the one package (§249) with its ILS prices, Free-10 rules, legacy rights unchanged and the VAT inclusion sentence', () => {
    expect(T.he).toContain('אחרי מסלול החינם (10 הצעות או 7 ימים, המוקדם מביניהם), המנוי הוא מסלול אחד שכולל את כל היכולות הזמינות בשירות, בתשלום חודשי או שנתי מתחדש: 30.00 ₪ לחודש או 306.00 ₪ לשנה.');
    expect(T.he).toContain('סגנונות הצגת ההצעה אינם מסלולים. זכויות קיימות במסלול קודם נשמרות ואינן משתנות אוטומטית.'); // Task 37: Owner-approved neutral legacy rights
    expect(T.he).toContain('מסלול חינם כולל 10 הצעות בסך הכול או 7 ימים מההרשמה, המוקדם מביניהם, ובשבעת הימים כלולה גם התוספת חכם פלוס');
    expect(T.he).toMatch(/מחיקת הצעה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים/); // the counting sentence itself: Task 36 block below
    expect(T.he).not.toMatch(/29\.00|49\.00|69\.00/); // the retired three-plan prices are no longer offered
    expect(T.he).toContain('5.00 ₪ לחודש, רק בבחירה מפורשת');
    expect(T.he).toContain('המחירים כוללים מע״מ.');
    expect(T.he).not.toMatch(/\$|USD|דולר/);
    expect(T.he).not.toMatch(/\+\s*מע|לא כולל מע/);
  });
  it('EN: the one package with its USD prices ($184.00 annual), Free-10 rules, billing always USD, local currency only an estimate, zero ILS', () => {
    expect(T.en).toContain('After the Free plan (10 quotes or 7 days, whichever ends first), the subscription is one package with every capability available in the Service, billed monthly or annually and renewing: 18.00 USD per month or 184.00 USD per year.');
    expect(T.en).toContain('Quote presentation styles are not plans. Existing rights on an earlier plan are kept and do not change automatically.'); // Task 37
    expect(T.en).toContain('The Free plan includes 10 quotes in total or 7 days from sign-up, whichever ends first, and the SMART PACK add-on is included during those 7 days');
    expect(T.en).not.toMatch(/183\.60|28\.00 USD|38\.00 USD/);
    expect(T.en).toContain('100 more products cost 3.00 USD per month, only when you explicitly choose it');
    expect(T.en).toContain('Billing is always in USD; a price shown in your local currency is only an estimate.');
    expect(T.en).not.toMatch(/₪|\bILS\b|\bNIS\b|shekel/i);
  });
  it('every still-open legal branch is "not decided, published once decided" (cancellation / refunds are decided)', () => {
    expect(T.he).toContain('הנושאים הבאים טרם הוכרעו ויפורסמו כשיוכרעו: מגבלות ההצעות במסלולים בתשלום; קבצים מצורפים; נפח אחסון; מכסות AI; מיסוי מעבר לכלילת המע״מ במחירים בישראל; ומשך שמירת נתונים ומסמכים.');
    expect(T.en).toContain('The following have not been decided yet and will be published once decided: quote limits of the paid plans; attachments; storage; AI quotas; taxes; and data and document retention periods.');
  });
  it('no value of a not-decided branch is stated (no paid quote limit, storage size, AI quota or refund window)', () => {
    expect(terms).not.toMatch(/\b50 (?:new )?quotes|\d+\s?(?:MB|GB)|\d+ AI|refund within|\d+ days? refund/i);
  });
});

describe('Privacy - the one payment provider is named with what it gets; retention / attachments not decided', () => {
  // Owner console 2026-10-25 (typed L-12 / L-14 ...): the subscription is bought on the PayPlus page (Israel only)
  it('names the payment provider, what passes to it and that card details never reach us (HE + EN); no broader claim', () => {
    expect(privacy).not.toMatch(/process billing|secure payment processors|עיבוד תשלומים,|ספקי סליקה מאובטחים/);
    expect(P.en).toContain('for accounts outside Israel, the service does not process payments at this time.');
    expect(P.en).toContain('Subscription purchases (open for accounts in Israel only) are made on a secure payment page of the payment provider PayPlus');
    expect(P.he).toContain('רכישת המנוי עצמו מתבצעת באמצעות ספק תשלום חיצוני (ראו סעיף 7).');
    expect(P.he).toContain('רכישת מנוי מתבצעת בדף תשלום מאובטח של ספק התשלום פיי פלוס (PayPlus); מה שמועבר אליו מפורט בסעיף 7.');
    expect(P.he).toContain('שאינו מקבל את פרטי הכרטיס');
    expect(P.he).not.toContain('השירות אינו מעבד תשלומים כרגע');
  });
  it('retention, attachments and storage are marked not decided, published once decided (HE + EN)', () => {
    expect(P.he).toMatch(/טרם נקבעו משכי שמירת הנתונים והמסמכים לאחר מחיקה או סגירת חשבון, אופן הטיפול בקבצים מצורפים ונפח האחסון. הם יפורסמו כשייקבעו/);
    expect(P.en).toMatch(/Retention periods for data and documents after deletion or account closure, the handling of attachments, and storage have not been decided yet and will be published once decided/);
    expect(P.en).not.toMatch(/₪|\bILS\b/);
  });
});

// Task 36 (Codex landing review L2): Terms §4 counts Free-10 by the CANONICAL rule (Owner decision 2026-10-11, version + customer;
// docs/subscriptions-complete-end-to-end-2026-10-07/OWNER_DECISION_FREE10_VERSION_RECIPIENT_2026-10-11.md) - the same rule as the
// landing FAQ and the server ledger - never the superseded "first time a quote reaches a client" identity rule.
// Owner console 2026-10-24 (typed: "מאשר שינוי ב-L-14 ו-L-17: נוסח ספירת 10 ההצעות - נספרת בשמירה עם לקוח ופריט"): the Terms state the
// server rule of 20261021100000 - counted at the FIRST save with a client and an item, re-saving never counts again, the version / customer
// rule still decides what a later output counts.
describe('Terms §4 Free-10 counting = the server rule (first save with a client and an item; then the version / customer rule)', () => {
  it('HE', () => {
    expect(T.he).not.toMatch(/הצעה נספרת כשהיא יוצאת ללקוח/);
    expect(T.he).toContain('הצעה נספרת בפעם הראשונה שהיא נשמרת עם לקוח ולפחות פריט אחד; שמירה חוזרת אחרי עריכה אינה נספרת שוב.');
    expect(T.he).toContain('הפקה חוזרת של אותה גרסה לאותו לקוח, בכל ערוץ (שליחה, קישור ציבורי, PDF סופי או הדפסה סופית), אינה נספרת; שינוי הלקוח, שם הנמען או תוכן ההצעה והפקה מחדש נספרים כהצעה נוספת.');
    expect(T.he).toContain('טיוטה ריקה ותצוגה מקדימה אינן נספרות, מחיקת הצעה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים.');
  });
  it('EN', () => {
    expect(T.en).not.toMatch(/A quote counts when it reaches a client/);
    expect(T.en).toContain('A quote counts the first time it is saved with a client and at least one item; editing and saving it again does not count again.');
    expect(T.en).toContain('Producing the same version again for the same client, on any channel (sending it, sharing its public link, or its final PDF or print), does not count; changing the client, the recipient name or the quote content and producing it again counts as another quote.');
    expect(T.en).toContain('An empty draft and previews do not count, deleting a quote does not give one back, and existing documents stay accessible.');
  });
});
