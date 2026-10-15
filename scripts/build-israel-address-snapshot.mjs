// Israel address snapshot (Codex spec A13 / A14 / A15, Owner-approved 2026-10-14): builds the city index and the per-city street
// shards that the address fields load lazily from our own site. Data: Population and Immigration Authority lists on data.gov.il
// (localities, streets, street synonyms), read through the public CKAN datastore_search API. No user address is ever sent anywhere -
// the app only fetches these static files. Maintenance step, run by hand (no scheduler):
//   node --use-system-ca scripts/build-israel-address-snapshot.mjs
// Fails closed (no files written) on an empty result, a changed header schema or a count mismatch.
// Licence (A17): the localities list says license_id=other-open; the street lists state no licence id. Owner decision 2026-10-15
// ("ניתן להפיץ את רשימת הכתובות"): the snapshot may be distributed on the site, with the source credited in the suggestion list.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://data.gov.il/api/3/action';
const RES = {
  cities: { id: '8f714b6f-c35c-4b40-a0e7-547b675eee0e', dataset: 'citiesandsettelments', fields: ['city_code', 'city_name_he', 'city_name_en'] },
  streets: { id: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b', dataset: '321', fields: ['סמל_ישוב', 'שם_ישוב', 'סמל_רחוב', 'שם_רחוב'] },
  synonyms: { id: 'bf185c7f-1a4e-4662-88c5-fa118a244bda', dataset: 'israel-streets-synom', fields: ['city_code', 'street_code', 'street_name', 'street_name_status', 'official_code'] },
};
// Street code 9000 carries the locality's own name, not a street (Codex spec): never a street suggestion.
const LOCALITY_SELF_CODE = 9000;
const PLACEHOLDER_ALIAS = /^(רח|רחוב|שכ|שכונה)?\s*\d+$/;
const LICENSE = { status: 'OWNER-CONFIRMED', decision: 'Owner console 2026-10-15: the address lists may be distributed on the site (Codex spec A17)', attribution: 'Population and Immigration Authority, data.gov.il', cities: 'license_id other-open', streets: 'no licence id stated', synonyms: 'no licence id stated' };
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(2); };
const getJson = async (url) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'tekango-address-snapshot/1' } });
      const t = await r.text();
      if (r.ok && t.startsWith('{')) return JSON.parse(t);
      if (attempt === 3) die(`${url} -> HTTP ${r.status}`);
    } catch (e) { if (attempt === 3) die(`${url} -> ${e.message}`); }
    await new Promise((res) => setTimeout(res, 2000 * attempt));
  }
};

async function readAll(key) {
  const { id, fields } = RES[key];
  const rows = []; let total = null;
  for (let offset = 0; total === null || offset < total; offset += 20000) {
    const j = await getJson(`${API}/datastore_search?resource_id=${id}&limit=20000&offset=${offset}`);
    if (!j.success) die(`${key}: datastore_search failed`);
    const have = j.result.fields.map((f) => f.id);
    const missing = fields.filter((f) => !have.includes(f));
    if (missing.length) die(`${key}: header schema changed, missing ${missing.join(', ')}`);
    total = j.result.total;
    rows.push(...j.result.records);
    if (!j.result.records.length) break;
  }
  if (!rows.length || rows.length !== total) die(`${key}: read ${rows.length} of ${total} records`);
  return rows;
}

