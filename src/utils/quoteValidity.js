// OD-1 quote acceptance expiry - the client mirror of public.quote_acceptance_expired (migration 20260922000000).
// A quote is acceptable THROUGH the end of its valid_until calendar day in the issuing market's time zone:
//   Local (Israel)  -> Asia/Jerusalem
//   International   -> "Anywhere on Earth" (UTC-12): the day has ended everywhere before the quote expires.
// No validity date = never expires. The stored date is never changed; this only answers "may it be accepted now?".
// The machine's own time zone / browser locale never decides the answer (the zone is explicit).
export const VALIDITY_TIME_ZONE = { Local: 'Asia/Jerusalem', International: 'Etc/GMT+12' };

const isLocalMarket = (market) => market === 'Local' || market === 'LCL';

// 'YYYY-MM-DD' of `now` in the market's validity time zone (en-CA formats ISO-like dates).
export function marketCalendarDate(market, now = new Date()) {
  const timeZone = isLocalMarket(market) ? VALIDITY_TIME_ZONE.Local : VALIDITY_TIME_ZONE.International;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// valid_until arrives as 'YYYY-MM-DD' (Postgres date); anything else is treated as "no usable validity date".
export function normalizeValidUntil(validUntil) {
  if (!validUntil) return null;
  const m = String(validUntil).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function isQuoteAcceptanceExpired(validUntil, market, now = new Date()) {
  const day = normalizeValidUntil(validUntil);
  if (!day) return false;
  return day < marketCalendarDate(market, now);
}

// Server truth wins when the (newer) get-public-quote returns it; otherwise the same rule is computed locally.
export function resolveQuoteExpired(quote, market, now = new Date()) {
  if (quote && typeof quote.is_expired === 'boolean') return quote.is_expired;
  return isQuoteAcceptanceExpired(quote?.valid_until, market, now);
}
