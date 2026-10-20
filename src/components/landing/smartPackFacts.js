// "חכם פלוס" / SMART PACK prices (Owner console 2026-10-20: 10 ILS / 5 USD a month; yearly with the main plan's 15% saving = 102 ILS /
// 51 USD; always the same billing period as the main plan). TEST-only landing display (SMART_PACK_ENABLED) - nothing is purchasable.
// The package price comes from packageCatalog.js, so "with SMART PACK" is always the catalog price plus the add-on, never a typed total.
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { packagePrice } from '../../domain/subscriptions/packageCatalog';
import { majorUnits } from '../../domain/subscriptions/priceCatalog';
import { SMART_PACK } from '../../domain/subscriptions/addOnCatalog';

// Owner console 2026-10-20 ("אז אפשר להעלות ללייב" + the typed IRON-LANDING-001 amendment): shown on every build, LIVE included. One
// switch to hide the promotion and the add-on box again.
export const SMART_PACK_ENABLED = true;

// the prices come from the ONE add-on source (src/domain/subscriptions/addOnCatalog.js)
export const SMART_PACK_PRICE_MINOR = Object.freeze({
  IL: Object.freeze({ month: SMART_PACK.priceMinor.IL.month, year: SMART_PACK.priceMinor.IL.year }),
  INTERNATIONAL: Object.freeze({ month: SMART_PACK.priceMinor.INTERNATIONAL.month, year: SMART_PACK.priceMinor.INTERNATIONAL.year }),
});

export const ilsSmartPack = (period) => `₪${formatWholeMoney(majorUnits(SMART_PACK_PRICE_MINOR.IL[period]))}`;
export const ilsWithSmartPack = (period) => `₪${formatWholeMoney(majorUnits(packagePrice('IL', period).amountMinor + SMART_PACK_PRICE_MINOR.IL[period]))}`;
export const usdSmartPack = (period) => `$${formatMoney(majorUnits(SMART_PACK_PRICE_MINOR.INTERNATIONAL[period]))}`;
export const usdWithSmartPack = (period) => `$${formatMoney(majorUnits(packagePrice('INTERNATIONAL', period).amountMinor + SMART_PACK_PRICE_MINOR.INTERNATIONAL[period]))}`;
