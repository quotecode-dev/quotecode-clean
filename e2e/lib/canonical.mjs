// Shared harness for the CANONICAL 5186 acceptance gates (Codex root-cause review 2026-09-22).
// Every gate binds its evidence to what was SERVED and what the browser tab actually LOADED:
//   served  = /version.json (source identity) + every file of the candidate's local dist fetched over HTTP and byte-compared
//   loaded  = window.__TEKANGO_BUILD__ (baked into the bundle the tab executed) + the /assets/* files the tab really loaded
//   font    = document.fonts.ready + the product font (Rubik) actually loaded - never a fallback font
// Expected identity comes from the environment (set by the tooling orchestrator):
//   IRON_CANDIDATE_SHA, IRON_CANDIDATE_DIGEST, IRON_DIST_DIR, IRON_CANONICAL_URL (default http://192.168.1.189:5186)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const require_ = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
export const { chromium } = require_('playwright');
export const personas = await import(pathToFileURL(path.join(here, '..', 'testPersonas.js')).href);
export const CANONICAL_URL = (process.env.IRON_CANONICAL_URL || 'http://192.168.1.189:5186').replace(/\/$/, '');
export const EXPECTED = { sha: process.env.IRON_CANDIDATE_SHA || null, digest: process.env.IRON_CANDIDATE_DIGEST || null, distDir: process.env.IRON_DIST_DIR || null };
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const PRODUCT_FONT = 'Rubik';

export function baseFromArgs() {
  const base = (process.argv[2] || CANONICAL_URL).replace(/\/$/, '');
  return base;
}

export async function login(page, persona, lang, base) {
  await page.goto(`${base}/dashboard?lang=${lang}`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 60000 });
  await email.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ state: 'visible', timeout: 60000 });
}

