// Task 16 - DESIGN FIDELITY comparison: approved refined reference vs candidate, at matched viewports.
//
// Reference (authority): evidence/task-16-quote-experience-v2/revision-r2-refined/ (landing-he.html, landing-en.html,
// index.html?view=plans, R2.quote() documents rendered with the reference styles.css).
// Candidate: BASE_URL (default http://localhost:5186) - /he, /en, /<locale>/sample-quote?style=..., and (with persona
// login, --surfaces app) the dashboard management view and the new-quote creator.
//
// For every cell: reference and candidate screenshots, a labeled side-by-side composite (reference LEFT, candidate
// RIGHT) and targeted fidelity assertions. Assertion kinds:
//   calibrated  - the same detector must PASS on the reference; if it does not, the cell is NOT TESTED (detector gap),
//   comparison  - candidate measured against values extracted from the reference (nav order),
//   policy      - Owner clarification / readability rule that supersedes the reference (metadata centering, no rule
//                 above metadata, title not centered, text >= 12px); evaluated on the candidate, reference shown.
//
//   region      - (2026-10-05 cloud fix3; cloud-fix4b: + the '<surface>.dark-pockets' row, and the landing cell is an Owner
//                 POLICY judged on the candidate - no longer NOT TESTED because the reference is dark) light/dark decided
//                 PER REGION by fidelity/darkscope.mjs with the provenance-
//                 bearing allowlist fidelity/dark-scope-policy.json: only Owner-approved / base-preserved / reference dark
//                 regions are masked; any other dark region FAILS (replaces the former whole-page dark-pixel fraction,
//                 which counted the approved greeting card, document band and the base sidebar against the page).
//   nav         - (2026-10-05 cloud fix3) role-based header/drawer navigation vs the reference at EVERY viewport, with the
//                 narrow overrides of fidelity/reference-overrides.json (language switch removed per Owner, HE actions
//                 right per Owner F1, base sign-in, IRON-LANDING-001 CTA label, phone drawer toggle); every other
//                 mismatch of order, side or coordinates FAILS.
//   base-parity - (2026-10-06 cloud fix4) app noLegacyPurple / tealAccentPresent judged against the measured base c65f742
//                 values of fidelity/app-palette-base.json (app palette = base violet, S-B8; reference not authority).
//                 cloud-fix4b (A17 H3): every violet-painted element and solid violet area must have a base counterpart
//                 (element / component comparison), purpleFrac <= base + min(0.25 x base, 0.005) as a backstop.
//                 --record-palette-base <file> writes that inventory from a run against the base build.
//
// Usage: node scripts/task16/qa/fidelity-compare.mjs [--base-url http://localhost:5186] [--out DIR]
//          [--surfaces landing,docs,app] [--viewports 1440x900,390x844] [--locales he,en] [--styles classic,modern,visual]
//          [--ref-dir <revision-r2-refined>] [--env C:/tkrc-pt/.env.localtest.local]
//          [--app-mode mock]   app cells with the synthetic mocked session (no persona, no credentials; build must point
//                              VITE_SUPABASE_URL at http://127.0.0.1:54399). Default: persona login (local TEST only).
// Exit code: 0 no FAIL, 1 any FAIL, 2 setup error. PW_CHROMIUM=<path> selects a pre-installed Chromium.
// Output: <out>/fidelity-matrix.json + <out>/composites/*.png (+ ref/ cand/ raw shots). Default out: scratchpad/qa-fidelity.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, parseArgs, ensureDir, writeJson, slug, isMain, STATUS, TEST_PROJECT_REF } from './lib.mjs';
import { PERSONAS, DEFAULT_ENV, T, readEnv, makeRedactor, login, openNewQuote } from './qa-app-persona.mjs';
import { REPO_REF_DIR, launchOptions, mockedAppContext, solidDarkComponents } from './fidelity/common.mjs';
import { probeNav, compareNav } from './fidelity/nav.mjs';
import { measureSurface, evaluateRegions } from './fidelity/darkscope.mjs';
import { applyAppPaletteBase, APP_PALETTE_BASE } from './fidelity/appPaletteBase.mjs';

export const VIEWPORTS = [[1440, 900], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [390, 844], [320, 640]];
const DEFAULT_REF_DIR = 'C:/Users/sales/Documents/YoutubeChanel/WebSite/quotecode-saas/evidence/task-16-quote-experience-v2/revision-r2-refined';
const DEFAULT_OUT = path.join(os.tmpdir(), 'claude', 'c--Users-sales-Documents-YoutubeChanel-WebSite-quotecode-saas', 'b6da8cf3-4c20-4651-96fb-4c72cd0ac39f', 'scratchpad', 'qa-fidelity');
const MAX_SHOT_HEIGHT = 5000;
const CANDIDATE_META_LABELS = {
  he: ['מספר הצעה', "מס' הצעה", 'מס׳ הצעה', 'תאריך', 'בתוקף עד', 'תוקף עד', 'תוקף', 'פרויקט'],
  en: ['Quote number', 'Quote #', 'Quote no.', 'Date', 'Valid through', 'Valid until', 'Project'],
};

