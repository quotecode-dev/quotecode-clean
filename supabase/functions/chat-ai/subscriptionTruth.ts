// SUBSCRIPTION TRUTH (OD-01..OD-20, 2026-10-07; CROSSCUT_CONTRACT stream C).
//
// Same shape as paymentTruth.ts: a conservative classifier, a DETERMINISTIC answer (no model call) built only from
// AI_FACTS.subscriptions (generated from subscriptionContract.ts + priceCatalog.js) and the SERVER account summary, an
// authoritative system-prompt block, and an answer validator that rejects a model answer which states retired plan truth.
//
// Task 27 (§249 + the Owner's 2026-10-11 amendment): the current offer is Free-10 and then ONE all-inclusive package billed monthly or
// annually (IL ₪30.00 / ₪306.00 incl. VAT, saving ₪54.00 = 15%; INTERNATIONAL $18.00 / $184.00 USD, saving $32.00 ≈ 15%). Classic /
// Modern / Visual are quote presentation styles; as plan names they exist only as legacy plans of existing accounts.
// What may be stated: Free, the package (HE חינם / הכול כלול) and its monthly + annual prices and annual saving (IL in ILS including
// VAT; International in USD - billing always USD, a local-currency figure is only an estimate); the 100 catalog products of every paid
// plan and the explicit +100 add-on price; the Free-10 rules (10 quotes in total, no expiry; one is used per quote VERSION + client (Task 30) when it reaches a
// client; drafts/previews do not use one; deleting does not refund; existing documents stay accessible); and that the plan system is not
// active yet. What may NOT be stated: a trial, the retired two-tier plan names, monthly quote counters, "unlimited", old or other prices,
// and every value that is not decided (paid quote limits, capability matrix, storage, AI quotas, attachments,
// cancellation/refund/proration, tax beyond the IL inclusion). The account's own plan / balance is
// stated ONLY from the server account summary - never from the user's message, the locale or the market.
import { AI_FACTS } from "./aiFacts.generated.ts";
import type { AccountPlanContext } from "./accountContext.ts";

const S = AI_FACTS.subscriptions;
type Lang = 'he' | 'en';
type LegacyPlanId = 'classic' | 'modern' | 'visual';
const LEGACY: readonly LegacyPlanId[] = ['classic', 'modern', 'visual'];
const PKG = 'all_inclusive';

export type SubscriptionIntent =
  | 'trial' | 'legacy_plan' | 'my_plan' | 'balance' | 'unlimited' | 'plan_contents' | 'pricing' | 'annual' | 'quota';

const planName = (id: string, lang: Lang): string => S.plans.find((p) => p.id === id)?.[lang] ?? id;

