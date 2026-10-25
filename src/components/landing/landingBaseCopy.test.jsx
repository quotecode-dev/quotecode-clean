// Task 16 cloud-fix3 (A10) - landing copy attributes restored pointwise to the approved base (c65f742 = tree of 24e6a3c),
// retro ledger rows L04 / L05 / L12 / L13 / L14 (RETRO_LEDGER_FULL.md §3.2 R21). The refined composition, section order,
// header without a language switch, plans truth and SEO are NOT touched here; only the strings below.
// Local fix 5 (Owner approval 2026-10-06, after reading the LIVE page): the HE landing copy is a FULL Hebrew language
// edit (plural address, natural Hebrew, fewer superlatives) - the HE strings below pin THAT approved copy, not the base
// text any more. EN is unchanged (base strings). Commercial truth is pinned by the landing truth suites.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, MemoryRouter } from 'react-router-dom';

vi.mock('../../shared/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
  rootRecoveryIntent: { isRecovery: false, isError: false },
  rootSignupIntent: { isSignup: false },
  consumeRootRecoveryIntent: () => {},
  consumeRootSignupIntent: () => {},
  isLocalTestMode: false,
}));

import LandingLocal from '../../pages/LandingLocal';
import LandingGlobal from '../../pages/LandingGlobal';
import { STYLE_COPY } from '../../quoteDocument/quoteStyles';

