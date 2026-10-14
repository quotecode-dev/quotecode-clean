// Plan facts for the landing plan cards (HE / IL and EN / INTERNATIONAL). The numbers come ONLY from the approved price
// catalog (src/domain/subscriptions/priceCatalog.js, Owner decisions OD-01..OD-08); the page files own the wording.
// Review display only: registration and billing for these plans are not active.
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { approvedPrice, majorUnits, FREE_QUOTES_TOTAL, CATALOG_PRODUCTS_INCLUDED, CATALOG_BLOCK_PRODUCTS, PAID_PLAN_IDS } from '../../domain/subscriptions/priceCatalog';
import { internationalDisplay } from '../../domain/subscriptions/displayEstimate';

export { FREE_QUOTES_TOTAL, CATALOG_PRODUCTS_INCLUDED, CATALOG_BLOCK_PRODUCTS, PAID_PLAN_IDS };

// IRON-ILS-001: HE / IL amounts are whole shekel with ".00" (the approved prices already include VAT, OD-05).
export const ilsAmount = (planId) => `₪${formatWholeMoney(majorUnits(approvedPrice('IL', planId).amountMinor))}`;

// EN / INTERNATIONAL: canonical USD with two decimals. A local estimate is shown only through internationalDisplay();
// with no verified rate source wired, the display is USD.
export function usdAmount(planId, rate = null) {
  const d = internationalDisplay(approvedPrice('INTERNATIONAL', planId), rate);
  return { text: `$${formatMoney(majorUnits(d.billingAmountMinor))}`, display: d };
}
