import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, PackageCheck, Mail, BriefcaseBusiness, PenTool, Ruler, MessagesSquare, BarChart3, Zap } from 'lucide-react';
import { FONT_HE } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { formatWholeMoney } from '../utils/money';
import { FREE_QUOTES_TOTAL, ilsPackageAmount, ilsAnnualSaving, ilsAnnualSavingRate } from '../components/landing/landingPackageFacts';
import BrandName from '../components/BrandName';
import LandingPage from '../components/landing/LandingPage';
import { SMART_PACK_ENABLED } from '../components/landing/smartPackFacts';
import { ilsSmartPack, ilsWithSmartPack } from '../components/landing/smartPackFacts';
import { SMART_PACK } from '../domain/subscriptions/addOnCatalog';
import MailLink from '../components/MailLink';

// Task 16 (correction A, 2026-10-05): the Local (HE / ILS) landing now uses the approved refined composition
// (revision-r2-refined landing-he.html) through the shared LandingPage layout. This file keeps EVERY customer-facing
// string and all commercial data, so the landing truth gates (landingTruth.static, landingCopyTruthfulness,
// landingFirstLiveTruth, landingTrialAndIconPolish, savingsClaimTruthfulness, subscriptionIntent) keep scanning the
// real copy. IRON-LANDING-001: only verified capabilities; no timed guarantee, statistical badge, invoicing, checkout,
// broad tax or instant claim. Plans (IRON-LANDING-001 as amended by the Owner 2026-10-11, PROFLOW_PROJECT_CONTEXT.md §249, review
// display): Free-10, then ONE all-inclusive package - ₪30 per renewing month or ₪306 per renewing year, including VAT - with the numbers
// from src/domain/subscriptions/packageCatalog.js; registration and billing are not active (review notice). Free-10 (10 quotes in
// total, never a time-limited trial; OD-01) and every "10 הצעות חינם" button carry the true state: not yet activated - until
// activation, a new account opens without a trial and without a plan assigned. Owner 2026-10-11: the Hebrew copy is rewritten into
// natural Hebrew with the same facts (strings from the Owner's own 2026-10-06 language edit are kept as written).
// Market: ILS only - no $ / USD anywhere on this page.

