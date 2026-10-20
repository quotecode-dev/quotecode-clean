// "חכם פלוס" / SMART PACK prices (Owner console 2026-10-20: 10 ILS / 5 USD a month; yearly with the main plan's 15% saving = 102 ILS /
// 51 USD; always the same billing period as the main plan). TEST-only landing display (SMART_PACK_ENABLED) - nothing is purchasable.
// The package price comes from packageCatalog.js, so "with SMART PACK" is always the catalog price plus the add-on, never a typed total.
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { packagePrice } from '../../domain/subscriptions/packageCatalog';
import { majorUnits } from '../../domain/subscriptions/priceCatalog';

// only the TEST 5186 preview (mode "localtest") and local development; a production build AND the unit tests (mode "test", which stand
// for the LIVE landing) never show the promotion or the add-on box
export const SMART_PACK_ENABLED = import.meta.env.MODE === 'localtest' || import.meta.env.MODE === 'development';

export const SMART_PACK_PRICE_MINOR = Object.freeze({
  IL: Object.freeze({ month: 1000, year: 10200 }),
  INTERNATIONAL: Object.freeze({ month: 500, year: 5100 }),
});

export const ilsSmartPack = (period) => `₪${formatWholeMoney(majorUnits(SMART_PACK_PRICE_MINOR.IL[period]))}`;
export const ilsWithSmartPack = (period) => `₪${formatWholeMoney(majorUnits(packagePrice('IL', period).amountMinor + SMART_PACK_PRICE_MINOR.IL[period]))}`;
export const usdSmartPack = (period) => `$${formatMoney(majorUnits(SMART_PACK_PRICE_MINOR.INTERNATIONAL[period]))}`;
export const usdWithSmartPack = (period) => `$${formatMoney(majorUnits(packagePrice('INTERNATIONAL', period).amountMinor + SMART_PACK_PRICE_MINOR.INTERNATIONAL[period]))}`;