const ssr = (el, path) => renderToString(<StaticRouter location={path}>{el}</StaticRouter>).replace(/<style>[\s\S]*?<\/style>/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const count = (hay, needle) => hay.split(needle).length - 1;

afterEach(() => cleanup());

const he = text(ssr(<LandingLocal />, '/he'));
const en = text(ssr(<LandingGlobal />, '/en'));
const heHtml = ssr(<LandingLocal />, '/he');
const enHtml = ssr(<LandingGlobal />, '/en');

describe('L05 - HE CTA labels (Owner 2026-10-06: plural address) and the base sign-in labels', () => {
  // IRON-LANDING-001 (amended by the Owner 2026-10-11): the signup CTAs are the Free-10 buttons "10 הצעות חינם" (header, hero,
  // plans section, closing = 4; the plan cards have none, registration and billing are not active), each with the visible status
  // "עדיין לא הופעל" inside the same button (Free-10 is never presented as active). No trial promise (OD-01).
  const free10 = (html) => [...html.matchAll(/<a [^>]*data-free10-cta[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]).trim());
  it('every signup CTA reads "10 הצעות חינם" + "עדיין לא הופעל" (header, hero, plans, closing = 4); no trial CTA', () => {
    expect(free10(heHtml)).toEqual(Array(4).fill('10 הצעות חינם עדיין לא הופעל'));
    expect(count(heHtml, 'href="/dashboard?signup=true&amp;lang=he"')).toBe(4);
    for (const s of ['התחילו בחינם', 'נסו חינם', 'נסה חינם', 'ניסיון חינם', 'התחל ניסיון חינם']) expect(he).not.toContain(s);
  });
  it('desktop sign-in "כניסה למערכת"', () => {
    expect(heHtml).toMatch(/class="tl-login"[^>]*>.*?כניסה למערכת<\/a>/);
  });
  it('the drawer (tablet/phone) keeps the base mobile sign-in label "כניסה"; EN keeps "Sign In"', () => {
    const { container } = render(<MemoryRouter><LandingLocal /></MemoryRouter>);
    fireEvent.click(container.querySelector('.tl-menu-toggle'));
    const loginLink = [...document.querySelectorAll('#tl-menu-drawer a')].find((a) => a.getAttribute('href') === '/dashboard?lang=he');
    expect(loginLink.textContent).toBe('כניסה');
    cleanup();
    const g = render(<MemoryRouter><LandingGlobal /></MemoryRouter>);
    fireEvent.click(g.container.querySelector('.tl-menu-toggle'));
    const enLogin = [...document.querySelectorAll('#tl-menu-drawer a')].find((a) => a.getAttribute('href') === '/dashboard?lang=en');
    expect(enLogin.textContent).toBe('Sign In');
  });
  // OD-01: no trial promise in EN either.
  it('EN signup labels "10 free quotes" + "Not active yet" (4) / "Sign In"; no "Free Trial"', () => {
    expect(free10(enHtml)).toEqual(Array(4).fill('10 free quotes Not active yet'));
    expect(count(enHtml, 'href="/dashboard?signup=true&amp;lang=en"')).toBe(4);
    for (const s of ['Start free', 'Sign up free']) expect(en).not.toContain(s);
    expect(en).not.toMatch(/Free Trial/i);
    expect(enHtml).toMatch(/class="tl-login"[^>]*>.*?Sign In<\/a>/);
  });
});

describe('L04 - the four capability cards are the base titles and bodies', () => {
  it('HE: capability titles and bodies of the Owner-approved language edit (plural address; base typo "ווקבל" fixed)', () => {
    for (const s of [
      'הפקת הצעות מחיר בקלות',
      'צרו הצעות מחיר מסודרות, עם חישוב מע״מ אוטומטי, הנחות ומוצרים מהקטלוג שלכם.',
      'חתימה דיגיטלית ואישור לקוח',
      'שלחו ללקוח קישור שבו אפשר לצפות בהצעה, להדפיס אותה או לשמור אותה כ-PDF, לחתום דיגיטלית ולאשר את ההזמנה מהטלפון או מהמחשב.',
      'ניהול הכנסות והוצאות',
      'עקבו אחר רווחי העסק, נהלו הוצאות שוטפות וקבלו תמונת מצב כספית עדכנית.',
      'הצעות מחיר לפי מידות ומפרט',
      'בנו הצעה לפי מידות אמיתיות (שטח או אורך), עם כמה שורות מדידה לכל פריט וחישוב כמות אוטומטי. מתאים לזכוכית ואלומיניום, ריצוף, חשמל, אינסטלציה ותחומים נוספים: פחות חישובים ידניים וטעויות, וחיסכון בזמן בהצעות חוזרות.',
      'עוזר חכם שמלווה אתכם בעבודה',
      // Task 34 (Owner 2026-10-12): the AI card states only what the LIVE product has - the assistant (no AI-draft claim before its release)
      'עוזר ה-AI של TEKANGO עומד לרשותכם כשאתם מכינים הצעות מחיר, מנהלים לקוחות או מעדכנים את ההגדרות. שאלו על השלב שבו אתם נמצאים, או בקשו הכוונה.',
    ]) expect(he).toContain(s);
    // negatives: the replaced phrasings (Owner table 2026-10-06) and the base typo are gone
    for (const s of ['ווקבל', 'עוזר AI בתוך העבודה', 'זרימות העבודה', 'שלח לינק ללקוח', 'עקוב אחר רווחי', 'מקצועיות ומהודרות', 'בכל מסלול']) expect(he).not.toContain(s);
    expect(he).not.toContain('השיחות הקודמות נשמרות'); // Task 33: the signed-in chat is kept for the current session only
    expect(en).not.toContain('your previous chats are kept');
    expect(en).toContain('Ask about the step you are on or get guided help.');
    for (const s of ['ריצוף 40 מ״ר', 'tiling 40 m²', 'the AI suggests quote items']) { expect(he).not.toContain(s); expect(en).not.toContain(s); } // Task 34: no AI-draft claim before its Production release
  });
  it('EN: base bodies; "on every plan" is gone', () => {
    expect(en).toContain('Send a direct link to your client to review, print or save as PDF, digitally sign, and approve orders from any smartphone or computer.');
    expect(en).toContain('Track business profits, manage operating expenses, and see an up-to-date financial overview of your business.');
    for (const s of ['Digital Signatures & Approvals', 'Income & Expense Tracking', 'Professional Quotes with Measurements & Specs', 'AI Assistant Inside Your Workflow']) expect(en).toContain(s);
    expect(en).not.toContain('on every plan');
    expect(en).not.toContain('Send a direct link so your client');
  });
});

describe('L12 - plans section heading is the base title and subtitle', () => {
  // §249 / IRON-LANDING-001 (2026-10-11): the subtitle states the one-package model; the heading stays.
  it('HE h2 "מסלולים ומחירים" + the Free-10-then-one-package subtitle; no eyebrow', () => {
    expect(heHtml).toMatch(/<h2 id="tl-plans-title">מסלולים ומחירים<\/h2><p>10 הצעות מחיר חינם או 7 ימים, המוקדם מביניהם, ואחר כך מסלול אחד שכולל הכול, בתשלום חודשי או שנתי.<\/p>/);
    expect(he).not.toContain('בחרו את המסלול שמתאים לעסק שלכם.');
    expect(heHtml).not.toMatch(/<span class="tl-eyebrow">מסלולים ומחירים<\/span>/);
    expect(he).not.toContain('בוחרים מסלול שמתאים לעסק');
    expect(he).not.toContain('המחירים במסלולים מותאמים לשוק הישראלי וכוללים מע"מ 18%.');
  });
  it('EN h2 "Plans & Pricing" + the Free-10-then-one-package subtitle', () => {
    expect(enHtml).toMatch(/<h2 id="tl-plans-title">Plans &amp; Pricing<\/h2><p>10 free quotes or 7 days, whichever ends first, then one package with every available capability, billed monthly or annually.<\/p>/);
    expect(en).not.toContain('Choose the best plan for your business.');
    expect(en).not.toContain('Choose the plan that fits your business');
    expect(en).not.toContain('Plan prices are shown in your currency for information.');
  });
});

// IRON-LANDING-001 as amended 2026-10-11 (§249): the plan cards are Free-10 and the one all-inclusive package; the style
// descriptions (quoteStyles.js STYLE_COPY) are no longer plan taglines, and "all available capabilities" never names Modern / Visual.
describe('L13 - plan taglines (§249 Free-10 + one all-inclusive package)', () => {
  it('HE Free / all-inclusive (no superlative; no "ללא מגבלות")', () => {
    for (const s of ['חינם עד 10 הצעות או 7 ימים, המוקדם מביניהם.', 'מסלול אחד עם כל היכולות הזמינות במערכת, בתשלום חודשי או שנתי.']) expect(heHtml).toContain(`<p class="tl-plan-tagline" data-region="description">${s}</p>`);
    for (const s of [STYLE_COPY.he.classic.description, STYLE_COPY.he.modern.description, STYLE_COPY.he.visual.description]) expect(heHtml).not.toContain(`<p class="tl-plan-tagline" data-region="description">${s}</p>`);
    expect(he).not.toContain('ללא מגבלות');
    expect(he).not.toContain('פתרון מושלם');
    expect(he).not.toContain('פתרון מלא.');
    expect(he).not.toContain('ללא מגבלת הצעות');
  });
  it('EN Free / all-inclusive', () => {
    // R3 (local fix 6, IRON-LANDING-001): the EN PRO tagline drops the unqualified 'with no limits' (PRO has real limits, e.g.
    // attachments up to 30MB) - the factual counterpart of the approved HE tagline. Price / plan / trial / entitlement unchanged.
    expect(en).not.toMatch(/no limits/i);
    for (const s of ['Free for 10 quotes or 7 days, whichever comes first.', 'One package with every available capability, billed monthly or annually.']) expect(enHtml).toContain(`<p class="tl-plan-tagline" data-region="description">${s}</p>`);
    for (const s of [STYLE_COPY.en.classic.description, STYLE_COPY.en.modern.description, STYLE_COPY.en.visual.description]) expect(enHtml).not.toContain(`<p class="tl-plan-tagline" data-region="description">${s.replace(/'/g, '&#x27;')}</p>`);
    expect(en).not.toContain('no quote limit');
  });
});

describe('L14 - base FAQ answers are verbatim; the reference style questions stay (Owner Q3)', () => {
  it('HE answers of the Owner-approved language edit (same facts)', () => {
    for (const s of [
      // OD-05 (Owner 2026-10-07): prices include VAT; no rate / breakdown is approved (supersedes the 18% + before-VAT answer).
      'כן. המחירים כוללים מע״מ, ולא יתווסף אליהם מע״מ.',
      'כן. אפשר להפיק הצעות ולנהל את העסק מהמחשב, מהטאבלט או מהטלפון.',
      'כן. הנתונים שמורים בענן ומוצפנים, גם בזמן ההעברה וגם באחסון. רק אתם יכולים לגשת לנתונים של החשבון שלכם.',
      'כן. אפשר לייצא בכל רגע את היסטוריית הצעות המחיר ואת דוחות ההוצאות לקובצי CSV שמתאימים לאקסל ולתוכנות הנהלת חשבונות.',
    ]) expect(he).toContain(s);
    expect(he).not.toContain('פלטפורמת SaaS');
    expect(he).not.toContain('כל מה ששאלת');
    expect(he).toContain('מה ההבדל בין שלושת הסגנונות?');
  });
  it('EN base answers', () => {
    for (const s of [
      'Yes, TEKANGO is built as a fully responsive modern SaaS platform, allowing you to generate quotes and manage your business from any computer, tablet, or smartphone.',
      'Yes, you can easily export all your business quotes and expense reports into CSV format compatible with Excel and accounting software.',
      'Your data is stored on cloud infrastructure built on Supabase/PostgreSQL, which includes encryption in transit (TLS) and at rest as part of the standard cloud infrastructure. Access to your data is restricted to your own account.',
    ]) expect(en).toContain(s);
    expect(en).not.toContain('fully responsive SaaS platform, so you can');
    expect(en).not.toContain('Yes, you can export your quotes and expense reports into CSV files');
    expect(en).toContain('How do the three styles differ?');
  });
});