export default function LandingLocal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  useEffect(() => {
    // /he is THE Local canonical (locked policy TEKANGO_AI_ARCHITECTURE.md §55.11); title / description / hreflang /
    // structured data come from the ONE public SEO table the prerender build also uses.
    setSeoMeta(publicSeo('/he'));
  }, []);

  // §249: two review cards in six shared regions (LandingPlans.jsx) - Free-10, then the one all-inclusive package with one price row
  // per billing period. IL prices INCLUDE VAT - no rate, no breakdown, nothing added on top; the annual price is shown as a price, never
  // as a savings badge. "All available capabilities" = what the account has today (Modern / Visual stay illustrations, see styles).
  // No paid quote quota, storage or AI claim. No purchase / signup action on a card (billing is not active).
  const savingRate = ilsAnnualSavingRate();
  const plans = [
    {
      id: 'free', icon: Gift, name: 'חינם', tagline: 'חינם עד 10 הצעות או 7 ימים, המוקדם מביניהם.',
      prices: [{ period: 'free', amount: `₪${formatWholeMoney(0)}`, per: null }],
      capacity: [`${FREE_QUOTES_TOTAL} הצעות מחיר בסך הכול`, 'או 7 ימים מההרשמה, המוקדם מביניהם', 'בשבעת הימים כלול גם חכם פלוס'],
      features: [
        'הצעה נספרת בשמירה הראשונה עם לקוח ופריט; גרסה חדשה או לקוח אחר נספרים שוב',
        'טיוטה ריקה ותצוגה מקדימה לא נספרות',
        'הצעות שכבר יצאו נשארות זמינות',
      ],
      // Owner 2026-10-25 ("למה בכלל צריך להזכיר את זה?"): no status line on the Free card - the offer speaks for itself
      notice: null,
    },
    {
      id: 'all_inclusive', icon: PackageCheck, name: 'הכול כלול', tagline: 'מסלול אחד עם כל היכולות הזמינות במערכת, בתשלום חודשי או שנתי.',
      prices: [
        { period: 'month', amount: ilsPackageAmount('month'), per: '/ חודש' },
        // Task 26 (Owner 2026-10-11, exact wording): shown only while the annual period is chosen - the permanent saving rate and amount vs
        // 12 monthly payments, from the catalog rows (rate before display rounding; amount per IRON-ILS-001).
        { period: 'year', amount: ilsPackageAmount('year'), per: '/ שנה', note: <>חיסכון של {savingRate.exact ? '' : 'כ-'}<bdi dir="ltr">{savingRate.text}</bdi> - <bdi dir="ltr">{ilsAnnualSaving()}</bdi> בשנה</> },
      ],
      // Task 26: the visitor chooses ONE billing period and sees that single price (initially monthly); review display only.
      periodChoice: { legend: 'תקופת חיוב', labels: { month: 'חודשי', year: 'שנתי' } },
      // Owner 2026-10-20 (TEST only): the "חכם פלוס" add-on box - ticked, the shown price is the package plus the add-on for the period.
      ...(SMART_PACK_ENABLED ? {
        addOn: {
          label: 'הוספת חכם פלוס',
          // Owner 2026-10-20 (phone): what SMART PACK gives, right under its box (the one source: addOnCatalog)
          summary: SMART_PACK.summary.he,
          perPeriod: {
            month: { add: <>(+<bdi dir="ltr">{ilsSmartPack('month')}</bdi> לחודש)</>, amount: ilsWithSmartPack('month'), line: <>כולל חכם פלוס: <bdi dir="ltr">{ilsPackageAmount('month')}</bdi> + <bdi dir="ltr">{ilsSmartPack('month')}</bdi></> },
            year: { add: <>(+<bdi dir="ltr">{ilsSmartPack('year')}</bdi> לשנה)</>, amount: ilsWithSmartPack('year'), line: <>כולל חכם פלוס: <bdi dir="ltr">{ilsPackageAmount('year')}</bdi> + <bdi dir="ltr">{ilsSmartPack('year')}</bdi></> },
          },
        },
      } : {}),
      capacity: [`אחרי ${FREE_QUOTES_TOTAL} ההצעות החינמיות`, 'חיוב חודשי או שנתי, לפי בחירתכם'],
      features: ['המנוי החודשי מתחדש כל חודש', 'המנוי השנתי מתחדש כל שנה'],
      notice: 'לרכישה בתוך החשבון, בחלון המסלולים',
    },
  ];

  const copy = {
    fontFamily: FONT_HE,
    links: { home: '/he', login: '/dashboard?lang=he', signup: '/dashboard?signup=true&lang=he' },
    // The Free-10 calls to action (hero, plans, closing) keep the existing signup path; the status pill is part of every button
    // until the server activation of Free-10 is verified (planSystemActive=false, activationPhase=off today).
    free10: { cta: '10 הצעות חינם', status: null },
    nav: {
      label: 'ניווט ראשי',
      homeLabel: 'TEKANGO - דף הבית',
      sections: [
        { id: 'styles', label: 'סגנונות' },
        { id: 'workflow', label: 'איך זה עובד' },
        { id: 'plans', label: 'מסלולים' },
        { id: 'faq', label: 'שאלות' },
      ],
      // Base labels (L05): desktop sign-in 'כניסה למערכת'; the narrow-width (drawer) label stays the base mobile 'כניסה'.
      login: 'כניסה למערכת',
      loginShort: 'כניסה',
      // IRON-LANDING-001 (amended 2026-10-11): the Free-10 button, always with its true status.
      cta: '10 הצעות חינם',
      ctaStatus: null,
      menu: 'תפריט',
      closeMenu: 'סגירת התפריט',
      forgotPassword: 'שכחתם את הסיסמה?',
    },
    hero: {
      // Authority ledger L07b: no hero eyebrow (the base hero had none).
      // Authority ledger L07 (pointwise rollback, cloud-fix4): hero h1 + subtitle = base c65f742 LandingLocal.jsx:272-279
      // verbatim (the base h1's second line, formerly a purple gradient span, is plain text in the light composition).
      // The base subtitle names no presentation style (landing truth L09: every account is Classic outside TEST).
      title: <>{'הצעות מחיר וניהול\u00A0העסק '}<br />בקלות ובמהירות</>,
      text: 'מערכת להפקת הצעות מחיר ולניהול העסק, המותאמת לעסקים בישראל: חישוב מע״מ 18% בהצעות, מחירים בשקלים, חתימה דיגיטלית של הלקוח וניהול לקוחות.',
      // L08: no public link / caption to the sample-quote route (no authority); the figure keeps an accessible name only.
      docLabel: 'הצעת מחיר לדוגמה בסגנון Classic',
      // OD-01 / IRON-LANDING-001: the line under the Free-10 button states the offer and its true state.
      trial: '10 הצעות מחיר חינם או 7 ימים מההרשמה, המוקדם מביניהם.',
      motion: {
        eyebrow: 'הצעות מחיר שעובדות בשבילכם',
        title: 'מהעבודה בשטח להצעה חתומה',
        text: 'הצעות מקצועיות, אישור מהיר ועסק מסודר, מהמחשב או מהטלפון.',
        cta: 'מתחילים עכשיו',
      },
    },
    styles: {
      eyebrow: 'שלושה סגנונות, מראה אחיד',
      title: 'מסמך שמתאים לאופי העסק שלכם',
      // L09: the capability every account has is Classic; Modern / Visual are illustrations only, never "included".
      intro: 'שלושה סגנונות להצעת מחיר, זמינים לכל המשתמשים: Classic - מסמך עסקי נקי עם פרטי העסקה וטבלת פריטים ומחירים ברורה; Modern - עם תמונות מוצר; Visual - עם תמונת פרויקט מרכזית. בוחרים סגנון בהגדרות העסק או בכל הצעה.',
      tablistLabel: 'סגנונות הצעת מחיר',
      // cloud-fix4b (Codex, truth): the phone layout with long amounts puts the description on its own full row, so the copy
      // may not promise "four columns on phones"; it states exactly what is kept (the four commercial fields).
      shared: 'בכל הסגנונות נשמרים ארבעת השדות של טבלת הפריטים: תיאור פריט, כמות, מחיר יחידה וסה״כ. בטלפון, כשהסכומים ארוכים, התיאור עובר לשורה מלאה ושלושת הערכים המספריים מופיעים מתחת לכותרות שלהם. רמת הפירוט (מקוצרת או מורחבת) נבחרת בנפרד מהסגנון.',
      availableBadge: 'זמין לכל המשתמשים',
      previewBadge: 'דוגמה בלבד · לא זמין כרגע',
      previewNote: 'להמחשה בלבד.',
      viewerLabel: 'הצעת מחיר לדוגמה בסגנון הנבחר',
      // Task 27 (Owner-approved image): atmosphere photo beside the live style showcase (synthetic sample data, no identity numbers)
      photo: { src: '/assets/landing/quote-electrician-he.webp', width: 1280, height: 699, alt: 'חשמלאי מחזיק טלפון עם הצעת מחיר של TEKANGO' },
    },
    // Authority ledger L07 (pointwise rollback): base "how it works" title, subtitle and three steps verbatim
    // (c65f742 LandingLocal.jsx:396-402). The reference eyebrow "ארבעה צעדים" has no base counterpart and would be false
    // with the three base steps, so the section has no eyebrow.
    workflow: {
      title: 'איך זה עובד?',
      intro: 'מהצעה ראשונה ועד חתימת הלקוח, בשלושה צעדים.',
      steps: [
        { title: 'יצירה', text: 'צרו הצעת מחיר שלב אחר שלב, עם פריטים רגילים, לפי מידות או מהקטלוג. הסכומים והמע״מ מחושבים תוך כדי הזנת הפרטים.' },
        { title: 'שליחה', text: 'שלחו ללקוח קישור אישי לצפייה בהצעה מכל מכשיר, בלי להדפיס ובלי לצרף קבצים למייל.' },
        { title: 'אישור וחתימה', text: 'הלקוח מאשר וחותם דיגיטלית מהטלפון, ומצב ההצעה מתעדכן בחשבון שלכם.' },
      ],
    },
    business: {
      phoneShowcaseAlt: 'בעל מקצוע מצביע על רשימת הצעות המחיר של TEKANGO בטלפון',
      // Authority ledger L07b: no eyebrow / heading (the base feature-card block had none).
      // Authority ledger L15 (rollback): the reference management preview and its three benefits are removed; the base
      // five-card set is complete again (card 1 "הפקת הצעות מחיר בקלות", c65f742 LandingLocal.jsx:455-461, verbatim).
      capabilities: [
        // Card order = base c65f742 (quotes, signature, income/expenses, measurements, AI) - ledger R21 / L04 / L15.
        { icon: Zap, title: 'הפקת הצעות מחיר בקלות', text: 'צרו הצעות מחיר מסודרות, עם חישוב מע״מ אוטומטי, הנחות ומוצרים מהקטלוג שלכם.' },
        { icon: PenTool, title: 'חתימה דיגיטלית ואישור לקוח', text: 'שלחו ללקוח קישור שבו אפשר לצפות בהצעה, להדפיס אותה או לשמור אותה כ-PDF, לחתום דיגיטלית ולאשר את ההזמנה מהטלפון או מהמחשב.' },
        // Base text verbatim (L04), including the base typo "ווקבל" (reported to the Owner, not silently corrected).
        { icon: BarChart3, title: 'ניהול הכנסות והוצאות', text: 'עקבו אחר רווחי העסק, נהלו הוצאות שוטפות וקבלו תמונת מצב כספית עדכנית.' },
        // Generic trade capability (QuoteForm.jsx: area / linear measurement rows) - deliberately no plan tier named here.
        { icon: Ruler, title: 'הצעות מחיר לפי מידות ומפרט', text: <>בנו הצעה לפי מידות אמיתיות (שטח או אורך), עם כמה שורות מדידה לכל פריט וחישוב כמות אוטומטי. מתאים לזכוכית ואלומיניום, ריצוף, חשמל, אינסטלציה ותחומים נוספים: פחות חישובים ידניים וטעויות, וחיסכון בזמן בהצעות חוזרות.</> },
        // Task 34 (Owner: the AI card describes ONLY what the LIVE product really has): the AI assistant inside the signed-in workflows - the
        // Owner HE wording of 2026-10-06 without the false "previous chats are kept" claim (Task 33). The AI quote DRAFT is not in Production yet,
        // so it is not advertised here; its card text is part of the AI release package (evidence/task34-followup/AI_RELEASE_PACKAGE.md).
        // Task 37 (Owner-approved): only what LIVE has - the step-aware help; the draft review ("the quote in front of you") is TEST only.
        { icon: MessagesSquare, title: 'עוזר חכם שמלווה אתכם בעבודה', text: 'עוזר ה-AI של TEKANGO עומד לרשותכם כשאתם מכינים הצעות מחיר, מנהלים לקוחות או מעדכנים את ההגדרות. שאלו על השלב שבו אתם נמצאים, או בקשו הכוונה.' },
      ],
    },
    // Owner 2026-10-20: the "חכם פלוס" promotion - TEST only (SmartPackShowcase renders nothing in a production build). Prices = the
    // Owner decision of 2026-10-20 (10 ILS a month; yearly with the 15% saving = 102 ILS), always an add-on the customer chooses.
    smartPack: {
      badge: 'חדש · תוספת למנוי',
      name: 'חכם פלוס',
      lead: 'העוזר החכם של TEKANGO: מדבר, מקשיב, מכיר את העסק שלכם ועוזר לנסח הצעות מחיר.',
      demoLabel: 'הדגמה: שאלה בקול לעוזר החכם ותשובה מהנתונים של העסק',
      demoTitle: 'העוזר החכם',
      demoQuestion: 'כמה הצעות מחכות לאישור השבוע?',
      demoAnswer: 'שלוש הצעות מחכות לאישור. שתיים מהן נצפו היום, וכדאי לפנות שוב ללקוחות שקיבלו אותן.',
      soon: 'בקרוב',
      features: [
        { icon: 'chat', title: 'צ׳אט חכם שמכיר את העסק', text: 'שואלים על ההצעות, הלקוחות, הקטלוג והמשימות, ומקבלים תשובה מהנתונים האמיתיים שלכם.' },
        { icon: 'voice', title: 'צ׳אט קולי', text: 'שואלים בקול ושומעים את התשובה, גם מהשטח וגם כשהידיים עסוקות.' },
        { icon: 'ai', title: 'הצעה חכמה עם AI', text: 'מתארים את העבודה, או מכתיבים בקול, וה-AI מנסח את שורות ההצעה. אתם בודקים ומאשרים.' },
        { icon: 'files', title: 'קבצים מצורפים להצעה', text: 'שרטוטים, תמונות ומסמכים שמצורפים להצעה שהלקוח מקבל.' },
        // Owner console 2026-10-22, typed: "מאשר שינוי ב-L-14 וב-L-22: כרטיס בדיקת הלקוח בדף הנחיתה בלי 'בקרוב' ובנוסח שהוצע ..." - Customer Twin is LIVE (PR #47)
        { icon: 'twin', title: 'בדיקת הלקוח', text: 'ראו את ההצעה דרך העיניים של הלקוח: שלושה סוגי לקוחות בודקים אותה, כדי שתוכלו לחזק אותה לפני השליחה.' },
      ],
      priceMonth: '₪10',
      priceMonthLabel: 'לחודש, בתוספת למנוי',
      priceYear: 'או ₪102 לשנה במנוי שנתי',
      // Owner console 2026-10-25 (typed L-14): never 'add or remove any time' - stopping it is a request to us
      points: ['מוסיפים רק אם רוצים', 'להפסקה כותבים לנו', 'משלמים יחד עם המנוי, באותו מועד'],
      // Owner 2026-10-20: what SMART PACK gives, next to its button too - a second check list in its own colour (the one source: addOnCatalog)
      // Owner 2026-10-20: on the landing list the attachments line reads 'צירוף קבצים ותמונות להצעה' (images are attached files too)
      includes: SMART_PACK.includes.he.map((t) => (t === 'צירוף קבצים להצעה' ? 'צירוף קבצים ותמונות להצעה' : t)),
      cta: 'למסלולים ולמחירים',
      note: 'המחירים כוללים מע״מ. מוסיפים את התוספת בחלון המסלולים, יחד עם המנוי.',
    },
    plans: {
      // Base section heading (L12); no eyebrow. The subtitle states the §249 model (Free-10, then one package).
      title: 'מסלולים ומחירים',
      // Owner 2026-10-23 (typed L-14, morning report item 8): the 7 days, as everywhere else
      intro: '10 הצעות מחיר חינם או 7 ימים, המוקדם מביניהם, ואחר כך מסלול אחד שכולל הכול, בתשלום חודשי או שנתי.',
      // Task 37 (Owner-approved L1 meaning, 2026-10-12): true on LIVE (signup states its own trial terms) and on TEST; Free-10 and the paid
      // plan stated as not active / not purchasable; prices stay visible.
      trialNote: 'את המנוי בתשלום רוכשים בתוך החשבון, בחלון המסלולים: בכרטיס אשראי, בתשלום חודשי או שנתי.',
      // Owner 2026-10-07: review notice for the new plan cards (exact wording).
      // Task 37 (Owner-approved L7): registration exists, checkout and Free-10 are off - no reviewer note on a customer page.
      reviewNotice: 'פותחים חשבון בחינם, ואת המנוי בתשלום רוכשים בתוך החשבון.',
      // OD-05: the exact required sentence; no rate or breakdown.
      priceNote: 'המחירים כוללים מע״מ',
    },
    // Authority ledger L07b (pointwise rollback): base FAQ heading + subtitle (c65f742 LandingLocal.jsx:669-670); no eyebrow.
    faq: {
      title: 'שאלות נפוצות',
      intro: 'כל מה שכדאי לדעת לפני שמתחילים.',
      items: [
        // L09: Classic is the only presentation outside TEST; Modern / Visual are described as illustrations, not features.
        { q: 'מה ההבדל בין שלושת הסגנונות?', a: 'שלושת הסגנונות זמינים לכל המשתמשים: Classic - מסמך עסקי נקי עם טבלת פריטים ומחירים מלאה וברורה; Modern - עם תמונות מוצר; Visual - עם תמונת פרויקט מרכזית. אפשר לקבוע סגנון ברירת מחדל בהגדרות העסק ולשנות אותו בכל הצעה.' },
        { q: 'האם צפייה בסגנון אחר משנה את המנוי?', a: 'לא. הצפייה בדוגמאות בדף הזה לא משנה את המסלול שלכם ולא את ההצעות שלכם.' },
        { q: 'מה קורה להצעה שנשלחה אחרי שינוי מסלול?', a: 'הצעה שנשלחה או נחתמה נשארת כפי שהלקוח קיבל אותה, כולל העיצוב שלה.' },
        // OD-05: the plan prices include VAT; no rate / breakdown is approved, and none is added on top.
        { q: 'האם המחירים המוצגים כוללים מע״מ?', a: 'כן. המחירים כוללים מע״מ, ולא יתווסף אליהם מע״מ.' },
        // OD-01/OD-02 (Owner 2026-10-07): the trial question is replaced by the Free-10 policy, truthfully not yet activated.
        // Task 37 (Owner-approved): the same facts as scannable points; the last line = the L1 meaning.
        { q: 'איך עובדות 10 ההצעות החינמיות?', a: <>ההטבה כוללת 10 הצעות מחיר חינם בסך הכול, או 7 ימים מההרשמה, המוקדם מביניהם. בשבעת הימים כלול גם חכם פלוס.<ul className="tl-faq-list"><li>הצעה נספרת בפעם הראשונה שהיא נשמרת עם לקוח ולפחות פריט אחד. שמירה חוזרת אחרי עריכה לא נספרת שוב.</li><li>שליחה או הפקה חוזרת של אותה גרסה לאותו לקוח לא נספרת, בשום ערוץ: שליחה, קישור לצפייה, PDF או הדפסה.</li><li>שינוי הלקוח, שם הנמען או תוכן ההצעה והפקה מחדש נספרים כהצעה נוספת.</li><li>טיוטה ריקה ותצוגה מקדימה לא נספרות.</li><li>מחיקת הצעה לא מחזירה אותה למכסה, והצעות שכבר יצאו ללקוחות נשארות זמינות.</li></ul>בחשבונות שנפתחו לפני הפעלת ההטבה, שבעת הימים נספרים מיום ההפעלה.</> },
        { q: 'האם המערכת מותאמת לסמארטפון ולמחשב?', a: 'כן. אפשר להפיק הצעות ולנהל את העסק מהמחשב, מהטאבלט או מהטלפון.' },
        // Verifiable infrastructure facts only (TLS in transit, encryption at rest by the Supabase/PostgreSQL platform).
        { q: 'האם הנתונים העסקיים שלי מאובטחים בענן?', a: 'כן. הנתונים שמורים בענן ומוצפנים, גם בזמן ההעברה וגם באחסון. רק אתם יכולים לגשת לנתונים של החשבון שלכם.' },
        // Task 39 (Owner final scope): the cancellation-request path - a request handled by the team, never shown as an automatic cancellation.
        { q: 'איך מבקשים ביטול מנוי?', a: <>אפשר לבקש ביטול מנוי בכל עת במייל אל {/* PRODUCT_TRUTH_DECORATIVE: mailto link that opens a cancellation-request email to the service mailbox (handled by the team; no automatic cancellation) */}<MailLink href="mailto:support@tekango.com?subject=%D7%91%D7%A7%D7%A9%D7%AA%20%D7%91%D7%99%D7%98%D7%95%D7%9C%20%D7%9E%D7%A0%D7%95%D7%99&body=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%91%D7%A7%D7%A9%20%D7%9C%D7%91%D7%98%D7%9C%20%D7%90%D7%AA%20%D7%94%D7%9E%D7%A0%D7%95%D7%99%20%D7%A9%D7%9C%D7%99." isHebrew><bdi dir="ltr">support@tekango.com</bdi></MailLink> או מתוך חלון המסלולים במערכת. הצוות מטפל בבקשה ושולח אישור במייל. הביטול אינו אוטומטי. ביטול מנוי אינו מחיקת חשבון. תנאי הביטול וההחזרים מפורטים {/* PRODUCT_TRUTH_DECORATIVE: public legal page link (the cancellation and refund terms) */}<a href="/he/terms#cancellation">בתנאי השימוש</a>.</> },
        { q: 'האם ניתן לייצא את נתוני ההצעות והדוחות לאקסל?', a: 'כן. אפשר לייצא בכל רגע את היסטוריית הצעות המחיר ואת דוחות ההוצאות לקובצי CSV שמתאימים לאקסל ולתוכנות הנהלת חשבונות.' },
        // Owner console 2026-10-20 (typed: "מאשר לשנות את נוסחי דף הנחיתה ואת הבדיקות שנועלות אותם: ... ושאלות נפוצות חדשות מאומתות"): questions
        // users asked in the smart chat and the support inbox; every answer = the verified how-to facts (src/data/productHowTo.js) and L-12 contact.
        { q: 'איך נרשמים?', a: 'לוחצים "מתחילים עכשיו", ממלאים אימייל וסיסמה ומאשרים את תנאי השימוש ואת מדיניות הפרטיות. אחר כך פותחים את הקישור שנשלח אליכם במייל, והחשבון מוכן. לפני ההצעה הראשונה ממלאים בהגדרות העסק את טלפון העסק ואת מספר העוסק.' },
        { q: 'איך שולחים את ההצעה ללקוח?', a: 'שולחים אותה במייל או בוואטסאפ, או מעתיקים הודעה עם קישור להצעה ומדביקים אותה בכל מקום. הלקוח פותח את הקישור מכל מכשיר. אפשר גם להוריד את ההצעה כ-PDF.' },
        { q: 'הלקוח יכול לחתום על ההצעה מהטלפון?', a: 'כן. הלקוח פותח את הקישור, מאשר את ההצעה וחותם עליה דיגיטלית, ומצב ההצעה מתעדכן אצלכם. הצעה חתומה נעולה לעריכה, ואפשר לשכפל אותה כדי ליצור ממנה הצעה חדשה.' },
        { q: 'אפשר לשמור מחירון קבוע של מוצרים ושירותים?', a: 'כן. מוסיפים לקטלוג פריטים עם המחירים שלהם, ובוחרים מהם כשמכינים הצעה.' },
        { q: 'אפשר להתחיל הצעה חדשה מהצעה קיימת?', a: 'כן. שומרים את ההצעה בתור תבנית, בלי פרטי הלקוח. בהצעה הבאה לוחצים "הצעה חדשה" ובוחרים "מתבנית שמורה".' },
        { q: 'איך יוצרים איתכם קשר?', a: <>במייל {/* PRODUCT_TRUTH_DECORATIVE: mailto link to the support mailbox */}<MailLink href="mailto:support@tekango.com" isHebrew><bdi dir="ltr">support@tekango.com</bdi></MailLink>, או בצ׳אט שבפינת המסך. כרגע אין מענה טלפוני.</> },
      ],
    },
    // Free business tools (base section, ledger L03 - base c65f742 LandingLocal.jsx:716-726, verbatim). The public tools
    // hub (/he/tools: currency, units, metals, crypto - App.jsx routes, no signup) exists; no plan / FREE claim here.
    tools: {
      title: 'כלים עסקיים חינמיים',
      text: 'מחשבונים חינמיים למטבעות, יחידות, מתכות וקריפטו. פתוחים לכולם, בלי הרשמה.',
      cta: 'למעבר לכלים העסקיים',
      href: '/he/tools',
      icon: BriefcaseBusiness,
    },
    // Closing band: outcome only - never the trial duration (it is stated in the hero, pricing and FAQ).
    // Authority ledger L07 (pointwise rollback): base closing title + text (c65f742 LandingLocal.jsx:736-737).
    closing: {
      title: 'מוכנים ליצור את ההצעה הראשונה שלכם?',
      text: 'הצעת מחיר ברורה, שלב אחר שלב.',
    },
    // Footer (ledger L17): base brand markup (c65f742 LandingLocal.jsx:765 `<BrandName />` on the dark footer); no new label.
    footer: {
      copyright: <>&copy; {new Date().getFullYear()} <BrandName /> ישראל. כל הזכויות שמורות.</>,
      links: [
        { href: '/he/terms', label: 'תנאי שימוש' },
        { href: '/he/privacy', label: 'מדיניות פרטיות' },
        { href: '/he/terms#cancellation', label: 'ביטול מנוי והחזרים' },
        { kind: 'accessibility', label: 'נגישות' },
        { href: '/he/contact', label: 'צרו קשר (support@tekango.com)', icon: Mail },
        { href: '/he/tools', label: 'כלים לעסקים', icon: BriefcaseBusiness },
      ],
    },
  };

  return (
    <LandingPage
      lang="he"
      copy={copy}
      plans={plans}
      navigate={navigate}
      onForgotPassword={onForgotPassword}
      accessibilityOpen={accessibilityOpen}
      onAccessibilityOpen={() => setAccessibilityOpen(true)}
      onAccessibilityClose={() => setAccessibilityOpen(false)}
    />
  );
}
