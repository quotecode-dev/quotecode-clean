// Task 16 - shared helpers for the fidelity / dark-scope QA (QA tooling only; never imported by the app).
//   - colour parsing that understands rgb()/rgba()/color(srgb ...)/gradients, relative luminance (WCAG 2.x)
//   - the mocked synthetic account session (same data as layout-regression-gate.mjs; no persona, no backend contact)
//   - synthetic public-quote DTOs from the tree's own sample builder (Vite SSR, no port opened)
//   - run identity (command, cwd, Node/npm, git identity of the tree under test, time)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../lib.mjs';

export const SUPA = 'http://127.0.0.1:54399';
export const FIDELITY_DIR = path.dirname(fileURLToPath(import.meta.url)); // local fix 5: Windows-safe (URL.pathname gave C:\C:\...)
export const VIEWPORTS = [[1440, 900], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [390, 844], [320, 640]];
export const REPO_REF_DIR = path.join(REPO_ROOT, 'docs', 'task16-quote-experience-v2', 'cloud-handoff', 'reference', 'revision-r2-refined');

export function readPolicy(name) {
  return JSON.parse(fs.readFileSync(path.join(FIDELITY_DIR, name), 'utf8'));
}

// Only loopback / private hosts; never the protected TEST port 5186 from the cloud tooling.
export function assertLocalUrl(raw, { allow5186 = false } = {}) {
  const u = new URL(String(raw));
  if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) throw new Error(`refusing non-loopback URL ${u.origin}`);
  if (!allow5186 && u.port === '5186') throw new Error('refusing port 5186 (protected TEST port)');
  return u.origin;
}

export function launchOptions() {
  return process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
}

// ---------------------------------------------------------------------------------------------------------------
// Synthetic account (one per market) + Supabase route mock. Mirrors layout-regression-gate.mjs (same ids / data).
// ---------------------------------------------------------------------------------------------------------------
export function syntheticAccount(market) {
  const now = Date.now();
  const local = market === 'Local';
  const uid = local ? '00000000-0000-4000-8000-00000000a001' : '00000000-0000-4000-8000-00000000b001';
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: local ? 'gate-local@example.test' : 'gate-intl@example.test', app_metadata: { provider: 'email' }, user_metadata: { country: market } };
  const settings = { id: 9001, user_id: uid, business_name: local ? 'סטודיו בדיקה' : 'Audit Studio', plan: 'pro', role: 'user', country: market, currency: local ? 'ILS' : 'USD', trial_ends_at: null };
  const names = local ? ['אלומיניום הצפון בע"מ', 'משפחת כהן', 'נגרות השרון', 'דירת גן רעננה'] : ['Northwind Builders LLC', 'Harbor Kitchens', 'Maple & Co', 'Riverside Lofts'];
  const quotes = Array.from({ length: 16 }, (_, i) => ({ id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`, user_id: uid, quote_number: 1040 + i, client_id: `c${i % 4}`, clients: { id: `c${i % 4}`, company_name: names[i % 4], contact_name: names[i % 4] }, status: ['draft', 'sent', 'approved', 'sent'][i % 4], created_at: new Date(now - i * 2 * 86400000).toISOString(), valid_until: new Date(now + (20 - i) * 86400000).toISOString().slice(0, 10), subtotal: 1000 + i * 731.5, discount: 0, tax_rate: local ? 18 : 0, total: (1000 + i * 731.5) * (local ? 1.18 : 1), currency: local ? 'ILS' : 'USD', client_type: 'business', quote_items: [], quote_sections: [] }));
  return { user, settings, quotes, session: { access_token: 't', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(now / 1000) + 86400, refresh_token: 'r', user } };
}

// A browser context signed in as the synthetic account; every Supabase call is answered locally.
export async function mockedAppContext(browser, { market, width, height }) {
  const lang = market === 'Local' ? 'he' : 'en';
  const acc = syntheticAccount(market);
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: true });
  await ctx.route(`${SUPA}/**`, (route) => {
    const u = new URL(route.request().url());
    const single = (route.request().headers().accept || '').includes('vnd.pgrst.object');
    let body = {};
    if (u.pathname.startsWith('/auth/v1/user')) body = acc.user;
    else if (u.pathname.startsWith('/rest/v1/business_settings')) body = single ? acc.settings : [acc.settings];
    else if (u.pathname.startsWith('/rest/v1/quotes')) body = single ? acc.quotes[0] : acc.quotes;
    else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null;
    else if (u.pathname.startsWith('/rest/v1/')) body = single ? null : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.addInitScript(([s, l]) => { try { localStorage.setItem('sb-127-auth-token', s); localStorage.setItem('proflow_lang', l); } catch { /* storage unavailable */ } }, [JSON.stringify(acc.session), lang]);
  return { ctx, lang, acc };
}

