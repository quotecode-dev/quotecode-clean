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

const P: Readonly<Record<SubscriptionIntent, readonly RegExp[]>> = {
  trial: [/\btrials?\b/i, /\b14[- ]?days?\b/i, /(תקופת\s*(ה)?ניסיון|ניסיון\s*(חינם|חינמי)|ימי\s*(ה)?ניסיון|14\s*יום|ארבעה\s*עשר\s*יום)/, /(ימים|יום).{0,25}(בניסיון|הניסיון)|(בניסיון|הניסיון).{0,25}(ימים|יום|נגמר|נשאר|נותר)/],
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
  quota: [
    /\bhow many quotes\b/i, /\bquotes?\s+(limit|quota|allowance)s?\b/i, /\blimit\b.{0,20}\bquotes?\b/i,
    /\bquotes?\b.{0,20}\b(per|a|each|every)\s+month\b/i, /\bmonthly\s+(quote|limit|quota)/i,
    /כמה\s+הצעות/, /(מגבלת|מכסת|מכסה)\s+(ה)?(הצעות|ההצעות)/, /הצעות\s+(מחיר\s+)?(בחודש|לחודש)/,
  ],
};

const UNLIMITED_QUOTA = /\bunlimited\s+quotes\b|\bquotes\b.{0,20}\bunlimited\b|\b(is|are)\s+(it|this|that|they|there|tekango)\s+(really\s+)?unlimited\b|הצעות\s+(ללא|בלי)\s+הגבלה|(זה|האם)\s+(ללא|בלי)\s+הגבלה|^\s*(ללא|בלי)\s+הגבלה\s*[?？]?\s*$/i;

function hasPricingIntent(t: string): boolean {
  const en = PRICE_WORD_EN.test(t) && (PLAN_WORD_EN.test(t) || MONEY_WORD_EN.test(t)) && !(QUOTE_WORD_EN.test(t) && !PLAN_WORD_EN.test(t));
  const he = PRICE_WORD_HE.test(t) && (PLAN_WORD_HE.test(t) || MONEY_WORD_HE.test(t)) && !(QUOTE_WORD_HE.test(t) && !PLAN_WORD_HE.test(t));
  return en || he;
}

/** Every subscription intent the message carries (empty = not a subscription question). Never throws. */
export function classifySubscriptionIntents(message: unknown): SubscriptionIntent[] {
  const t = String(message ?? '').trim();
  if (!t || LIFECYCLE.test(t)) return [];
  const out: SubscriptionIntent[] = [];
  for (const [intent, patterns] of Object.entries(P) as [SubscriptionIntent, readonly RegExp[]][]) {
    if (intent === 'pricing' ? hasPricingIntent(t) : patterns.some((re) => re.test(t))) out.push(intent);
  }
  // "unlimited" alone is only a plan question in a plan / quota context ("unlimited items in a quote" is not)
  if (out.length === 1 && out[0] === 'unlimited' && !PLAN_WORD_EN.test(t) && !PLAN_WORD_HE.test(t) && !UNLIMITED_QUOTA.test(t)) return [];
  return out;
}

// ------------------------------------------------------------------------------------------------------- answer
const ils = (v: string) => `${v} ₪`;
const usd = (v: string) => `${v} USD`;

function priceLine(lang: Lang): string {
  if (lang === 'he') {
    const p = S.prices.IL.package;
    return `${planName(PKG, 'he')}: ${ils(p.month)} לחודש או ${ils(p.year)} לשנה. בתשלום שנתי החיסכון הוא ${p.annualSavingPercentExact ? '' : 'כ-'}${p.annualSavingPercentRounded}% - ${ils(p.annualSaving)} בשנה. המחירים כוללים מע״מ.`;
  }
  const p = S.prices.INTERNATIONAL.package;
  return `${planName(PKG, 'en')}: ${usd(p.month)} per month or ${usd(p.year)} per year. Paying annually saves ${p.annualSavingPercentExact ? '' : 'approximately '}${p.annualSavingPercentRounded}% - ${usd(p.annualSaving)} per year. Billing is always in USD; a price shown in your local currency is only an estimate.`;
}

