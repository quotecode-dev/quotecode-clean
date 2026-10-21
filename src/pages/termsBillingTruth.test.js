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
  it('states the facts: the plan system, subscription purchase and online payment are not active; cancellation terms decided', () => {
    expect(T.he).toContain('זמינות כיום: מערכת המסלולים החדשה, רכישת מנוי ותשלום מקוון עדיין אינם פעילים, ולא נגבה תשלום כלשהו דרך השירות.');
    expect(T.en).toContain('Availability today: the new plan system, subscription purchase and online payment are not active yet, and no payment is collected through the Service.');
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
    expect(T.he).toContain('אחרי 10 ההצעות החינמיות, המנוי הוא מסלול אחד שכולל את כל היכולות הזמינות בשירות, בתשלום חודשי או שנתי מתחדש: 30.00 ₪ לחודש או 306.00 ₪ לשנה.');
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
    expect(T.en).toContain('After the 10 free quotes, the subscription is one package with every capability available in the Service, billed monthly or annually and renewing: 18.00 USD per month or 184.00 USD per year.');
    expect(T.en).toContain('Quote presentation styles are not plans. Existing rights on an earlier plan are kept and do not change automatically.'); // Task 37
    expect(T.en).toContain('The Free plan includes 10 quotes in total or 7 days from sign-up, whichever ends first, and the SMART PACK add-on is included during those 7 days');
    expect(T.en).not.toMatch(/183\.60|28\.00 USD|38\.00 USD/);
    expect(T.en).toContain('100 more products cost 3.00 USD per month, only when you explicitly choose it');
    expect(T.en).toContain('Billing is always in USD; a price shown in your local currency is only an estimate.');
    expect(T.en).not.toMatch(/₪|\bILS\b|\bNIS\b|shekel/i);
  });
  it('every still-open legal branch is "not decided, published before activation" (cancellation / refunds are decided)', () => {
    expect(T.he).toContain('הנושאים הבאים טרם הוכרעו ויפורסמו לפני הפעלת המסלולים: מגבלות ההצעות במסלולים בתשלום; קבצים מצורפים; נפח אחסון; מכסות AI; מיסוי מעבר לכלילת המע״מ במחירים בישראל; ומשך שמירת נתונים ומסמכים.');
    expect(T.en).toContain('The following have not been decided yet and will be published before the plans are activated: quote limits of the paid plans; attachments; storage; AI quotas; taxes; and data and document retention periods.');
  });
  it('no value of a not-decided branch is stated (no paid quote limit, storage size, AI quota or refund window)', () => {
    expect(terms).not.toMatch(/\b50 (?:new )?quotes|\d+\s?(?:MB|GB)|\d+ AI|refund within|\d+ days? refund/i);
  });
});

describe('Privacy - no payment processing claim; retention / attachments not decided', () => {
  it('does not claim payments are processed or a payment processor is connected (HE + EN)', () => {
    expect(privacy).not.toMatch(/process billing|secure payment processors|עיבוד תשלומים,|ספקי סליקה מאובטחים/);
    expect(P.en).toContain('The service does not process payments at this time.');
    expect(P.en).toContain('No payment processor is connected to the service at this time');
    expect(P.he).toContain('השירות אינו מעבד תשלומים כרגע.');
    expect(P.he).toContain('כרגע אין ספק סליקה מחובר לשירות');
  });
  it('retention, attachments and storage are marked not decided, published before activation (HE + EN)', () => {
    expect(P.he).toMatch(/טרם נקבעו משכי שמירת הנתונים והמסמכים לאחר מחיקה או סגירת חשבון, אופן הטיפול בקבצים מצורפים ונפח האחסון. הם יפורסמו לפני הפעלת המסלולים/);
    expect(P.en).toMatch(/Retention periods for data and documents after deletion or account closure, the handling of attachments, and storage have not been decided yet and will be published before the plans are activated/);
    expect(P.en).not.toMatch(/₪|\bILS\b/);
  });
});

// Task 36 (Codex landing review L2): Terms §4 counts Free-10 by the CANONICAL rule (Owner decision 2026-10-11, version + customer;
// docs/subscriptions-complete-end-to-end-2026-10-07/OWNER_DECISION_FREE10_VERSION_RECIPIENT_2026-10-11.md) - the same rule as the
// landing FAQ and the server ledger - never the superseded "first time a quote reaches a client" identity rule.
describe('Terms §4 Free-10 counting = the canonical version / customer rule', () => {
  it('HE', () => {
    expect(T.he).not.toMatch(/בפעם הראשונה שהיא יוצאת ללקוח/);
    expect(T.he).toContain('הצעה נספרת כשהיא יוצאת ללקוח (שליחה, קישור ציבורי, PDF סופי או הדפסה סופית).');
    expect(T.he).toContain('הפקה חוזרת של אותה גרסה לאותו לקוח, בכל ערוץ, אינה נספרת שוב; שינוי הלקוח, שם הנמען או תוכן ההצעה והפקה מחדש נספרים כהצעה נוספת.');
    expect(T.he).toContain('טיוטה ותצוגה מקדימה אינן נספרות, מחיקת הצעה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים.');
  });
  it('EN', () => {
    expect(T.en).not.toMatch(/the first time it reaches a client/);
    expect(T.en).toContain('A quote counts when it reaches a client (sending it, sharing its public link, or producing its final PDF or print).');
    expect(T.en).toContain('Producing the same version again for the same client, on any channel, does not count again; changing the client, the recipient name or the quote content and producing it again counts as another quote.');
    expect(T.en).toContain('Drafts and previews do not count, deleting a quote does not give one back, and existing documents stay accessible.');
  });
});