// Public quote route (/quote/:id) with get-public-quote / quote-presentation answered by a synthetic DTO.
export async function mockedPublicContext(browser, { width, height, dto, presentation }) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route(`${SUPA}/**`, (route) => {
    const u = new URL(route.request().url());
    let body = {};
    if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto;
    else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = presentation || {};
    else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return ctx;
}

// Synthetic DTOs from <srcRoot>/src/quoteDocument/sampleQuotes.js (Vite SSR in middleware mode: no port, no network).
export async function loadSampleDtos(srcRoot, combos) {
  const viteEntry = path.join(REPO_ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js');
  const { createServer } = await import(pathToFileURL(viteEntry).href);
  const server = await createServer({ root: srcRoot, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const m = await server.ssrLoadModule('/src/quoteDocument/sampleQuotes.js');
    const out = {};
    for (const c of combos) {
      const s = m.buildSampleQuote(c);
      out[`${c.locale}/${c.style}`] = JSON.parse(JSON.stringify({ quoteData: s.quoteData, presentation: s.presentation }));
    }
    return out;
  } finally {
    await server.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Run identity
// ---------------------------------------------------------------------------------------------------------------
const sh = (cmd, args, cwd) => { try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
export function runIdentity(treeDir) {
  return {
    command: process.argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' '),
    cwd: process.cwd(),
    node: process.version,
    npm: sh('npm', ['-v'], process.cwd()),
    chromium: process.env.PW_CHROMIUM || 'playwright default',
    startedAt: new Date().toISOString(),
    tree: treeDir ? {
      dir: path.resolve(treeDir),
      head: sh('git', ['rev-parse', 'HEAD'], treeDir),
      dirtyPaths: (sh('git', ['status', '--porcelain', '--', 'src', 'index.html', 'public', 'vite.config.js', 'package.json'], treeDir) || '').split('\n').filter(Boolean).length,
    } : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// In-page helpers: serialised into page.evaluate as source text (no closures over Node values).
// ---------------------------------------------------------------------------------------------------------------
export const IN_PAGE_COLOR_LIB = String.raw`
  const __parseColor = (s) => {
    s = String(s || '').trim();
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = s.match(/^color\(srgb\s+([^)]+)\)$/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(parseFloat); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    return null;
  };
  const __gradientColors = (s) => [...String(s).matchAll(/rgba?\([^)]+\)|color\(srgb[^)]+\)/g)].map((m) => __parseColor(m[0])).filter((c) => c && c.a > 0.5);
  const __relLum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  // effective background: own colour if opaque enough, else the first gradient stop, else walk up the ancestors
  const __effBg = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const c = __parseColor(cs.backgroundColor);
      if (c && c.a > 0.5) return { color: c, from: e === el ? 'self' : (e.tagName + '.' + String(e.className).split(' ')[0]).slice(0, 50), css: cs.backgroundColor };
      const g = __gradientColors(cs.backgroundImage);
      if (g.length) return { color: g[0], from: e === el ? 'self(gradient)' : (e.tagName + '.' + String(e.className).split(' ')[0] + '(gradient)').slice(0, 50), css: cs.backgroundImage.slice(0, 80) };
    }
    return { color: { r: 255, g: 255, b: 255, a: 1 }, from: 'canvas-default', css: 'none' };
  };
  const __vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05; };
`;

// ---------------------------------------------------------------------------------------------------------------
// Dark POCKETS (cloud-fix4b, A17 F4): connected SOLID dark areas of a screenshot, found by a morphological opening.
//   1. dark pixel  = sRGB luma < darkLuma (the same pixel test as pixelStats / the policy classification);
//   2. dark block  = a g x g block (g = 4px) with >= 75% dark pixels; a block whose centre lies in an excluded rect
//                    (approved dark region, embedded media, UA scrollbar gutter) is never dark;
//   3. solid anchor = a block whose k x k window (k = ceil(S / g)) is entirely dark blocks (erosion by an S x S square);
//   4. pocket      = a 4-connected component of solid anchors; its area is the union of its windows (opening).
// Text strokes, rules, borders and thin icons cannot hold an S x S solid square when S exceeds the thickest stroke on
// the surface (see darkscope.mjs pocketWindow), so the opening keeps SURFACES and drops text. Pure function on a
// Uint8 dark-block grid (unit-tested); the browser part only builds the grid.
export function solidDarkComponents(dark, bw, bh, k, { withBlocks = false } = {}) {
  const I = new Int32Array((bw + 1) * (bh + 1));
  for (let y = 0; y < bh; y += 1) {
    let row = 0;
    for (let x = 0; x < bw; x += 1) { row += dark[y * bw + x]; I[(y + 1) * (bw + 1) + x + 1] = I[y * (bw + 1) + x + 1] + row; }
  }
  const aw = bw - k + 1; const ah = bh - k + 1;
  if (aw <= 0 || ah <= 0) return [];
  const anchor = new Uint8Array(aw * ah);
  for (let y = 0; y < ah; y += 1) for (let x = 0; x < aw; x += 1) {
    const s = I[(y + k) * (bw + 1) + x + k] - I[y * (bw + 1) + x + k] - I[(y + k) * (bw + 1) + x] + I[y * (bw + 1) + x];
    if (s === k * k) anchor[y * aw + x] = 1;
  }
  const label = new Int32Array(aw * ah);
  const cover = new Int32Array(bw * bh);
  const comps = [];
  const stack = [];
  for (let start = 0; start < aw * ah; start += 1) {
    if (!anchor[start] || label[start]) continue;
    const id = comps.length + 1;
    const c = { id, anchors: 0, blocks: 0, x0: Infinity, y0: Infinity, x1: -1, y1: -1, seed: [start % aw, Math.floor(start / aw)] };
    label[start] = id; stack.push(start);
    while (stack.length) {
      const p = stack.pop(); const ax = p % aw; const ay = (p - ax) / aw;
      c.anchors += 1;
      c.x0 = Math.min(c.x0, ax); c.y0 = Math.min(c.y0, ay); c.x1 = Math.max(c.x1, ax + k); c.y1 = Math.max(c.y1, ay + k);
      for (let yy = ay; yy < ay + k; yy += 1) for (let xx = ax; xx < ax + k; xx += 1) { const q = yy * bw + xx; if (!cover[q]) { cover[q] = id; c.blocks += 1; } }
      const nb = [[ax - 1, ay], [ax + 1, ay], [ax, ay - 1], [ax, ay + 1]];
      for (const [nx, ny] of nb) { if (nx < 0 || ny < 0 || nx >= aw || ny >= ah) continue; const q = ny * aw + nx; if (anchor[q] && !label[q]) { label[q] = id; stack.push(q); } }
    }
    comps.push(c);
  }
  // cloud-fix4b K3: the covered blocks of every component (block indices), for per-block attribution
  if (withBlocks) {
    for (const c of comps) c.cells = [];
    for (let q = 0; q < cover.length; q += 1) if (cover[q]) comps[cover[q] - 1].cells.push(q);
  }
  return comps;
}

// Screenshot -> dark-block grid (in a scratch page) -> solidDarkComponents. Returns pockets in screenshot pixels.
//   excludes: [{x,y,w,h}] screenshot-pixel rects that can never be part of a pocket.
export async function darkPockets(browser, pngBuf, { darkLuma = 0.35, S = 16, g = 4, excludes = [], withCells = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  let grid;
  try {
    await page.setContent(`<img id="i" src="data:image/png;base64,${pngBuf.toString('base64')}">`);
    await page.waitForFunction(() => document.getElementById('i').complete);
    grid = await page.evaluate(({ darkLuma, g, excludes }) => {
      const img = document.getElementById('i');
      const W = img.naturalWidth; const H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const bw = Math.floor(W / g); const bh = Math.floor(H / g);
      const dark = new Array(bw * bh).fill(0);
      const CH = 1024; // read in horizontal strips (bounded memory on 16000px pages)
      for (let y0 = 0; y0 < bh * g; y0 += CH) {
        const h = Math.min(CH, bh * g - y0);
        const d = x.getImageData(0, y0, bw * g, h).data;
        for (let by = y0 / g; by < (y0 + h) / g; by += 1) {
          for (let bx = 0; bx < bw; bx += 1) {
            const cx = bx * g + g / 2; const cy = by * g + g / 2;
            if (excludes.some((e) => cx >= e.x && cx < e.x + e.w && cy >= e.y && cy < e.y + e.h)) continue;
            let n = 0;
            for (let yy = 0; yy < g; yy += 1) for (let xx = 0; xx < g; xx += 1) {
              const i = (((by * g + yy) - y0) * bw * g + bx * g + xx) * 4;
              if ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255 < darkLuma) n += 1;
            }
            if (n >= 0.75 * g * g) dark[by * bw + bx] = 1;
          }
        }
      }
      return { W, H, bw, bh, dark };
    }, { darkLuma, g, excludes });
  } finally {
    await page.close();
  }
  const k = Math.max(1, Math.ceil(S / g));
  const comps = solidDarkComponents(Uint8Array.from(grid.dark), grid.bw, grid.bh, k, { withBlocks: withCells });
  return {
    W: grid.W, H: grid.H, g, k, S: k * g,
    pockets: comps.map((c) => ({
      x: c.x0 * g, y: c.y0 * g, w: (c.x1 - c.x0) * g, h: (c.y1 - c.y0) * g, area: c.blocks * g * g,
      seed: { x: c.seed[0] * g + (k * g) / 2, y: c.seed[1] * g + (k * g) / 2 },
      ...(withCells ? { cells: c.cells.map((q) => ({ x: (q % grid.bw) * g, y: Math.floor(q / grid.bw) * g })) } : {}),
    })).sort((a, b) => b.area - a.area),
  };
}

// Pixel statistics for many rects of one screenshot, in a scratch page (data URL keeps the canvas untainted).
// rects: [{ id, x, y, w, h, exclude: [{x,y,w,h}] }] in screenshot pixel coordinates.
export async function pixelStats(browser, pngBuf, rects, { darkLuma = 0.35 } = {}) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    await page.setContent(`<img id="i" src="data:image/png;base64,${pngBuf.toString('base64')}">`);
    await page.waitForFunction(() => document.getElementById('i').complete);
    return await page.evaluate(({ rects, darkLuma }) => {
      const img = document.getElementById('i');
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const out = {};
      for (const r of rects) {
        const x0 = Math.max(0, Math.floor(r.x)); const y0 = Math.max(0, Math.floor(r.y));
        const x1 = Math.min(c.width, Math.ceil(r.x + r.w)); const y1 = Math.min(c.height, Math.ceil(r.y + r.h));
        if (x1 - x0 < 2 || y1 - y0 < 2) { out[r.id] = { n: 0, note: 'rect outside the screenshot' }; continue; }
        const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const W = x1 - x0;
        const step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 60000)));
        let n = 0; let sum = 0; let dark = 0; let excluded = 0;
        for (let yy = 0; yy < y1 - y0; yy += step) {
          for (let xx = 0; xx < W; xx += step) {
            const px = x0 + xx; const py = y0 + yy;
            if (r.exclude && r.exclude.some((e) => px >= e.x && px < e.x + e.w && py >= e.y && py < e.y + e.h)) { excluded += 1; continue; }
            const i = (yy * W + xx) * 4;
            const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            n += 1; sum += L; if (L < darkLuma) dark += 1;
          }
        }
        out[r.id] = n ? { n, meanLuma: +(sum / n).toFixed(3), darkFrac: +(dark / n).toFixed(3), excludedFrac: +(excluded / (n + excluded)).toFixed(3) } : { n: 0, excludedFrac: 1, note: 'fully excluded' };
      }
      return out;
    }, { rects, darkLuma });
  } finally {
    await page.close();
  }
}
