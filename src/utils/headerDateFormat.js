import { resolveAdminMarket } from './adminMarket';

// Market-aware Header date: driven only by the account's stored country
// (never by UI language, currency, email or browser locale).
//   Local / Israel  -> DD.MM.YYYY
//   United States   -> MM.DD.YYYY
//   anything else   -> DD.MM.YYYY (unchanged non-US convention)
export function formatHeaderDate(date, country) {
  const { countryCode } = resolveAdminMarket({ country });
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return countryCode === 'US' ? `${mm}.${dd}.${yyyy}` : `${dd}.${mm}.${yyyy}`;
}
