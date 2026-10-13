// OD-08: International billing is always USD; a local-currency figure is only a labelled ESTIMATE. This pure adapter
// is the only way a display currency can be derived. It never alters billingCurrency / billingAmountMinor, never trusts a
// browser-supplied market, and falls back to USD when the rate record is missing, malformed, stale, unsupported or a
// forbidden International currency (ILS / NIS never appear on the International site, OD-11).
// No verified rate source is wired today (see the plan-cards / subscriptions report): callers pass `rate: null` and get
// the USD display.
export const ESTIMATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FORBIDDEN_INTERNATIONAL_CURRENCIES = Object.freeze(['ILS', 'NIS']);

export function internationalDisplay(priceRow, rate, { now = Date.now(), maxAgeMs = ESTIMATE_MAX_AGE_MS, supportedCurrencies = [] } = {}) {
  if (!priceRow || priceRow.market !== 'INTERNATIONAL' || priceRow.currency !== 'USD' || !Number.isInteger(priceRow.amountMinor)) {
    throw new Error('internationalDisplay needs an approved INTERNATIONAL USD price row');
  }
  const usd = { billingCurrency: 'USD', billingAmountMinor: priceRow.amountMinor, displayCurrency: 'USD', displayAmountMinor: priceRow.amountMinor, estimate: false, rate: null, rateAsOf: null, rateSource: null, fallbackReason: null };
  const fallback = (reason) => ({ ...usd, fallbackReason: reason });
  if (rate == null) return fallback('no_rate_source');
  const cur = typeof rate.currency === 'string' ? rate.currency.toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(cur)) return fallback('invalid_currency');
  if (cur === 'USD') return usd;
  if (FORBIDDEN_INTERNATIONAL_CURRENCIES.includes(cur)) return fallback('forbidden_currency');
  if (!supportedCurrencies.includes(cur)) return fallback('unsupported_currency');
  const asOf = Date.parse(rate.asOf);
  if (!(typeof rate.usdToCurrency === 'number' && Number.isFinite(rate.usdToCurrency) && rate.usdToCurrency > 0)) return fallback('invalid_rate');
  if (!Number.isFinite(asOf) || asOf > now + 60_000) return fallback('invalid_as_of');
  if (now - asOf > maxAgeMs) return fallback('stale_rate');
  if (typeof rate.source !== 'string' || !rate.source.trim()) return fallback('no_provenance');
  return {
    billingCurrency: 'USD', billingAmountMinor: priceRow.amountMinor,
    displayCurrency: cur, displayAmountMinor: Math.round(priceRow.amountMinor * rate.usdToCurrency),
    estimate: true, rate: rate.usdToCurrency, rateAsOf: new Date(asOf).toISOString(), rateSource: rate.source.trim(), fallbackReason: null,
  };
}
