import countries from './adminCountries.json';
// Catalog/flags: flag-icons, MIT license in public/flags/LICENSE.txt.
// Use only an explicitly stored country, never email/currency/operator geography.
const countryCodes = new Map(countries.flatMap(({ code, name }) => [[code.toLowerCase(), code], [name.toLowerCase(), code]]));
countryCodes.set('uk', 'GB');
countryCodes.set('united states', 'US');
export function resolveAdminMarket(account) {
  const value = typeof account?.country === 'string' ? account.country.trim() : '';
  if (value === 'Local' || value === 'LCL') return { market: 'Local', countryCode: 'IL' };
  if (value === 'International') return { market: 'International', countryCode: null };
  const countryCode = countryCodes.get(value.toLowerCase());
  if (countryCode) return { market: countryCode === 'IL' ? 'Local' : 'International', countryCode };
  return { market: 'Unknown', countryCode: null };
}
