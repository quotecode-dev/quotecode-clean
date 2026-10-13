// The Owner-approved ALL-INCLUSIVE subscription package (PROFLOW_PROJECT_CONTEXT.md §249, Owner decision 2026-10-09; IRON-LANDING-001
// as amended by the Owner in the Claude console 2026-10-11) - the ONE repository source of the numbers the landing pages show.
//   Free-10 first (10 free quotes in total, never a time-limited trial), then ONE package with every capability, billed monthly or annually.
//   IL: ILS INCLUDING VAT (the sentence "המחירים כוללים מע״מ"); monthly ₪30, annual ₪30 × 12 − 15% = ₪306.
//   INTERNATIONAL: USD base; monthly $18, annual $184.00 (Owner, typed in the Claude console 2026-10-11, IRON-LANDING-001 amended: the
//   price both displayed and billed, replacing $18 × 12 − 15% = $183.60); EUR/GBP only as labelled estimates through the existing
//   internationalDisplay() ratio mechanism (no verified rate source is wired today, so the display is USD).
// Display / review data only: billing, checkout and entitlements are NOT active and nothing here grants or charges anything. The prepared
// three-plan system (priceCatalog.js -> server price_versions, in-app pricing modal, AI price facts) is a separate, not-yet-rescoped surface.
export const PACKAGE_CATALOG_VERSION = '2026-10-11.p2';
export const PACKAGE_ID = 'all_inclusive';
export const ANNUAL_DISCOUNT_PERCENT = 15; // §249 formula input; the landing shows the resulting prices, not a savings badge

const row = (priceId, market, currency, billingPeriod, amountMinor, taxMode) => Object.freeze({
  priceId, planId: PACKAGE_ID, market, currency, billingPeriod, amountMinor, taxMode, approvedRef: 'PROFLOW_PROJECT_CONTEXT.md §249',
});

export const PACKAGE_PRICES = Object.freeze([
  row('il_all_inclusive_month_p1', 'IL', 'ILS', 'month', 3000, 'included'),
  row('il_all_inclusive_year_p1', 'IL', 'ILS', 'year', 30600, 'included'),
  row('intl_all_inclusive_month_p1', 'INTERNATIONAL', 'USD', 'month', 1800, 'not_decided'),
  row('intl_all_inclusive_year_p2', 'INTERNATIONAL', 'USD', 'year', 18400, 'not_decided'), // p2: $184.00 (Owner 2026-10-11); p1 $183.60 retired
]);

// The approved package price row for a market and billing period; throws on anything not approved.
export function packagePrice(market, billingPeriod) {
  const hit = PACKAGE_PRICES.find((p) => p.market === market && p.billingPeriod === billingPeriod);
  if (!hit) throw new Error(`no approved ${market} ${billingPeriod} package price`);
  return hit;
}

// §249 arithmetic for Israel (monthly × 12 − 15% = ₪306); the International annual price is the Owner-set $184.00, not this formula.
export const annualFromMonthly = (monthlyMinor) => Math.round(monthlyMinor * 12 * (100 - ANNUAL_DISCOUNT_PERCENT) / 100);

// Task 26 (Owner 2026-10-11): the yearly saving of the annual subscription compared with 12 monthly payments, from the approved rows only
// (IL 36000 - 30600 = 5400 -> ₪54.00; INTERNATIONAL 21600 - 18400 = 3200 -> $32.00). A permanent price difference, not a promotion.
export const annualSavingMinor = (market) => packagePrice(market, 'month').amountMinor * 12 - packagePrice(market, 'year').amountMinor;
// The exact saving rate from the final approved minor-unit rows (IL 5400 / 36000 = 15; INTERNATIONAL 3200 / 21600 = 14.81...).
export const annualSavingPercent = (market) => (annualSavingMinor(market) * 100) / (packagePrice(market, 'month').amountMinor * 12);
