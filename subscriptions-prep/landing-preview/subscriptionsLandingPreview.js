// Subscriptions landing/content PREVIEW (2026-10-07 night task) - PREVIEW / NOT CONNECTED / NOT ACTIVATED.
//
// Nothing in src/ imports this module. It is a content-only proposal of the strings that would later replace the
// 14-day-trial and Free/Basic/Pro wording in LandingLocal.jsx (HE / ILS) and LandingGlobal.jsx (EN), shaped like the
// existing copy pieces (copy.hero.trial, copy.nav.cta, copy.plans.trialNote, the `plans` card array, copy.faq.items).
// The live landing must keep its current trial wording until the server-side Free-10 mechanism is verified and the
// Owner authorizes activation. Per-surface mapping: docs/subscriptions-prep-2026-10-07/LANDING_CONTENT_CHANGE_MAP.md.
//
// Owner-approved facts used here (2026-10-07): 10 free quotes in total, no expiry, consumed once per quote at its first
// client-facing output; ILS monthly Classic 29 / Modern 49 / Visual 69 (Owner wording: consumer price including VAT where applicable; the VAT rate, any breakdown and how VAT is shown are NOT decided, so the preview shows no VAT line); 100 catalog products
// included in every paid plan; each extra block of 100 products = 5 ILS / month, explicit purchase only; an expansion
// never opens a style or images; no automatic overage charge.
// NOT approved (rendered only as an explicit "not decided" marker): international prices, annual billing, paid quote
// quotas, style/image capability matrix, storage, AI usage, attachments, registration fields, account transition,
// retention / grace / proration, revision policy, catalog-count definition.
//
// Money: HE/ILS display = whole shekel with ".00" through the canonical formatWholeMoney (IRON-ILS-001) - formatting only.
// No VAT rate, VAT breakdown or tax claim is shown: tax treatment of the approved prices is NOT decided (Codex review
// 2026-10-07). No calculation, storage or tax semantics change. EN shows no price figure and no currency symbol (international prices are not decided).
import { formatWholeMoney } from '../../src/utils/money.js';

export const PREVIEW_MARKER = 'PREVIEW — NOT CONNECTED — NOT ACTIVATED';

// --- Owner-approved commercial facts (ILS only) ---------------------------------------------------------------------
export const FREE_QUOTES_TOTAL = 10;
export const PAID_PLAN_IDS = Object.freeze(['classic', 'modern', 'visual']);
export const PLAN_IDS = Object.freeze(['free10', ...PAID_PLAN_IDS]);
export const APPROVED_ILS_MONTHLY = Object.freeze({ classic: 29, modern: 49, visual: 69 });
export const CATALOG_EXPANSION = Object.freeze({ includedProducts: 100, blockSize: 100, ilsPerBlockMonthly: 5 });

// Monthly ILS price = base + 5 x blocks. Capacity = 100 + 100 x blocks. Pure helpers, display only.
export function monthlyIlsPrice(planId, blocks) {
  const base = APPROVED_ILS_MONTHLY[planId];
  if (base === undefined) throw new Error(`no approved ILS price for plan "${planId}"`);
  if (!Number.isInteger(blocks) || blocks < 0) throw new Error('blocks must be a non-negative integer');
  return base + CATALOG_EXPANSION.ilsPerBlockMonthly * blocks;
}

export function catalogCapacity(blocks) {
  if (!Number.isInteger(blocks) || blocks < 0) throw new Error('blocks must be a non-negative integer');
  return CATALOG_EXPANSION.includedProducts + CATALOG_EXPANSION.blockSize * blocks;
}

// Smallest number of blocks an illustrative catalog size needs. Illustration only: the exact counting rule for a
// "catalog product" is still PROPOSED / OPEN (USAGE_PACKAGES_SPEC_ADDENDUM.md section 4), and blocks are bought only
// on the user's explicit request - never derived automatically from usage.
export function minimumBlocksFor(productCount) {
  if (!Number.isInteger(productCount) || productCount < 0) throw new Error('productCount must be a non-negative integer');
  const over = productCount - CATALOG_EXPANSION.includedProducts;
  return over <= 0 ? 0 : Math.ceil(over / CATALOG_EXPANSION.blockSize);
}

