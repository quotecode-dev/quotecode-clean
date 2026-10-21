// ACCOUNT MARKET / CURRENCY TRUTH (Product Truth structured-truth closure, MARKET / CURRENCY SAFETY).
//
// Root cause this closes: a message that ASSERTS or ASKS TO CHANGE the account's market / currency (a user claiming the other market
// and asking for the other currency) had no deterministic route, so the
// free-form model produced a different sentence each time - and on some runs a PRODUCT-wide claim ("the prices shown in
// TEKANGO are in ILS only") that is false for a product that serves both a Local (ILS) and an International (USD / EUR / GBP)
// market. The market of a verified account is a server fact, not something the model - or the message - decides.
//
// INTENT GRAMMAR (intent grammar normalization closure): what counts as an account market / currency intent is decided by a small
// deterministic domain grammar (marketIntentGrammar.ts: normalize -> clause segmentation -> tokenize + tag (lexicon, Hebrew clitic
// morphology) -> parse into a normalized intent), not by a growing union of phrase regexes. Every normalized intent resolves to ONE
// normalized kind and to the SAME single deterministic route: verified server account facts -> ACCOUNT_MARKET payload -> prose.
//
// This route answers ONLY for a verified authenticated account whose market is known. The answer is ACCOUNT-scoped by
// construction: it is rendered from a structured `ACCOUNT_MARKET` payload (productTruthPayload.ts#buildAccountMarketFactPayload),
// which cannot express a product-wide currency claim. Anything the grammar does not recognise still reaches the model under
// the account-context / pricing block exactly as before.
import type { ProductTruthFactPayload } from "../_shared/productTruthContract.ts";
import { parseAccountMarketIntent, type AccountMarketIntent, type ClauseIntent } from "./marketIntentGrammar.ts";

export type AccountMarketIntentKind =
  | 'ACCOUNT_MARKET_QUERY'               // a question about which market the account is in / belongs to
  | 'ACCOUNT_CURRENCY_QUERY'             // what currency the account / prices use, or whether the account can work in a currency
  | 'ACCOUNT_MARKET_OVERRIDE_REQUEST'    // ask to be treated as / to pretend to belong to another market
  | 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST'  // ask / prefer / wish to see or work in another currency
  | 'ACCOUNT_MARKET_IDENTITY_ASSERTION'; // a statement about which market the user / account belongs to

/** normalized clause -> normalized kind (the kind never selects a different response) */
function kindOfClause(c: ClauseIntent): AccountMarketIntentKind {
  switch (c.relation) {
    case 'IDENTITY':
    case 'BELONGS_TO_MARKET':
      if (c.modality === 'QUESTION') return 'ACCOUNT_MARKET_QUERY';
      if (c.modality === 'ASSERTION') return 'ACCOUNT_MARKET_IDENTITY_ASSERTION';
      return 'ACCOUNT_MARKET_OVERRIDE_REQUEST';
    case 'MARKET_QUERY': return 'ACCOUNT_MARKET_QUERY';
    case 'MARKET_OVERRIDE_REQUEST': return c.modality === 'QUESTION' ? 'ACCOUNT_MARKET_QUERY' : 'ACCOUNT_MARKET_OVERRIDE_REQUEST';
    case 'CURRENCY_QUERY':
    case 'CURRENCY_CAPABILITY': return 'ACCOUNT_CURRENCY_QUERY';
    default: return 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST';
  }
}
const KIND_PRIORITY: readonly AccountMarketIntentKind[] = [
  'ACCOUNT_MARKET_IDENTITY_ASSERTION', 'ACCOUNT_MARKET_OVERRIDE_REQUEST', 'ACCOUNT_MARKET_QUERY', 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST', 'ACCOUNT_CURRENCY_QUERY',
];

/** The normalized account market / currency intent of a message (the grammar's output); `clauses` is empty for anything else. */
export function parseAccountMarketIntentOf(lastUserMessage: unknown): AccountMarketIntent {
  return parseAccountMarketIntent(lastUserMessage);
}

/**
 * Normalized kind of a message that asserts, asks about, or asks to change the ACCOUNT's market / currency; null for anything else.
 * Conservative on purpose: generic currency knowledge, quote-content questions and third-party (CRM) market words are NOT account intents.
 */
export function classifyAccountMarketIntentKind(lastUserMessage: unknown): AccountMarketIntentKind | null {
  const intent = parseAccountMarketIntent(lastUserMessage);
  if (intent.clauses.length === 0) return null;
  const kinds = new Set(intent.clauses.map(kindOfClause));
  return KIND_PRIORITY.find((k) => kinds.has(k)) ?? null;
}

/** True when the message asserts, asks about, or asks to change the account's market / currency. */
export function classifyAccountMarketIntent(lastUserMessage: unknown): boolean {
  return classifyAccountMarketIntentKind(lastUserMessage) !== null;
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