// ---------------------------------------------------------------------------------------------------------------
// In-page probe (runs identically on reference and candidate).
// ---------------------------------------------------------------------------------------------------------------
function pageProbe(opts) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05;
  };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height), cx: r.left + r.width / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
  const parseColor = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const gradientColors = (s) => [...String(s).matchAll(/rgba?\([^)]+\)/g)].map((m) => parseColor(m[0])).filter(Boolean);
  const effBg = (el) => {
    for (let e = el; e; e = e.parentElement) { const c = parseColor(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; const g = gradientColors(getComputedStyle(e).backgroundImage); if (g.length) return g[0]; }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const isFixedInside = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  const textMin = (scope, exclude) => {
    const small = [];
    let min = null;
    for (const el of scope.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg', 'SVG'].includes(el.tagName) || el.closest('svg')) continue;
      const t = ownText(el);
      if (!t || t.length < 2) continue;
      if (exclude && exclude.some((x) => x && x.contains(el))) continue;
      if (!vis(el) || isFixedInside(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue; // sr-only
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (min === null || fs < min) min = fs;
      if (fs < 12) small.push({ fs, text: t.slice(0, 40), cls: String(el.className).slice(0, 50) });
    }
    small.sort((a, b) => a.fs - b.fs);
    return { min, smallCount: small.length, smallest: small.slice(0, 6) };
  };
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const out = { vw, vh, kind: opts.kind };

  if (opts.kind === 'landing') {
    out.bodyBgLum = lum(effBg(document.body));
    const h1 = [...document.querySelectorAll('h1')].find(vis);
    const headers = [...document.querySelectorAll('header, nav, [role="banner"]')].filter((e) => vis(e) && e.getBoundingClientRect().top < 120 && e.getBoundingClientRect().height < 260);
    const header = headers[0] || null;
    if (header) {
      out.header = rect(header);
      const logo = [...header.querySelectorAll('img, svg')].find(vis) || [...header.querySelectorAll('a')].find(vis);
      out.logoCx = logo ? logo.getBoundingClientRect().left + logo.getBoundingClientRect().width / 2 : null;
      const items = [...header.querySelectorAll('a, button')].filter((e) => vis(e) && (e.innerText || '').trim() && !(logo && e.contains(logo)));
      const rtl = getComputedStyle(header).direction === 'rtl';
      items.sort((a, b) => (rtl ? b.getBoundingClientRect().left - a.getBoundingClientRect().left : a.getBoundingClientRect().left - b.getBoundingClientRect().left));
      out.navLabels = items.map((e) => e.innerText.replace(/\s+/g, ' ').trim().toLowerCase());
    }
    let hero = null;
    let doc = null;
    if (h1) {
      out.h1 = { ...rect(h1), text: h1.innerText.replace(/\s+/g, ' ').slice(0, 80) };
      // Hero = the closest ancestor of the h1 that also holds a quote document (table / quote-doc / pq-card).
      // The walk stops at a page-level wrapper: MAIN/BODY, or any ancestor taller than 40% of the whole document.
      // (2026-10-05 correction: the former fixed cap max(2.4 x viewport, 1800px) cut off a legitimately stacked phone
      // hero - 1809px at 320x640 with its quote table at y~1059 - a harness false negative. The 40% rule still
      // excludes whole-page wrappers: MAIN there is 98% of the document; the stacked hero section is 14%.)
      const docH = Math.max(document.documentElement.scrollHeight, 1);
      const docCands = (scope) => [...scope.querySelectorAll('*')].filter((e) => !e.contains(h1) && vis(e) && (e.tagName === 'TABLE' || e.querySelector('table') || /quote-doc|pq-card/i.test(String(e.className))))
        .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height);
      let fallback = null;
      for (let e = h1.parentElement; e && e !== document.body; e = e.parentElement) {
        const er = e.getBoundingClientRect();
        if (e.tagName === 'MAIN' || er.height > 0.4 * docH) break;
        if (!fallback && er.height >= 300) fallback = e;
        const c = docCands(e)[0];
        if (c) { hero = e; doc = c; break; }
      }
      if (!hero) hero = fallback || h1.parentElement;
      out.hero = { ...rect(hero), tag: hero.tagName, cls: String(hero.className).slice(0, 40), docFraction: +(hero.getBoundingClientRect().height / docH).toFixed(3) };
      out.heroDoc = doc ? { ...rect(doc), cls: String(doc.className).slice(0, 60) } : null;
    }
    const scope = [header, hero].filter(Boolean);
    out.ctas = [];
    for (const s of scope) {
      for (const e of s.querySelectorAll('a, button')) {
        if (!vis(e) || isFixedInside(e)) continue;
        const cs = getComputedStyle(e);
        const bg = parseColor(cs.backgroundColor);
        const grad = gradientColors(cs.backgroundImage);
        const filled = (bg && bg.a > 0.5 && lum(bg) < 0.85) || grad.length;
        if (filled) out.ctas.push({ text: (e.innerText || '').trim().slice(0, 30), colors: [...(bg && bg.a > 0.5 ? [bg] : []), ...grad] });
      }
    }
    // Readability is judged on page copy, not on scaled document previews (hero / style showcase / plan minis).
    const previews = [...document.querySelectorAll('.quote-doc, .pq-card, .hero-proof, .quote-viewer, .mini, [data-quote-preview], table')]
      .map((e) => e.closest('.hero-proof, .quote-viewer') || e);
    out.text = textMin(document.body, [doc, ...previews]);
  }

  if (opts.kind === 'doc') {
    const root = document.querySelector(opts.rootSel);
    if (!root) return { ...out, missing: opts.rootSel };
    out.root = rect(root);
    out.rootBgLum = lum(effBg(root));
    const ths = [...root.querySelectorAll('thead th')].filter(vis);
    out.thCount = ths.length;
    // Title = largest-font visible text element (not a money figure).
    let title = null; let tf = 0;
    for (const el of root.querySelectorAll('h1, h2, h3, [class*="title"]')) {
      if (!vis(el)) continue;
      const f = parseFloat(getComputedStyle(el).fontSize);
      if (f > tf && !/[₪$€£]\s?\d/.test(el.innerText)) { tf = f; title = el; }
    }
    if (title) {
      const cs = getComputedStyle(title);
      const p = getComputedStyle(title.parentElement);
      out.title = { text: title.innerText.trim().slice(0, 60), textAlign: cs.textAlign, parentJustify: p.justifyContent, parentAlignItems: p.alignItems, parentTextAlign: p.textAlign, fontSize: tf };
    }
    const labels = opts.metaLabels.map((s) => s.toLowerCase());
    const metas = [];
    for (const el of root.querySelectorAll('*')) {
      const t = ownText(el).replace(/[:׃]\s*$/, '').trim().toLowerCase();
      if (!t || !labels.includes(t) || !vis(el)) continue;
      let cell = el.parentElement;
      const hasValue = (c) => [...c.querySelectorAll('*')].some((x) => x !== el && !x.contains(el) && ownText(x) && vis(x)) || (ownText(c) && ownText(c).toLowerCase() !== t);
      let guard = 0;
      while (cell && cell !== root && !hasValue(cell) && guard < 3) { cell = cell.parentElement; guard += 1; }
      if (!cell || cell === root) continue;
      const valueEl = [...cell.querySelectorAll('*')].find((x) => x !== el && !x.contains(el) && !el.contains(x) && ownText(x) && vis(x));
      const cr = cell.getBoundingClientRect();
      const cs = getComputedStyle(cell);
      const contentCx = cr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) + (cr.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / 2;
      const lr = el.getBoundingClientRect();
      // the text's own box (inline content) - use a Range so block elements report the glyph extent, not the block
      const textBox = (node) => { const r = document.createRange(); r.selectNodeContents(node); const b = r.getBoundingClientRect(); return b.width ? b : node.getBoundingClientRect(); };
      const lb = textBox(el);
      const vb = valueEl ? textBox(valueEl) : null;
      // rule above: borders on cell / row, or a thin line element right above the cell
      const row = cell.parentElement;
      const borderAbove = parseFloat(cs.borderTopWidth) > 0 || (row && row !== root && parseFloat(getComputedStyle(row).borderTopWidth) > 0 && Math.abs(row.getBoundingClientRect().top - cr.top) < 20);
      let lineAbove = null;
      for (const x of root.querySelectorAll('*')) {
        if (x.contains(cell) || !vis(x)) continue;
        const xr = x.getBoundingClientRect();
        const xs = getComputedStyle(x);
        const overlap = Math.min(xr.right, cr.right) - Math.max(xr.left, cr.left);
        if (overlap < 0.5 * cr.width) continue;
        const thin = (x.tagName === 'HR' || (xr.height <= 4 && (parseColor(xs.backgroundColor)?.a > 0.3 || parseFloat(xs.borderTopWidth) > 0)));
        if (thin && xr.bottom >= cr.top - 16 && xr.bottom <= cr.top + 1) { lineAbove = { tag: x.tagName, cls: String(x.className).slice(0, 40) }; break; }
        if (parseFloat(xs.borderBottomWidth) > 0 && xr.bottom >= cr.top - 16 && xr.bottom <= cr.top + 1 && xr.height < 400) { lineAbove = { tag: x.tagName, cls: String(x.className).slice(0, 40), borderBottom: true }; break; }
      }
      metas.push({
        label: t, cellCls: String(cell.className).slice(0, 50),
        labelOffset: Math.round((lb.left + lb.width / 2) - contentCx), valueOffset: vb ? Math.round((vb.left + vb.width / 2) - contentCx) : null,
        borderAbove, lineAbove,
      });
    }
    out.meta = metas;
    out.text = textMin(root, [...root.querySelectorAll('img, svg, canvas')]);
  }

  if (opts.kind === 'app') {
    const root = opts.rootSel ? document.querySelector(opts.rootSel) : document.body;
    if (!root) return { ...out, missing: opts.rootSel };
    out.root = rect(root);
    const rr = root.getBoundingClientRect();
    const main = root.querySelector('main') || root;
    const sideEl = [...root.querySelectorAll('aside, nav, [class*="sidebar"], [class*="mg-side"]')].find((e) => vis(e) && e.getBoundingClientRect().height >= 0.5 * Math.min(rr.height, vh) && e.getBoundingClientRect().width < 0.45 * rr.width);
    let cx = rr.left + rr.width / 2;
    if (sideEl) { const s = sideEl.getBoundingClientRect(); const leftFree = s.left - rr.left; const rightFree = rr.right - s.right; cx = leftFree > rightFree ? rr.left + leftFree / 2 : s.right + rightFree / 2; }
    const cy = Math.min(Math.max(rr.top, 0) + Math.min(rr.height, vh) * 0.55, vh - 2);
    const probeEl = document.elementFromPoint(Math.max(1, Math.min(cx, vw - 2)), Math.max(1, cy));
    out.mainBgLum = lum(effBg(probeEl && root.contains(probeEl) ? probeEl : main));
    out.mainBgProbe = probeEl ? String(probeEl.className || probeEl.tagName).slice(0, 40) : null;
    const sides = [...root.querySelectorAll('aside, nav, [class*="sidebar"], [class*="mg-side"]')].filter((e) => vis(e) && e.getBoundingClientRect().height >= 0.5 * Math.min(rr.height, vh) && e.getBoundingClientRect().width < 0.45 * rr.width);
    sides.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
    if (sides[0]) {
      const s = sides[0].getBoundingClientRect();
      out.sidebar = { cls: String(sides[0].className).slice(0, 50), side: s.left + s.width / 2 > rr.left + rr.width / 2 ? 'right' : 'left', w: Math.round(s.width), h: Math.round(s.height) };
    }
    out.dir = getComputedStyle(main).direction;
    out.text = textMin(root, [...root.querySelectorAll('.pq-card, .quote-doc, [data-testid="qp-preview"]')]);
    const refCards = [...root.querySelectorAll('.style-card[data-style]')];
    const candCards = [...root.querySelectorAll('[data-testid^="qp-quote-style-select-"]')];
    // violet-PAINTED elements in the viewport (cloud-fix4b H3): own background colour (alpha > 0.5) or any gradient stop
    // in the purpleFrac violet range, box >= 16x16; outermost only. Compared with the base c65f742 inventory.
    const isViolet = (c) => { if (!c || (c.a !== undefined && c.a <= 0.5)) return false; const R = c.r / 255; const G = c.g / 255; const B = c.b / 255; const mx = Math.max(R, G, B); const mn = Math.min(R, G, B); if (mx === mn) return false; let h = mx === R ? 60 * (((G - B) / (mx - mn)) % 6) : mx === G ? 60 * ((B - R) / (mx - mn) + 2) : 60 * ((R - G) / (mx - mn) + 4); if (h < 0) h += 360; return h >= 250 && h <= 340 && (mx - mn) / mx >= 0.35 && mx >= 0.25; };
    const vEls = [];
    for (const e of root.querySelectorAll('*')) {
      if (e.closest('svg') || !vis(e)) continue;
      const cs = getComputedStyle(e);
      if (!(isViolet(parseColor(cs.backgroundColor)) || gradientColors(cs.backgroundImage).some(isViolet))) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 16 || r.height < 16 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      vEls.push({ e, tag: e.tagName.toLowerCase(), label: (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }
    out.violetEls = vEls.filter((v) => !vEls.some((o) => o !== v && o.e.contains(v.e))).map(({ e, ...rest }) => rest);
    out.styleCards = refCards.length || candCards.length;
    out.locked = refCards.length
      ? refCards.filter((c) => c.classList.contains('locked')).map((c) => c.dataset.style).sort()
      : [...root.querySelectorAll('[data-testid^="qp-quote-style-locked-"]')].map((e) => e.getAttribute('data-testid').replace('qp-quote-style-locked-', '')).sort();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Pixel statistics + composite (in a browser page; data URLs keep the canvas untainted).
// ---------------------------------------------------------------------------------------------------------------
async function compositeAndStats(browser, refBuf, candBuf, title, outFile, statsHeight) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    const html = `<!doctype html><html><body style="margin:0;background:#20262b;font:14px system-ui,sans-serif;color:#fff">
<div style="padding:10px 14px;font-weight:600">${title.replace(/</g, '&lt;')}</div>
<div style="display:flex;gap:16px;align-items:flex-start;padding:0 14px 14px">
<figure style="margin:0"><figcaption style="padding:6px 0;color:#9fe0c9">REFERENCE - approved revision-r2-refined</figcaption><img id="a" src="data:image/png;base64,${refBuf.toString('base64')}" style="display:block;outline:2px solid #9fe0c9"></figure>
<figure style="margin:0"><figcaption style="padding:6px 0;color:#ffcf8a">CANDIDATE</figcaption><img id="b" src="data:image/png;base64,${candBuf.toString('base64')}" style="display:block;outline:2px solid #ffcf8a"></figure>
</div></body></html>`;
    await page.setContent(html);
    await page.waitForFunction(() => document.getElementById('a').complete && document.getElementById('b').complete);
    const dims = await page.evaluate(() => ({ a: [document.getElementById('a').naturalWidth, document.getElementById('a').naturalHeight], b: [document.getElementById('b').naturalWidth, document.getElementById('b').naturalHeight] }));
    await page.setViewportSize({ width: Math.min(4200, dims.a[0] + dims.b[0] + 60), height: 900 });
    const stats = await page.evaluate((statsHeight) => {
      const calc = (img) => {
        const h = Math.min(img.naturalHeight, statsHeight || img.naturalHeight);
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = h;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, h).data;
        let n = 0; let sum = 0; let purple = 0; let teal = 0; let dark = 0;
        for (let i = 0; i < d.length; i += 4 * 3) {
          const r = d[i] / 255; const g = d[i + 1] / 255; const b = d[i + 2] / 255;
          const max = Math.max(r, g, b); const min = Math.min(r, g, b); const v = max; const s = max ? (max - min) / max : 0;
          let hue = 0;
          if (max !== min) { if (max === r) hue = 60 * (((g - b) / (max - min)) % 6); else if (max === g) hue = 60 * ((b - r) / (max - min) + 2); else hue = 60 * ((r - g) / (max - min) + 4); }
          if (hue < 0) hue += 360;
          const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          n += 1; sum += L; if (L < 0.25) dark += 1;
          if (hue >= 250 && hue <= 340 && s >= 0.35 && v >= 0.25) purple += 1;
          if (hue >= 165 && hue <= 205 && s >= 0.25 && v >= 0.2 && v <= 0.85) teal += 1;
        }
        // violet block grid (cloud-fix4b H3): 4x4 blocks with >= 75% violet pixels (same violet test as purpleFrac)
        const g = 4; const bw = Math.floor(c.width / g); const bh = Math.floor(h / g); let bits = '';
        for (let by = 0; by < bh; by += 1) for (let bx = 0; bx < bw; bx += 1) {
          let k = 0;
          for (let yy = 0; yy < g; yy += 1) for (let xx = 0; xx < g; xx += 1) {
            const i = ((by * g + yy) * c.width + bx * g + xx) * 4;
            const r = d[i] / 255; const gg = d[i + 1] / 255; const b = d[i + 2] / 255;
            const max = Math.max(r, gg, b); const min = Math.min(r, gg, b); const s = max ? (max - min) / max : 0;
            if (max === min || s < 0.35 || max < 0.25) continue;
            let hue = max === r ? 60 * (((gg - b) / (max - min)) % 6) : max === gg ? 60 * ((b - r) / (max - min) + 2) : 60 * ((r - gg) / (max - min) + 4);
            if (hue < 0) hue += 360;
            if (hue >= 250 && hue <= 340) k += 1;
          }
          bits += k >= 0.75 * g * g ? '1' : '0';
        }
        return { meanLum: +(sum / n).toFixed(3), darkFrac: +(dark / n).toFixed(4), purpleFrac: +(purple / n).toFixed(4), tealFrac: +(teal / n).toFixed(4), region: [img.naturalWidth, h], violetGrid: { g, bw, bh, bits } };
      };
      return { ref: calc(document.getElementById('a')), cand: calc(document.getElementById('b')) };
    }, statsHeight);
    for (const side of ['ref', 'cand']) {
      const vg = stats[side].violetGrid; delete stats[side].violetGrid;
      stats[side].violet = violetComponents(vg);
    }
    await page.screenshot({ path: outFile, fullPage: true });
    return stats;
  } finally {
    await page.close();
  }
}

// Solid violet components of a screenshot (cloud-fix4b H3): opening of the violet block grid by a VIOLET_S x VIOLET_S
// square (fidelity/appPaletteBase.mjs explains the window), components >= one window. Violet TEXT (labels, links, the
// violet amounts) has strokes far thinner than the window and drops out; filled controls, pills, bars and active
// states remain and are compared one by one with the measured base c65f742 inventory (app-palette-base.json).
function violetComponents(vg) {
  const k = Math.ceil(APP_PALETTE_BASE.components.windowPx / vg.g);
  const grid = Uint8Array.from(vg.bits, (ch) => (ch === '1' ? 1 : 0));
  const comps = solidDarkComponents(grid, vg.bw, vg.bh, k);
  return { windowPx: k * vg.g, comps: comps.map((c) => ({ x: c.x0 * vg.g, y: c.y0 * vg.g, w: (c.x1 - c.x0) * vg.g, h: (c.y1 - c.y0) * vg.g, area: c.blocks * vg.g * vg.g })).sort((a, b) => b.area - a.area) };
}

// ---------------------------------------------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------------------------------------------
const hueOf = ({ r, g, b }) => {
  const R = r / 255; const G = g / 255; const B = b / 255; const max = Math.max(R, G, B); const min = Math.min(R, G, B);
  if (max === min) return { h: 0, s: 0, v: max };
  let h = max === R ? 60 * (((G - B) / (max - min)) % 6) : max === G ? 60 * ((B - R) / (max - min) + 2) : 60 * ((R - G) / (max - min) + 4);
  if (h < 0) h += 360;
  return { h, s: (max - min) / max, v: max };
};
const isTeal = (c) => { const x = hueOf(c); return x.h >= 165 && x.h <= 205 && x.s >= 0.25 && x.v >= 0.2 && x.v <= 0.85; };
const isPurple = (c) => { const x = hueOf(c); return x.h >= 250 && x.h <= 340 && x.s >= 0.35 && x.v >= 0.25; };
const R = (status, kind, ref, cand, note) => ({ status, kind, ref, cand, ...(note ? { note } : {}) });

// calibrated: run fn on reference first; reference must pass for the candidate verdict to count.
function calibrated(fn, ref, cand) {
  const r = fn(ref); const c = fn(cand);
  if (!r.ok) return R(STATUS.NOT_TESTED, 'calibrated', r.v, c.v, 'detector does not pass on the reference at this viewport');
  return R(c.ok ? STATUS.PASS : STATUS.FAIL, 'calibrated', r.v, c.v);
}
function policy(fn, ref, cand, note) {
  const r = fn(ref); const c = fn(cand);
  if (c.na) return R(STATUS.NOT_TESTED, 'policy', r.v, c.v, c.na);
  return R(c.ok ? STATUS.PASS : STATUS.FAIL, 'policy', r.v, c.v, note);
}

// Region light/dark verdicts (darkscope). Calibrated when the reference was measured with the same regions: a reference
// FAIL means the region policy does not describe the reference -> NOT TESTED; otherwise PASS iff no candidate FAIL.
function regionAssertion(darkRef, darkCand, calibrate) {
  if (!darkCand) return R(STATUS.NOT_TESTED, 'region', null, null, 'region measurement missing');
  const rows = evaluateRegions(darkCand, null, STATUS);
  const brief = (rs) => rs.filter((r) => r.status !== 'ABSENT').map((r) => ({ id: r.id, rule: r.rule, verdict: r.verdict, status: r.status, ...(r.masked.length ? { masked: r.masked } : {}), ...(r.provenance.length && r.verdict === 'dark' ? { provenance: r.provenance } : {}) }));
  const refRows = darkRef ? evaluateRegions(darkRef, null, STATUS) : null;
  if (calibrate && refRows && refRows.some((r) => r.status === STATUS.FAIL)) return R(STATUS.NOT_TESTED, 'region', brief(refRows), brief(rows), 'region policy FAILS on the reference at this viewport (detector gap)');
  const fails = rows.filter((r) => r.status === STATUS.FAIL);
  return R(fails.length ? STATUS.FAIL : STATUS.PASS, 'region', refRows ? brief(refRows) : null, brief(rows), fails.length ? `not light / not allowed: ${fails.map((f) => `${f.id}=${f.verdict}`).join(', ')}` : 'every region light except policy-allowed dark regions (masked, provenance in dark-scope-policy.json)');
}

function landingAssertions(ref, cand, px, locale, extra = {}) {
  const A = {};
  // cloud-fix4b (A18): an Owner POLICY, not reference-calibrated. Formerly calibrate=true turned all 14 landing cells into
  // NOT TESTED because the reference itself is dark where the Owner requires light (closing band, footer, management
  // sidebar): the Owner instruction in force (black on screen only on the greeting card and the issuer/metadata band;
  // base/reference never override it) supersedes the reference, so the candidate is judged on its own and the reference
  // rows stay in the cell as context (refDarkWhereOwnerRequiresLight).
  A.pageBackgroundLight = regionAssertion(extra.darkRef, extra.darkCand, false);
  if (A.pageBackgroundLight.status !== STATUS.NOT_TESTED) {
    A.pageBackgroundLight.kind = 'policy';
    A.pageBackgroundLight.refDarkWhereOwnerRequiresLight = (A.pageBackgroundLight.ref || []).filter((r) => r.status === STATUS.FAIL).map((r) => `${r.id}=${r.verdict}`);
  }
  if (extra.darkDrawer) A.drawerBackgroundLight = regionAssertion(null, extra.darkDrawer, false);
  A.tealAccentOnPrimaryCta = calibrated((m) => { const p = m === ref ? px.ref : px.cand; const teal = (m.ctas || []).filter((c) => c.colors.some(isTeal)); return { ok: teal.length > 0 && p.tealFrac >= 0.001, v: { tealCtas: teal.map((c) => c.text), ctaCount: (m.ctas || []).length, tealPixelFrac: p.tealFrac } }; }, ref, cand);
  A.noLegacyPurpleInHeroHeader = calibrated((m) => { const p = m === ref ? px.ref : px.cand; const purp = (m.ctas || []).filter((c) => c.colors.some(isPurple)); return { ok: p.purpleFrac <= 0.03 && purp.length === 0, v: { purplePixelFrac: p.purpleFrac, purpleCtas: purp.map((c) => c.text) } }; }, ref, cand);
  A.heroSplitWithLargeDocument = calibrated((m) => {
    if (!m.h1 || !m.hero) return { ok: false, v: 'no h1/hero' };
    const d = m.heroDoc;
    if (!d) return { ok: false, v: { reason: 'no quote document in the hero', hero: [m.hero.w, m.hero.h] } };
    const widthRatio = +(d.w / m.hero.w).toFixed(2);
    if (m.vw >= 1024) {
      const sideBySide = d.right <= m.h1.left + 2 || d.left >= m.h1.right - 2;
      return { ok: widthRatio >= 0.38 && sideBySide, v: { widthRatio, sideBySide, doc: d.cls } };
    }
    return { ok: widthRatio >= 0.6, v: { widthRatio, stacked: true, doc: d.cls } };
  }, ref, cand);
  A.headerLogoSide = calibrated((m) => {
    if (m.logoCx == null) return { ok: false, v: 'no header logo' };
    const side = m.logoCx > m.vw / 2 ? 'right' : 'left';
    return { ok: side === (locale === 'he' ? 'right' : 'left'), v: side };
  }, ref, cand);
  // Navigation: role-based comparison at every viewport (replaces the former >=75% label LCS on >900px only, which
  // failed on the reference language switch the Owner ordered removed). Overrides: fidelity/reference-overrides.json.
  Object.assign(A, compareNav(extra.navRef, extra.navCand, locale, STATUS));
  A.readableText12 = policy((m) => ({ ok: m.text.min >= 12, v: { min: m.text.min, below12: m.text.smallCount, smallest: m.text.smallest.slice(0, 3) } }), ref, cand, 'text outside the hero document mini-preview');
  return A;
}

function docAssertions(ref, cand, px, extra = {}) {
  const A = {};
  if (cand.missing) { for (const k of ['documentBackgroundLight', 'fourTableColumns', 'noLegacyPurple', 'metadataCentered', 'noRuleAboveMetadata', 'titleNotCentered', 'readableText12']) A[k] = R(STATUS.NOT_TESTED, 'calibrated', null, null, `candidate root ${cand.missing} not found`); return A; }
  // card body light outside the Owner-required dark band (region policy); the reference doc has no band -> uncalibrated
  A.documentBackgroundLight = extra.darkCand ? regionAssertion(null, extra.darkCand, false) : calibrated((m) => ({ ok: m.rootBgLum >= 0.9, v: +m.rootBgLum.toFixed(3) }), ref, cand);
  A.fourTableColumns = calibrated((m) => ({ ok: m.thCount === 4, v: m.thCount }), ref, cand);
  A.noLegacyPurple = calibrated((m) => { const p = m === ref ? px.ref : px.cand; return { ok: p.purpleFrac <= 0.02, v: p.purpleFrac }; }, ref, cand);
  A.metadataCentered = policy((m) => {
    if (!m.meta.length) return { na: 'no metadata label found', v: [] };
    const bad = m.meta.filter((x) => Math.abs(x.labelOffset) > 4 || (x.valueOffset !== null && Math.abs(x.valueOffset) > 4));
    return { ok: bad.length === 0, v: m.meta.map((x) => ({ label: x.label, labelOffset: x.labelOffset, valueOffset: x.valueOffset })) };
  }, ref, cand, 'Owner clarification 2026-10-05: each metadata label and its value centered within its cell');
  A.noRuleAboveMetadata = policy((m) => {
    if (!m.meta.length) return { na: 'no metadata label found', v: [] };
    const bad = m.meta.filter((x) => x.borderAbove || x.lineAbove);
    return { ok: bad.length === 0, v: bad.map((x) => ({ label: x.label, borderAbove: x.borderAbove, lineAbove: x.lineAbove })) };
  }, ref, cand, 'Owner clarification 2026-10-05: no decorative rule above the metadata fields');
  A.titleNotCentered = policy((m) => {
    if (!m.title) return { na: 'no title', v: null };
    const centered = m.title.textAlign === 'center' || m.title.parentJustify === 'center' || m.title.parentAlignItems === 'center' && m.title.parentTextAlign === 'center';
    return { ok: !centered, v: m.title };
  }, ref, cand, 'Owner: do NOT center the quotation title');
  A.readableText12 = policy((m) => ({ ok: m.text.min >= 12, v: { min: m.text.min, below12: m.text.smallCount, smallest: m.text.smallest.slice(0, 3) } }), ref, cand);
  return A;
}

function appAssertions(ref, cand, px, locale, view, tier, extra = {}) {
  const A = {};
  // region policy: sidebar (dark in base c65f742), greeting card and document band (Owner 2026-10-05) are the only dark
  // regions masked; canvas, Quote History, creator form, preview tray, bottom nav must be light. Reference selectors
  // differ (static prototype) -> uncalibrated, reference values shown for context.
  A.backgroundLight = regionAssertion(null, extra.darkCand, false);
  if (A.backgroundLight.status !== STATUS.NOT_TESTED) A.backgroundLight.ref = { mainBgLum: +ref.mainBgLum.toFixed(3), meanLum: px.ref.meanLum, darkFrac: px.ref.darkFrac };
  A.noLegacyPurple = calibrated((m) => { const p = m === ref ? px.ref : px.cand; return { ok: p.purpleFrac <= 0.03, v: p.purpleFrac }; }, ref, cand);
  A.tealAccentPresent = calibrated((m) => { const p = m === ref ? px.ref : px.cand; return { ok: p.tealFrac >= 0.001, v: p.tealFrac }; }, ref, cand);
  A.sidebarSide = calibrated((m) => {
    if (m.vw < 1024) return { ok: false, v: 'narrow - drawer/bottom nav' };
    if (!m.sidebar) return { ok: false, v: 'no sidebar' };
    return { ok: m.sidebar.side === (locale === 'he' ? 'right' : 'left'), v: m.sidebar };
  }, ref, cand);
  A.readableText12 = policy((m) => ({ ok: m.text.min >= 12, v: { min: m.text.min, below12: m.text.smallCount, smallest: m.text.smallest.slice(0, 3) } }), ref, cand);
  if (view === 'creator' && tier === null) {
    A.lockedStylesMatchTier = R(STATUS.NOT_TESTED, 'comparison', ref.locked, cand.locked, 'mocked session: no presentation-tier fixture (tier mapping is a persona/QA-capability check)');
  } else if (view === 'creator') {
    if (!ref.styleCards || !cand.styleCards) A.lockedStylesMatchTier = R(STATUS.NOT_TESTED, 'comparison', ref.locked, cand.locked, 'style picker not found');
    else A.lockedStylesMatchTier = R(JSON.stringify(ref.locked) === JSON.stringify(cand.locked) ? STATUS.PASS : STATUS.FAIL, 'comparison', ref.locked, cand.locked, `reference plan demo at tier ${tier}`);
  }
  return A;
}

// ---------------------------------------------------------------------------------------------------------------
async function settle(page, sel, timeout = 60000) {
  if (sel) await page.locator(sel).first().waitFor({ timeout }).catch(() => {});
  await page.evaluate(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 5000))])).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.race([Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))), new Promise((r) => setTimeout(r, 8000))]);
  }).catch(() => {});
  await page.waitForTimeout(400);
}