const EXAMPLE_PRODUCT_COUNTS = Object.freeze([50, 150, 1000]); // 0 / 1 / 9 expansions on Visual

// --- formatting (HE / ILS) ------------------------------------------------------------------------------------------
const ils = (v) => `₪${formatWholeMoney(v)}`;
const heCount = (n) => n.toLocaleString('en-US');

// --- localized text -------------------------------------------------------------------------------------------------
const NOT_DECIDED = { he: 'טרם נקבע', en: 'Not decided yet' };

const TEXT = {
  he: {
    heroTrialLine: '10 הצעות מחיר חינם בסך הכול, ללא הגבלת זמן',
    cta: {
      navCta: 'התחילו בחינם',
      navCtaShort: 'הרשמה חינם',
      heroCta: 'התחילו בחינם',
      closingCta: 'התחילו בחינם',
      freeCardCta: 'התחילו בחינם',
      paidCardCta: 'הרשמה והתחלה בחינם',
    },
    plansNote: 'כל חשבון חדש מקבל 10 הצעות מחיר חינם בסך הכול, ללא הגבלת זמן. הצעה נספרת רק בפעם הראשונה שהיא יוצאת ללקוח. המסלולים בתשלום — קלאסיק, מודרן וויזואל — עדיין אינם זמינים לרכישה ואין כרגע תשלום מקוון; המחירים מוצגים לידיעה בלבד.',
    names: { free10: 'מסלול חינמי', classic: 'מסלול קלאסיק', modern: 'מסלול מודרן', visual: 'מסלול ויזואל' },
    freeTagline: '10 הצעות לשימוש מול לקוחות, בלי תפוגה.',
    paidTagline: 'מסלול חודשי · עדיין לא זמין לרכישה',
    freePrice: 'חינם',
    perMonth: '/ חודש',
    freeYearly: 'ללא הגבלת זמן',
    paidYearly: 'מחיר חודשי · מסלול שנתי: טרם נקבע',
    features: {
      freeQuotesTotal: '10 הצעות מחיר בסך הכול, ללא תפוגה',
      countedOnFirstOutput: 'הצעה נספרת פעם אחת, כשהיא יוצאת ללקוח לראשונה: שליחה, קישור, קובץ סופי או הדפסה סופית',
      draftsNotCounted: 'טיוטות ותצוגה מקדימה אינן נספרות',
      noticeBeforeUse: 'לפני כל ניצול מוצגות הודעה והיתרה שנותרה',
      includedProducts: '100 מוצרי קטלוג כלולים',
      catalogExpansion: 'הרחבה של 100 מוצרים: ₪5.00 לחודש, רק לפי בחירה מפורשת',
      noAutoOverage: 'ללא חיוב אוטומטי על חריגה',
      paidQuoteQuota: 'מכסת הצעות: טרם נקבע',
      styles: 'סגנונות כלולים: טרם נקבע',
      images: 'תמונות: טרם נקבע',
      storage: 'נפח אחסון: טרם נקבע',
      aiUsage: 'היקף השימוש בעוזר החכם: טרם נקבע',
    },
    expansionsLine: 'כל מסלול בתשלום כולל 100 מוצרי קטלוג. צריכים יותר? אפשר להוסיף הרחבה של 100 מוצרים ב־₪5.00 לחודש לכל הרחבה, רק לפי בחירה מפורשת שלכם. הרחבה מוסיפה מקום למוצרים בלבד ואינה פותחת סגנון או תמונות, ואין חיוב אוטומטי על חריגה.',
    expansionExample: (products, blocks, price) => `מסלול ויזואל עם ${heCount(products)} מוצרים: ${blocks === 0 ? 'ללא הרחבות' : blocks === 1 ? 'הרחבה אחת' : `${blocks} הרחבות`} · ${price} לחודש`,
    faqTrial: {
      q: 'איך עובדות 10 ההצעות החינמיות?',
      a: 'כל חשבון חדש מקבל 10 הצעות מחיר חינם בסך הכול, ללא תפוגה. הצעה נספרת פעם אחת בלבד — בפעם הראשונה שהיא יוצאת ללקוח: שליחה, יצירת קישור לצפייה, קובץ סופי או הדפסה סופית. טיוטות ותצוגה מקדימה אינן נספרות, ותיקון או שימוש חוזר באותה הצעה לאותו לקוח אינם נספרים שוב; הצעה חתומה נשארת נעולה. שכפול להצעה חדשה או החלפת לקוח נספרים כשההצעה החדשה יוצאת ללקוח לראשונה, ומחיקת הצעה אינה מחזירה אותה למכסה. לפני כל ניצול תוצג לכם הודעה והיתרה שנותרה. אחרי ניצול 10 ההצעות, הצעות שכבר יצאו ללקוחות נשארות זמינות לכם.',
    },
    faqExpansion: {
      q: 'מה קורה אם יש לי יותר מ־100 מוצרים בקטלוג?',
      a: 'כל מסלול בתשלום כולל 100 מוצרים. אפשר להוסיף הרחבות של 100 מוצרים כל אחת, ב־₪5.00 לחודש להרחבה, רק לפי בחירה מפורשת שלכם. לדוגמה: מסלול ויזואל עם 50 מוצרים עולה ₪69.00 לחודש; עם 1,000 מוצרים נדרשות 9 הרחבות והמחיר הוא ₪114.00 לחודש. הרחבה אינה פותחת סגנון או תמונות, ואין חיוב אוטומטי על חריגה.',
    },
    table: {
      title: 'השוואת מסלולים',
      rows: {
        freeQuotes: 'הצעות חינם',
        monthlyPrice: 'מחיר חודשי',
        includedProducts: 'מוצרי קטלוג כלולים',
        catalogExpansion: 'הרחבת קטלוג',
        paidQuoteQuota: 'מכסת הצעות',
        styles: 'סגנונות',
        images: 'תמונות',
        storage: 'אחסון',
        aiUsage: 'עוזר חכם',
        attachments: 'קבצים מצורפים',
      },
      freeQuotesValue: '10 בסך הכול, ללא תפוגה',
      notApplicable: 'לא רלוונטי',
      priceSuffix: 'לחודש',
      includedValue: '100',
      expansionValue: '₪5.00 לחודש לכל 100 מוצרים',
    },
    open: {
      internationalPrices: 'מחירים במטבעות אחרים: טרם נקבע',
      annualBilling: 'מסלול שנתי ומחיריו: טרם נקבע',
      paidQuoteQuota: 'מכסת הצעות במסלולים בתשלום: טרם נקבע',
      capabilityMatrix: 'אילו סגנונות כלולים בכל מסלול, ואם הם מצטברים: טרם נקבע',
      imagesPerPlan: 'תמונות לפי מסלול: טרם נקבע',
      storage: 'נפח אחסון ומגבלותיו: טרם נקבע',
      aiUsage: 'הצעה חכמה (בינה מלאכותית) כציר נפרד מהמסלולים - יחידת שימוש, מכסות ומחיר: טרם נקבע',
      attachments: 'קבצים מצורפים לפי מסלול: טרם נקבע',
      registrationFields: 'פרטי ההרשמה הנדרשים: טרם נקבע',
      accountTransition: 'מעבר חשבונות קיימים: טרם נקבע',
      taxTreatment: 'אופן הצגת המע"מ לצד המחירים: טרם נקבע',
      retentionGraceProration: 'משך שמירת המסמכים, מחיקת חשבון, תקופת חסד וחיוב יחסי: טרם נקבע',
      revisionPolicy: 'מתי שינוי מהותי בהצעה מחייב הצעה חדשה: טרם נקבע',
      catalogCountDefinition: 'מה בדיוק נספר כמוצר קטלוג: טרם נקבע',
    },
    app: {
      signupSuccess: 'ההרשמה הצליחה! מכינים את החשבון שלכם עם 10 הצעות מחיר חינם...',
      consumptionWarning: 'פעולה זו תנצל הצעה אחת מתוך 10 ההצעות החינמיות שלכם',
      balance: 'נותרו {remaining} מתוך 10 הצעות חינם',
    },
  },
  en: {
    heroTrialLine: '10 free quotes in total, with no time limit',
    cta: {
      navCta: 'Start free',
      navCtaShort: 'Sign up free',
      heroCta: 'Start free',
      closingCta: 'Start free',
      freeCardCta: 'Start free',
      paidCardCta: 'Sign up and start free',
    },
    plansNote: 'Every new account gets 10 free quotes in total, with no time limit. A quote counts only the first time it goes out to a customer. The paid plans — Classic, Modern and Visual — are not available for purchase yet, and there is no online payment at this stage. Prices for your currency have not been decided yet.',
    names: { free10: 'Free plan', classic: 'Classic plan', modern: 'Modern plan', visual: 'Visual plan' },
    freeTagline: '10 quotes for your customers, with no expiry.',
    paidTagline: 'Monthly plan · not yet available for purchase',
    freePrice: 'Free',
    perMonth: '',
    freeYearly: 'No time limit',
    paidYearly: 'Annual option: not decided yet',
    features: {
      freeQuotesTotal: '10 quotes in total, with no expiry',
      countedOnFirstOutput: 'A quote counts once, the first time it reaches a customer: sending, a share link, a final file or a final print',
      draftsNotCounted: 'Drafts and previews never count',
      noticeBeforeUse: 'You see a notice and your remaining balance before any quote is used',
      includedProducts: '100 catalog products included',
      catalogExpansion: 'Room for 100 more products at a time, only when you choose it',
      noAutoOverage: 'No automatic overage charge',
      paidQuoteQuota: 'Quote allowance: not decided yet',
      styles: 'Included styles: not decided yet',
      images: 'Images: not decided yet',
      storage: 'Storage: not decided yet',
      aiUsage: 'AI assistant usage: not decided yet',
    },
    expansionsLine: 'Every paid plan includes 100 catalog products. Need more? You can add room for 100 more products at a time, only when you explicitly choose to. An expansion adds product room only — it never unlocks a style or images — and there is no automatic overage charge. Expansion pricing for your currency has not been decided yet.',
    expansionExample: (products, blocks) => `Visual plan with ${products.toLocaleString('en-US')} products: ${blocks === 0 ? 'no expansions' : blocks === 1 ? '1 expansion' : `${blocks} expansions`} · price not decided yet`,
    faqTrial: {
      q: 'How do the 10 free quotes work?',
      a: 'Every new account gets 10 free quotes in total, with no expiry. A quote counts only once — the first time it reaches a customer: sending it, creating a share link, a final file or a final print. Drafts and previews never count, and correcting or reusing the same quote for the same customer does not count again; a signed quote stays locked. Duplicating into a new quote or switching to a different customer counts when that new quote first reaches a customer, and deleting a quote does not give it back. Before any quote is used, you see a notice and your remaining balance. After all 10 are used, the quotes you have already issued stay available to you.',
    },
    faqExpansion: {
      q: 'What if my catalog has more than 100 products?',
      a: 'Every paid plan includes 100 products. You can add expansions of 100 products each, only when you explicitly choose to. For example, a Visual plan with 50 products needs no expansion; with 1,000 products it needs 9 expansions. Prices for your currency have not been decided yet. An expansion never unlocks a style or images, and there is no automatic overage charge.',
    },
    table: {
      title: 'Plan comparison',
      rows: {
        freeQuotes: 'Free quotes',
        monthlyPrice: 'Monthly price',
        includedProducts: 'Catalog products included',
        catalogExpansion: 'Catalog expansion',
        paidQuoteQuota: 'Quote allowance',
        styles: 'Styles',
        images: 'Images',
        storage: 'Storage',
        aiUsage: 'AI assistant',
        attachments: 'Attachments',
      },
      freeQuotesValue: '10 in total, no expiry',
      notApplicable: 'Not applicable',
      priceSuffix: '',
      includedValue: '100',
      expansionValue: '100 products per expansion · price not decided yet',
    },
    open: {
      internationalPrices: 'Prices in your currency: not decided yet',
      annualBilling: 'Annual option and its prices: not decided yet',
      paidQuoteQuota: 'Quote allowance on paid plans: not decided yet',
      capabilityMatrix: 'Which styles each plan includes, and whether they build on each other: not decided yet',
      imagesPerPlan: 'Images by plan: not decided yet',
      storage: 'Storage space and its limits: not decided yet',
      aiUsage: 'Smart quote (AI) as a separate axis from the plans - usage unit, allowances and price: not decided yet',
      attachments: 'Attachments by plan: not decided yet',
      registrationFields: 'Required sign-up details: not decided yet',
      accountTransition: 'Moving existing accounts: not decided yet',
      taxTreatment: 'How tax is shown alongside prices: not decided yet',
      retentionGraceProration: 'Document retention period, account deletion, grace period and proration: not decided yet',
      revisionPolicy: 'When a material change requires a new quote: not decided yet',
      catalogCountDefinition: 'Exactly what counts as a catalog product: not decided yet',
    },
    app: {
      signupSuccess: 'Sign-up successful! Setting up your account with 10 free quotes...',
      consumptionWarning: 'This action will use 1 of your 10 free quotes',
      balance: '{remaining} of 10 free quotes left',
    },
  },
};

