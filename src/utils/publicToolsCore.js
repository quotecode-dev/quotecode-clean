// Task 36 (Codex landing review L4 / L5): ONE pure core for the public tools (HE /he/tools and EN /en/tools).
//   - input: a strict number grammar; empty / negative / not a number / absurdly large are refused with a code, never "cleaned up";
//   - data: every provider has its own state (loading | live | cached | stale | unavailable); a value without verified data is never shown;
//     the time shown is the PROVIDER's own update time (open.er-api.com `time_last_update_unix`, CoinGecko `last_updated_at`),
//     never the moment of the fetch;
//   - metals: there is NO metals feed - the value is an estimate from a stated reference price per gram of fine metal (editable by the
//     user), multiplied by the exact fineness of the chosen purity (24k = 99.9%).

export const MAX_TOOL_INPUT = 1e12;
const NUMBER_GRAMMAR = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

// '' -> empty, '-1' -> negative, 'abc' / '1e3' / '1,000' -> invalid, > MAX -> too_large; otherwise { ok, value }
export function parseToolNumber(raw, { max = MAX_TOOL_INPUT } = {}) {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: false, code: 'empty' };
  if (/^-/.test(s)) return { ok: false, code: 'negative' };
  if (!NUMBER_GRAMMAR.test(s)) return { ok: false, code: 'invalid' };
  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, code: 'invalid' };
  if (value > max) return { ok: false, code: 'too_large' };
  return { ok: true, value };
}

export const INPUT_ERRORS = {
  he: { empty: 'הזינו מספר.', negative: 'המספר לא יכול להיות שלילי.', invalid: 'הזינו מספר תקין (ספרות ונקודה עשרונית בלבד).', too_large: 'המספר גדול מדי לחישוב.' },
  en: { empty: 'Enter a number.', negative: 'The number cannot be negative.', invalid: 'Enter a valid number (digits and a decimal point only).', too_large: 'The number is too large to calculate.' },
};

// ---------------------------------------------------------------------------------------------------------------- units
export const UNIT_FACTORS = { m: 1, ft: 0.3048, km: 1000, mi: 1609.344, cm: 0.01, in: 0.0254 };
export function convertLength(value, from, to) {
  return (value * UNIT_FACTORS[from]) / UNIT_FACTORS[to];
}
// up to 6 significant decimals, trailing zeros dropped (1 m -> "100" cm, 1 in -> "0.0254" m)
export function formatToolNumber(n, locale = 'en-US', maxFractionDigits = 6) {
  return Number(n).toLocaleString(locale, { maximumFractionDigits: maxFractionDigits, useGrouping: true });
}

// ---------------------------------------------------------------------------------------------------------------- metals
// Fixed REFERENCE price per gram of FINE metal in USD (no feed). Shown to the user as the basis; never called a market price.
export const REFERENCE_METAL_USD_PER_GRAM = Object.freeze({ gold: 75.6, silver: 0.88, platinum: 33.0, palladium: 30.0, rhodium: 1040.0 });
// exact fineness of every purity offered (the label and the factor are the same number)
export const METAL_PURITY = Object.freeze({
  gold: { '24k': 0.999, '22k': 0.916, '21k': 0.875, '18k': 0.75, '14k': 0.585 },
  silver: { 999: 0.999, 925: 0.925, 800: 0.8 },
  platinum: { 999: 0.999, 950: 0.95 },
  palladium: { 999: 0.999 },
  rhodium: { 999: 0.999 },
});
export const DEFAULT_PURITY = Object.freeze({ gold: '24k', silver: '999', platinum: '999', palladium: '999', rhodium: '999' });
export function metalValueUsd(grams, metal, purity, usdPerGramFine) {
  const f = METAL_PURITY[metal]?.[purity];
  return f == null ? null : grams * f * usdPerGramFine;
}

// ---------------------------------------------------------------------------------------------------------------- providers
export const CURRENCY_CODES = ['ILS', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY'];
export const CRYPTO_IDS = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', trx: 'tron' };
export const currencyUrl = (base) => `https://open.er-api.com/v6/latest/${base}`;
export const CRYPTO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_IDS).join(',')}&vs_currencies=usd&include_last_updated_at=true`;
export const CURRENCY_SOURCE = 'ExchangeRate-API';
export const CRYPTO_SOURCE = 'CoinGecko';

// open.er-api.com v6 -> { rates: units of each code per 1 base, asOf (ms, provider time), source } | null (anything incomplete is refused)
export function normalizeCurrencyResponse(json, base) {
  if (!json || json.result !== 'success' || json.base_code !== base || !json.rates || !Number.isFinite(json.time_last_update_unix)) return null;
  const rates = {};
  for (const c of CURRENCY_CODES) {
    const r = Number(json.rates[c]);
    if (!(Number.isFinite(r) && r > 0)) return null;
    rates[c] = r;
  }
  return { rates, asOf: json.time_last_update_unix * 1000, source: CURRENCY_SOURCE };
}
// amount in `from` -> `to`, with rates = units per 1 base
export function convertCurrency(amount, from, to, rates) {
  return (amount / rates[from]) * rates[to];
}

// CoinGecko simple/price -> { prices: { btc: { usd, asOf } , ... }, source } - a coin without a valid price is simply absent
export function normalizeCryptoResponse(json) {
  if (!json || typeof json !== 'object') return null;
  const prices = {};
  for (const [code, id] of Object.entries(CRYPTO_IDS)) {
    const usd = Number(json[id]?.usd);
    const at = Number(json[id]?.last_updated_at);
    if (Number.isFinite(usd) && usd > 0 && Number.isFinite(at)) prices[code] = { usd, asOf: at * 1000 };
  }
  return Object.keys(prices).length ? { prices, source: CRYPTO_SOURCE } : null;
}

// ---------------------------------------------------------------------------------------------------------------- cache + state
export const FRESH_FOR_MS = 10 * 60 * 1000; // a fetch younger than this is reused instead of asking the provider again
export function readToolsCache(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}
export function writeToolsCache(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* storage full / blocked: the data is still shown, just not kept */ }
}
// when THIS provider was last fetched (each entry keeps its own time; an older cache format kept one shared time)
export const entryFetchedAt = (cache, name) => (Number.isFinite(cache?.[name]?.fetchedAt) ? cache[name].fetchedAt : Number.isFinite(cache?.fetchedAt) ? cache.fetchedAt : 0);
// the state shown for one provider: live (fetched now) | cached (reused, still fresh) | stale (fetch failed, older data) | unavailable
export function feedState({ live, cached, fetchedAt, now, failed }) {
  if (live) return { status: 'live', data: live };
  if (cached && now - fetchedAt < FRESH_FOR_MS && !failed) return { status: 'cached', data: cached };
  if (cached && failed) return { status: 'stale', data: cached };
  return failed ? { status: 'unavailable', data: null } : { status: 'loading', data: cached || null };
}
