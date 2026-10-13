// Package facts for the landing plan section (HE / IL and EN / INTERNATIONAL), IRON-LANDING-001 as amended 2026-10-11: Free-10, then ONE
// all-inclusive package billed monthly or annually. The numbers come ONLY from src/domain/subscriptions/packageCatalog.js
// (PROFLOW_PROJECT_CONTEXT.md §249); the page files own the wording. Review display only: registration and billing are not active.
// (landingPlanFacts.js stays the three-plan source of the in-app pricing modal, a separate surface.)
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { packagePrice, annualSavingMinor, annualSavingPercent } from '../../domain/subscriptions/packageCatalog';
import { FREE_QUOTES_TOTAL, majorUnits } from '../../domain/subscriptions/priceCatalog';
import { internationalDisplay } from '../../domain/subscriptions/displayEstimate';

export { FREE_QUOTES_TOTAL };

// IRON-ILS-001: HE / IL amounts are whole shekel with ".00" (the §249 prices already include VAT).
export const ilsPackageAmount = (billingPeriod) => `₪${formatWholeMoney(majorUnits(packagePrice('IL', billingPeriod).amountMinor))}`;
// Task 26: the annual saving vs 12 monthly payments, same display rule (IRON-ILS-001 whole shekel ".00" -> ₪54.00).
export const ilsAnnualSaving = () => `₪${formatWholeMoney(majorUnits(annualSavingMinor('IL')))}`;
// The saving rate from the final approved rows: { text, exact } - "15%" with exact=true when the rate is a whole number (IL 15),
// otherwise the nearest whole percent with exact=false so the copy says "approximately" (INTERNATIONAL 14.81... -> "15%", approximate).
const rate = (market) => { const p = annualSavingPercent(market); const whole = Math.round(p); return { text: `${whole}%`, exact: Math.abs(p - whole) < 1e-9 }; };
export const ilsAnnualSavingRate = () => rate('IL');
export const usdAnnualSavingRate = () => rate('INTERNATIONAL');

// EN / INTERNATIONAL: canonical USD with two decimals; a local estimate only through internationalDisplay() (no verified rate source is
// wired, so the display is USD).
export function usdPackageAmount(billingPeriod, rate = null) {
  const d = internationalDisplay(packagePrice('INTERNATIONAL', billingPeriod), rate);
  return { text: `$${formatMoney(majorUnits(d.billingAmountMinor))}`, display: d };
}
// Task 26: the annual saving vs 12 monthly payments in USD, International precision ($32.00 at the Owner's $184.00; never the ILS rounding).
export const usdAnnualSaving = () => `$${formatMoney(majorUnits(annualSavingMinor('INTERNATIONAL')))}`;