// Feature keys per card. `approved` facts may be shown with the existing check icon; `open` items have no neutral icon
// in LandingPlans.jsx (only check / X), so they need CR-04 or must stay out of the cards (content-only fallback).
const FREE_FEATURES = [
  ['freeQuotesTotal', 'approved'], ['countedOnFirstOutput', 'approved'], ['draftsNotCounted', 'approved'], ['noticeBeforeUse', 'approved'],
];
const PAID_FEATURES = [
  ['includedProducts', 'approved'], ['catalogExpansion', 'approved'], ['noAutoOverage', 'approved'],
  ['paidQuoteQuota', 'open'], ['styles', 'open'], ['images', 'open'], ['storage', 'open'], ['aiUsage', 'open'],
];

export const CHANGE_REQUESTS = Object.freeze({
  'CR-01': 'Four plan cards (Free-10 + Classic/Modern/Visual) in .tl-plan-grid, which is 3 columns (landing.css:246, 445-454, 508-509).',
  'CR-02': 'A capability / comparison table: no such slot exists in LandingPage.jsx or LandingPlans.jsx.',
  'CR-03': 'Monthly/annual toggle (copy.plans.cycles in LandingPlans.jsx): annual billing is not approved; hiding or reducing it changes the visible control.',
  'CR-04': 'A neutral "not decided" feature row: LandingPlans.jsx renders only a check or an X icon per feature.',
  'CR-05': 'A separate expansions block under the plan cards: no such slot exists.',
});

