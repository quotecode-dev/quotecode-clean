// Approved subscription price versions — the ONE repository source of the Owner-locked prices
// (docs/subscriptions-complete-end-to-end-2026-10-07/OWNER_DECISIONS_LOCKED_2026-10-07.md). The prepared server table
// `price_versions` (subscriptions/sql) is seeded with exactly these rows and a test keeps the two identical.
// Display/review data only while activation is off: nothing here grants an entitlement, selects a billing market or
// produces a checkout amount on the client.
//
// IL (OD-03/04/05): ILS per month, consumer price INCLUDING VAT (tax_mode 'included'); no rate, no breakdown, nothing
// is ever added on top. INTERNATIONAL (OD-06/07/08): canonical billing currency USD; a local-currency figure may only be
// a labelled estimate and never changes the USD charge. Annual billing (OPEN-10) has no row.
export const PRICE_CATALOG_VERSION = '2026-10-07.1';

export const MARKETS = Object.freeze(['IL', 'INTERNATIONAL']);
export const PAID_PLAN_IDS = Object.freeze(['classic', 'modern', 'visual']);
export const FREE_QUOTES_TOTAL = 10; // OD-01: lifetime per account, no expiry
export const CATALOG_PRODUCTS_INCLUDED = 100; // OD-04: every paid plan
export const CATALOG_BLOCK_PRODUCTS = 100; // OD-04 / OD-07: one explicit add-on block

const row = (priceId, planId, market, currency, amountMinor, taxMode, approvedRef) => Object.freeze({
  priceId, planId, market, currency, billingPeriod: 'month', amountMinor, taxMode, approvedRef,
});

export const PRICE_VERSIONS = Object.freeze([
  row('il_classic_month_v1', 'classic', 'IL', 'ILS', 2900, 'included', 'OD-03,OD-05'),
  row('il_modern_month_v1', 'modern', 'IL', 'ILS', 4900, 'included', 'OD-03,OD-05'),
  row('il_visual_month_v1', 'visual', 'IL', 'ILS', 6900, 'included', 'OD-03,OD-05'),
  row('il_catalog_block_month_v1', 'catalog_block_100', 'IL', 'ILS', 500, 'included', 'OD-04,OD-05'),
  row('intl_classic_month_v1', 'classic', 'INTERNATIONAL', 'USD', 1800, 'not_decided', 'OD-06,OD-08'),
  row('intl_modern_month_v1', 'modern', 'INTERNATIONAL', 'USD', 2800, 'not_decided', 'OD-06,OD-08'),
  row('intl_visual_month_v1', 'visual', 'INTERNATIONAL', 'USD', 3800, 'not_decided', 'OD-06,OD-08'),
  row('intl_catalog_block_month_v1', 'catalog_block_100', 'INTERNATIONAL', 'USD', 300, 'not_decided', 'OD-07,OD-08'),
]);

export const BILLING_CURRENCY = Object.freeze({ IL: 'ILS', INTERNATIONAL: 'USD' });

// The approved monthly price row for a plan (or 'catalog_block_100') in a market; throws on anything not approved.
export function approvedPrice(market, planId) {
  if (!MARKETS.includes(market)) throw new Error(`unknown market "${market}"`);
  const hit = PRICE_VERSIONS.find((p) => p.market === market && p.planId === planId);
  if (!hit) throw new Error(`no approved ${market} price for "${planId}"`);
  return hit;
}

export const majorUnits = (amountMinor) => amountMinor / 100;