// ---------------------------------------------------------------------------------------------------------------- served
const walk = (dir, root = dir) => fs.readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return fs.statSync(p).isDirectory() ? walk(p, root) : [path.relative(root, p).replace(/\\/g, '/')]; });
export function localDistFingerprint(distDir) {
  const files = walk(distDir).sort();
  const entries = files.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(distDir, f))) }));
  return { files: entries.length, fingerprint: sha256(entries.map((e) => `${e.path}\0${e.sha256}\n`).join('')), entries };
}
export async function servedIdentity(base) {
  const vr = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' });
  const version = vr.ok ? await vr.json() : null;
  const u = new URL(base);
  const out = { base, port: u.port, host: u.hostname, capturedAt: new Date().toISOString(), version, servedFingerprint: null, servedFiles: 0, servedMismatches: [] };
  if (EXPECTED.distDir && fs.existsSync(EXPECTED.distDir)) {
    const local = localDistFingerprint(EXPECTED.distDir);
    const served = [];
    for (const e of local.entries) {
      const r = await fetch(`${base}/${e.path}`, { cache: 'no-store' });
      const h = r.ok ? sha256(Buffer.from(await r.arrayBuffer())) : `HTTP ${r.status}`;
      served.push({ path: e.path, sha256: h });
      if (h !== e.sha256) out.servedMismatches.push(e.path);
    }
    out.servedFiles = served.length;
    out.servedFingerprint = sha256(served.map((e) => `${e.path}\0${e.sha256}\n`).join(''));
    out.localDistFingerprint = local.fingerprint;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- loaded
export async function loadedIdentity(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((fontName) => {
    const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, '').startsWith(fontName));
    const assets = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.startsWith(location.origin) && /\/assets\//.test(n)).map((n) => new URL(n).pathname.replace(/^\//, ''));
    return {
      href: location.href,
      build: window.__TEKANGO_BUILD__ ? { ...window.__TEKANGO_BUILD__ } : null,
      loadedAssets: [...new Set(assets)].sort(),
      font: {
        ready: document.fonts.status === 'loaded',
        productFontLoaded: faces.some((f) => f.status === 'loaded'),
        loadedFaces: faces.filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`).slice(0, 12),
        erroredFaces: faces.filter((f) => f.status === 'error').length,
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
      },
      at: new Date().toISOString(),
    };
  }, PRODUCT_FONT);
}

// Fail-closed identity verdict for one snapshot (served + optional loaded).
export function identityProblems({ served, loaded }, expected = EXPECTED) {
  const p = [];
  const v = served?.version;
  if (!v) p.push('version.json unreachable');
  if (served && served.port !== '5186') p.push(`port ${served.port} is not the canonical 5186`);
  if (served && served.host !== '192.168.1.189') p.push(`host ${served.host} is not the canonical 192.168.1.189`);
  if (v) {
    if (expected.sha && v.buildSha !== expected.sha) p.push(`served buildSha ${String(v.buildSha).slice(0, 12)} != candidate ${expected.sha.slice(0, 12)}`);
    if (expected.digest && v.buildInputDigest !== expected.digest) p.push('served build-input digest != candidate digest');
    if (v.dirty !== false) p.push('served build was produced from a dirty tree');
    if (v.mode !== 'localtest') p.push(`mode ${v.mode} is not localtest (TEST)`);
    if (v.servesWorkingTree !== false) p.push('5186 serves a mutable working tree (dev server) - not a frozen build');
  }
  if (!expected.distDir) p.push('no candidate dist to compare served bytes with');
  if (served && served.servedMismatches?.length) p.push(`${served.servedMismatches.length} served file(s) differ from the candidate build (${served.servedMismatches.slice(0, 3).join(', ')})`);
  if (loaded) {
    if (!loaded.build) p.push('loaded tab exposes no build identity (window.__TEKANGO_BUILD__)');
    else {
      if (expected.sha && loaded.build.buildSha !== expected.sha) p.push(`loaded tab runs ${String(loaded.build.buildSha).slice(0, 12)} (stale/old tab)`);
      if (expected.digest && loaded.build.buildInputDigest !== expected.digest) p.push('loaded tab build-input digest != candidate digest (stale/old tab)');
    }
    if (expected.distDir) {
      const known = new Set(localDistFingerprint(expected.distDir).entries.map((e) => e.path));
      const foreign = loaded.loadedAssets.filter((a) => !known.has(a));
      if (foreign.length) p.push(`loaded tab executed ${foreign.length} asset(s) not in the candidate build (${foreign.slice(0, 2).join(', ')})`);
      if (loaded.loadedAssets.length === 0) p.push('loaded tab reports no candidate assets');
    }
    if (!loaded.font.ready) p.push('document.fonts not ready');
    if (!loaded.font.productFontLoaded) p.push(`product font ${PRODUCT_FONT} not loaded`);
    if (loaded.font.erroredFaces) p.push(`${loaded.font.erroredFaces} product font face(s) errored`);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------- evidence
export function evidenceDir(name) {
  const dir = process.env.IRON_EVIDENCE_DIR ? path.join(process.env.IRON_EVIDENCE_DIR, name) : path.join(here, '..', '..', 'release-evidence', 'canonical', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
export async function shot(page, dir, file, opts = {}) {
  const p = path.join(dir, file);
  // IRON-DATA-001: evidence images never show an e-mail address (synthetic persona addresses included) - masked, deterministic.
  await page.evaluate(() => {
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    for (const el of document.querySelectorAll('input, textarea')) if (re.test(el.value || '')) el.setAttribute('data-mask-pii', '1');
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) if (re.test(n.textContent || '') && n.parentElement) n.parentElement.setAttribute('data-mask-pii', '1');
  }).catch(() => {});
  const buf = await page.screenshot({ path: p, mask: [page.locator('[data-mask-pii]')], ...opts });
  return { file, sha256: sha256(buf), bytes: buf.length };
}
export function writeEvidence(dir, name, obj) {
  const p = path.join(dir, name);
  // IRON-DATA-001: evidence JSON never carries an e-mail address (replaced by a short sha256 tag)
  const text = `${JSON.stringify(obj, null, 2)}\n`.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => `[email:${sha256(m.toLowerCase()).slice(0, 12)}]`);
  fs.writeFileSync(p, text);
  return { file: name, sha256: sha256(Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8')) };
}

// Opens a context for a canonical cell and records the loaded-tab identity right after authentication.
export async function openAuthed(browser, { persona, lang, base, viewport, mobile, locale, timezoneId }) {
  const ctx = await browser.newContext({ viewport, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 2 : 1, ...(locale ? { locale } : {}), ...(timezoneId ? { timezoneId } : {}) });
  const page = await ctx.newPage();
  try { await login(page, persona, lang, base); } catch { await page.waitForTimeout(1500); await login(page, persona, lang, base); }
  const loaded = await loadedIdentity(page);
  return { ctx, page, loaded };
}

export function rectOf(r) { return r ? { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), r: +(r.x + r.width).toFixed(2), b: +(r.y + r.height).toFixed(2) } : null; }

// EUR/GBP synthetic personas (OD-8): read from the same gitignored env file, and admitted ONLY if the allowlist (IRON-DATA-001) holds them.
export function extraPersona(prefix) {
  const text = fs.readFileSync(path.join(here, '..', '..', '.env.localtest.local'), 'utf8');
  const get = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  const p = { email: get(`${prefix}_EMAIL`), password: get(`${prefix}_PASSWORD`) };
  const list = JSON.parse(fs.readFileSync(process.env.IRON_SYNTHETIC_ALLOWLIST, 'utf8'));
  const h = sha256(String(p.email || '').trim().toLowerCase());
  if (!p.email || !p.password || !(list.testPersonas || []).some((x) => x.emailSha256 === h)) throw new Error(`IRON-DATA-001: ${prefix} is not an allowlisted synthetic persona - refusing`);
  return p;
}