function stamp(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(stamp));
  if (value && typeof value === 'object') {
    const out = { marker: PREVIEW_MARKER };
    for (const [k, v] of Object.entries(value)) if (k !== 'marker') out[k] = stamp(v);
    return Object.freeze(out);
  }
  return value;
}

export function buildSubscriptionsPreview(lang) {
  if (lang !== 'he' && lang !== 'en') throw new Error(`unsupported preview language "${lang}"`);
  const t = TEXT[lang];
  const isHe = lang === 'he';

  const feature = ([key, status]) => ({ key, status, ok: status === 'approved' ? true : null, text: t.features[key] });

  const planCards = PLAN_IDS.map((id) => {
    if (id === 'free10') {
      return {
        id, name: t.names[id], tagline: t.freeTagline,
        price: t.freePrice, per: '', yearly: t.freeYearly, vatNote: null, savings: null,
        priceStatus: 'approved', purchasable: false,
        features: FREE_FEATURES.map(feature),
        cta: t.cta.freeCardCta,
      };
    }
    return {
      id, name: t.names[id], tagline: t.paidTagline,
      price: isHe ? ils(APPROVED_ILS_MONTHLY[id]) : NOT_DECIDED.en,
      per: isHe ? t.perMonth : '',
      yearly: t.paidYearly,
      vatNote: null, // tax treatment / VAT display not decided
      savings: null,
      priceStatus: isHe ? 'approved' : 'open',
      purchasable: false,
      features: PAID_FEATURES.map(feature),
      cta: t.cta.paidCardCta,
    };
  });

  const expansionExamples = EXAMPLE_PRODUCT_COUNTS.map((products) => {
    const blocks = minimumBlocksFor(products);
    const price = isHe ? ils(monthlyIlsPrice('visual', blocks)) : NOT_DECIDED.en;
    return {
      planId: 'visual', products, blocks, capacity: catalogCapacity(blocks),
      price, priceStatus: isHe ? 'approved' : 'open',
      text: t.expansionExample(products, blocks, price),
    };
  });

  const cell = (text, status) => ({ text, status });
  const nd = cell(NOT_DECIDED[lang], 'open');
  const row = (key, cells) => ({ key, label: t.table.rows[key], cells });
  const paidCells = (fn) => Object.fromEntries(PAID_PLAN_IDS.map((id) => [id, fn(id)]));
  const capabilityTable = {
    changeRequest: 'CR-02',
    title: t.table.title,
    columns: PLAN_IDS.map((id) => ({ id, label: t.names[id] })),
    rows: [
      // Whether a paid account keeps any unused free quotes is part of the open account-transition decision.
      row('freeQuotes', { free10: cell(t.table.freeQuotesValue, 'approved'), ...paidCells(() => nd) }),
      row('monthlyPrice', {
        free10: cell(t.freePrice, 'approved'),
        ...paidCells((id) => (isHe ? cell(`${ils(APPROVED_ILS_MONTHLY[id])} ${t.table.priceSuffix}`, 'approved') : nd)),
      }),
      row('includedProducts', { free10: nd, ...paidCells(() => cell(t.table.includedValue, 'approved')) }),
      row('catalogExpansion', { free10: nd, ...paidCells(() => cell(t.table.expansionValue, isHe ? 'approved' : 'open')) }),
      row('paidQuoteQuota', { free10: cell(t.table.notApplicable, 'approved'), ...paidCells(() => nd) }),
      row('styles', { free10: nd, ...paidCells(() => nd) }),
      row('images', { free10: nd, ...paidCells(() => nd) }),
      row('storage', { free10: nd, ...paidCells(() => nd) }),
      row('aiUsage', { free10: nd, ...paidCells(() => nd) }),
      row('attachments', { free10: nd, ...paidCells(() => nd) }),
    ],
  };

  const openDecisions = Object.entries(t.open).map(([key, text]) => ({ key, status: 'open', text }));

  return stamp({
    lang,
    heroTrialLine: { replaces: 'copy.hero.trial', status: 'contentOnly', text: t.heroTrialLine },
    ctaLabels: {
      replaces: ['copy.nav.cta', 'copy.nav.ctaShort', 'copy.hero.cta', 'copy.closing.cta', 'plans[].cta'],
      status: 'contentOnly',
      nav: { cta: t.cta.navCta, ctaShort: t.cta.navCtaShort },
      hero: { cta: t.cta.heroCta },
      closing: { cta: t.cta.closingCta },
      planCards: { free: t.cta.freeCardCta, paid: t.cta.paidCardCta },
    },
    plans: { replaces: 'copy.plans.trialNote', status: 'contentOnly', trialNote: t.plansNote },
    planCards: {
      replaces: 'plans (array passed to LandingPlans)',
      status: 'changeRequest',
      changeRequest: 'CR-01',
      cards: planCards,
      // Content-only alternative inside the existing 3-column grid: the three paid cards only, with the Free-10 offer
      // carried by the hero line and plans.trialNote; open features stay out of the cards (CR-04 fallback).
      contentOnlyAlternative: { cardIds: [...PAID_PLAN_IDS], featureStatuses: ['approved'] },
    },
    expansionsLine: {
      // Content-only option: carried inside the existing cards (catalogExpansion feature) and/or appended to
      // plans.trialNote. A separate block under the cards is CR-05.
      status: 'contentOnly',
      separateBlockChangeRequest: 'CR-05',
      text: t.expansionsLine,
      examples: expansionExamples,
    },
    faqReplacement: {
      replaces: 'copy.faq.items[4] (the free-trial question)',
      status: 'contentOnly',
      item: { q: t.faqTrial.q, a: t.faqTrial.a },
      optionalExpansionItem: { q: t.faqExpansion.q, a: t.faqExpansion.a },
    },
    cycles: {
      replaces: 'copy.plans.cycles',
      status: 'changeRequest',
      changeRequest: 'CR-03',
      annual: { status: 'open', text: t.open.annualBilling },
    },
    capabilityTable,
    appNotices: {
      // Later, outside the landing (Dashboard signup success / pre-consumption notice / balance). Not landing content.
      status: 'contentOnly',
      signupSuccess: t.app.signupSuccess,
      consumptionWarning: t.app.consumptionWarning,
      balanceTemplate: t.app.balance,
    },
    openDecisions,
  });
}