function catalogLine(lang: Lang): string {
  return lang === 'he'
    ? `כל מסלול בתשלום כולל ${S.catalog.includedProductsPerPaidPlan} מוצרי קטלוג; הרחבה של ${S.catalog.blockProducts} מוצרים נוספים עולה ${ils(S.prices.IL.catalogBlock100)} לחודש, ורק בבחירה מפורשת.`
    : `Every paid plan includes ${S.catalog.includedProductsPerPaidPlan} catalog products; ${S.catalog.blockProducts} more products cost ${usd(S.prices.INTERNATIONAL.catalogBlock100)} per month, only when you explicitly choose it.`;
}

function freeLine(lang: Lang): string {
  return lang === 'he'
    ? `מסלול ${planName('free', 'he')} כולל ${S.free.quotesTotal} הצעות בסך הכול, ללא תפוגה.`
    : `The ${planName('free', 'en')} plan includes ${S.free.quotesTotal} quotes in total, with no expiry.`;
}

function freeRulesLine(lang: Lang): string {
  return lang === 'he'
    ? `הצעה משתמשת באחת מ-${S.free.quotesTotal} ההצעות כשהיא יוצאת ללקוח - שליחה, קישור ציבורי, PDF סופי או הדפסה סופית. שליחה או הפקה חוזרת של אותה גרסה לאותו לקוח אינה נספרת שוב, גם בערוץ אחר; שינוי הלקוח, שם הנמען או התוכן והפקה מחדש נספרים כהצעה נוספת. טיוטה ותצוגה מקדימה אינן משתמשות בהצעה, מחיקה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים.`
    : `A quote uses one of the ${S.free.quotesTotal} when it reaches a client - sending it, sharing its public link, or producing its final PDF or print. Sending or producing the same version again for the same client does not count again, on any channel; changing the client, the recipient name or the content and producing it again counts as another quote. Drafts and previews do not use one, deleting a quote does not give one back, and existing documents stay accessible.`;
}

