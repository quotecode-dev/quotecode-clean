// OD-1 server truth for the public quote page: the Deno copy of src/utils/quoteValidity.js and of the SQL
// public.quote_acceptance_expired (migration 20260922000000). Edge Functions cannot import src/, so this deliberate copy is
// parity-tested against the client module (validity.test.js). Valid THROUGH the end of valid_until: Local businesses in
// Asia/Jerusalem, International "Anywhere on Earth" (UTC-12). NULL/malformed = no expiry.
// PRODUCT_TRUTH_CAPABILITY: quote_expiry
// Codex LANG-02 (2026-10-18): the stored country follows the one market rule (src/utils/regionConfig.js marketOfStoredCountry):
// 'Local' / 'LCL' / 'Israel' / 'IL' (any case, trimmed) = Local; anything else = International. Same in SQL (20261018000000).
export function isLocalValidityCountry(country: unknown): boolean {
  const v = typeof country === 'string' ? country.trim() : ''
  return v === 'Local' || v === 'LCL' || v.toLowerCase() === 'israel' || v.toLowerCase() === 'il'
}
export function isQuoteAcceptanceExpired(validUntil: unknown, country: unknown, now: Date = new Date()): boolean {
  const m = String(validUntil ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return false
  const timeZone = isLocalValidityCountry(country) ? 'Asia/Jerusalem' : 'Etc/GMT+12'
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${m[1]}-${m[2]}-${m[3]}` < `${get('year')}-${get('month')}-${get('day')}`
}