async function shoot(page, file, { element, fullPage = true, mask } = {}) {
  if (element) {
    const loc = page.locator(element).first();
    if (await loc.count()) {
      const buf = await loc.screenshot({ timeout: 30000, animations: 'disabled' }).catch(() => null);
      if (buf) { fs.writeFileSync(file, buf); return buf; }
    }
  }
  const h = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 900);
  const vp = page.viewportSize();
  const buf = await page.screenshot({ fullPage, timeout: 45000, animations: 'disabled', ...(mask ? { mask } : {}), clip: fullPage ? { x: 0, y: 0, width: vp.width, height: Math.min(h, MAX_SHOT_HEIGHT) } : undefined });
  fs.writeFileSync(file, buf);
  return buf;
}

async function candidateIdentity(base) {
  for (const p of ['/tekango-build-identity.json', '/version.json']) {
    try { const r = await fetch(base + p); if (r.ok) { const j = await r.json(); if (j.buildSha || j.sha) return j.buildSha || j.sha; } } catch { /* next */ }
  }
  return null;
}

export async function runFidelity(args) {
  const base = new URL(String(args['base-url'] || process.env.BASE_URL || 'http://localhost:5186')).origin;
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(base)) throw new Error('refusing non-local / non-private BASE_URL');
  let refDir = path.resolve(String(args['ref-dir'] || process.env.T16_REF_DIR || DEFAULT_REF_DIR));
  // cloud / fresh clone: fall back to the preserved, manifest-bound copy in this repository
  if (!args['ref-dir'] && !process.env.T16_REF_DIR && !fs.existsSync(path.join(refDir, 'landing-he.html'))) refDir = REPO_REF_DIR;
  if (!fs.existsSync(path.join(refDir, 'landing-he.html'))) throw new Error(`reference not found: ${refDir}`);
  const out = ensureDir(path.resolve(String(args.out || DEFAULT_OUT)));
  const dirs = { comp: ensureDir(path.join(out, 'composites')), ref: ensureDir(path.join(out, 'ref')), cand: ensureDir(path.join(out, 'cand')) };
  const surfaces = String(args.surfaces || 'landing,docs').split(',');
  const locales = String(args.locales || 'he,en').split(',');
  const styles = String(args.styles || 'classic,modern,visual').split(',');
  const viewports = args.viewports ? String(args.viewports).split(',').map((s) => s.split('x').map(Number)) : VIEWPORTS;
  const refUrl = (file, q = '') => `${pathToFileURL(path.join(refDir, file)).href}${q}`;
  // Reference document host page (R2.quote rendered with the reference stylesheet at a readable 12px scale).
  const refDocFile = path.join(out, 'ref-doc.html');
  fs.writeFileSync(refDocFile, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${refUrl('styles.css')}"></head><body style="background:#edf1f0;margin:0;padding:16px"><div class="detail-review" style="margin:0 auto"><div class="quote-frame" id="host"></div></div><script src="${refUrl('app.js')}"></script><script>const q=new URLSearchParams(location.search);document.getElementById('host').innerHTML=R2.quote({style:q.get('style'),locale:q.get('locale'),detail:'compact'});</script></body></html>`);

  const sha = await candidateIdentity(base);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(launchOptions());
  const cells = [];
  const errors = [];
  const loaded = {};
  const doCell = async ({ id, refPage, candPage, refProbe, candProbe, refShotOpts, candShotOpts, statsHeight, assert, pre }) => {
    const refFile = path.join(dirs.ref, `${slug(id)}.png`);
    const candFile = path.join(dirs.cand, `${slug(id)}.png`);
    const compFile = path.join(dirs.comp, `${slug(id)}.png`);
    try {
      const extra = pre ? await pre() : {};
      const ref = await refPage.evaluate(pageProbe, refProbe);
      const cand = await candPage.evaluate(pageProbe, candProbe);
      const rb = await shoot(refPage, refFile, refShotOpts);
      const cb = await shoot(candPage, candFile, candShotOpts);
      const px = await compositeAndStats(browser, rb, cb, `${id}  |  reference: revision-r2-refined  |  candidate: ${base}${sha ? ` @ ${sha.slice(0, 10)}` : ''}`, compFile, statsHeight);
      const assertions = assert(ref, cand, px, extra);
      const navTable = extra.navCand ? { ref: extra.navRef?.items?.map((i) => ({ role: i.role, key: i.key, label: i.label, x: i.x, y: i.y, w: i.w, h: i.h, side: i.side })), cand: extra.navCand.items.map((i) => ({ role: i.role, key: i.key, label: i.label, x: i.x, y: i.y, w: i.w, h: i.h, side: i.side })), refHeader: extra.navRef?.header, candHeader: extra.navCand.header, refDrawer: extra.navRef?.drawer || extra.navRef?.drawerMarkup || null, candDrawer: extra.navCand.drawer || null } : undefined;
      cells.push({ id, composite: compFile, refShot: refFile, candShot: candFile, pixels: px, ...(navTable ? { nav: navTable } : {}), ...(cand.violetEls ? { violetEls: cand.violetEls } : {}), assertions });
    } catch (e) {
      errors.push({ id, error: String(e).split('\n')[0].slice(0, 300) });
      cells.push({ id, assertions: { cellError: R(STATUS.NOT_TESTED, 'harness', null, null, String(e).split('\n')[0].slice(0, 200)) } });
    }
  };

  try {
    if (surfaces.includes('landing')) {
      for (const locale of locales) {
        const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const rp = await rctx.newPage(); const cp = await cctx.newPage();
        await rp.goto(refUrl(`landing-${locale}.html`), { waitUntil: 'domcontentloaded' });
        await cp.goto(`${base}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        for (const [w, h] of viewports) {
          await rp.setViewportSize({ width: w, height: h }); await cp.setViewportSize({ width: w, height: h });
          await settle(rp, 'h1'); await settle(cp, 'h1');
          if (!loaded[locale]) {
            loaded[locale] = await cp.evaluate(() => {
              const b = window.__TEKANGO_BUILD__;
              const sha = b && (b.buildSha || b.sha || (typeof b === 'string' ? b : null));
              return { buildSha: sha || null, rubikCheck: document.fonts.check('16px Rubik'), rubikLoadedFaces: [...document.fonts].filter((x) => /rubik/i.test(x.family) && x.status === 'loaded').length, bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 60) };
            }).catch((e) => ({ error: String(e).slice(0, 120) }));
          }
          await rp.evaluate(() => window.scrollTo(0, 0)); await cp.evaluate(() => window.scrollTo(0, 0));
          await doCell({
            id: `landing/${locale}/${w}x${h}`, refPage: rp, candPage: cp, refProbe: { kind: 'landing' }, candProbe: { kind: 'landing' }, statsHeight: h,
            pre: async () => {
              const navRef = await probeNav(rp, locale); const navCand = await probeNav(cp, locale);
              await rp.evaluate(() => window.scrollTo(0, 0)); await cp.evaluate(() => window.scrollTo(0, 0));
              const darkRef = await measureSurface(rp, browser, 'landing', { fullPage: true });
              const darkCand = await measureSurface(cp, browser, 'landing', { fullPage: true });
              let darkDrawer = null;
              const tg = cp.locator('.tl-menu-toggle').filter({ visible: true }).first();
              if (await tg.count()) { await tg.click(); await cp.waitForTimeout(300); darkDrawer = await measureSurface(cp, browser, 'landing-drawer', { fullPage: false }); await cp.keyboard.press('Escape'); await cp.waitForTimeout(200); }
              await rp.evaluate(() => window.scrollTo(0, 0)); await cp.evaluate(() => window.scrollTo(0, 0));
              return { navRef, navCand, darkRef, darkCand, darkDrawer };
            },
            assert: (r, c, px, extra) => landingAssertions(r, c, px, locale, extra),
          });
        }
        await rctx.close(); await cctx.close();
      }
    }

    if (surfaces.includes('docs')) {
      for (const locale of locales) {
        for (const style of styles) {
          const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const rp = await rctx.newPage(); const cp = await cctx.newPage();
          await rp.goto(`${pathToFileURL(refDocFile).href}?style=${style}&locale=${locale}`, { waitUntil: 'domcontentloaded' });
          await cp.goto(`${base}/${locale}/sample-quote?style=${style}&length=short&detail=compact&images=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
          const refLabels = await rp.evaluate((l) => { const L = R2.fixtures[l].labels; return [L.number, L.date, L.valid]; }, locale);
          const metaLabels = [...new Set([...refLabels, ...CANDIDATE_META_LABELS[locale]])];
          for (const [w, h] of viewports) {
            await rp.setViewportSize({ width: w, height: h }); await cp.setViewportSize({ width: w, height: h });
            await settle(rp, '.quote-doc'); await settle(cp, '.pq-card');
            await doCell({
              id: `doc/${locale}/${style}/${w}x${h}`, refPage: rp, candPage: cp,
              refProbe: { kind: 'doc', rootSel: '.quote-doc', metaLabels }, candProbe: { kind: 'doc', rootSel: '.pq-card', metaLabels },
              refShotOpts: { element: '.quote-doc' }, candShotOpts: { element: '.pq-card' }, statsHeight: 0,
              pre: async () => ({ darkCand: await measureSurface(cp, browser, 'doc', { fullPage: true }) }),
              assert: (r, c, px, extra) => docAssertions(r, c, px, extra),
            });
          }
          await rctx.close(); await cctx.close();
        }
      }
    }

    if (surfaces.includes('app') && args['app-mode'] === 'mock') {
      // Synthetic mocked session (fidelity/common.mjs): no persona, no credentials, no backend contact.
      for (const locale of locales) {
        const market = locale === 'he' ? 'Local' : 'International';
        const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const rp = await rctx.newPage();
        const { ctx: cctx, lang } = await mockedAppContext(browser, { market, width: 1440, height: 900 });
        const cp = await cctx.newPage();
        await cp.goto(`${base}/dashboard?lang=${lang}`, { waitUntil: 'networkidle', timeout: 120000 });
        await cp.waitForSelector('.pf-work-screen', { timeout: 20000 }).catch(() => {});
        const views = [
          { key: 'management', refView: 'quotes', refSel: locale === 'he' ? '#managementHe .management' : '#managementEn .management', prep: async () => {} },
          { key: 'creator', refView: 'plans', refSel: '.creator-layout', prep: async () => { await cp.setViewportSize({ width: 1440, height: 900 }); await openNewQuote(cp, T[locale]); } },
        ];
        for (const v of views) {
          await rp.setViewportSize({ width: 1440, height: 900 });
          await rp.goto(refUrl('index.html', `?view=${v.refView}`), { waitUntil: 'domcontentloaded' });
          await rp.evaluate(({ sel }) => { const el = document.querySelector(sel); for (let e = el; e; e = e.parentElement) if (e.tagName === 'DETAILS') e.open = true; }, { sel: v.refSel });
          try { await v.prep(); } catch (e) { cells.push({ id: `app/${locale}/${v.key}`, assertions: { open: R(STATUS.FAIL, 'harness', null, null, String(e).split('\n')[0].slice(0, 200)) } }); continue; }
          for (const [w, h] of viewports) {
            await rp.setViewportSize({ width: w, height: h }); await cp.setViewportSize({ width: w, height: h });
            await settle(rp, v.refSel); await settle(cp, null); await cp.waitForTimeout(500);
            await doCell({
              id: `app/${locale}/${v.key}/${w}x${h}`, refPage: rp, candPage: cp,
              refProbe: { kind: 'app', rootSel: v.refSel }, candProbe: { kind: 'app' },
              refShotOpts: { element: v.refSel }, candShotOpts: { fullPage: false }, statsHeight: 0,
              pre: async () => ({ darkCand: await measureSurface(cp, browser, v.key === 'creator' ? 'creator' : 'app', { fullPage: false }) }),
              assert: (r, c, px, extra) => appAssertions(r, c, px, locale, v.key, null, extra),
            });
          }
        }
        await rctx.close(); await cctx.close();
      }
    } else if (surfaces.includes('app')) {
      const envFile = String(args.env || DEFAULT_ENV);
      const env = fs.existsSync(envFile) ? readEnv(envFile) : {};
      if (!String(env.VITE_SUPABASE_URL || '').includes(TEST_PROJECT_REF)) {
        cells.push({ id: 'app', assertions: { login: R(STATUS.NOT_TESTED, 'harness', null, null, 'persona env missing or not the TEST project') } });
      } else {
        // Default: LOCAL_PRO (HE) + INTL_PRO (EN). --app-personas adds tier states (all must be IRON-DATA-001 allowlisted).
        const TIER = { LOCAL_PRO: 'visual', INTL_PRO: 'visual', INTL_EUR: 'classic', INTL_GBP: 'modern', PERSONA_SUPER_ADMIN: 'classic' };
        const RANK = { classic: 1, modern: 2, visual: 3 };
        const appPersonas = String(args['app-personas'] || 'LOCAL_PRO,INTL_PRO').split(',').filter(Boolean);
        const unknown = appPersonas.filter((n) => !PERSONAS[n] || !TIER[n]);
        if (unknown.length) throw new Error(`refusing app persona(s) outside the allowlisted set: ${unknown.join(', ')}`);
        const secrets = appPersonas.flatMap((n) => [env[PERSONAS[n].key], env[PERSONAS[n].pwdKey]]);
        const redact = makeRedactor(secrets);
        for (const name of appPersonas) {
          const cfg = PERSONAS[name];
          const locale = cfg.lang;
          if (!locales.includes(locale)) continue;
          const tier = TIER[name];
          const tag = ['LOCAL_PRO', 'INTL_PRO'].includes(name) ? locale : `${locale}/${name}`;
          const creds = { email: env[cfg.key], password: env[cfg.pwdKey] }; // login() enforces the IRON-DATA-001 allowlist
          const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const rp = await rctx.newPage(); const cp = await cctx.newPage();
          await cp.route('**/auth/v1/token**', (route) => (new URL(route.request().url()).hostname.includes(TEST_PROJECT_REF) ? route.continue() : route.abort()));
          // reference page is navigated per view below (management lives in view=quotes inside a collapsed <details>)
          let ok = true;
          try { await login(cp, base, cfg, T[locale], creds); } catch (e) { ok = false; cells.push({ id: `app/${tag}`, assertions: { login: R(STATUS.FAIL, 'harness', null, null, redact(String(e)).split('\n')[0].slice(0, 200)) } }); }
          if (ok) {
            const mask = [cp.getByText(creds.email, { exact: false })];
            const views = [
              { key: 'management', refView: 'quotes', refSel: locale === 'he' ? '#managementHe .management' : '#managementEn .management', prep: async () => {} },
              { key: 'creator', refView: 'plans', refSel: '.creator-layout', prep: async () => { await cp.setViewportSize({ width: 1440, height: 900 }); await openNewQuote(cp, T[locale]); } },
            ];
            for (const v of views) {
              await rp.setViewportSize({ width: 1440, height: 900 });
              await rp.goto(refUrl('index.html', `?view=${v.refView}`), { waitUntil: 'domcontentloaded' });
              await rp.evaluate(({ sel, rank }) => {
                const el = document.querySelector(sel); for (let e = el; e; e = e.parentElement) if (e.tagName === 'DETAILS') e.open = true;
                const demo = document.querySelector('#planDemo'); if (demo) { demo.value = String(rank); demo.dispatchEvent(new Event('change')); }
              }, { sel: v.refSel, rank: RANK[tier] });
              try { await v.prep(); } catch (e) { cells.push({ id: `app/${tag}/${v.key}`, assertions: { open: R(STATUS.FAIL, 'harness', null, null, redact(String(e)).split('\n')[0].slice(0, 200)) } }); continue; }
              for (const [w, h] of viewports) {
                await rp.setViewportSize({ width: w, height: h }); await cp.setViewportSize({ width: w, height: h });
                await settle(rp, v.refSel); await settle(cp, null);
                const id = `app/${tag}/${v.key}/${w}x${h}`;
                // candidate screenshot masks the persona e-mail; probe never returns text beyond 40 chars of labels
                await doCell({
                  id, refPage: rp, candPage: cp,
                  refProbe: { kind: 'app', rootSel: v.refSel }, candProbe: { kind: 'app' },
                  refShotOpts: { element: v.refSel }, candShotOpts: { fullPage: false, mask }, statsHeight: 0,
                  pre: async () => ({ darkCand: await measureSurface(cp, browser, v.key === 'creator' ? 'creator' : 'app', { fullPage: false }) }),
                  assert: (r, c, px, extra) => appAssertions(r, c, px, locale, v.key, tier, extra),
                });
              }
            }
          }
          await rctx.close(); await cctx.close();
        }
        // redact any accidental persona text in the collected cells
        const txt = redact(JSON.stringify(cells));
        cells.splice(0, cells.length, ...JSON.parse(txt));
      }
    }
  } finally {
    await browser.close();
  }

  // cloud-fix4b: --record-palette-base <file> writes the measured app palette inventory of THIS run (point --base-url at
  // the base c65f742 build) in the app-palette-base.json cell shape; the committed policy is then regenerated from it.
  if (args['record-palette-base']) {
    const inv = {};
    for (const c of cells) if (c.id.startsWith('app/') && c.pixels) inv[c.id] = { purpleFrac: c.pixels.cand.purpleFrac, tealFrac: c.pixels.cand.tealFrac, violetEls: c.violetEls || [], violetComps: c.pixels.cand.violet.comps };
    writeJson(path.resolve(String(args['record-palette-base'])), { base: base, buildSha: sha, generatedAt: new Date().toISOString(), command: process.argv.slice(1).join(' '), cells: inv });
  }
  // cloud-fix4: app palette judged against the measured base c65f742, not the teal reference (fidelity/appPaletteBase.mjs)
  applyAppPaletteBase(cells, undefined, { PASS: STATUS.PASS, FAIL: STATUS.FAIL, NOT_TESTED: STATUS.NOT_TESTED });
  const totals = { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
  const byAssertion = {};
  const failures = [];
  for (const c of cells) for (const [k, v] of Object.entries(c.assertions || {})) {
    totals[v.status] += 1;
    const surface = c.id.split('/')[0];
    const key = `${surface}.${k}`;
    byAssertion[key] ||= { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
    byAssertion[key][v.status] += 1;
    if (v.status === STATUS.FAIL) failures.push({ cell: c.id, assertion: k, cand: v.cand, composite: c.composite });
  }
  const result = { kind: 'task16-design-fidelity', base, candidateSha: sha, loadedInTab: loaded, referenceDir: refDir, generatedAt: new Date().toISOString(), viewports: viewports.map((v) => v.join('x')), totals, byAssertion, failures, errors, cells };
  const file = writeJson(path.join(out, 'fidelity-matrix.json'), result);
  return { file, totals, byAssertion, failures: failures.length, errors: errors.length };
}

if (isMain(import.meta.url)) {
  runFidelity(parseArgs()).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = r.totals.FAIL ? 1 : 0;
  }).catch((e) => { console.error(String(e && e.message ? e.message : e).slice(0, 400)); process.exitCode = 2; });
}
