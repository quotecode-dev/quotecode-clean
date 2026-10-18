import { marketOfStoredCountry } from './regionConfig';
// Catalog/flags: flag-icons, MIT license in public/flags/LICENSE.txt.
// Use only an explicitly stored country, never email/currency/operator geography.
// Owner 2026-10-17 ("one market rule"): the admin and the user interface read a stored country with the SAME function (regionConfig.js)
export function resolveAdminMarket(account) {
  return marketOfStoredCountry(account?.country);
}
