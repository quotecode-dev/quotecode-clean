// LANDING FIRST-LIVE TRUTH GATE (Phase J, 2026-09-22). Owner decisions: PRICING DISPLAY KEEP · ANNUAL PLAN KEEP · 14-DAY FREE TRIAL KEEP.
// Unsupported claims stay removed: timed guarantees, statistical popularity, current invoicing, card processing, broad International
// tax compliance, instant notifications, autonomous AI. The in-app plan comparison uses the same canonical price catalog.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
// visible copy only: strip // and {/* */} comments so historical notes about removed claims do not count
const visible = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const he = visible(read('src/pages/LandingLocal.jsx'));
const en = visible(read('src/pages/LandingGlobal.jsx'));
const modal = visible(read('src/components/PricingModal.jsx'));
const layout = visible(read('src/components/landing/LandingPage.jsx'));
const showcase = visible(read('src/components/landing/QuoteStyleShowcase.jsx'));
const availability = visible(read('src/components/landing/showcaseAvailability.js'));
const html = read('index.html');

const FORBIDDEN = [
  [/תוך דקה|בדקה\b|משלוש דקות|מוכנה תוך דקות/, 'HE timed guarantee'],
  [/in a minute|in minutes|Quotes in Minutes/i, 'EN timed guarantee'],
  [/הפופולרי ביותר|Most Popular|'POPULAR'/, 'statistical popularity badge'],
  [/עדכון מיידי|notified instantly|Instant digital signature/i, 'instant notification / instant approval promise'],
  [/automated tax handling|automate tax calculations|Taxes calculated automatically|international standards with clear tax/i, 'broad International tax claim'],
  [/מע"מ 18% כחוק/, 'legal-compliance assertion'],
  [/invoic|חשבונית|קבלה דיגיטלית/i, 'current invoicing capability'],
  [/accept card|card payments|get paid online|סליקה|תשלום באשראי זמין/i, 'card processing'],
  [/AI (sends|writes|negotiates|collects)|ה-AI (שולח|כותב|גובה)/i, 'autonomous AI action'],
];

// cloud-fix4 A14 (IRON-LANDING-001, retro ledger L09 / L08): outside TEST every account resolves to the Classic
// presentation (supabase/functions/quote-presentation/lib.ts resolveTier -> 'classic'), and tiers are not mapped to
// plans - so no landing copy may promise styles "included in your plan", offer a style choice, or describe Modern /
// Visual as an available feature; and no public landing link goes to the noindex sample-quote QA route.
const STYLE_TRUTH_FORBIDDEN = [
  [/הסגנונות הכלולים במסלול|styles included in your plan|included in your plan/i, 'styles "included in your plan"'],
  [/בוחרים את סגנון ההצגה|choose the presentation style|הסגנון שנבחר להצעה|the style selected for your quote/i, 'a style choice the account does not have'],
  [/Modern מוסיף תמונות מוצר|Modern adds product images/, 'Modern presented as an available feature'],
  [/sample-quote|sampleQuoteHref|צפו בהצעה לדוגמה|לצפייה בהצעה לדוגמה|See a sample quote|View the full sample quote|נתונים סינתטיים|synthetic data/i, 'public sample-quote link / caption'],
];

describe('landing truth gate', () => {
  for (const [name, src] of [['HE landing', he], ['EN landing', en], ['in-app PricingModal', modal]]) {
    for (const [re, what] of FORBIDDEN) {
      it(`${name}: no ${what}`, () => { expect(src.match(re)?.[0] ?? null).toBeNull(); });
    }
  }
  for (const [name, src] of [['HE landing', he], ['EN landing', en], ['landing layout', layout], ['styles showcase', showcase]]) {
    for (const [re, what] of STYLE_TRUTH_FORBIDDEN) {
      it(`${name}: no ${what}`, () => { expect(src.match(re)?.[0] ?? null).toBeNull(); });
    }
  }

  it('Owner 2026-10-14: all three styles are available to every account (HE + EN); the landing labels all three available', () => {
    expect(he).toContain('שלושה סגנונות להצעת מחיר, זמינים לכל המשתמשים');
    expect(he).not.toMatch(/מוצגות בסגנון Classic|להמחשה בלבד, וכרגע אינם זמינים/);
    expect(he).toMatch(/availableBadge: 'זמין לכל המשתמשים'/);
    expect(en).toContain('Three quote styles, available to every account');
    expect(en).not.toMatch(/presented in the Classic style|illustrations only and are not currently available/);
    expect(en).toMatch(/availableBadge: 'Available to every account'/);
    expect(availability).toMatch(/DEFAULT_SHOWCASE_STYLE = 'classic'/);
    expect(availability).toContain("AVAILABLE_SHOWCASE_STYLES = Object.freeze(['classic', 'modern', 'visual'])");
    expect(showcase).toContain('isShowcaseStyleAvailable(id)');
  });

  it('KEEP: the base free business tools section (ledger L03) - base strings, public tools hub, no FREE-plan claim', () => {
    expect(he).toMatch(/title: 'כלים עסקיים חינמיים'/);
    expect(he).toMatch(/cta: 'למעבר לכלים העסקיים',\s*href: '\/he\/tools'/);
    expect(en).toMatch(/title: 'Free Business Tools'/);
    expect(en).toMatch(/cta: 'Explore the Free Business Tools',\s*href: '\/en\/tools'/);
    for (const src of [he, en]) {
      const tools = src.match(/tools: \{[\s\S]*?\n {4}\},/)[0];
      expect(tools).not.toMatch(/FREE|Free plan|מסלול חינמי|Basic|PRO|בסיסי|round|עיגול/);
    }
  });

  it('static index.html fallback claims no invoicing', () => {
    expect(html).not.toMatch(/Invoicing/i);
  });

  // IRON-LANDING-001 as amended by the Owner 2026-10-11 (PROFLOW_PROJECT_CONTEXT.md §249, supersedes the OD-03..OD-08 three-plan
  // cards): Free-10, then ONE all-inclusive package, monthly + annual (annual Owner-approved, §249), with the numbers ONLY from
  // src/domain/subscriptions/packageCatalog.js via landingPackageFacts.js; the 14-day trial stays replaced by Free-10, stated as not
  // yet activated; the paid / checkout "not available" truth stays.
  it('§249 package prices (packageCatalog), the review notice and the Free-10 line are visible; no 14-day trial (HE + EN)', () => {
    for (const p of ['month', 'year']) {
      expect(he).toContain(`ilsPackageAmount('${p}')`);
      expect(en).toContain(`usdPackageAmount('${p}'`); // Task 39: the call also passes the local-estimate rate record (still the catalog price)
    }
    expect(`${he}${en}`).not.toMatch(/landingPlanFacts|ilsAmount\(|usdAmount\(|catalog_block_100|STYLE_COPY/);
    // Task 37: the Owner-approved L7 notice (registration exists; checkout and Free-10 are off) replaced the 2026-10-07 review notice
    // Owner console 2026-10-25 (typed L-06 ... "להפעלת הרכישה בישראל"): Free-10 active in both markets; buying open in Israel only
    expect(he).toContain('המסלולים פעילים: פותחים חשבון בחינם, ואת המנוי בתשלום רוכשים בתוך החשבון.');
    expect(en).toContain('The 10 free quotes are active. The paid package cannot be purchased yet, and there is no online payment. You can already open an account.');
    expect(he).not.toMatch(/basicPricing|proPricing/);
    expect(en).not.toMatch(/basicPricing|proPricing/);
    expect(he).not.toMatch(/14 יום ניסיון|ניסיון PRO/);
    expect(en).not.toMatch(/14-day|PRO trial|Free Trial/);
    // IRON-LANDING-001 amended 2026-10-25 (Owner typed): Free-10 active once verified in Production
    expect(he).toContain('10 הצעות מחיר חינם או 7 ימים מההרשמה, המוקדם מביניהם. ההטבה פעילה.');
    expect(en).toContain('10 free quotes or 7 days, whichever comes first · active now');
    // Task 37: the same "paid / checkout not available" truth in the Owner-approved L1 wording
    // IRON-LANDING-001 amended 2026-10-25: EN still not purchasable; HE bought inside the account
    expect(en).toMatch(/The paid package cannot be purchased yet/);
    expect(he).toMatch(/את המנוי בתשלום רוכשים בתוך החשבון, בחלון המסלולים: בכרטיס אשראי, בתשלום חודשי או שנתי\./);
  });

  it('signup CTAs start the free trial (no pay-now path)', () => {
    expect(he).toMatch(/\/dashboard\?signup=true&lang=he/);
    expect(en).toMatch(/\/dashboard\?signup=true&lang=en/);
    expect(`${he}${en}`).not.toMatch(/Pay now|Buy now|Subscribe now|שלם עכשיו|קנה עכשיו|לתשלום עכשיו/i);
  });

  it('the in-app comparison uses the canonical price catalog (no second, contradicting price list)', () => {
    // OD-03..OD-08: PricingModal renders pricingModalModel, which reads only the approved price catalog through landingPlanFacts
    const model = visible(read('src/domain/subscriptions/pricingModalModel.js'));
    expect(modal).toMatch(/pricingModalModel/);
    // Task 27: the same package facts as the landing (packageCatalog.js through landingPackageFacts.js)
    expect(model).toMatch(/from '\.\.\/\.\.\/components\/landing\/landingPackageFacts'/);
    expect(modal + model).not.toMatch(/PRICING_CATALOG|pricingCatalog'|\? 39\)|: 89\)|EUR|GBP|€|£/);
  });
});