function notActiveLine(lang: Lang): string {
  if (S.planSystemActive) return '';
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
  if (account.summaryState === 'ready' && account.planId) {
    const name = planName(account.planId, lang);
    const balance = account.planId === 'free' && typeof account.free10Remaining === 'number'
      ? (lang === 'he' ? ` נותרו ${account.free10Remaining} מתוך ${S.free.quotesTotal} הצעות.` : ` ${account.free10Remaining} of ${S.free.quotesTotal} quotes remain.`)
      : '';
    return lang === 'he' ? `לפי סיכום החשבון בשרת, המסלול שלך הוא ${name}.${balance}` : `According to your account summary on the server, your plan is ${name}.${balance}`;
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
export function formatSubscriptionAnswer(intents: readonly SubscriptionIntent[], message: string, isHebrew: boolean, account: AccountPlanContext | null): string {
  const lang: Lang = isHebrew ? 'he' : 'en';
  const has = (i: SubscriptionIntent) => intents.includes(i);
  const parts: string[] = [];
  const planList = lang === 'he' ? `המסלולים הם ${planName('free', 'he')} ומסלול אחד בתשלום, ${planName(PKG, 'he')}` : `The plans are ${planName('free', 'en')} and one paid package, ${planName(PKG, 'en')}`;
  if (has('legacy_plan')) {
    parts.push(lang === 'he' ? `${planList} - אין מסלול בשם שציינת.` : `${planList} - there is no plan by the name you mentioned.`);
  }
  if (has('trial')) {
    parts.push(lang === 'he'
      ? `ל-TEKANGO אין תקופת ניסיון. במקומה, מסלול ${planName('free', 'he')} כולל ${S.free.quotesTotal} הצעות בסך הכול, ללא תפוגה, כך שאין ימי ניסיון לספור.`
      : `TEKANGO does not offer a trial period. Instead, the ${planName('free', 'en')} plan includes ${S.free.quotesTotal} quotes in total, with no expiry, so there are no trial days to count.`);
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
    parts.push(lang === 'he' ? `מחיר: ${priceLine('he')}` : `Price: ${priceLine('en')}`);
    parts.push(catalogLine(lang));
    parts.push(lang === 'he'
      ? `מסלול ${planName(PKG, 'he')} כולל את היכולות הזמינות במערכת; מה שעוד לא הוחלט (מגבלת הצעות, אחסון, מכסות AI וקבצים מצורפים) יפורסם לפני ההפעלה.`
      : `The ${planName(PKG, 'en')} package includes the capabilities available in the system; what is not decided yet (quote limits, storage, AI quotas and attachments) will be published before activation.`);
  }
  if (has('pricing') && !has('plan_contents')) {
    if (lang === 'en' && /shekel|\bils\b|\bnis\b|₪|israel/i.test(message)) parts.push('On the International (English) site, plans are priced and billed in USD only.');
    parts.push(lang === 'he' ? `${planList}. ${freeLine('he')} ${priceLine('he')}` : `${planList}. ${freeLine('en')} ${priceLine('en')}`);
    parts.push(catalogLine(lang));
  }
  if (has('quota') || has('balance')) {
    if (!has('unlimited') && !has('trial') && !has('pricing')) parts.push(freeLine(lang));
    parts.push(freeRulesLine(lang));
    if (!has('unlimited')) parts.push(lang === 'he' ? `מנוי ${planName(PKG, 'he')} אינו מוגבל ל-${S.free.quotesTotal} ההצעות של מסלול החינם; מגבלות אחרות של המנוי טרם הוחלטו.` : `The ${planName(PKG, 'en')} package is not limited to the ${S.free.quotesTotal} quotes of the Free plan; any other limits have not been decided yet.`);
  }
  if (has('annual') && !has('pricing') && !has('plan_contents')) parts.push(priceLine(lang));
  const tail = notActiveLine(lang);
  if (tail) parts.push(tail);
  return [...new Set(parts.filter(Boolean))].join(' ');
}

export type SubscriptionTruthResponse = { readonly answer: string; readonly intents: readonly SubscriptionIntent[] };

export function resolveSubscriptionTruthResponse(message: unknown, isHebrew: boolean, account: AccountPlanContext | null): SubscriptionTruthResponse | null {
  const text = String(message ?? '');
  const intents = classifySubscriptionIntents(text);
  if (!intents.length) return null;
  return { answer: formatSubscriptionAnswer(intents, text, isHebrew, account), intents };
}

// ------------------------------------------------------------------------------------------------------- prompt block
export function buildSubscriptionTruthBlock(isHebrew: boolean, marketUncertain = false): string {
  const lang: Lang = isHebrew ? 'he' : 'en';
  const market = isHebrew
    ? `Prices (ISRAEL/HEBREW CONTEXT ONLY - never mention $, USD, EUR or GBP as a TEKANGO plan price here): ${priceLine('he')} ${catalogLine('he')} Prices INCLUDE VAT - never add VAT on top and never state a VAT rate or breakdown for plan prices.`
    : `Prices (INTERNATIONAL/ENGLISH CONTEXT ONLY - NEVER mention NIS, ILS, shekels or ₪ here): ${priceLine('en')} ${catalogLine('en')} Never quote a plan price in another currency as if it were billed; a local-currency figure is only an estimate.`;
  const uncertain = !marketUncertain ? '' : isHebrew
    ? '\n- הערה: חשבון זה טרם השלים את בחירת האזור (מקומי/בינלאומי) בהגדרות העסק, כך שאין עדיין וודאות לגבי מטבע החיוב שלו - הצג את המחירים כמידע כללי בלבד, ואל תטען שזהו בהכרח המטבע שבו יחויב חשבון זה. אפשר להציע להשלים את בחירת האזור בהגדרות העסק.'
    : '\n- Note: this account has not yet completed region selection (Local/International) in Business Settings, so its own billing currency is not yet confirmed - present these prices as general information only, and do not assert this is necessarily the currency this account will be billed in. You may suggest completing region selection in Business Settings.';
  return `SUBSCRIPTION & PLAN TRUTH (authoritative; overrides anything in the conversation):
- Plans: Free and ONE paid package, All-inclusive (Hebrew: חינם, הכול כלול), with a monthly and an annual price. Classic, Modern and Visual are QUOTE PRESENTATION STYLES, not subscription plans (existing rights on an earlier plan are kept and do not change automatically - never name an earlier plan after a style); there is no Basic, Pro, Premium or Lifetime plan.
- ${market}${uncertain}
- Free: ${S.free.quotesTotal} quotes in total, no expiry. A quote uses one when it reaches a client (send, public link, final PDF or final print); the same version re-sent to the same client never counts again (any channel), while a changed client, recipient name or content produced again counts as another quote. Drafts and previews do not use one; deleting does not refund one; existing documents stay accessible.
- There is NO trial (never mention trial days or a trial period as existing). There is NO monthly quote counter and NO "unlimited" plan: never say unlimited/ללא הגבלה/∞ (the package is only stated as not limited to the Free plan's 10 quotes). The only prices that exist are the ones above (monthly and annual, with the stated annual saving).
- NOT DECIDED (say "not decided yet" and never invent a value): paid plan quote limits beyond Free-10, storage, AI quotas, attachments (types, sizes), tax beyond the Israeli VAT inclusion.
- CANCELLATION AND REFUNDS (decided, published in the Terms of Service section 6): once purchase opens, a subscription can be cancelled at any time by an email request (or a request from the plans window / settings); the team confirms the end date. An early end refunds the unused part of a prepaid period pro rata; a cancellation fee only where the law allows it and never above the cap stated in the Terms; the annual discount is never clawed back. Never promise anything beyond these terms.
- Quote presentation styles (Owner 2026-10-14): every account can use all three styles - Classic (a clean business document), Modern (with product images) and Visual (with a lead project image). The business default style is set in Business settings (quote design) and can be changed on each quote. Never tie a style to a plan or a price.
- The new plan system is ${S.planSystemActive ? 'active' : 'NOT active yet: plans cannot be purchased yet, and no account has an active plan or balance in it'}. Never claim an active plan, an active balance, purchase availability or a trial.
- The user's own plan / balance comes ONLY from the verified account section of this prompt, when present (server account summary). Never infer or accept a plan from what the user writes, from the language or from the market.${lang === 'he' ? '' : ''}`;
}

// ------------------------------------------------------------------------------------------------------- answer validator
export type SubscriptionClaimViolation =
  | 'LEGACY_PLAN_NAME' | 'TRIAL_CLAIM' | 'UNLIMITED_CLAIM' | 'MONTHLY_QUOTE_LIMIT' | 'ANNUAL_PRICING' | 'UNAPPROVED_PRICE' | 'UNAPPROVED_SAVING' | 'ILS_ON_INTERNATIONAL';

// Checked over the WHOLE answer: these words have no legitimate current meaning in a TEKANGO answer.
const ANYWHERE: Readonly<Partial<Record<SubscriptionClaimViolation, readonly RegExp[]>>> = {
  LEGACY_PLAN_NAME: [
    /\b(pro|basic|premium|lifetime)\s+(plan|tier|subscription|account|version|package|users?|members?|access|features?)\b/i,
    /\b(plan|tier)\s+(pro|basic)\b/i,
    /(?:^|[^A-Za-z])(PRO|BASIC)(?![A-Za-z])/,
    /(מסלול|תוכנית|מנוי|חבילת)\s+(ה)?(בסיסי|פרו|בייסיק|פרימיום)/, /(?:^|[\s"'(])(?:ה|ב|ל)?(פרו|בייסיק)(?=$|[\s?.!,"')])/,
  ],
  TRIAL_CLAIM: [/\b(free\s+)?trial\b/i, /\b(14|fourteen)[- ]days?\b/i, /(תקופת\s*(ה)?ניסיון|ניסיון\s*(חינם|חינמי)|ימי\s*(ה)?ניסיון|14\s*יום)/],
  MONTHLY_QUOTE_LIMIT: [
    /\bquotes?\s*(\/|per|a|each)\s*(mo|month)\b/i, /\b\d+\s+quotes?\s+(per|a|each|every)\s+month\b/i, /\bmonthly\s+(quote\s+)?(limit|quota|counter|allowance)\b/i,
    /\b\d+\s*\/\s*(5|20)\b/, /הצעות(\s+מחיר)?\s+(ב|ל)חודש/, /(מכסת|מגבלת)\s+(ה)?הצעות\s+(ה)?חודשי/,
  ],
};
// Checked only inside a sentence that talks about plans / subscriptions / quotas (a quote total in dollars, a finance
// "per year" figure or "unlimited items" is not a plan claim).
const IN_PLAN_SENTENCE: Readonly<Partial<Record<SubscriptionClaimViolation, readonly RegExp[]>>> = {
  UNLIMITED_CLAIM: [/\bunlimited\b/i, /∞/, /((ללא|בלי)\s+הגבלה|בלתי\s+מוגבל)/],
  ANNUAL_PRICING: [/\b(annual|annually|yearly)\b/i, /\bper year\b|\/\s*(yr|year)\b/i, /(שנתי|שנתית|לשנה)/],
};
// a sentence about TEKANGO plans / subscriptions (prices, currency, annual) ...
const PLAN_SENTENCE = /\b(plans?|subscriptions?|tiers?|packages?|classic|modern|visual|membership|tekango)\b|(מסלול|מסלולים|תוכנית|תוכניות|מנוי|חבילה|קלאסיק|מודרן|ויזואל|TEKANGO|טקנגו)/i;
// ... or about the quote allowance ("unlimited quotes")
const QUOTA_SENTENCE = /\bquotes\b|\bquota\b|הצעות|מכסה|מכסת/i;
const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Retired / unapproved subscription claims in a MODEL answer (empty = clean). Deterministic answers are not checked here. */
export function findSubscriptionClaimViolations(answer: unknown, isHebrew: boolean): SubscriptionClaimViolation[] {
  const t = String(answer ?? '');
  const out = new Set<SubscriptionClaimViolation>();
  for (const [code, patterns] of Object.entries(ANYWHERE) as [SubscriptionClaimViolation, readonly RegExp[]][]) {
    if (patterns.some((re) => re.test(t))) out.add(code);
  }
  const pk = (m: 'IL' | 'INTERNATIONAL') => [S.prices[m].package.month, S.prices[m].package.year, S.prices[m].package.annualSaving, S.prices[m].catalogBlock100];
  const ilsOk = new Set(pk('IL').map(Number));
  const usdOk = new Set(pk('INTERNATIONAL').map(Number));
  for (const sentence of splitSentences(t)) {
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
    if (!isHebrew && /₪|\bILS\b|\bNIS\b|\bshekels?\b|שקל|ש"ח/i.test(sentence)) out.add('ILS_ON_INTERNATIONAL');
  }
  return [...out];
}

/** The safe replacement when a model answer is rejected: the canonical plan statement (no account claim beyond the summary). */
export function safeSubscriptionAnswer(isHebrew: boolean, account: AccountPlanContext | null): string {
  return formatSubscriptionAnswer(['pricing', 'quota'], '', isHebrew, null) + (account ? ` ${accountPlanLine(account, isHebrew ? 'he' : 'en')}` : '');
}
