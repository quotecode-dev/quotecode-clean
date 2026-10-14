// Task 16 - Quote Experience V2: TEST runtime verification of the DEPLOYED `quote-presentation` Edge Function.
//
// Usage (coordinator, after the TEST deploy; AVG HTTPS scanning needs the Windows trust store):
//   node --use-system-ca scripts/task16/qa/verify-presentation-runtime.mjs --out <dir> [--env C:/tkrc-pt/.env.localtest.local]
//
// Output: <dir>/presentation-runtime.json  - every check PASS / FAIL / NOT TESTED with secret-free evidence, plus the ids
//         (quotes, assets, services) this run created so they can be cleaned up later. Nothing is deleted (retention by design).
//         Exit code 0 = no FAIL, 1 = at least one FAIL, 2 = refused / setup error.
//
// TARGET: refuses unless VITE_SUPABASE_URL is exactly https://ljfizgrdyzxddswcedwr.supabase.co (TEST). Production is never reached.
// CREDENTIALS: persona e-mails / passwords and the anon key are read from the env file and used ONLY in createClient /
//   signInWithPassword. They are never printed, logged or written; every output string passes through redact(), which also
//   removes JWTs and signed-URL tokens. Only the project ref and user ids truncated to 8 characters are printed.
// WRITES (TEST only, all prefixed "T16 QA"): new quotes + clients through the app's own save path
//   (src/utils/quoteSaveOrchestrator.js persistQuote -> save_quote_atomic when available, else the phased path), one services
//   row if LOCAL_PRO has no "T16 QA" service, uploaded test images, Task 16 JSON records. One storage write PROBE as LOCAL_PRO into
//   t16-presentation/ (expected to be refused; if it is NOT refused that is a FAIL and the probe object path is recorded).
// LEFT IN PLACE AFTER A RUN (nothing is reverted except the S6 temporary downgrade):
//   - QA tier fixtures (t16-presentation/_qa/capabilities.json): LOCAL_PRO visual, INTL_PRO visual, INTL_GBP modern,
//     INTL_EUR classic. S6 downgrades LOCAL_PRO to classic and sets it back to visual at the end of S6.
//   - INTL_GBP business default style = modern (S2).
//   - One T16 QA quote of LOCAL_PRO with status 'approved' (S8; 'sent' if the owner update to approved is refused) plus its
//     frozen issued.json, and one issued T16 QA draft quote (S6). All created ids are listed in the output.
//
// Scenarios: S1 QA capability | S2 context + set_default | S3 upload validation | S4 quote save / ownership |
//            S5 public_get + storage isolation | S6 issue + downgrade | S7 catalog link/unlink | S8 locked quote lazy freeze.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertAllowlistedPersona } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { persistQuote, newUuid } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'utils', 'quoteSaveOrchestrator.js')).href);

const TEST_REF = 'ljfizgrdyzxddswcedwr';
const TEST_URL = `https://${TEST_REF}.supabase.co`;
const FN = 'quote-presentation';
const BUCKET = 'quote-files';
const DEFAULT_ENV = 'C:/tkrc-pt/.env.localtest.local';
// IRON-DATA-001: only allowlisted synthetic personas (sha256(email) in synthetic-personas.json, checked fail-closed
// before any sign-in). INTL_GBP replaces the former LOCAL_BASIC role (modern tier), INTL_EUR the former LOCAL_FREE role
// (classic tier).
const PERSONA_PASSWORD_KEY = 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD';
const PERSONA_KEYS = {
  LOCAL_PRO: { email: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', pwd: PERSONA_PASSWORD_KEY },
  INTL_PRO: { email: 'PROFLOW_TEST_INTL_PRO_EMAIL', pwd: PERSONA_PASSWORD_KEY },
  INTL_GBP: { email: 'PROFLOW_TEST_INTL_GBP_EMAIL', pwd: 'PROFLOW_TEST_INTL_GBP_PASSWORD' },
  INTL_EUR: { email: 'PROFLOW_TEST_INTL_EUR_EMAIL', pwd: 'PROFLOW_TEST_INTL_EUR_PASSWORD' },
};
const ADMIN_EMAIL_KEY = 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL';
const ADMIN_PASSWORD_KEY = 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD';
const PASS = 'PASS'; const FAIL = 'FAIL'; const NT = 'NOT TESTED';
const ITEM_DESC = 'T16 QA Oak table';
const ITEM_KEY = 't16 qa oak table';

// ------------------------------------------------------------------------------------------------------------- args / env
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i += 1; } else out[a.slice(2)] = true;
  }
  return out;
}
function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

