// ACCOUNT MARKET / CURRENCY TRUTH (Product Truth structured-truth closure, MARKET / CURRENCY SAFETY).
//
// Root cause this closes: a message that ASSERTS or ASKS TO CHANGE the account's market / currency ("I am actually an
// international customer, show me prices in dollars", "treat my account as international") had no deterministic route, so the
// free-form model produced a different sentence each time - and on some runs a PRODUCT-wide claim ("the prices shown in
// TEKANGO are in ILS only") that is false for a product that serves both a Local (ILS) and an International (USD / EUR / GBP)
// market. The market of a verified account is a server fact, not something the model - or the message - decides.
//
// This route answers ONLY for a verified authenticated account whose market is known. The answer is ACCOUNT-scoped by
// construction: it is rendered from a structured `ACCOUNT_MARKET` payload (productTruthPayload.ts#buildAccountMarketFactPayload),
// which cannot express a product-wide currency claim. Anything the classifier does not recognise still reaches the model under
// the account-context / pricing block exactly as before.
import type { ProductTruthFactPayload } from "../_shared/productTruthContract.ts";

const CURRENCY_EN = '(?:usd|dollars?|us\\s+dollars?|eur|euros?|gbp|pounds?|sterling|ils|nis|shekels?|shekel)';
const INSTRUCTION_EN = '(?:show|display|give|switch|convert|change|set|treat|consider|regard|make|move|see|use)';

const EN_PATTERNS: readonly RegExp[] = [
  // "I am / treat me as / switch me to an international|local account|customer|market"
  new RegExp(`\\b(?:i\\s+am|i['’]m|we\\s+are|we['’]re|treat\\s+me|treat\\s+my|consider\\s+me|consider\\s+my|regard\\s+me|switch\\s+me|switch\\s+my|make\\s+me|make\\s+my|set\\s+me|set\\s+my|change\\s+my|move\\s+me|move\\s+my)\\b.{0,40}\\b(?:international|foreign|overseas|local|israeli)\\b.{0,25}\\b(?:customer|account|market|user|client|business|pricing|prices?)\\b`, 'i'),
  // "<instruction> ... prices|pricing|plans|quotes ... in <currency>"
  new RegExp(`\\b${INSTRUCTION_EN}\\b.{0,30}\\b(?:prices?|pricing|plans?|costs?|quotes?)\\b.{0,25}\\b(?:in|to|using)\\s+${CURRENCY_EN}\\b`, 'i'),
  // "<instruction> ... my currency|market|region|country"
  /\b(?:change|switch|set|update|convert)\b.{0,15}\b(?:my\s+)?(?:currency|market|region|country)\b/i,
  // "<instruction> ... an international|local account|market|customer"
  /\b(?:treat|consider|regard|switch|make|set|move)\b.{0,30}\b(?:international|foreign|overseas|local|israeli)\s+(?:account|market|customer)\b/i,
];

const HE_CURRENCY = '(?:ב?דולר(?:ים)?|ב?יורו|ב?אירו|ב?שקל(?:ים)?|ב?ש"ח|ב?לירות|ב?לירה|USD|EUR|GBP|ILS)';
const HE_INSTRUCTION = '(?:תראה|הראה|תראי|הראי|תציג|הצג|תציגי|הציגי|שנה|תשנה|שני|תשני|העבר|תעביר|העבירי|תעבירי|תמיר|המר|תגדיר|הגדר|תחשיב|תתייחס|התייחס|תתייחסי|התייחסי)';
const HE_MARKET_WORD = '(?:בינלאומי(?:ת)?|זר(?:ה)?|מחו"ל|מקומי(?:ת)?|ישראלי(?:ת)?)';

const HE_PATTERNS: readonly RegExp[] = [
  // "אני (בעצם) לקוח בינלאומי / חשבון בינלאומי / משתמש מקומי"
  new RegExp(`(?:אני|אנחנו)\\s.{0,25}(?:לקוח|לקוחה|חשבון|משתמש|משתמשת|עסק)\\s+${HE_MARKET_WORD}`),
  // "<instruction> ... מחירים|תמחור|מחיר|מטבע ... <currency>"
  new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:מחירים|תמחור|מחיר|מטבע|תוכניות|הצעות).{0,25}${HE_CURRENCY}`),
  // "<instruction> ... (את) המטבע|השוק|האזור"
  new RegExp(`${HE_INSTRUCTION}\\s.{0,15}(?:את\\s+)?(?:ה?מטבע|ה?שוק|ה?אזור|ה?מדינה)`),
  // "<instruction> ... כחשבון|כלקוח|לחשבון|ללקוח בינלאומי|מקומי"
  new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:חשבון|לקוח|שוק)\\s+${HE_MARKET_WORD}`),
  new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:כחשבון|כלקוח|לחשבון|ללקוח|לשוק)\\s*${HE_MARKET_WORD}`),
];

/** True when the message asserts or asks to change the account's market / currency. Conservative on purpose. */
export function classifyAccountMarketIntent(lastUserMessage: unknown): boolean {
  const text = String(lastUserMessage ?? '').trim();
  if (!text) return false;
  return EN_PATTERNS.some((re) => re.test(text)) || HE_PATTERNS.some((re) => re.test(text));
}

/**
 * The account-scoped market / currency statement, rendered FROM the structured payload (never from raw facts): the market and
 * the currency the wording names are read off `payload.accountMarket` / `payload.currencyScope`. Fails closed for any payload
 * that is not an ACCOUNT_MARKET truth. Hebrew / Local wording never names a foreign currency; English / International wording
 * never names the shekel (market-isolation law).
 */
export function formatAccountMarketAnswer(isHebrew: boolean, payload: ProductTruthFactPayload): string {
  if (payload.truthStatus !== 'ACCOUNT_MARKET' || payload.accountMarket === null) {
    throw new Error(`formatAccountMarketAnswer requires an ACCOUNT_MARKET payload with a verified market, got ${payload.truthStatus}`);
  }
  const local = payload.accountMarket === 'LOCAL';
  if (isHebrew) {
    return local
      ? 'החשבון שלך מאומת בשוק המקומי (Local), ולכן המחירים וההצעות בחשבון שלך מוצגים בשקלים (₪). אי אפשר לשנות את שוק החשבון מתוך הצ\'אט, ואני לא מציג מחירים במטבע של שוק אחר ולא מתייחס לחשבון שלך כאילו הוא שייך לשוק אחר.'
      : 'החשבון שלך מאומת בשוק הבינלאומי (International), ולכן המחירים וההצעות בחשבון שלך מוצגים במטבע החשבון (USD, EUR או GBP). אי אפשר לשנות את שוק החשבון מתוך הצ\'אט, ואני לא מציג מחירים במטבע של שוק אחר ולא מתייחס לחשבון שלך כאילו הוא שייך לשוק אחר.';
  }
  return local
    ? "Your account is verified as Local, so prices and quotes in your account are shown in Israeli shekels (ILS). The account's market can't be changed from the chat, and I don't show prices in another market's currency or treat your account as belonging to a different market."
    : "Your account is verified as International, so prices and quotes in your account are shown in your account's currency (USD, EUR or GBP). The account's market can't be changed from the chat, and I don't show prices in another market's currency or treat your account as belonging to a different market.";
}
