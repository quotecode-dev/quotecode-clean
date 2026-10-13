// Task 39 (Owner final scope 2026-10-13, OD-08): the International landing / plans window may show the USD package price as a LABELLED
// local-currency ESTIMATE. Billing stays USD; the estimate never changes an account market, currency or entitlement.
//   * display currency from the visitor's real geo country (Vercel geo via /api/geo, else the root-redirect geo cookie): GB -> GBP,
//     the euro-area member states -> EUR, every other country (and no country) -> USD. Not "all of Europe": only the euro area.
//   * rate from the product's existing public source (ExchangeRate-API, already used by the in-app currency calculator), with its own
//     provider, base and last-update time; valid for 26 h (a daily source + 2 h grace). Missing / malformed / stale -> USD + a notice.
export const EURO_AREA = Object.freeze(['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES']);
export const ESTIMATE_CURRENCIES = Object.freeze(['GBP', 'EUR']);
export const RATE_SOURCE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
export const RATE_SOURCE_NAME = 'ExchangeRate-API';
export const RATE_VALIDITY_MS = 26 * 60 * 60 * 1000;
export const CURRENCY_SYMBOL = Object.freeze({ USD: '$', GBP: '£', EUR: '€' });

export function normalizeCountry(raw) {
  const c = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export function displayCurrencyForCountry(country) {
  const c = normalizeCountry(country);
  if (c === 'GB') return 'GBP';
  if (c && EURO_AREA.includes(c)) return 'EUR';
  return 'USD';
}

export function geoCountryFromCookie(cookieString) {
  const m = typeof cookieString === 'string' ? cookieString.match(/(?:^|;\s*)proflow_geo_country=([^;]*)/) : null;
  if (!m) return null;
  try { return normalizeCountry(decodeURIComponent(m[1])); } catch { return null; }
}

// The rate record internationalDisplay() accepts, or null. Only the requested currency, from a USD-based payload with a real update time.
export function rateFromPayload(payload, currency) {
  const cur = typeof currency === 'string' ? currency.toUpperCase() : '';
  if (!ESTIMATE_CURRENCIES.includes(cur)) return null;
  if (!payload || typeof payload !== 'object' || payload.base !== 'USD' || !payload.rates || typeof payload.rates !== 'object') return null;
  const v = payload.rates[cur];
  const updated = payload.time_last_updated;
  if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) return null;
  if (!(typeof updated === 'number' && Number.isFinite(updated) && updated > 0)) return null;
  return { currency: cur, usdToCurrency: v, asOf: new Date(updated * 1000).toISOString(), source: RATE_SOURCE_NAME };
}

async function fetchJson(fetchImpl, url, timeoutMs, init = {}) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl?.signal });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// The visitor's real geo country: /api/geo (Vercel geo header, no-store, per request); the root-redirect cookie only when it is unavailable.
export async function resolveVisitorCountry({ fetchImpl = globalThis.fetch, cookieString = '', timeoutMs = 4000 } = {}) {
  const geo = typeof fetchImpl === 'function' ? await fetchJson(fetchImpl, '/api/geo', timeoutMs, { cache: 'no-store' }) : null;
  const fromApi = normalizeCountry(geo?.country);
  if (fromApi) return { country: fromApi, source: 'geo' };
  const fromCookie = geoCountryFromCookie(cookieString);
  return fromCookie ? { country: fromCookie, source: 'cookie' } : { country: null, source: 'none' };
}

// { currency, rate|null, reason } - rate is null for USD visitors and on any source failure (the caller then shows USD + its notice).
export async function loadLocalEstimate({ fetchImpl = globalThis.fetch, cookieString = '', timeoutMs = 4000 } = {}) {
  const { country } = await resolveVisitorCountry({ fetchImpl, cookieString, timeoutMs });
  const currency = displayCurrencyForCountry(country);
  if (currency === 'USD') return { currency, rate: null, reason: null };
  const payload = typeof fetchImpl === 'function' ? await fetchJson(fetchImpl, RATE_SOURCE_URL, timeoutMs) : null;
  const rate = rateFromPayload(payload, currency);
  return { currency, rate, reason: rate ? null : 'rate_unavailable' };
}

// In-app plans window: the estimate follows the ACCOUNT's identified currency (GBP / EUR), never the visitor's geo; same source + validity.
export async function loadUsdRate(currency, { fetchImpl = globalThis.fetch, timeoutMs = 4000 } = {}) {
  const cur = typeof currency === 'string' ? currency.toUpperCase() : '';
  if (!ESTIMATE_CURRENCIES.includes(cur) || typeof fetchImpl !== 'function') return null;
  return rateFromPayload(await fetchJson(fetchImpl, RATE_SOURCE_URL, timeoutMs), cur);
}