let SECRETS = [];
function redact(text) {
  let s = String(text);
  for (const v of SECRETS) if (v && v.length >= 3) s = s.split(v).join('<redacted>');
  s = s.replace(/eyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]{2,}){1,2}/g, '<jwt>');
  s = s.replace(/([?&]token=)[^&"\s]+/g, '$1<redacted>');
  s = s.replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '<key>');
  return s;
}
const say = (msg) => process.stdout.write(redact(msg) + '\n');
const short = (id) => (typeof id === 'string' ? `${id.slice(0, 8)}…` : String(id));

// Evidence scrubber: signed URLs -> shape only; data: URLs -> length only; long strings cut.
function scrub(v) {
  if (typeof v === 'string') {
    if (/^https?:\/\//.test(v)) return v.includes('token=') ? '<signed-url>' : '<url>';
    if (v.startsWith('data:')) return `<data-url len=${v.length}>`;
    return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  }
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)]));
  return v;
}

// ------------------------------------------------------------------------------------------------------------- PNG builder
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Real, decodable RGB PNG. fill: 'gradient' | 'noise' (incompressible, for the > 4 MB case).
function makePng(w, h, { fill = 'gradient', extraChunks = [] } = {}) {
  const rowLen = 1 + w * 3;
  const raw = Buffer.alloc(rowLen * h);
  if (fill === 'noise') crypto.randomFillSync(raw);
  for (let y = 0; y < h; y += 1) {
    raw[y * rowLen] = 0; // filter: none
    if (fill === 'gradient') for (let x = 0; x < w; x += 1) { const o = y * rowLen + 1 + x * 3; raw[o] = (x * 255 / w) | 0; raw[o + 1] = (y * 255 / h) | 0; raw[o + 2] = 160; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), ...extraChunks, chunk('IDAT', zlib.deflateSync(raw, { level: fill === 'noise' ? 0 : 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------------------------------------------------- clients
function newClient(url, anonKey) {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function signIn(url, anonKey, email, password) {
  const client = newClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  // Only the auth error CODE is kept (never the message, never a reset attempt).
  if (error || !data?.user?.id) return { client: null, uid: null, errorCode: String(error?.code || (error?.status ? `http_${error.status}` : 'no_user')) };
  return { client, uid: data.user.id, errorCode: null };
}

// One function call; never throws. { status, ok, data | code, message }
async function invoke(client, body) {
  try {
    const { data, error } = await client.functions.invoke(FN, { body });
    if (!error) return { status: 200, ok: true, data };
    let payload = null;
    const ctx = error.context;
    try { payload = ctx && typeof ctx.json === 'function' ? await ctx.json() : null; } catch { payload = null; }
    return { status: ctx?.status ?? null, ok: false, code: payload?.error ?? error.name ?? 'error', message: payload?.message ?? error.message };
  } catch (e) {
    return { status: null, ok: false, code: 'exception', message: e?.message || String(e) };
  }
}
const ev = (r) => scrub(r.ok ? { status: r.status, data: r.data } : { status: r.status, code: r.code, message: r.message });
async function fetchHead(url) {
  try {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, contentType: res.headers.get('content-type'), xContentTypeOptions: res.headers.get('x-content-type-options'), bytes: buf.length };
  } catch (e) { return { status: null, error: e?.message || String(e) }; }
}

// ------------------------------------------------------------------------------------------------------------- recorder
const scenarios = [];
const created = { quotes: [], assets: [], services: [], clients: [], storageProbes: [] };
function scenario(id, title) {
  const s = { id, title, checks: {} };
  scenarios.push(s);
  const set = (name, status, detail) => { s.checks[name] = { status, detail: scrub(detail) }; say(`  [${status}] ${id}.${name}`); };
  return {
    pass: (n, d) => set(n, PASS, d), fail: (n, d) => set(n, FAIL, d), nt: (n, d) => set(n, NT, d),
    expect: (n, cond, d) => set(n, cond ? PASS : FAIL, d),
  };
}
const expectRefused = (r, codes, statuses) => !r.ok && (!codes || codes.includes(r.code)) && (!statuses || statuses.includes(r.status));

// ------------------------------------------------------------------------------------------------------------- quote creation
// Through the app's own persistence path (RLS as the owner). Minimal valid single-item quote.
async function createQaQuote(client, uid, { market, label }) {
  const quoteId = newUuid();
  const local = market === 'LOCAL';
  const subtotal = 1000;
  const taxRate = local ? 0.18 : 0; // stored as a fraction (regionConfig vatRate), like the app
  const total = Math.round(subtotal * (1 + taxRate));
  const clientName = `T16 QA ${label} ${new Date().toISOString().slice(0, 19)}`;
  const plan = {
    userId: uid,
    isNew: true,
    quoteId,
    existingClientId: null,
    clientPayload: { company_name: clientName, email: '', phone: '', client_type: 'business', tax_id: '', address: '', notes: '', user_id: uid },
    header: {
      client_type: 'business', currency: local ? 'ILS' : 'USD', subtotal, tax_rate: taxRate, total, discount: 0, status: 'draft',
      valid_until: null, terms: '', warranty: '', notes: '', subject: `T16 QA ${label}`, quote_subject: `T16 QA ${label}`,
    },
    attnFields: { attn_name: clientName, attn_role: null },
    attnUserEntered: false,
    projectName: null,
    descriptionUpdates: [],
    structured: {
      financial: null,
      sections: [],
      items: [{
        client_key: 'new_0', id: null, section_client_key: null, description: ITEM_DESC, quantity: 1, unit_price: subtotal, total_price: subtotal,
        pricing_unit: null, calculated_quantity: null, quantity_source: null, specification: [], calculation_method: null, sort_order: 0, measurements: [],
      }],
      removedSectionIds: [],
      removedItemIds: [],
    },
    newFiles: [],
    removedAttachments: [],
    now: () => Date.now(),
  };
  const r = await persistQuote(client, plan);
  const ok = r.outcome === 'ok';
  if (r.quoteId) created.quotes.push({ id: r.quoteId, owner: short(uid), label, outcome: r.outcome, path: r.path });
  if (r.clientId) created.clients.push(r.clientId);
  return { ok, quoteId: r.quoteId || quoteId, detail: { outcome: r.outcome, path: r.path, stage: r.stage || null, error: r.error ? { code: r.error.code, message: r.error.message } : null } };
}

// ------------------------------------------------------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out || args.out === true) { say('usage: node --use-system-ca scripts/task16/qa/verify-presentation-runtime.mjs --out <dir> [--env <file>]'); return 2; }
  const outDir = path.resolve(String(args.out));
  const envFile = String(args.env && args.env !== true ? args.env : DEFAULT_ENV);
  const env = readEnv(envFile);
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  SECRETS = [anonKey, env[ADMIN_EMAIL_KEY], env[ADMIN_PASSWORD_KEY], ...Object.values(PERSONA_KEYS).flatMap((k) => [env[k.email], env[k.pwd]])].filter(Boolean);
  let host = null;
  try { const u = new URL(url); host = u.protocol === 'https:' && !u.port && !u.username ? u.hostname : null; } catch { host = null; }
  if (url !== TEST_URL || host !== `${TEST_REF}.supabase.co`) { say('REFUSED: VITE_SUPABASE_URL is not exactly the TEST project (value not printed)'); return 2; }
  const missing = [ADMIN_EMAIL_KEY, ADMIN_PASSWORD_KEY, 'VITE_SUPABASE_ANON_KEY', ...Object.values(PERSONA_KEYS).flatMap((k) => [k.email, k.pwd])].filter((k) => !env[k]);
  if (missing.length) { say(`REFUSED: env file lacks ${[...new Set(missing)].join(', ')} (names only)`); return 2; }
  try {
    for (const [name, k] of Object.entries(PERSONA_KEYS)) assertAllowlistedPersona(env[k.email], name);
    assertAllowlistedPersona(env[ADMIN_EMAIL_KEY], 'PERSONA_SUPER_ADMIN');
  } catch (e) { say(`REFUSED (IRON-DATA-001): ${e.message}`); return 2; }
  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = new Date().toISOString();
  say(`project ${TEST_REF} (TEST) | function ${FN}`);

  // ---- sign-in (each persona in its own client)
  const P = {};
  for (const [name, k] of Object.entries(PERSONA_KEYS)) {
    P[name] = await signIn(url, anonKey, env[k.email], env[k.pwd]);
    say(`persona ${name}: ${P[name].uid ? `uid ${short(P[name].uid)}` : `sign-in failed (auth error code ${P[name].errorCode})`}`);
  }
  const ADMIN = await signIn(url, anonKey, env[ADMIN_EMAIL_KEY], env[ADMIN_PASSWORD_KEY]);
  say(`persona SUPER_ADMIN: ${ADMIN.uid ? `uid ${short(ADMIN.uid)}` : `sign-in failed (auth error code ${ADMIN.errorCode})`}`);
  const anon = newClient(url, anonKey);
  const up = (n) => !!P[n]?.client;
  const why = (...names) => ({ reason: 'sign-in failed', authErrorCodes: Object.fromEntries(names.map((n) => [n, (n === 'SUPER_ADMIN' ? ADMIN : P[n])?.errorCode ?? null]).filter(([, c]) => c)) });
  const LP = P.LOCAL_PRO; const IP = P.INTL_PRO;

  // ================================================================ S1 QA capability
  {
    const s = scenario('S1', 'qa_set_capability (TEST only, super_admin only)');
    const plan = { LOCAL_PRO: 'visual', INTL_PRO: 'visual', INTL_GBP: 'modern', INTL_EUR: 'classic' };
    for (const [n, tier] of Object.entries(plan)) {
      if (!ADMIN.client || !up(n)) { s.nt(`set_${n}_${tier}`, why('SUPER_ADMIN', n)); continue; }
      const r = await invoke(ADMIN.client, { action: 'qa_set_capability', userId: P[n].uid, tier });
      s.expect(`set_${n}_${tier}`, r.ok && r.data?.tier === tier, ev(r));
    }
    if (up('INTL_GBP')) {
      const r = await invoke(P.INTL_GBP.client, { action: 'qa_set_capability', userId: P.INTL_GBP.uid, tier: 'visual' });
      s.expect('non_admin_refused', expectRefused(r, ['forbidden'], [403]), ev(r));
    } else s.nt('non_admin_refused', why('INTL_GBP'));
    const r = await invoke(anon, { action: 'context' });
    s.expect('anonymous_context_refused', expectRefused(r, ['unauthorized'], [401]), ev(r));
  }

  // ================================================================ S2 context + set_default
  {
    const s = scenario('S2', 'context tier + set_default entitlement');
    const expected = { LOCAL_PRO: 'visual', INTL_PRO: 'visual', INTL_GBP: 'modern', INTL_EUR: 'classic' };
    for (const [n, tier] of Object.entries(expected)) {
      if (!up(n)) { s.nt(`context_${n}`, why(n)); continue; }
      const r = await invoke(P[n].client, { action: 'context' });
      s.expect(`context_${n}`, r.ok && r.data?.tier === tier && r.data?.tierSource === 'qa_fixture' && r.data?.testMode === true
        && r.data?.commercialMapping === 'pending_owner_decision', ev(r));
    }
    if (up('INTL_EUR')) {
      const r = await invoke(P.INTL_EUR.client, { action: 'set_default', style: 'modern' });
      s.expect('classic_tier_set_default_modern_refused', expectRefused(r, ['style_not_entitled'], [403]), ev(r));
    } else s.nt('classic_tier_set_default_modern_refused', why('INTL_EUR'));
    if (up('INTL_GBP')) {
      const r = await invoke(P.INTL_GBP.client, { action: 'set_default', style: 'modern' });
      s.expect('modern_tier_set_default_modern_ok', r.ok && r.data?.defaultStyle === 'modern', ev(r));
    } else s.nt('modern_tier_set_default_modern_ok', why('INTL_GBP'));
  }

  // ================================================================ S3 upload validation
  const assets = {}; // name -> asset meta (LOCAL_PRO)
  {
    const s = scenario('S3', 'upload_media validation (server-side)');
    if (!up('LOCAL_PRO')) { s.nt('all', 'LOCAL_PRO sign-in failed'); } else {
      const upload = (bytes, contentType = 'image/png', filename = 't16-qa.png') =>
        invoke(LP.client, { action: 'upload_media', filename, contentType, dataBase64: Buffer.from(bytes).toString('base64') });
      for (const [name, w, h] of [['hero', 200, 150], ['support', 180, 120], ['item', 160, 160]]) {
        const r = await upload(makePng(w, h));
        if (r.ok && r.data?.asset?.id) { assets[name] = r.data.asset; created.assets.push({ id: r.data.asset.id, owner: short(LP.uid), name }); }
        s.expect(`valid_png_${name}`, r.ok && r.data?.asset?.mime === 'image/png' && r.data.asset.width === w && r.data.asset.height === h
          && /^[0-9a-f]{64}$/.test(r.data.asset.sha256 || ''), ev(r));
      }
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script></svg>');
      let r = await upload(svg, 'image/png', 'x.png');
      s.expect('svg_refused', expectRefused(r, ['unsupported_image_type'], [415]), ev(r));
      r = await upload(svg, 'image/svg+xml', 'x.svg');
      s.expect('svg_declared_refused', expectRefused(r, ['unsupported_image_type'], [415]), ev(r));
      const htmlMagic = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('<html><body><script>alert(1)</script></body></html>')]);
      r = await upload(htmlMagic);
      s.expect('html_with_png_magic_refused', expectRefused(r, ['invalid_image'], [400]), ev(r));
      r = await upload(makePng(200, 150, { extraChunks: [chunk('tEXt', Buffer.from('Comment\0<script>alert(1)</script>', 'latin1'))] }));
      s.expect('png_with_script_chunk_refused', expectRefused(r, ['invalid_image'], [400]), ev(r));
      r = await upload(Buffer.concat([makePng(200, 150), Buffer.from(`<html>${'x'.repeat(500)}</html>`)]));
      s.expect('png_with_trailing_payload_refused', expectRefused(r, ['invalid_image'], [400]), ev(r));
      r = await upload(makePng(7000, 100));
      s.expect('oversized_dimension_refused', expectRefused(r, ['image_dimensions_too_large'], [400]), ev(r));
      r = await upload(makePng(32, 32));
      s.expect('undersized_dimension_refused', expectRefused(r, ['image_too_small'], [400]), ev(r));
      const big = makePng(1200, 1200, { fill: 'noise' });
      r = await upload(big);
      s.expect('over_4mb_refused', big.length > 4 * 1024 * 1024 && expectRefused(r, ['image_too_large', 'payload_too_large'], [413]), { sourceBytes: big.length, ...ev(r) });
      r = await upload(Buffer.from('GIF89a') , 'image/gif', 'x.gif');
      s.expect('gif_refused', expectRefused(r, ['unsupported_image_type'], [415]), ev(r));
      s.nt('asset_cap_200', 'not exercised at runtime (would need 200 uploads); 409 asset_limit_reached is unit-tested in lib.test.js');
    }
  }
  const mediaRefs = () => [
    assets.hero && { assetId: assets.hero.id, caption: 'T16 QA hero', alt: 'T16 QA hero image', role: 'hero', itemKey: null, order: 0 },
    assets.support && { assetId: assets.support.id, caption: 'T16 QA support', alt: 'T16 QA support image', role: 'support', itemKey: null, order: 1 },
    assets.item && { assetId: assets.item.id, caption: 'T16 QA item', alt: 'T16 QA item image', role: 'item', itemKey: ITEM_DESC, order: 2 },
  ].filter(Boolean);

  // ================================================================ S4 quote save / ownership
  let Q1 = null; let QI = null;
  {
    const s = scenario('S4', 'save_quote / get_quote / tenant isolation');
    if (!up('LOCAL_PRO')) s.nt('create_q1', 'LOCAL_PRO sign-in failed');
    else {
      const c = await createQaQuote(LP.client, LP.uid, { market: 'LOCAL', label: 'S4 draft' });
      s.expect('create_q1', c.ok, { quoteId: c.quoteId, ...c.detail });
      if (c.ok) Q1 = c.quoteId;
    }
    if (!Q1 || mediaRefs().length !== 3) s.nt('save_visual_with_media', 'no quote or assets');
    else {
      const r = await invoke(LP.client, { action: 'save_quote', quoteId: Q1, style: 'visual', media: mediaRefs() });
      s.expect('save_visual_with_media', r.ok && r.data?.draft?.style === 'visual' && r.data.draft.media?.length === 3
        && r.data.draft.media.find((m) => m.role === 'item')?.itemKey === ITEM_KEY, ev(r));
      const g = await invoke(LP.client, { action: 'get_quote', quoteId: Q1 });
      const urls = g.data?.urls || {};
      s.expect('get_quote_returns_record', g.ok && g.data?.draft?.style === 'visual' && g.data.draft.media?.length === 3 && g.data.issued === null
        && g.data.locked === false && mediaRefs().every((m) => typeof urls[m.assetId] === 'string'), ev(g));
      // style key omitted => the stored draft style is kept (review L7)
      const keep = await invoke(LP.client, { action: 'save_quote', quoteId: Q1, media: mediaRefs() });
      s.expect('save_without_style_keeps_style', keep.ok && keep.data?.draft?.style === 'visual', ev(keep));
    }
    if (!Q1 || !up('INTL_PRO')) { s.nt('other_tenant_get_refused', 'prerequisite missing'); s.nt('other_tenant_save_refused', 'prerequisite missing'); }
    else {
      let r = await invoke(IP.client, { action: 'get_quote', quoteId: Q1 });
      s.expect('other_tenant_get_refused', expectRefused(r, ['quote_not_found'], [404]), ev(r));
      r = await invoke(IP.client, { action: 'save_quote', quoteId: Q1, style: 'classic', media: [] });
      s.expect('other_tenant_save_refused', expectRefused(r, ['quote_not_found'], [404]), ev(r));
      r = await invoke(IP.client, { action: 'media_urls', assetIds: mediaRefs().map((m) => m.assetId) });
      s.expect('other_tenant_media_urls_null', r.ok && Object.values(r.data?.urls || {}).length === 3 && Object.values(r.data.urls).every((u) => u === null), ev(r));
    }
    if (!up('INTL_PRO') || !assets.hero) s.nt('foreign_asset_on_own_quote_refused', 'prerequisite missing');
    else {
      const c = await createQaQuote(IP.client, IP.uid, { market: 'INTL', label: 'S4 intl draft' });
      if (!c.ok) s.fail('foreign_asset_on_own_quote_refused', { createIntlQuote: c.detail });
      else {
        QI = c.quoteId;
        const r = await invoke(IP.client, { action: 'save_quote', quoteId: QI, style: 'modern', media: [{ assetId: assets.hero.id, caption: '', alt: '', role: 'hero', itemKey: null, order: 0 }] });
        s.expect('foreign_asset_on_own_quote_refused', expectRefused(r, ['asset_not_owned'], [403]), { quoteId: QI, ...ev(r) });
      }
    }
  }

  // ================================================================ S5 public_get + storage isolation
  {
    const s = scenario('S5', 'public_get (anonymous) + server-only storage prefix');
    if (!Q1 || !assets.hero) s.nt('all', 'prerequisite missing');
    else {
      const r = await invoke(anon, { action: 'public_get', quoteId: Q1 });
      const media = r.data?.media || [];
      s.expect('public_get_draft_visual', r.ok && r.data?.mode === 'draft' && r.data?.style === 'visual' && r.data?.branding === null && media.length === 3, ev(r));
      // Signed URLs contain the object path (and so the asset id) by design; every OTHER field must not carry an asset id.
      const withoutUrls = JSON.stringify({ ...(r.data || {}), media: media.map(({ url: _url, ...rest }) => rest) });
      const leaked = Object.values(assets).filter((a) => withoutUrls.includes(a.id)).length;
      s.expect('no_asset_ids_in_payload', r.ok && leaked === 0 && media.every((m) => !('assetId' in m)),
        { mediaKeys: media[0] ? Object.keys(media[0]) : [], assetIdsOutsideUrlFields: leaked });
      const fetched = [];
      for (const m of media) fetched.push(m.url ? await fetchHead(m.url) : { status: null, missing: m.missing });
      s.expect('media_urls_fetchable', fetched.length === 3 && fetched.every((f) => f.status === 200 && /^image\//.test(f.contentType || '')), fetched);
      // Evidence for the deploy-md L1 assumption (signed media served with nosniff).
      s.expect('signed_media_nosniff', fetched.length > 0 && fetched.every((f) => String(f.xContentTypeOptions || '').toLowerCase() === 'nosniff'),
        fetched.map((f) => ({ status: f.status, contentType: f.contentType, xContentTypeOptions: f.xContentTypeOptions ?? null })));
      const objPath = `t16-presentation/${LP.uid}/assets/${assets.hero.id}.png`;
      const pub = await fetchHead(`${url}/storage/v1/object/public/${BUCKET}/${objPath}`);
      s.expect('anon_public_object_url_not_200', pub.status !== 200, { status: pub.status });
      const dl = await LP.client.storage.from(BUCKET).download(objPath);
      s.expect('owner_direct_download_refused', !!dl.error && !dl.data, { error: dl.error ? String(dl.error.message || dl.error.name) : null, gotData: !!dl.data });
      const sg = await LP.client.storage.from(BUCKET).createSignedUrl(objPath, 60);
      s.expect('owner_direct_sign_refused', !!sg.error && !sg.data?.signedUrl, { error: sg.error ? String(sg.error.message || sg.error.name) : null });
      const draftObj = `t16-presentation/${LP.uid}/quotes/${Q1}/draft.json`;
      const dd = await LP.client.storage.from(BUCKET).download(draftObj);
      s.expect('owner_direct_draft_json_refused', !!dd.error && !dd.data, { error: dd.error ? String(dd.error.message || dd.error.name) : null });
      const probePath = `t16-presentation/${LP.uid}/client-write-probe-${Date.now()}.txt`;
      const w = await LP.client.storage.from(BUCKET).upload(probePath, Buffer.from('t16 qa probe'), { contentType: 'text/plain', upsert: false });
      if (!w.error) created.storageProbes.push(probePath);
      s.expect('owner_direct_write_refused', !!w.error, { error: w.error ? String(w.error.message || w.error.name) : null, probePathIfWritten: w.error ? null : probePath });
      const anonGet = await invoke(anon, { action: 'public_get', quoteId: newUuid() });
      s.expect('public_get_unknown_quote_404', expectRefused(anonGet, ['quote_not_found'], [404]), ev(anonGet));
    }
  }

  // ================================================================ S6 issue + downgrade
  {
    const s = scenario('S6', 'issue / idempotency / frozen / downgrade');
    let Q2 = null;
    if (!Q1) s.nt('issue_q1', 'prerequisite missing');
    else {
      // Q2 is saved with style visual BEFORE the downgrade.
      const c2 = await createQaQuote(LP.client, LP.uid, { market: 'LOCAL', label: 'S6 downgrade draft' });
      if (c2.ok) {
        const r2 = await invoke(LP.client, { action: 'save_quote', quoteId: c2.quoteId, style: 'visual', media: mediaRefs().slice(0, 1) });
        s.expect('q2_saved_visual_before_downgrade', r2.ok, ev(r2));
        if (r2.ok) Q2 = c2.quoteId;
      } else s.fail('q2_saved_visual_before_downgrade', c2.detail);

      let r = await invoke(LP.client, { action: 'issue', quoteId: Q1 });
      s.expect('issue_q1', r.ok && r.data?.alreadyIssued === false && r.data?.issued?.style === 'visual' && r.data.issued.styleVersion === 1
        && r.data.issued.branding && typeof r.data.issued.branding === 'object' && 'business_name' in r.data.issued.branding
        && r.data.issued.media?.length === 3, ev(r));
      r = await invoke(LP.client, { action: 'issue', quoteId: Q1 });
      s.expect('issue_q1_again_idempotent', r.ok && r.data?.alreadyIssued === true && r.data?.issued?.style === 'visual', ev(r));
      r = await invoke(LP.client, { action: 'save_quote', quoteId: Q1, style: 'classic', media: [] });
      s.expect('save_after_issue_refused', expectRefused(r, ['quote_issued'], [409]), ev(r));
    }
    if (!ADMIN.client || !up('LOCAL_PRO')) s.nt('downgrade', 'admin or LOCAL_PRO sign-in failed');
    else {
      let r = await invoke(ADMIN.client, { action: 'qa_set_capability', userId: LP.uid, tier: 'classic' });
      s.expect('downgrade_local_pro_to_classic', r.ok && r.data?.tier === 'classic', ev(r));
      if (Q1) {
        r = await invoke(anon, { action: 'public_get', quoteId: Q1 });
        s.expect('issued_survives_downgrade', r.ok && r.data?.mode === 'issued' && r.data?.style === 'visual' && (r.data?.media || []).length === 3, ev(r));
      } else s.nt('issued_survives_downgrade', 'no Q1');
      if (Q2) {
        r = await invoke(LP.client, { action: 'save_quote', quoteId: Q2, style: 'visual', media: mediaRefs().slice(0, 1) });
        s.expect('unchanged_premium_style_preserved', r.ok && r.data?.draft?.style === 'visual', ev(r));
        r = await invoke(LP.client, { action: 'save_quote', quoteId: Q2, style: 'modern', media: mediaRefs().slice(0, 1) });
        s.expect('changed_premium_style_refused', expectRefused(r, ['style_not_entitled'], [403]), ev(r));
        r = await invoke(LP.client, { action: 'issue', quoteId: Q2 });
        s.expect('issue_unentitled_refused', expectRefused(r, ['style_not_entitled'], [409]) , ev(r));
        r = await invoke(anon, { action: 'public_get', quoteId: Q2 });
        s.expect('public_draft_resolves_entitled_classic', r.ok && r.data?.mode === 'draft' && r.data?.style === 'classic' && (r.data?.media || []).length === 0, ev(r));
      } else ['unchanged_premium_style_preserved', 'changed_premium_style_refused', 'issue_unentitled_refused', 'public_draft_resolves_entitled_classic'].forEach((n) => s.nt(n, 'no Q2'));
      r = await invoke(ADMIN.client, { action: 'qa_set_capability', userId: LP.uid, tier: 'visual' });
      s.expect('restore_local_pro_visual', r.ok && r.data?.tier === 'visual', ev(r));
      const c = await invoke(LP.client, { action: 'context' });
      s.expect('context_after_restore', c.ok && c.data?.tier === 'visual', ev(c));
    }
  }

  // ================================================================ S7 catalog link / unlink
  {
    const s = scenario('S7', 'catalog_link / unlink never deletes the asset');
    if (!up('LOCAL_PRO') || !assets.item) s.nt('all', 'prerequisite missing');
    else {
      let serviceId = null;
      const { data: rows, error: selErr } = await LP.client.from('services').select('id, name').eq('user_id', LP.uid).like('name', 'T16 QA%').limit(1);
      if (!selErr && rows?.[0]?.id != null) serviceId = rows[0].id;
      else {
        const { error: insErr } = await LP.client.from('services').insert([{ name: 'T16 QA service', price: 100, user_id: LP.uid }]);
        if (!insErr) {
          const { data: again } = await LP.client.from('services').select('id').eq('user_id', LP.uid).eq('name', 'T16 QA service').limit(1);
          serviceId = again?.[0]?.id ?? null;
          if (serviceId != null) created.services.push(serviceId);
        }
        if (serviceId == null) s.fail('service_available', { selectError: selErr?.message || null, insertError: insErr?.message || null });
      }
      if (serviceId != null) {
        s.pass('service_available', { serviceId });
        let r = await invoke(LP.client, { action: 'catalog_link', serviceId: String(serviceId), assetId: assets.item.id, caption: 'T16 QA catalog' });
        s.expect('link', r.ok && r.data?.catalog?.links?.[String(serviceId)]?.assetId === assets.item.id, ev(r));
        r = await invoke(LP.client, { action: 'context' });
        s.expect('context_shows_link', r.ok && r.data?.catalog?.links?.[String(serviceId)]?.assetId === assets.item.id, ev(r));
        r = await invoke(LP.client, { action: 'catalog_link', serviceId: String(serviceId), assetId: null, caption: '' });
        s.expect('unlink', r.ok && !r.data?.catalog?.links?.[String(serviceId)], ev(r));
        if (Q1) {
          const p = await invoke(anon, { action: 'public_get', quoteId: Q1 });
          const itemMedia = (p.data?.media || []).find((m) => m.role === 'item');
          const f = itemMedia?.url ? await fetchHead(itemMedia.url) : { status: null };
          s.expect('asset_still_served_after_unlink', p.ok && itemMedia && itemMedia.missing === false && f.status === 200, { public: ev(p), fetch: f });
        } else s.nt('asset_still_served_after_unlink', 'no Q1');
        const fr = await invoke(LP.client, { action: 'catalog_link', serviceId: String(serviceId), assetId: newUuid(), caption: '' });
        s.expect('link_unknown_asset_refused', expectRefused(fr, ['asset_not_owned'], [403]), ev(fr));
      }
    }
  }

  // ================================================================ S8 locked quote lazy freeze
  {
    const s = scenario('S8', 'locked quote: lazy freeze on public_get, save refused');
    if (!up('LOCAL_PRO') || !assets.hero) s.nt('all', 'prerequisite missing');
    else {
      const c = await createQaQuote(LP.client, LP.uid, { market: 'LOCAL', label: 'S8 lock' });
      if (!c.ok) s.fail('create_q3', c.detail);
      else {
        const Q3 = c.quoteId;
        let r = await invoke(LP.client, { action: 'save_quote', quoteId: Q3, style: 'modern', media: mediaRefs().slice(0, 2) });
        s.expect('q3_saved_modern', r.ok && r.data?.draft?.style === 'modern', ev(r));
        // Owner's normal update path (RLS). 'approved' locks; if the schema refuses an owner-set 'approved', fall back to 'sent'
        // (non-draft => lazy freeze still applies, and the save is then refused as issued instead of locked).
        let lockedAs = 'approved';
        let { error: upErr } = await LP.client.from('quotes').update({ status: 'approved' }).eq('id', Q3);
        if (upErr) {
          s.nt('owner_status_approved', { error: upErr.message, code: upErr.code });
          lockedAs = 'sent';
          ({ error: upErr } = await LP.client.from('quotes').update({ status: 'sent' }).eq('id', Q3));
        } else s.pass('owner_status_approved', { quoteId: Q3 });
        const qrow = created.quotes.find((q) => q.id === Q3); if (qrow) qrow.status = upErr ? 'draft (update failed)' : lockedAs;
        if (upErr) s.fail('status_update', { error: upErr.message, code: upErr.code });
        else {
          r = await invoke(anon, { action: 'public_get', quoteId: Q3 });
          s.expect('public_get_lazy_freeze', r.ok && r.data?.mode === 'issued' && r.data?.style === 'modern' && r.data?.branding && (r.data?.media || []).length === 2, { lockedAs, ...ev(r) });
          const g = await invoke(LP.client, { action: 'get_quote', quoteId: Q3 });
          s.expect('snapshot_persisted', g.ok && g.data?.issued?.style === 'modern' && g.data?.locked === (lockedAs === 'approved'), ev(g));
          r = await invoke(LP.client, { action: 'save_quote', quoteId: Q3, style: 'classic', media: [] });
          s.expect('save_locked_refused', expectRefused(r, lockedAs === 'approved' ? ['quote_locked'] : ['quote_issued'], [409]), { lockedAs, ...ev(r) });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------- write result
  const totals = { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
  const failures = [];
  for (const sc of scenarios) for (const [n, c] of Object.entries(sc.checks)) { totals[c.status] += 1; if (c.status === FAIL) failures.push(`${sc.id}.${n}`); }
  const result = {
    schema: 'tekango-t16-presentation-runtime/1',
    project: { ref: TEST_REF, env: 'TEST' },
    function: FN,
    startedAt,
    finishedAt: new Date().toISOString(),
    personas: Object.fromEntries([...Object.entries(P), ['SUPER_ADMIN', ADMIN]].map(([n, p]) => [n, { signedIn: !!p.uid, uid: p.uid ? short(p.uid) : null, authErrorCode: p.errorCode ?? null }])),
    created: { ...created, intlQuote: QI },
    leftInPlace: [
      'QA tier fixtures: LOCAL_PRO visual, INTL_PRO visual, INTL_GBP modern, INTL_EUR classic (S6 downgrade of LOCAL_PRO restored to visual)',
      'INTL_GBP business default style = modern',
      'one LOCAL_PRO T16 QA quote locked by the owner status update (see created.quotes[].status) with a frozen issued.json; one issued S6 quote',
    ],
    totals,
    failures,
    scenarios,
  };
  const file = path.join(outDir, 'presentation-runtime.json');
  fs.writeFileSync(file, redact(JSON.stringify(result, null, 2)) + '\n');
  say(`totals PASS ${totals.PASS} | FAIL ${totals.FAIL} | NOT TESTED ${totals['NOT TESTED']} -> ${file}`);
  return totals.FAIL ? 1 : 0;
}

export { makePng, chunk, redact, scrub };
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then((code) => process.exit(code), (e) => { say(`ERROR: ${e?.message || e}`); process.exit(2); });
}