async function resourceMeta(key) {
  try {
    const j = await getJson(`${API}/resource_show?id=${RES[key].id}`);
    return { lastModified: j.result?.last_modified || j.result?.metadata_modified || null };
  } catch { return { lastModified: null }; }
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// Display only: the source writes English names in capitals ("TEL AVIV - YAFO"); no spelling is changed.
const titleCase = (s) => clean(s).toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const norm = (s) => clean(s).toLowerCase().replace(/["'`׳״]/g, '').replace(/[-–־]/g, ' ').replace(/\s+/g, ' ').trim();

const [cityRows, streetRows, synRows] = [await readAll('cities'), await readAll('streets'), await readAll('synonyms')];
const meta = { cities: await resourceMeta('cities'), streets: await resourceMeta('streets'), synonyms: await resourceMeta('synonyms') };

// streets per city (official list)
const byCity = new Map();
for (const r of streetRows) {
  const city = Number(r['סמל_ישוב']); const code = Number(r['סמל_רחוב']); const name = clean(r['שם_רחוב']);
  if (!Number.isFinite(city) || !Number.isFinite(code) || !name || code === LOCALITY_SELF_CODE) continue;
  if (!byCity.has(city)) byCity.set(city, new Map());
  const m = byCity.get(city);
  if (!m.has(code)) m.set(code, { name, aliases: new Set() });
}
// A14: an alias is only a search key of an official street of the SAME city (never a second street); unmapped aliases are dropped.
let aliasKept = 0; let aliasDropped = 0;
for (const r of synRows) {
  if (clean(r.street_name_status).toLowerCase() === 'official') continue;
  const city = Number(r.city_code); const official = Number(r.official_code); const alias = clean(r.street_name);
  const target = byCity.get(city)?.get(official);
  // "רח 3939"-style entries are internal placeholder numbers, not names a person would type.
  if (!target || !alias || PLACEHOLDER_ALIAS.test(alias) || norm(alias) === norm(target.name)) { aliasDropped++; continue; }
  target.aliases.add(alias); aliasKept++;
}

const cities = [];
for (const r of cityRows) {
  const code = Number(r.city_code); const he = clean(r.city_name_he);
  if (!Number.isFinite(code) || code === 0 || !he) continue;
  cities.push([code, he, r.city_name_en ? titleCase(r.city_name_en) : '', byCity.has(code) && byCity.get(code).size > 0 ? 1 : 0]);
}
cities.sort((a, b) => a[1].localeCompare(b[1], 'he'));
if (cities.length < 1000 || byCity.size < 500) die(`implausible snapshot: ${cities.length} cities, ${byCity.size} cities with streets`);

const sourceDate = [meta.cities.lastModified, meta.streets.lastModified, meta.synonyms.lastModified].filter(Boolean).sort().pop();
const version = (sourceDate ? sourceDate.slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
const base = path.join(ROOT, 'public', 'data', 'il-address');
const dir = path.join(base, `v${version}`);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const files = {};
const write = (rel, data) => { const s = JSON.stringify(data); fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), s); files[rel] = { bytes: Buffer.byteLength(s), sha256: sha(s) }; };

fs.rmSync(base, { recursive: true, force: true });
write('cities.json', cities);
// Progressive load: the official names first (small), the aliases of the same city in a second file fetched right after.
let streetCount = 0; let largest = { city: null, bytes: 0 };
for (const [city, m] of byCity) {
  const list = [...m.entries()].map(([code, v]) => [code, v.name]);
  list.sort((a, b) => a[1].localeCompare(b[1], 'he'));
  streetCount += list.length;
  write(`streets/${city}.json`, list);
  if (files[`streets/${city}.json`].bytes > largest.bytes) largest = { city, bytes: files[`streets/${city}.json`].bytes };
  const aliases = Object.fromEntries([...m.entries()].filter(([, v]) => v.aliases.size).map(([code, v]) => [code, [...v.aliases].sort()]));
  if (Object.keys(aliases).length) write(`aliases/${city}.json`, aliases);
}
const manifest = {
  schema: 'il-address/v1',
  version: `v${version}`,
  fetchedAt: new Date().toISOString(),
  source: Object.fromEntries(Object.entries(RES).map(([k, v]) => [k, { publisher: 'Population and Immigration Authority (data.gov.il)', dataset: `https://data.gov.il/dataset/${v.dataset}`, resourceId: v.id, lastModified: meta[k].lastModified, records: { cities: cityRows, streets: streetRows, synonyms: synRows }[k].length }])),
  license: LICENSE,
  format: { cities: '[city_code, name_he, name_en_display, has_streets]', streets: 'streets/<city_code>.json: [street_code, name_he]; code 9000 (the locality itself) excluded', aliases: 'aliases/<city_code>.json: { street_code: [alias, ...] } - search keys of that official street only' },
  counts: { cities: cities.length, citiesWithStreets: byCity.size, streets: streetCount, aliasesKept: aliasKept, aliasesDropped: aliasDropped },
  largestShard: largest,
  files: { 'cities.json': files['cities.json'], streetShards: Object.keys(files).filter((f) => f.startsWith('streets/')).length, aliasShards: Object.keys(files).filter((f) => f.startsWith('aliases/')).length, shardsSha256: sha(Object.keys(files).filter((f) => f !== 'cities.json').sort().map((f) => `${f}:${files[f].sha256}`).join('\n')) },
};
fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'ilAddressSnapshot.json'), `${JSON.stringify({ version: manifest.version, base: `/data/il-address/${manifest.version}` }, null, 2)}\n`);
console.log(JSON.stringify({ version: manifest.version, counts: manifest.counts, largestShard: largest, citiesBytes: files['cities.json'].bytes }, null, 2));