// ------------------------------------------------------------------------------------------------------- classifier
// Lifecycle / refund questions belong to the existing lifecycle + payment truth (not self-service; refunds not decided).
const LIFECYCLE = /\b(cancel\w*|refund\w*|delete\w*|close my account)\b|(ביטול|לבטל|מבטל|החזר כספי|זיכוי|למחוק|מחיקת)/i;
// Quote-content questions ("the price of this item") are not plan questions unless a plan word is also present.
const QUOTE_WORD_EN = /\b(quote'?s?|items?|clients?|customers?|line|invoices?|services?|expenses?)\b/i;
const QUOTE_WORD_HE = /(הצעה|הצעת|ההצעה|פריט|לקוח|חשבונית|שירות|הוצאה)/;
const PLAN_WORD_EN = /\b(plans?|subscriptions?|tiers?|packages?|tekango|classic|modern|visual|pro|basic|premium|membership|add-?on|catalog expansion|extra (100 )?products)\b/i;
const PLAN_WORD_HE = /(מסלול|מסלולים|תוכנית|תוכניות|מנוי|חבילה|חבילת|TEKANGO|טקנגו|קלאסיק|מודרן|ויזואל|הרחבת\s*(ה)?קטלוג)/;
const PRICE_WORD_EN = /\b(price|prices|pricing|cost|costs|how much|fee|fees|charge|charged)\b/i;
const PRICE_WORD_HE = /(כמה\s+(זה\s+)?(עולה|עולים|עולות|יעלה)|מחיר|מחירים|עלות|תמחור|תעריף)/;
const MONEY_WORD_EN = /\b(month(ly)?|per month|shekels?|ils|nis|usd|dollars?|euros?|eur|gbp|pounds?|currency|vat|site)\b|₪|\$/i;
const MONEY_WORD_HE = /(בחודש|לחודש|חודשי|שקל|ש"ח|ש״ח|₪|דולר|מע"מ|מע״מ|מטבע|באתר)/;

// Night task 2026-10-16 (R-01, Owner-approved): "14 days" alone is a quote validity / payment term, not a trial - it is a trial
// question only next to a free / plan / account / sign-up word; "how many quotes did I send" is a statistics question, not a quota.
const TRIAL_14_EN = /\b(14|fourteen)[- ]?days?\b.{0,40}\b(free|plan|account|subscription|sign[- ]?up|register\w*|tekango|use (it|the app|the system))\b|\b(free|plan|account|subscription|sign[- ]?up|register\w*|tekango)\b.{0,40}\b(14|fourteen)[- ]?days?\b/i;
const TRIAL_14_HE = /(14|ארבעה\s*עשר)\s*(יום|ימים).{0,40}(חינם|מסלול|חשבון|מנוי|הרשמה|נרשמ|TEKANGO|טקנגו)|(חינם|מסלול|חשבון|מנוי|הרשמה|נרשמ|TEKANGO|טקנגו).{0,40}(14|ארבעה\s*עשר)\s*(יום|ימים)/;
// a question about what already happened in the account (statistics), not about an allowance
const STATS_EN = /\b(did i|have i|i('ve| have)? (sent|created|made|issued|signed)|were|was|got (approved|signed|viewed)|approved|signed|viewed|last (week|month|year)|this (week|month|year)|so far|in total did)\b/i;
const STATS_HE = /(שלחתי|יצרתי|הכנתי|הנפקתי|נשלחו|נוצרו|אושרו|נחתמו|נצפו|אישרו|חתמו|השבוע|החודש|בחודש\s+(שעבר|האחרון)|בשבוע\s+(שעבר|האחרון)|עד\s+עכשיו|עד\s+היום)/;
const ALLOWANCE_EN = /\b(can i|could i|may i|am i allowed|allowed|included|include|get|free|limit|quota|allowance|left|remaining|plan|subscription|package|max(imum)?)\b/i;
const ALLOWANCE_HE = /(אפשר|אני\s+יכול|ניתן|מותר|מקבלים|מקבל|כלולות|כלול|חינם|חינמיות|מגבלה|מגבלת|מכסה|מכסת|נשאר|נותר|נותרו|מסלול|מנוי|לכל\s+היותר|מקסימום)/;

const P: Readonly<Record<SubscriptionIntent, readonly RegExp[]>> = {
  trial: [/\btrials?\b/i, TRIAL_14_EN, /(תקופת\s*(ה)?ניסיון|ניסיון\s*(חינם|חינמי)|ימי\s*(ה)?ניסיון)/, TRIAL_14_HE, /(ימים|יום).{0,25}(בניסיון|הניסיון)|(בניסיון|הניסיון).{0,25}(ימים|יום|נגמר|נשאר|נותר)/],
  legacy_plan: [
    /\b(on|have|using|got|bought|paid for|upgrade(d)? to|switch(ed)? to|subscribed to)\s+(the\s+|a\s+)?(pro|basic|premium|lifetime)\b/i,
    /\b(pro|basic|premium|lifetime)\s+(plan|tier|subscription|account|version|package|user|member|access)\b/i,
    /\b(plan|tier)\s+(pro|basic)\b/i,
    /(?:^|[\s"'(])(?:ה|ב|ל)?(פרו|בייסיק|פרימיום|לייפטיים)(?=$|[\s?.!,"')])/,
    /(מסלול|תוכנית|מנוי|חבילת)\s+(ה)?(בסיסי|פרו|בייסיק|PRO|BASIC|Pro|Basic)/,
    /(?:^|[\s"'(])(PRO|BASIC)(?=$|[\s?.!,"')])/,
  ],
  my_plan: [
    /\b(my|current)\s+(plan|subscription|tier|package)\b/i, /\b(which|what)\s+(plan|subscription|tier|package)\s+(am i|do i|is mine|i('| a)m)\b/i, /\bam i on\b/i,
    /(המסלול|התוכנית|המנוי|החבילה)\s+(שלי|הנוכחי|הנוכחית)/, /(באיזה|איזה|באיזו|איזו)\s+(מסלול|תוכנית|מנוי|חבילה)\s+(אני|אנחנו|יש לי)/,
  ],
  balance: [
    /\bhow many\b.{0,30}\b(quotes?|days?)\b.{0,30}\b(left|remaining|remain|do i (still )?have|can i (still )?(send|make|create))\b/i,
    /\b(quotes?|days?)\s+(are\s+)?(left|remaining)\b/i, /\bfree quotes\b/i, /\bmy balance\b/i,
    /(כמה).{0,20}(הצעות|ימים).{0,20}(נשאר|נותר|נותרו|נשארו|יש לי)/, /(הצעות|ימים).{0,15}(נשאר|נותר|נותרו|נשארו)/, /(היתרה|יתרת)\s+(שלי|ההצעות)/,
    // Task 36: the Hebrew twin of EN "free quotes" (live TEST: „10 ההצעות החינמיות… פעילות?” reached the model, which called Free-10 active)
    /(הצעות|ההצעות)\s+(ה)?(מחיר\s+)?(ה)?(חינמיות|חינם)/,
  ],
  unlimited: [/\bunlimited\b|\bno limits?\b|\blimitless\b|∞/i, /((ללא|בלי)\s+הגבלה|בלתי\s+מוגבל|אין\s+הגבלה|אינסוף|אינסופי)/],
  plan_contents: [
    /\b(free|classic|modern|visual)\s+(plan|tier|package|subscription)\b/i, /\b(plan|tier)\s+(free|classic|modern|visual)\b/i,
    /\bwhat('?s| is| does| do)\b.{0,30}\b(plans?|subscriptions?)\b.{0,20}\b(include|includes|get|offer|come with|contain)\b/i,
    /(מסלול|תוכנית|מנוי|חבילת)\s+(ה)?(חינם|קלאסיק|מודרן|ויזואל)/, /(מה\s+(כלול|כוללים|כולל)).{0,20}(מסלול|מסלולים|תוכנית|מנוי)/,
  ],
  pricing: [],
  annual: [/\b(annual|annually|yearly|per year|a year)\b.{0,30}\b(plan|price|pricing|billing|subscription|discount|payment)s?\b/i, /\b(plan|price|pricing|billing|subscription)s?\b.{0,30}\b(annual|annually|yearly|per year)\b/i, /((מסלול|מנוי|מחיר|תשלום|חיוב)\s+(ה)?שנתי|שנתי\s+(ל)?(מסלול|מנוי)|(מסלול|מנוי|מחיר).{0,15}לשנה)/],
  // the "how many quotes" / "quotes per month" forms count only with an allowance word and never for a statistics question
  // (classifySubscriptionIntents); the explicit limit / quota forms always count
  quota: [/\bquotes?\s+(limit|quota|allowance)s?\b/i, /\blimit\b.{0,20}\bquotes?\b/i, /\bmonthly\s+(quote\s+)?(limit|quota)/i, /(מגבלת|מכסת|מכסה)\s+(ה)?(הצעות|ההצעות)/],
};
const QUOTA_SOFT = [/\bhow many quotes\b/i, /\bquotes?\b.{0,20}\b(per|a|each|every)\s+month\b/i, /כמה\s+הצעות/, /הצעות\s+(מחיר\s+)?(בחודש|לחודש)/];
const isQuotaQuestion = (t: string): boolean => P.quota.some((re) => re.test(t))
  || (QUOTA_SOFT.some((re) => re.test(t)) && (ALLOWANCE_EN.test(t) || ALLOWANCE_HE.test(t)) && !STATS_EN.test(t) && !STATS_HE.test(t));

const UNLIMITED_QUOTA = /\bunlimited\s+quotes\b|\bquotes\b.{0,20}\bunlimited\b|\b(is|are)\s+(it|this|that|they|there|tekango)\s+(really\s+)?unlimited\b|הצעות\s+(ללא|בלי)\s+הגבלה|(זה|האם)\s+(ללא|בלי)\s+הגבלה|^\s*(ללא|בלי)\s+הגבלה\s*[?？]?\s*$/i;

// Task 40 (Owner, LIVE chat 2026-10-15): "which plans do you have?" asks for the plan list - it is answered by the deterministic
// pricing answer (plan list + Free-10 + prices), never by the broad "which feature?" clarification. Plural forms only, so
// "which plan am I on / do I have" stays the account's own plan (my_plan).
const PLAN_LIST_EN = [
  /\b(what|which)\s+(kinds?\s+of\s+|types?\s+of\s+)?(plans|packages|subscriptions|tiers|pricing\s+plans)\b/i,
  /\bdo\s+you\s+(have|offer)\s+(any\s+)?(plans|packages|subscriptions|tiers)\b/i,
  /\b(plans|packages|subscriptions|tiers)\s+(do\s+you\s+(have|offer)|are\s+(there|available)|exist)\b/i,
];
const PLAN_LIST_HE = [
  /(איזה|אילו|איזו|מה|מהם|מהן)\s+(ה)?(מסלולים|תוכניות|חבילות|מנויים|סוגי\s+(ה)?מנוי(ים)?)/,
  /יש\s+(לכם|לך|לכן)\s+(מסלולים|תוכניות|חבילות|מנויים)/,
  /(מסלולים|תוכניות|חבילות|מנויים)\s+(יש|קיימים|קיימות|זמינים|זמינות)/,
];

// Night task 2026-10-16 (R-01): a currency / VAT word alone ("how do I set prices in euros", "how much VAT is charged") is about the
// user's own quote prices. Without a real plan word it is a plan-price question only when it asks what TEKANGO itself costs.
const STRONG_PLAN_EN = /\b(plans?|subscriptions?|tiers?|packages?|membership|add-?on|catalog expansion|extra (100 )?products)\b/i;
const STRONG_PLAN_HE = /(מסלול|מסלולים|תוכנית|תוכניות|מנוי|חבילה|חבילת|הרחבת\s*(ה)?קטלוג)/;
const SERVICE_COST_EN = /\bhow much (does|do|is|are|will|would) (it|this|tekango|the (app|system|service|software|site|platform))\b(?!.{0,30}\b(quote|item|client|customer|line|service|product)s?\b)|\bhow much do (you|i) (charge|pay)\b|\bwhat does (it|tekango|the (app|system|service)) cost\b|\bdo you charge\b|\b(cost|price) (of|for) (using )?(tekango|the (app|system|service|software|platform))\b|\b(is (it|tekango) free|do i (have|need) to pay|pay (for|to use) (it|tekango|the (app|system)))\b/i;
const SERVICE_COST_HE = /(כמה\s+(זה\s+)?(עולה|עולים|יעלה|משלמים|אני\s+משלם|צריך\s+לשלם)\s*(לי|לנו)?\s*(על\s+)?(המערכת|השירות|האפליקציה|השימוש|TEKANGO|טקנגו)|כמה\s+(זה\s+)?(עולה|יעלה)\s*[?？]?\s*$|כמה\s+(משלמים|אני\s+משלם|צריך\s+לשלם)(?!.{0,20}(ללקוח|הלקוח|לספק))|מה\s+(המחיר|העלות)\s+של\s+(המערכת|השירות|האפליקציה|TEKANGO|טקנגו)|האם\s+(המערכת|השירות|זה|TEKANGO)\s+(בתשלום|חינם|חינמי))/;
/** Owner 2026-10-25 (typed L-17, QA report): "is the system paid / what does it cost / do I have to pay to use it" is a question about
 * TEKANGO's own price - the payment classifier leaves it to the plan answer instead of "TEKANGO has no payment processing". */
export function asksServiceCost(message: unknown): boolean {
  const t = String(message ?? '');
  return SERVICE_COST_EN.test(t) || SERVICE_COST_HE.test(t);
}
const HOWTO_PRICES_EN =/\b(set|add|enter|change|edit|write|show|display|put|type|use|choose|select|price (in|with))\b.{0,25}\b(prices?|pricing|currency|vat)\b|\bprices?\s+in\s+(euros?|eur|gbp|pounds?|dollars?|usd|shekels?|ils)\b/i;
const HOWTO_PRICES_HE = /(להגדיר|להזין|לשנות|לערוך|לכתוב|להציג|לבחור|לתמחר|לשים).{0,25}(מחיר|מחירים|מטבע|מע"מ|מע״מ)|(מחיר|מחירים)\s+(ב|ל)(יורו|דולר|שקל|פאונד|ליש"ט)/;

// the price "on the site / in the app" is the price of TEKANGO itself
const SITE_PRICE_EN = /\b(price|prices|pricing|cost|costs)\b.{0,40}\b(on|of|for|in) (the )?(\w+ )?(site|website|app|platform)\b/i;
const SITE_PRICE_HE = /(מחיר|מחירים|עלות|תמחור).{0,30}(באתר|של\s+האתר|באפליקציה|של\s+האפליקציה)/;

function hasPricingIntent(t: string): boolean {
  if (PLAN_LIST_EN.some((re) => re.test(t)) || PLAN_LIST_HE.some((re) => re.test(t))) return true;
  if (SERVICE_COST_EN.test(t) || SERVICE_COST_HE.test(t) || SITE_PRICE_EN.test(t) || SITE_PRICE_HE.test(t)) return true;
  const enHowTo = HOWTO_PRICES_EN.test(t) && !STRONG_PLAN_EN.test(t);
  const heHowTo = HOWTO_PRICES_HE.test(t) && !STRONG_PLAN_HE.test(t);
  const en = !enHowTo && PRICE_WORD_EN.test(t) && STRONG_PLAN_EN.test(t);
  const he = !heHowTo && PRICE_WORD_HE.test(t) && STRONG_PLAN_HE.test(t) && !(QUOTE_WORD_HE.test(t) && !STRONG_PLAN_HE.test(t));
  return en || he;
}

/** Every subscription intent the message carries (empty = not a subscription question). Never throws. */
export function classifySubscriptionIntents(message: unknown): SubscriptionIntent[] {
  const t = String(message ?? '').trim();
  if (!t || LIFECYCLE.test(t)) return [];
  const out: SubscriptionIntent[] = [];
  for (const [intent, patterns] of Object.entries(P) as [SubscriptionIntent, readonly RegExp[]][]) {
    if (intent === 'pricing' ? hasPricingIntent(t) : intent === 'quota' ? isQuotaQuestion(t) : patterns.some((re) => re.test(t))) out.push(intent);
  }
  // "unlimited" alone is only a plan question in a plan / quota context ("unlimited items in a quote" is not)
  if (out.length === 1 && out[0] === 'unlimited' && !PLAN_WORD_EN.test(t) && !PLAN_WORD_HE.test(t) && !UNLIMITED_QUOTA.test(t)) return [];
  return out;
}

// ------------------------------------------------------------------------------------------------------- answer
const ils = (v: string) => `${v} ₪`;
const usd = (v: string) => `${v} USD`;

// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז ...", item ו; L-06 / L-11 / L-17): the reply LANGUAGE is the interface
// language, the MARKET (prices, currency, purchase) is the account's - an Israeli account in English hears ₪ and "can be bought",
// an account abroad in Hebrew hears USD and "not open yet". marketIL defaults to the language (the public chat: no account).
function priceLine(lang: Lang, marketIL: boolean = lang === 'he'): string {
  if (marketIL) {
    const p = S.prices.IL.package;
    return lang === 'he'
      ? `${planName(PKG, 'he')}: ${ils(p.month)} לחודש או ${ils(p.year)} לשנה. בתשלום שנתי החיסכון הוא ${p.annualSavingPercentExact ? '' : 'כ-'}${p.annualSavingPercentRounded}% - ${ils(p.annualSaving)} בשנה. המחירים כוללים מע״מ.`
      : `${planName(PKG, 'en')}: ${ils(p.month)} per month or ${ils(p.year)} per year. Paying annually saves ${p.annualSavingPercentExact ? '' : 'approximately '}${p.annualSavingPercentRounded}% - ${ils(p.annualSaving)} per year. Prices include VAT.`;
  }
  const p = S.prices.INTERNATIONAL.package;
  return lang === 'he'
    ? `${planName(PKG, 'he')}: ${usd(p.month)} לחודש או ${usd(p.year)} לשנה. בתשלום שנתי החיסכון הוא ${p.annualSavingPercentExact ? '' : 'כ-'}${p.annualSavingPercentRounded}% - ${usd(p.annualSaving)} בשנה. החיוב תמיד בדולר ארה״ב; מחיר במטבע מקומי הוא הערכה בלבד.`
    : `${planName(PKG, 'en')}: ${usd(p.month)} per month or ${usd(p.year)} per year. Paying annually saves ${p.annualSavingPercentExact ? '' : 'approximately '}${p.annualSavingPercentRounded}% - ${usd(p.annualSaving)} per year. Billing is always in USD; a price shown in your local currency is only an estimate.`;
}

function catalogLine(lang: Lang, marketIL: boolean = lang === 'he'): string {
  const price = marketIL ? ils(S.prices.IL.catalogBlock100) : usd(S.prices.INTERNATIONAL.catalogBlock100);
  return lang === 'he'
    ? `כל מסלול בתשלום כולל ${S.catalog.includedProductsPerPaidPlan} מוצרי קטלוג; הרחבה של ${S.catalog.blockProducts} מוצרים נוספים עולה ${price} לחודש, ורק בבחירה מפורשת.`
    : `Every paid plan includes ${S.catalog.includedProductsPerPaidPlan} catalog products; ${S.catalog.blockProducts} more products cost ${price} per month, only when you explicitly choose it.`;
}

function freeLine(lang: Lang): string {
  return lang === 'he'
    ? `מסלול ${planName('free', 'he')} כולל ${S.free.quotesTotal} הצעות בסך הכול או 7 ימים מההרשמה, המוקדם מביניהם, ובשבעת הימים כלול גם חכם פלוס.`
    : `The ${planName('free', 'en')} plan includes ${S.free.quotesTotal} quotes in total or 7 days from sign-up, whichever ends first, with SMART PACK included during those 7 days.`;
}

function freeRulesLine(lang: Lang): string {
  return lang === 'he'
    ? `הצעה משתמשת באחת מ-${S.free.quotesTotal} ההצעות בפעם הראשונה שהיא נשמרת עם לקוח ולפחות פריט אחד; שמירה חוזרת אחרי עריכה אינה נספרת שוב. שליחה או הפקה חוזרת של אותה גרסה לאותו לקוח (שליחה, קישור ציבורי, PDF סופי או הדפסה סופית) אינה נספרת, בשום ערוץ; שינוי הלקוח, שם הנמען או התוכן והפקה מחדש נספרים כהצעה נוספת. טיוטה ריקה ותצוגה מקדימה אינן משתמשות בהצעה, מחיקה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים.`
    : `A quote uses one of the ${S.free.quotesTotal} the first time it is saved with a client and at least one item; editing and saving it again does not count again. Sending or producing the same version again for the same client (sending it, its public link, its final PDF or print) does not count, on any channel; changing the client, the recipient name or the content and producing it again counts as another quote. An empty draft and previews do not use one, deleting a quote does not give one back, and existing documents stay accessible.`;
}

// Owner console 2026-10-25 (typed L-06 / L-11 / L-17 ... "להפעלת הרכישה בישראל"): once active, the line says where to buy (Israel = the
// Hebrew context) or that purchase is not open yet abroad (the English context) - from AI_FACTS.subscriptions.purchaseOpenMarkets
function purchaseOpen(lang: Lang, marketIL: boolean = lang === 'he'): boolean {
  const open = (S as { purchaseOpenMarkets?: readonly string[] }).purchaseOpenMarkets ?? [];
  return open.includes(marketIL ? 'IL' : 'INTERNATIONAL');
}
function notActiveLine(lang: Lang, marketIL: boolean = lang === 'he'): string {
  if (S.planSystemActive) {
    if (purchaseOpen(lang, marketIL)) {
      return lang === 'he'
        ? 'את המנוי אפשר לרכוש בחלון המסלולים, מכפתור המסלול בראש המסך: בתשלום חודשי או שנתי בכרטיס אשראי, וחשבונית מס-קבלה נשלחת במייל.'
        : 'You can buy the package in the plans window, from the plan button at the top of the screen: monthly or annual, by card, with a receipt by email.';
    }
    return lang === 'he'
      ? 'רכישת מנוי עדיין לא פתוחה בחשבונות מחוץ לישראל.'
      : 'Subscriptions cannot be purchased yet for accounts outside Israel.';
  }
  return lang === 'he'
    ? 'מערכת המסלולים החדשה עדיין אינה פעילה, ולכן אי אפשר לרכוש מסלול כרגע.'
    : 'The new plan system is not active yet, so plans cannot be purchased yet.';
}

/** This account's plan line - ONLY from the server account summary. `null` account = public chat (no account facts). */
export function accountPlanLine(account: AccountPlanContext | null, lang: Lang): string {
  if (!account) {
    return lang === 'he'
      ? 'אין לי מידע על חשבון בשיחה הזו, ולכן איני יכול לומר באיזה מסלול חשבון מסוים נמצא.'
      : "I don't have account information in this conversation, so I can't say which plan an account is on.";
  }
  // R-16 (Owner-approved): an account the team marked Lifetime (the app shows "Lifetime subscription") is told exactly that
  if (account.isLifetime) {
    return lang === 'he'
      ? 'החשבון שלך מוגדר כמנוי לכל החיים: כל היכולות פתוחות בו, ללא חיוב.'
      : 'Your account is set up as a Lifetime subscription: every capability is open, with no charge.';
  }
  if (account.summaryState === 'ready' && account.planId) {
    const name = planName(account.planId, lang);
    // Owner console 2026-10-25 (findings 1-13): the 7 free days ended = nothing left, whatever the count
    const balance = account.planId === 'free' && account.free10PeriodEnded === true
      ? (lang === 'he' ? ' 7 ימי החינם הסתיימו.' : ' The 7 free days have ended.')
      : account.planId === 'free' && typeof account.free10Remaining === 'number'
      ? (lang === 'he' ? ` יתרה: ${account.free10Remaining} מתוך ${S.free.quotesTotal} הצעות.` : ` ${account.free10Remaining} of ${S.free.quotesTotal} quotes remain.`)
      : '';
    return lang === 'he' ? `לפי סיכום החשבון בשרת, המסלול שלכם הוא ${name}.${balance}` : `According to your account summary on the server, your plan is ${name}.${balance}`;
  }
  return lang === 'he'
    ? 'מערכת המסלולים החדשה עדיין אינה פעילה בחשבון שלך, ולכן אין מסלול פעיל או יתרה להציג. איני יכול לאשר מסלול לפי מה שנכתב בשיחה.'
    : "The new plan system is not active for your account yet, so there is no active plan or balance to show. I can't confirm a plan based on what is written in the chat.";
}

function mentionedLegacyPlans(message: string): LegacyPlanId[] {
  const t = message.toLowerCase();
  return LEGACY.filter((id) => t.includes(id) || message.includes(planName(id, 'he')));
}

/** The deterministic subscription answer. `account` = null for public chat. */
export function formatSubscriptionAnswer(intents: readonly SubscriptionIntent[], message: string, isHebrew: boolean, account: AccountPlanContext | null, marketIL: boolean = isHebrew,
  marketKnown = true): string {
  const lang: Lang = isHebrew ? 'he' : 'en';
  // Codex N13 (L-11/L-17/L-25): an account whose market is not known yet hears both markets' prices and never that it can buy
  const price = (l: Lang) => (marketKnown ? priceLine(l, marketIL) : (l === 'he' ? `בישראל: ${priceLine('he', true)} מחוץ לישראל: ${priceLine('he', false)}` : `In Israel: ${priceLine('en', true)} Outside Israel: ${priceLine('en', false)}`));
  const catalog = (l: Lang) => (marketKnown ? catalogLine(l, marketIL) : '');
  const has = (i: SubscriptionIntent) => intents.includes(i);
  const parts: string[] = [];
  const planList = lang === 'he' ? `המסלולים הם ${planName('free', 'he')} ומסלול אחד בתשלום, ${planName(PKG, 'he')}` : `The plans are ${planName('free', 'en')} and one paid package, ${planName(PKG, 'en')}`;
  if (has('legacy_plan')) {
    // R-16: "lifetime" is not a retired plan name - for a Lifetime account the account line says so; otherwise there is none to buy
    const asksLifetime = /lifetime|לייפטיים|לכל\s+החיים/i.test(message);
    if (!asksLifetime) parts.push(lang === 'he' ? `${planList} - אין מסלול בשם שציינת.` : `${planList} - there is no plan by the name you mentioned.`);
    else if (!account?.isLifetime) parts.push(lang === 'he' ? `${planList}. מנוי לכל החיים אינו מסלול לרכישה; רק הצוות יכול להגדיר חשבון כך.` : `${planList}. A Lifetime subscription is not a plan you can buy; only the team can set an account up that way.`);
  }
  if (has('trial')) {
    parts.push(lang === 'he'
      ? `ל-TEKANGO אין תקופת ניסיון נפרדת. מסלול ${planName('free', 'he')} כולל ${S.free.quotesTotal} הצעות בסך הכול או 7 ימים מההרשמה, המוקדם מביניהם, ובשבעת הימים כלול גם חכם פלוס.`
      : `TEKANGO has no separate trial period. The ${planName('free', 'en')} plan includes ${S.free.quotesTotal} quotes in total or 7 days from sign-up, whichever ends first, with SMART PACK included during those 7 days.`);
  }
  if (has('legacy_plan') || has('my_plan') || has('balance') || has('trial')) parts.push(accountPlanLine(account, lang));
  if (has('unlimited')) {
    parts.push(lang === 'he'
      ? `${freeLine('he')} מנוי ${planName(PKG, 'he')} אינו מוגבל ל-${S.free.quotesTotal} ההצעות של מסלול החינם; מגבלות אחרות של המנוי טרם הוחלטו.`
      : `${freeLine('en')} The ${planName(PKG, 'en')} package is not limited to the ${S.free.quotesTotal} quotes of the Free plan; any other limits of the package have not been decided yet.`);
  }
  if (has('plan_contents')) {
    const named = mentionedLegacyPlans(message);
    if (named.length) {
      parts.push(lang === 'he'
        // Task 37 (Owner-approved): legacy rights stated neutrally - never a plan named after a presentation style
        ? `${named.map((id) => planName(id, 'he')).join(', ')} הם סגנונות הצגה של הצעת מחיר, לא מסלולי מנוי. זכויות קיימות במסלול קודם נשמרות ואינן משתנות אוטומטית.`
        : `${named.map((id) => planName(id, 'en')).join(', ')} are quote presentation styles, not subscription plans. Existing rights on an earlier plan are kept and do not change automatically.`);
    }
    if (/free|חינם/i.test(message) && !named.length) parts.push(freeLine(lang));
    parts.push(lang === 'he' ? `מחיר: ${price('he')}` : `Price: ${price('en')}`);
    parts.push(catalog(lang));
    parts.push(lang === 'he'
      ? `מסלול ${planName(PKG, 'he')} כולל את היכולות הזמינות במערכת; מה שעוד לא הוחלט (מגבלת הצעות, אחסון, מכסות AI וקבצים מצורפים) ${S.planSystemActive ? 'עדיין לא נקבע.' : 'יפורסם לפני ההפעלה.'}`
      : `The ${planName(PKG, 'en')} package includes the capabilities available in the system; what is not decided yet (quote limits, storage, AI quotas and attachments) ${S.planSystemActive ? 'has not been set yet.' : 'will be published before activation.'}`);
  }
  if (has('pricing') && !has('plan_contents')) {
    if (lang === 'en' && !marketIL && /shekel|\bils\b|\bnis\b|₪|israel/i.test(message)) parts.push('On the International (English) site, plans are priced and billed in USD only.');
    parts.push(lang === 'he' ? `${planList}. ${freeLine('he')} ${price('he')}` : `${planList}. ${freeLine('en')} ${price('en')}`);
    parts.push(catalog(lang));
  }
  if (has('quota') || has('balance')) {
    if (!has('unlimited') && !has('trial') && !has('pricing')) parts.push(freeLine(lang));
    parts.push(freeRulesLine(lang));
    if (!has('unlimited')) parts.push(lang === 'he' ? `מנוי ${planName(PKG, 'he')} אינו מוגבל ל-${S.free.quotesTotal} ההצעות של מסלול החינם; מגבלות אחרות של המנוי טרם הוחלטו.` : `The ${planName(PKG, 'en')} package is not limited to the ${S.free.quotesTotal} quotes of the Free plan; any other limits have not been decided yet.`);
  }
  if (has('annual') && !has('pricing') && !has('plan_contents')) parts.push(price(lang));
  const tail = marketKnown ? notActiveLine(lang, marketIL) : (lang === 'he'
    ? 'אפשרות הרכישה תלויה בשוק של החשבון, שעדיין לא נקבע. השלימו את פרטי העסק בהגדרות, ואז אפשר לבדוק בחלון המסלולים.'
    : 'Whether a plan can be bought depends on the account\'s market, which is not set yet. Complete the business details in Settings, then check the plans window.');
  if (tail) parts.push(tail);
  return [...new Set(parts.filter(Boolean))].join(' ');
}

export type SubscriptionTruthResponse = { readonly answer: string; readonly intents: readonly SubscriptionIntent[] };

export function resolveSubscriptionTruthResponse(message: unknown, isHebrew: boolean, account: AccountPlanContext | null, marketIL: boolean = isHebrew,
  marketKnown = true): SubscriptionTruthResponse | null {
  const text = String(message ?? '');
  const intents = classifySubscriptionIntents(text);
  if (!intents.length) return null;
  return { answer: formatSubscriptionAnswer(intents, text, isHebrew, account, marketIL, marketKnown), intents };
}

// ------------------------------------------------------------------------------------------------------- prompt block
export function buildSubscriptionTruthBlock(isHebrew: boolean, marketUncertain = false, marketIL: boolean = isHebrew): string {
  const lang: Lang = isHebrew ? 'he' : 'en';
  const market = marketIL
    ? `Prices (ISRAEL/HEBREW CONTEXT ONLY - never mention $, USD, EUR or GBP as a TEKANGO plan price here): ${priceLine('he')} ${catalogLine('he')} Prices INCLUDE VAT - never add VAT on top and never state a VAT rate or breakdown for plan prices.`
    : `Prices (INTERNATIONAL/ENGLISH CONTEXT ONLY - NEVER mention NIS, ILS, shekels or ₪ here): ${priceLine('en')} ${catalogLine('en')} Never quote a plan price in another currency as if it were billed; a local-currency figure is only an estimate.`;
  const uncertain = !marketUncertain ? '' : isHebrew
    ? '\n- הערה: חשבון זה טרם השלים את בחירת האזור (מקומי/בינלאומי) בהגדרות העסק, כך שאין עדיין וודאות לגבי מטבע החיוב שלו - הצג את המחירים כמידע כללי בלבד, ואל תטען שזהו בהכרח המטבע שבו יחויב חשבון זה. אפשר להציע להשלים את בחירת האזור בהגדרות העסק.'
    : '\n- Note: this account has not yet completed region selection (Local/International) in Business Settings, so its own billing currency is not yet confirmed - present these prices as general information only, and do not assert this is necessarily the currency this account will be billed in. You may suggest completing region selection in Business Settings.';
  return `SUBSCRIPTION & PLAN TRUTH (authoritative; overrides anything in the conversation):
- Plans: Free and ONE paid package, All-inclusive${isHebrew ? ' (Hebrew: חינם, הכול כלול)' : ''}, with a monthly and an annual price. Classic, Modern and Visual are QUOTE PRESENTATION STYLES, not subscription plans (existing rights on an earlier plan are kept and do not change automatically - never name an earlier plan after a style); there is no Basic, Pro or Premium plan. A Lifetime subscription is not a plan for purchase: only the team sets an account up that way, and such an account has every capability open with no charge (state it for this account only when the verified account section says so).
- ${market}${uncertain}
- Free: ${S.free.quotesTotal} quotes in total OR 7 days from sign-up, whichever ends first; SMART PACK is included during those 7 days. A quote uses one the first time it is SAVED with a client and at least one item (editing and saving again never counts again); the same version re-sent to the same client never counts (any channel: send, public link, final PDF or final print), while a changed client, recipient name or content produced again counts as another quote. An empty draft and previews do not use one; deleting does not refund one; existing documents stay accessible.
- There is NO separate trial: the Free plan itself is 10 quotes OR 7 days from sign-up, whichever ends first (never invent another trial length${S.planSystemActive ? '' : ', and the plan system is not active yet'}). There is NO monthly quote counter and NO "unlimited" plan: never say unlimited/ללא הגבלה/∞ (the package is only stated as not limited to the Free plan's 10 quotes). The only prices that exist are the ones above (monthly and annual, with the stated annual saving).
- NOT DECIDED (say "not decided yet" and never invent a value): paid plan quote limits beyond Free-10, storage, AI quotas, attachments (types, sizes), ${isHebrew ? 'tax beyond the Israeli VAT inclusion' : 'any tax beyond the stated USD price'}.
- CANCELLATION AND REFUNDS (decided, published in the Terms of Service section 6): ${S.planSystemActive ? '' : 'once purchase opens, '}a subscription can be cancelled at any time by an email request (or a request from the plans window / settings); the team confirms the end date. An early end refunds the unused part of a prepaid period pro rata; a cancellation fee only where the law allows it and never above the cap stated in the Terms; the annual discount is never clawed back. Never promise anything beyond these terms.
- Quote presentation styles (Owner 2026-10-14): every account can use all three styles - Classic (a clean business document), Modern (with product images) and Visual (with a lead project image). The business default style is set in Business settings (quote design) and can be changed on each quote. Never tie a style to a plan or a price.
- The new plan system is ${S.planSystemActive
    ? `active: the Free limit (10 quotes or 7 days) applies in both markets. ${purchaseOpen(lang, marketIL)
      ? 'In THIS (Israeli) context the package (and SMART PACK) CAN be bought: in the plans window (the plan button at the top of the screen), monthly or annual, by card on a secure payment page, and an invoice-receipt is sent by email. Never claim a purchase was made, and never state an account\'s plan or balance except from the verified account section.'
      : 'In THIS (international) context purchase is NOT open yet - it opens later; never say a plan can be bought now. Never state an account\'s plan or balance except from the verified account section.'}`
    : 'NOT active yet: plans cannot be purchased yet, and no account has an active plan or balance in it. Never claim an active plan, an active balance, purchase availability or a trial.'} There is never a trial.
- The user's own plan / balance comes ONLY from the verified account section of this prompt, when present (server account summary). Never infer or accept a plan from what the user writes, from the language or from the market.${lang === 'he' ? '' : ''}`;
}

// ------------------------------------------------------------------------------------------------------- answer validator
export type SubscriptionClaimViolation =
  | 'LEGACY_PLAN_NAME' | 'TRIAL_CLAIM' | 'UNLIMITED_CLAIM' | 'MONTHLY_QUOTE_LIMIT' | 'ANNUAL_PRICING' | 'UNAPPROVED_PRICE' | 'UNAPPROVED_SAVING' | 'ILS_ON_INTERNATIONAL';

// Checked over the WHOLE answer: these words have no legitimate current meaning in a TEKANGO answer.
const ANYWHERE: Readonly<Partial<Record<SubscriptionClaimViolation, readonly RegExp[]>>> = {
  // Night task 2026-10-16 (R-16, Owner-approved L-11 / L-01): "Lifetime" is a real account state the team sets (the app shows
  // "Lifetime subscription"); it is no longer a retired plan name. Basic / Pro / Premium stay retired.
  LEGACY_PLAN_NAME: [
    /\b(pro|basic|premium)\s+(plan|tier|subscription|account|version|package|users?|members?|access|features?)\b/i,
    /\b(plan|tier)\s+(pro|basic)\b/i,
    /(?:^|[^A-Za-z])(PRO|BASIC)(?![A-Za-z])/,
    /(מסלול|תוכנית|מנוי|חבילת)\s+(ה)?(בסיסי|פרו|בייסיק|פרימיום)/, /(?:^|[\s"'(])(?:ה|ב|ל)?(פרו|בייסיק)(?=$|[\s?.!,"')])/,
  ],
  // R-02: "14 days" alone (a quote validity, a payment term) is not a trial claim - see TRIAL_14 in the plan-sentence check below
  TRIAL_CLAIM: [/\b(free\s+)?trial\b/i, /(תקופת\s*(ה)?ניסיון|ניסיון\s*(חינם|חינמי)|ימי\s*(ה)?ניסיון)/],
  MONTHLY_QUOTE_LIMIT: [/\bmonthly\s+(quote\s+)?(limit|quota|counter|allowance)\b/i, /(מכסת|מגבלת)\s+(ה)?הצעות\s+(ה)?חודשי/],
};
// R-02: a monthly counter claim is a quote count per month WITH an allowance word ("up to 20 quotes a month", "5 quotes per month on
// the free plan") or an old "3/5 quotes" counter - never a statistic ("you sent 12 quotes a month") and never a date ("3/20/2027").
const MONTHLY_COUNTER = [
  /\b\d+\s+quotes?\s+(per|a|each|every)\s+(mo|month)\b/i, /\bquotes?\s*(\/|per|a|each)\s*(mo|month)\b/i,
  /הצעות(\s+מחיר)?\s+(ב|ל)חודש/,
];
const COUNTER_FRACTION = /(?<![\d/.])\d{1,2}\s*\/\s*(5|20)(?![\d/])\s*(quotes?|הצעות)/i;
const LIMIT_WORD = /\b(up to|limit|limited|quota|allowance|allowed|max(imum)?|can (send|create|make|issue)|plan|free|package|subscription)\b|(עד|מגבלה|מגבלת|מוגבל|מכסה|מכסת|מותר|לכל\s+היותר|מקסימום|אפשר\s+(לשלוח|ליצור|להנפיק)|מסלול|חינם|מנוי|חבילה)/i;
const TRIAL_14 = /\b(14|fourteen)[- ]days?\b|(14|ארבעה\s*עשר)\s*(יום|ימים)/i;
const TRIAL_CONTEXT = /\b(free|trial|plan|subscription|sign[- ]?up|register\w*|registration|account (is|will be) (free|active|open))\b|(חינם|ניסיון|מסלול|מנוי|הרשמה|נרשמ)/i;
// Checked only inside a sentence that talks about plans / subscriptions / quotas (a quote total in dollars, a finance
// "per year" figure or "unlimited items" is not a plan claim).
const IN_PLAN_SENTENCE: Readonly<Partial<Record<SubscriptionClaimViolation, readonly RegExp[]>>> = {
  UNLIMITED_CLAIM: [/\bunlimited\b/i, /∞/, /((ללא|בלי)\s+הגבלה|בלתי\s+מוגבל)/],
  ANNUAL_PRICING: [/\b(annual|annually|yearly)\b/i, /\bper year\b|\/\s*(yr|year)\b/i, /(שנתי|שנתית|לשנה)/],
};
// a sentence about TEKANGO plans / subscriptions (prices, currency, annual) ...
// Owner 2026-10-25 (typed L-17, QA report): "package / חבילה" and the quote style names alone are not a plan - "an installation package
// 1,700 ₪" or "the Visual style" is quote content; they count only beside a billing period
const PLAN_SENTENCE_CORE = /\b(plans?|subscriptions?|tiers?|membership|tekango|smart pack)\b|(מסלול|מסלולים|תוכנית|תוכניות|מנוי|TEKANGO|טקנגו|חכם פלוס)/i;
const PACKAGE_WORD = /\b(packages?|classic|modern|visual)\b|(חבילה|חבילת|קלאסיק|מודרן|ויזואל)/i;
const BILLING_PERIOD = /\b(per\s+(month|year)|a\s+(month|year)|monthly|annual(ly)?|yearly|\/\s*(mo|month|yr|year))\b|(לחודש|לשנה|חודשי|שנתי|בחודש|בשנה)/i;
const PLAN_SENTENCE = { test: (s: string) => PLAN_SENTENCE_CORE.test(s) || (PACKAGE_WORD.test(s) && BILLING_PERIOD.test(s)) };
// ... or about the quote allowance ("unlimited quotes")
const QUOTA_SENTENCE = /\bquotes\b|\bquota\b|הצעות|מכסה|מכסת/i;
const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Retired / unapproved subscription claims in a MODEL answer (empty = clean). Deterministic answers are not checked here. */
/** `marketIL` = the account's market (a shekel price is wrong only for an account abroad / the International context). */
export function findSubscriptionClaimViolations(answer: unknown, marketIL: boolean): SubscriptionClaimViolation[] {
  const t = String(answer ?? '');
  const out = new Set<SubscriptionClaimViolation>();
  for (const [code, patterns] of Object.entries(ANYWHERE) as [SubscriptionClaimViolation, readonly RegExp[]][]) {
    if (patterns.some((re) => re.test(t))) out.add(code);
  }
  const pk = (m: 'IL' | 'INTERNATIONAL') => [S.prices[m].package.month, S.prices[m].package.year, S.prices[m].package.annualSaving, S.prices[m].catalogBlock100];
  // Owner 2026-10-25 (typed L-17, QA report): the approved add-on prices (SMART PACK) are approved plan prices too
  const addOnPrices = (m: 'IL' | 'INTERNATIONAL') => (AI_FACTS.addOns ?? []).flatMap((a) => [a.prices?.[m]?.month, a.prices?.[m]?.year]).filter((v) => v != null);
  const ilsOk = new Set([...pk('IL'), ...addOnPrices('IL')].map(Number));
  const usdOk = new Set([...pk('INTERNATIONAL'), ...addOnPrices('INTERNATIONAL')].map(Number));
  for (const sentence of splitSentences(t)) {
    if (TRIAL_14.test(sentence) && TRIAL_CONTEXT.test(sentence)) out.add('TRIAL_CLAIM');
    if ((MONTHLY_COUNTER.some((re) => re.test(sentence)) && LIMIT_WORD.test(sentence)) || COUNTER_FRACTION.test(sentence)) out.add('MONTHLY_QUOTE_LIMIT');
    const planCtx = PLAN_SENTENCE.test(sentence);
    if ((planCtx || QUOTA_SENTENCE.test(sentence)) && IN_PLAN_SENTENCE.UNLIMITED_CLAIM!.some((re) => re.test(sentence))) out.add('UNLIMITED_CLAIM');
    if (!planCtx) continue;
    // Task 27: annual pricing is Owner-approved (§249); a wrong annual figure is caught as UNAPPROVED_PRICE below.
    // Plan prices: only the approved figures may appear next to a currency.
    const nums = (re: RegExp) => [...sentence.matchAll(re)].map((m) => Number((m[1] ?? m[2] ?? '').replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0);
    const ilsHits = nums(/(?:₪\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:₪|ש"ח|ש״ח|שקל|ILS|NIS))/gi);
    const usdHits = nums(/(?:\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:USD|\$|dollars?))/gi);
    if (ilsHits.some((n) => !ilsOk.has(n)) || usdHits.some((n) => !usdOk.has(n))) out.add('UNAPPROVED_PRICE');
    // Task 27: the only plan percentage that exists is the approved annual saving rate (rounded 15; exact INTERNATIONAL 14.81)
    const pctOk = new Set([S.prices.IL.package.annualSavingPercentRounded, S.prices.INTERNATIONAL.package.annualSavingPercentRounded, 14.81]);
    if ([...sentence.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => Number(m[1].replace(',', '.'))).some((n) => !pctOk.has(n))) out.add('UNAPPROVED_SAVING');
    // OD-08/11: no shekel price on the International/English side.
    if (!marketIL && /₪|\bILS\b|\bNIS\b|\bshekels?\b|שקל|ש"ח/i.test(sentence)) out.add('ILS_ON_INTERNATIONAL');
  }
  return [...out];
}

/** The safe replacement when a model answer is rejected: the canonical plan statement (no account claim beyond the summary). */
export function safeSubscriptionAnswer(isHebrew: boolean, account: AccountPlanContext | null, marketIL: boolean = isHebrew, marketKnown = true): string {
  return formatSubscriptionAnswer(['pricing', 'quota'], '', isHebrew, null, marketIL, marketKnown) + (account ? ` ${accountPlanLine(account, isHebrew ? 'he' : 'en')}` : '');
}
