// Israel address suggestions (Codex spec A13-A16, Owner-approved 2026-10-14). The data is a build-time snapshot of the Population and
// Immigration Authority lists (scripts/build-israel-address-snapshot.mjs) served as static files from our own site: the city index is
// loaded only when an address field is used, the streets of ONE city only after that city is known, and the aliases of that city right
// after its streets. Nothing the user types is sent anywhere. The stored address stays the existing text format (street|city|state|zip):
// a suggestion only fills text, it is never an address verification.
import snapshot from '../data/ilAddressSnapshot.json';

export const IL_ADDRESS_VERSION = snapshot.version;
const BASE = snapshot.base;
const cache = new Map();

function loadJson(rel, { signal, fetchImpl = globalThis.fetch } = {}) {
  const url = `${BASE}/${rel}`;
  if (!cache.has(url)) {
    const p = Promise.resolve()
      .then(() => fetchImpl(url))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .catch((e) => { cache.delete(url); throw e; });
    cache.set(url, p);
  }
  const p = cache.get(url);
  if (!signal) return p;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    p.then((v) => { signal.removeEventListener('abort', onAbort); resolve(v); }, (e) => { signal.removeEventListener('abort', onAbort); reject(e); });
  });
}

// [code, name_he, name_en_display, has_streets]
export const loadCities = (opts) => loadJson('cities.json', opts);
// [[street_code, name_he], ...]
export const loadStreets = (cityCode, opts) => loadJson(`streets/${cityCode}.json`, opts);
// { street_code: [alias, ...] } - a missing file means the city has no aliases
export const loadAliases = (cityCode, opts) => loadJson(`aliases/${cityCode}.json`, opts).catch((e) => { if (e?.name === 'AbortError') throw e; return {}; });

export function resetIsraelAddressCache() { cache.clear(); }

// Quotes / geresh / gershayim are ignored, hyphens count as spaces: "תל-אביב" finds "תל אביב - יפו", "באר שבע" finds "באר שבע".
export function normalizeAddressText(s) {
  return String(s ?? '').toLowerCase().replace(/["'`׳״]/g, '').replace(/[-–־,.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function rankOf(name, q) {
  const n = normalizeAddressText(name);
  if (!n || !q) return -1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(' ').some((w) => w.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  return -1;
}

export const cityLabel = (city, isHebrew) => (isHebrew ? city[1] : (city[2] || city[1]));

// City suggestions start at 2 characters, Hebrew and English names both match.
export function searchCities(cities, query, { isHebrew, limit = 8 } = {}) {
  const q = normalizeAddressText(query);
  if (!Array.isArray(cities) || q.length < 2) return [];
  const hits = [];
  for (const c of cities) {
    const r = [rankOf(c[1], q), rankOf(c[2], q)].filter((x) => x >= 0);
    if (r.length) hits.push({ rank: Math.min(...r), city: c });
  }
  hits.sort((a, b) => a.rank - b.rank || cityLabel(a.city, isHebrew).length - cityLabel(b.city, isHebrew).length);
  return hits.slice(0, limit).map(({ city }) => ({ code: city[0], label: cityLabel(city, isHebrew), he: city[1], en: city[2], hasStreets: city[3] === 1 }));
}

// The city typed or picked, by its exact Hebrew or English name (a typed-by-hand exact name counts as well).
export function findCity(cities, text) {
  const q = normalizeAddressText(text);
  if (!Array.isArray(cities) || !q) return null;
  const c = cities.find((x) => normalizeAddressText(x[1]) === q || (x[2] && normalizeAddressText(x[2]) === q));
  return c ? { code: c[0], he: c[1], en: c[2], hasStreets: c[3] === 1 } : null;
}

// Street suggestions of ONE city. An alias only finds its official street (shown once, by its official name). Once the text is a full
// street name followed by more text (the house number), there is nothing more to suggest.
export function searchStreets(streets, aliases, query, { limit = 8 } = {}) {
  const raw = String(query ?? '');
  const q = normalizeAddressText(raw);
  if (!Array.isArray(streets) || !q) return [];
  if (streets.some(([, name]) => { const n = normalizeAddressText(name); return q.startsWith(`${n} `); })) return [];
  const best = new Map();
  for (const [code, name] of streets) {
    let r = rankOf(name, q); let via = null;
    for (const a of (aliases && aliases[code]) || []) {
      const ra = rankOf(a, q);
      if (ra >= 0 && (r < 0 || ra < r)) { r = ra; via = a; }
    }
    if (r >= 0) best.set(code, { rank: r, code, label: name, via });
  }
  return [...best.values()].sort((a, b) => a.rank - b.rank || a.label.length - b.label.length).slice(0, limit).map(({ code, label, via }) => ({ code, label, via }));
}
