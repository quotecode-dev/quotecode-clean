// Task 16 - DARK SCOPE: per-region light/dark measurement with an explicit, provenance-bearing allowlist
// (dark-scope-policy.json). Used by dark-scope-gate.mjs and by fidelity-compare.mjs (backgroundLight assertions).
// A region is measured twice: CSS (effective background luminance) and pixels (screenshot inside the region minus the
// masked rects = policy-allowed dark regions + embedded media). Only policy regions are ever masked.
// cloud-fix4b (A18, A17 F4): plus one '<surface>.dark-pockets' row per surface - every connected SOLID dark area of the
// screenshot outside the approved regions / content media (img, picture, video, canvas, iframe; CSS url() images only
// when allowlisted with provenance) / UA gutter is attributed to what paints it (dark-scope-policy.json
// 'pockets'): accent-filled controls, glyph ink and small icons are content; a dark surface, a near-black control or
// dark pixels painted by no dark background FAIL, whatever share of their region they cover.
import { IN_PAGE_COLOR_LIB, readPolicy, pixelStats, darkPockets } from './common.mjs';

export const DARK_POLICY = readPolicy('dark-scope-policy.json');
const POCKET = DARK_POLICY.pockets;
const DARK_LUMA = DARK_POLICY.classification.pixelDarkLuma;
const ICON_MAX_PX = POCKET.iconMaxPx;
const CSS_IMAGE_ALLOW_SELECTORS = (POCKET.cssImageAllowlist || []).map((a) => a.selector);
const MEDIA_ALLOW_SELECTORS = (POCKET.mediaAllowlist || []).map((a) => a.selector);

export const REGION_PROBE_SOURCE = String.raw`({ regions }) => {
  ${IN_PAGE_COLOR_LIB}
  const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, vx: r.left, vy: r.top }; };
  const claimed = new Set();
  const found = [];
  const add = (reg, el, sel, suffix) => {
    const cs = getComputedStyle(el);
    const eff = __effBg(el);
    const media = [...el.querySelectorAll('img, video, picture, canvas, iframe')].filter((m) => __vis(m) && m.getBoundingClientRect().width * m.getBoundingClientRect().height >= 400).map(docRect);
    found.push({ id: reg.id + (suffix || ''), regionId: reg.id, rule: reg.rule, sel, cls: (el.tagName + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70), rect: docRect(el), position: cs.position, cssBg: eff.css, cssFrom: eff.from, cssRelLum: +__relLum(eff.color).toFixed(4), media });
    claimed.add(el);
  };
  const heroOf = () => {
    const h1 = [...document.querySelectorAll('h1')].find(__vis); if (!h1) return null;
    const docH = Math.max(document.documentElement.scrollHeight, 1);
    let best = null; let last = null;
    for (let e = h1.parentElement; e && e !== document.body; e = e.parentElement) { const r = e.getBoundingClientRect(); if (e.tagName === 'MAIN' || r.height > 0.4 * docH) break; last = e; if (r.height >= 300) { best = e; if (e.tagName === 'SECTION') break; } }
    return best || last;
  };
  const deferred = [];
  for (const reg of regions) {
    let done = false;
    for (const sel of reg.selectors) {
      if (sel === '@sections') { deferred.push(reg); done = true; break; }
      if (sel === '@page') {
        const el = document.body;
        const W = Math.max(document.documentElement.scrollWidth, innerWidth); const H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const eff = __effBg(document.body).color.a ? __effBg(document.body) : __effBg(document.documentElement);
        found.push({ id: reg.id, regionId: reg.id, rule: reg.rule, sel, cls: 'BODY', rect: { x: 0, y: 0, w: W, h: H, vx: -scrollX, vy: -scrollY }, position: 'static', cssBg: eff.css, cssFrom: eff.from, cssRelLum: +__relLum(eff.color).toFixed(4), media: [...el.querySelectorAll('img, video, picture, canvas, iframe')].filter((m) => __vis(m) && m.getBoundingClientRect().width * m.getBoundingClientRect().height >= 400).map(docRect) });
        done = true; break;
      }
      if (sel === '@hero') { const h = heroOf(); if (h && __vis(h)) { add(reg, h, sel); done = true; break; } continue; }
      if (sel.startsWith('@each ')) { const els = [...document.querySelectorAll(sel.slice(6))].filter(__vis); els.forEach((e, i) => add(reg, e, sel, '#' + (i + 1))); if (els.length) { done = true; break; } continue; }
      const el = [...document.querySelectorAll(sel)].find(__vis);
      if (el) { add(reg, el, sel); done = true; break; }
    }
    if (!done) found.push({ id: reg.id, regionId: reg.id, rule: reg.rule, absent: true, tried: reg.selectors });
  }
  for (const reg of deferred) {
    let secs = [...document.querySelectorAll('main > section')].filter((e) => __vis(e) && !claimed.has(e));
    if (!secs.length) { const m = document.querySelector('main'); const wrap = m && (m.children.length === 1 ? m.children[0] : m); secs = wrap ? [...wrap.children].filter((e) => __vis(e) && e.getBoundingClientRect().height >= 200 && !claimed.has(e) && ![...claimed].some((c) => c.contains(e) || e.contains(c))) : []; }
    secs.forEach((e, i) => add(reg, e, '@sections', '#' + (e.id || (String(e.className).split(' ').filter(Boolean).pop() || 'n') + '-' + (i + 1))));
    if (!secs.length) found.push({ id: reg.id, regionId: reg.id, rule: reg.rule, absent: true, tried: reg.selectors });
  }
  // --- page-level inputs of the dark-POCKET rule (cloud-fix4b) ---------------------------------------------------
  const fixedIn = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed') return true; } return false; };
  const lumaOf = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const CONTROL = 'a[href], button, [role="button"], [role="tab"], [role="link"], [role="menuitem"], input, select, textarea, summary, label';
  const media = [];
  const painters = [];
  const icons = [];
  const textLines = [];
  const CSS_IMAGE_ALLOW = ${JSON.stringify(CSS_IMAGE_ALLOW_SELECTORS)};
  const MEDIA_ALLOW = ${JSON.stringify(MEDIA_ALLOW_SELECTORS)};
  const matchesAny = (e, list) => list.some((sel) => { try { return e.matches(sel); } catch { return false; } });
  const elName = (e) => (e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).trim().split(/\s+/).slice(0, 2).join('.')).slice(0, 60);
  // the control's OWN paint-overflow RINGS (cloud-fix4b K5): outline (width + max(0, offset)) and every non-inset
  // box-shadow (|offset| + blur + spread), each with its own colour (chroma / luma / alpha) so a ring is judged by colour
  const ringsOf = (el) => {
    const cs2 = getComputedStyle(el);
    const out = [];
    const col = (str) => { const k = __parseColor(str); if (!k) return null; return { chroma: +((Math.max(k.r, k.g, k.b) - Math.min(k.r, k.g, k.b)) / 255).toFixed(3), luma: +lumaOf(k).toFixed(3), alpha: k.a }; };
    if (cs2.outlineStyle !== 'none' && parseFloat(cs2.outlineWidth) > 0) {
      const c2 = col(cs2.outlineColor);
      if (c2) out.push({ kind: 'outline', ext: Math.ceil((parseFloat(cs2.outlineWidth) || 0) + Math.max(0, parseFloat(cs2.outlineOffset) || 0)), ...c2 });
    }
    if (cs2.boxShadow && cs2.boxShadow !== 'none') {
      for (const sh of cs2.boxShadow.split(/,(?![^(]*\))/)) {
        if (/inset/.test(sh)) continue;
        const cm = sh.match(/rgba?\([^)]*\)|color\([^)]*\)/);
        const n = (sh.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map((v) => parseFloat(v));
        const c2 = cm ? col(cm[0]) : null;
        if (c2) out.push({ kind: 'box-shadow', ext: Math.ceil(Math.max(Math.abs(n[0] || 0), Math.abs(n[1] || 0)) + (n[2] || 0) + (n[3] || 0)), ...c2 });
      }
    }
    return out.filter((r) => r.ext > 0);
  };
  // every control whose OWN paint overflows its box (focus ring / outline / box-shadow), with those rings
  const controls = [];
  for (const el of document.querySelectorAll(CONTROL)) { if (!__vis(el)) continue; const rings = ringsOf(el); if (rings.length) controls.push({ ...docRect(el), rings, el: elName(el) }); }
  let cssImages = 0;
  let unlistedMedia = 0;
  let maxFontPx = 0;
  for (const e of document.querySelectorAll('html, body, body *')) {
    if (!__vis(e)) continue;
    const tag = e.tagName.toLowerCase();
    const cs = getComputedStyle(e);
    const ctl = e.closest(CONTROL);
    const ctlInfo = () => { const cr = ctl.getBoundingClientRect(); return { tag: ctl.tagName.toLowerCase(), h: Math.round(cr.height), w: Math.round(cr.width), box: docRect(ctl) }; };
    if (['img', 'video', 'picture', 'canvas', 'iframe'].includes(tag)) {
      // cloud-fix4b K1r (A17): content media are excluded only inside a provenance-bearing container (pockets.mediaAllowlist);
      // any other img/video/picture/canvas/iframe paints its box like a fill and is judged like one ('media').
      if (matchesAny(e, MEDIA_ALLOW)) { const r = e.getBoundingClientRect(); if (r.width * r.height >= 400) media.push({ ...docRect(e), fixed: fixedIn(e), tag }); continue; }
      unlistedMedia += 1;
      painters.push({ ...docRect(e), dark: true, media: tag, el: elName(e), bg: tag + ' (not an allowlisted content-media container)', control: ctl ? ctlInfo() : null });
      continue;
    }
    if (tag === 'svg') { const r = e.getBoundingClientRect(); if (r.width <= ${ICON_MAX_PX} && r.height <= ${ICON_MAX_PX}) icons.push({ ...docRect(e), fixed: fixedIn(e) }); continue; }
    if (e.closest('svg')) continue;
    const texts = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (texts.length) {
      maxFontPx = Math.max(maxFontPx, parseFloat(cs.fontSize) || 0);
      // cloud-fix4b K6: block elements (U+2580-U+259F) and geometric shapes (U+25A0-U+25FF) are drawn fills, not text:
      // line boxes are built only over runs of the other characters, so their ink is never credited as text
      const fontPx = parseFloat(cs.fontSize) || 0;
      for (const t of texts) {
        if (textLines.length >= 8000) break;
        const str = t.textContent;
        const runs = [];
        let i0 = -1;
        for (let i = 0; i <= str.length; i += 1) {
          const shape = i < str.length && /[\u2580-\u259F\u25A0-\u25FF]/.test(str[i]);
          if (i < str.length && !shape) { if (i0 < 0) i0 = i; } else if (i0 >= 0) { runs.push([i0, i]); i0 = -1; }
        }
        for (const [r0, r1] of runs) {
          if (!str.slice(r0, r1).trim()) continue;
          const rg = document.createRange(); rg.setStart(t, r0); rg.setEnd(t, r1);
          for (const q of rg.getClientRects()) if (q.width >= 1 && q.height >= 1) textLines.push({ x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height, vx: q.left, vy: q.top, fontPx });
        }
      }
    }
    const bgUrl = /url\(/.test(cs.backgroundImage);
    const c = __parseColor(cs.backgroundColor);
    const grads = __gradientColors(cs.backgroundImage);
    const opaque = (c && c.a > 0.5) || grads.length > 0 || bgUrl;
    // cloud-fix4b K1 (A17): a CSS url() background is NOT media by default (pockets.cssImageAllowlist, empty).
    if (bgUrl && matchesAny(e, CSS_IMAGE_ALLOW)) { media.push({ ...docRect(e), fixed: fixedIn(e), tag: tag + '(css-image, allowlisted)' }); continue; }
    if (bgUrl) cssImages += 1;
    if (!opaque) continue;
    // cloud-fix4b K3 (A17): every element with an opaque background is a painter (light ones too): a dark pixel is credited
    // to the topmost painter at that pixel, so a dark pixel over a LIGHT painter is not a background (ink / border / shadow)
    const dark = bgUrl || (c && c.a > 0.5 && lumaOf(c) < ${DARK_LUMA}) || grads.some((g) => lumaOf(g) < ${DARK_LUMA});
    const fill = c && c.a > 0.5 && lumaOf(c) < ${DARK_LUMA} ? c : grads.filter((g) => lumaOf(g) < ${DARK_LUMA}).sort((x, y) => lumaOf(x) - lumaOf(y))[0];
    painters.push({ ...docRect(e), fixed: fixedIn(e), dark, cssImage: bgUrl, chroma: dark && fill ? +((Math.max(fill.r, fill.g, fill.b) - Math.min(fill.r, fill.g, fill.b)) / 255).toFixed(3) : null, el: elName(e), bg: c && c.a > 0.5 ? cs.backgroundColor : cs.backgroundImage.slice(0, 60), control: ctl ? ctlInfo() : null });
  }
  // UA scrollbar gutter (classic scrollbars in headless Chromium; html scrollbar-gutter: stable): the strip between the
  // root's client box and the window edge paints the html/body colour. A harness/UA artefact, not page content (A17 log 34;
  // present in base too); overlay-scrollbar phones have none. Excluded from the pocket search, never from region stats.
  // Measured as the part of the window outside the root element's box (clientWidth reports the full window under
  // scrollbar-gutter: stable in this Chromium); only a scrollbar-sized strip (<= GUTTER_MAX_PX) is treated as a gutter.
  const rr = document.documentElement.getBoundingClientRect();
  const gutterW = Math.round(innerWidth - rr.width);
  const gutter = gutterW > 0 && gutterW <= ${POCKET.gutterMaxPx} ? (rr.left >= 1 ? { side: 'left', x: 0, w: Math.round(rr.left) } : { side: 'right', x: Math.round(rr.right), w: gutterW }) : null;
  return { vw: innerWidth, vh: innerHeight, scrollY, docH: document.documentElement.scrollHeight, regions: found, media, painters, icons, textLines, controls, maxFontPx, gutter, cssImages, unlistedMedia };
}`;

const C = DARK_POLICY.classification;
const isDarkRule = (rule) => rule === 'dark-allowed' || rule === 'dark-required' || rule === 'dark-unresolved';
const intersect = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

export function classify(cssRelLum, px) {
  const cssDark = cssRelLum < C.cssDarkBelowRelLum;
  const cssLight = cssRelLum >= C.cssLightFromRelLum;
  if (!px || !px.n) return cssDark ? 'dark' : cssLight ? 'light(css-only)' : 'mixed';
  if (cssDark || px.darkFrac >= C.pixelDarkFromFrac) return 'dark';
  if (cssLight && px.darkFrac <= C.lightMaxDarkFrac && px.meanLuma >= C.lightMinMeanLuma) return 'light';
  return 'mixed';
}

// Measure the regions of one surface on the current page state.
//   fullPage: true -> document coordinates on a full-page screenshot; false -> the visible viewport only (fixed shells).
export async function measureSurface(page, browser, surface, { fullPage = true, maxHeight = 16000 } = {}) {
  const regions = DARK_POLICY.regions.filter((r) => r.surface === surface);
  const probe = await page.evaluate(`(${REGION_PROBE_SOURCE})(${JSON.stringify({ regions })})`);
  const vp = page.viewportSize();
  let shot;
  let toShot;
  if (fullPage) {
    const H = Math.min(probe.docH, maxHeight);
    shot = await page.screenshot({ fullPage: true, animations: 'disabled', clip: { x: 0, y: 0, width: vp.width, height: H }, timeout: 60000 });
    toShot = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h });
  } else {
    shot = await page.screenshot({ fullPage: false, animations: 'disabled', timeout: 60000 });
    toShot = (r) => ({ x: r.vx, y: r.vy, w: r.w, h: r.h });
  }
  const frame = fullPage ? { x: 0, y: 0, w: vp.width, h: Math.min(probe.docH, maxHeight) } : { x: 0, y: 0, w: vp.width, h: vp.height };
  const present = probe.regions.filter((r) => !r.absent);
  const darkAllowedRects = present.filter((r) => isDarkRule(r.rule)).map((r) => ({ id: r.id, ...toShot(r.rect) }));
  const rects = [];
  for (const r of present) {
    const R = toShot(r.rect);
    // clip to the screenshot frame
    const x0 = Math.max(R.x, frame.x); const y0 = Math.max(R.y, frame.y);
    const x1 = Math.min(R.x + R.w, frame.x + frame.w); const y1 = Math.min(R.y + R.h, frame.y + frame.h);
    r.visibleRect = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    if (x1 - x0 < 2 || y1 - y0 < 2) { r.outOfFrame = true; continue; }
    const exclude = [];
    r.masked = [];
    if (!isDarkRule(r.rule)) {
      for (const d of darkAllowedRects) if (d.id !== r.id && intersect(d, R)) { exclude.push(d); r.masked.push(d.id); }
    }
    for (const m of r.media) { exclude.push(toShot(m)); }
    if (r.media.length) r.masked.push(`media x${r.media.length}`);
    rects.push({ id: r.id, x: x0, y: y0, w: x1 - x0, h: y1 - y0, exclude });
  }
  const stats = await pixelStats(browser, shot, rects, { darkLuma: C.pixelDarkLuma });
  const pockets = await measurePockets(browser, shot, probe, { fullPage, frame, present, toShot });
  for (const r of present) {
    r.pixels = stats[r.id] || null;
    // visibleOnly (policy): the page canvas is judged by what is VISIBLE. The html/body colour behind a page that paints its
    // own full-height background (base c65f742 index.html #050506, restored as ledger M10) is not seen; visible dark pixels
    // still FAIL. Only '@page' regions may carry this flag.
    const pol = DARK_POLICY.regions.find((p) => p.id === r.regionId);
    const visibleOnly = !!(pol?.visibleOnly && r.sel === '@page');
    if (visibleOnly) r.cssIgnored = `${r.cssBg} (${r.cssFrom || 'body'}) not visible - judged on pixels`;
    r.verdict = r.outOfFrame ? 'out-of-frame' : classify(visibleOnly ? 1 : r.cssRelLum, r.pixels);
  }
  return { surface, vw: probe.vw, vh: probe.vh, fullPage, regions: probe.regions, pockets };
}

// Window size S of the pocket opening for a surface whose largest visible text is maxFontPx: S must exceed the thickest
// glyph stroke on the surface (heavy weights: stem <= ~0.2 em; strokeEm 0.25 adds margin), never below minWindowPx.
export function pocketWindow(maxFontPx, p = POCKET) {
  return Math.max(p.minWindowPx, Math.ceil(((maxFontPx || 0) * p.strokeEm) / p.blockPx) * p.blockPx);
}

// Map a probe rect to screenshot pixels: document coordinates on a full-page shot (Chromium captures beyond the viewport
// without resizing it, so a fixed element - e.g. the AI chat launcher - is drawn at its scroll-0 document position, which
// is what docRect records), viewport coordinates on a viewport shot.
function shotRect(r, { fullPage }) {
  return fullPage ? { x: r.x, y: r.y, w: r.w, h: r.h } : { x: r.vx, y: r.vy, w: r.w, h: r.h };
}
const inside = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

// Spatial index of painters (screenshot px): each tile lists the painters overlapping it, smallest first, so the first
// one containing a point is the smallest = topmost painter there (nested backgrounds paint over their ancestors).
export function painterIndex(painters, tile = 128) {
  const sorted = [...painters].sort((a, b) => a.w * a.h - b.w * b.h);
  const tiles = new Map();
  for (const r of sorted) {
    for (let ty = Math.floor(r.y / tile); ty <= Math.floor((r.y + r.h) / tile); ty += 1) for (let tx = Math.floor(r.x / tile); tx <= Math.floor((r.x + r.w) / tile); tx += 1) {
      const k = `${tx},${ty}`; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(r);
    }
  }
  return { at: (pt) => (tiles.get(`${Math.floor(pt.x / tile)},${Math.floor(pt.y / tile)}`) || []).find((r) => inside(pt, r)) || null };
}

const BAD = { surface: 'dark-painted element outside every approved dark region', 'css-image': 'dark area painted by a CSS url() background that is not on pockets.cssImageAllowlist (judged like a solid fill)', media: 'img/video/picture/canvas/iframe outside every provenance-bearing content-media container (pockets.mediaAllowlist): judged like a solid fill', 'black-control': 'control filled with a near-black ink colour (chroma < inkMaxChroma): black on screen', unpainted: 'dark pixels over no dark background, not inside one text line, an icon or a control\'s own outline/shadow ring (border / box-shadow / pseudo-element / large svg)' };

// Attribute EVERY block of one pocket to what paints it (pure; unit-tested). cloud-fix4b K3 (A17): the former seed-only
// attribution credited a whole merged component to the painter under its top-most point (a dark strip touching the
// selected accent tab passed as 'control'). Per block (g x g, centre point), the topmost OPAQUE painter decides:
//   dark painter:  accent control (chroma >= inkMaxChroma; the painter is the control or inside it) -> control (approved:
//                  only blocks inside that painter's own box); near-black control -> black-control; url() background ->
//                  css-image; un-allowlisted media -> media; any other element -> surface   (all but control FAIL)
//   no dark painter on top (light painter or none) - the dark pixel is not a background:
//                  inside an inline svg <= iconMaxPx -> icon; inside the paint-overflow RING of a control (outside its
//                  border box, within the extent of one of its OWN outline / box-shadow rings that is opaque, ACCENT-
//                  coloured and <= ringMaxPx: a focus ring) -> control (a block straddling such an edge or an accent
//                  control's edge is credited by overlap: 4px quantisation, <= 2px); inside an opaque near-black ring
//                  -> black-control;
//                  otherwise ink: approved as text only when all such ink blocks of the pocket lie inside ONE text line
//                  box (grown by max(2px, h/4); block / geometric-shape glyphs never form line boxes) and span <= 1 em,
//                  else unpainted (FAIL).
// The pocket is approved only when no block is unapproved. parts = area per kind; painters = the failing elements.
export function attributeBlocks(pocket, { painters = [], icons = [], textLines = [], controls = [] }, p = POCKET) {
  const idx = painterIndex(painters);
  const accent = (r) => r.control && r.chroma != null && r.chroma >= p.inkMaxChroma;
  // the paint OVERFLOW ring of every control (between its border box and the box grown by its own outline / box-shadow)
  const accentBoxes = painters.filter((r) => r.dark && accent(r));
  // cloud-fix4b K5: a ring is the control's own focus ring / outline only when it is opaque (alpha > 0.5), ACCENT-coloured
  // (chroma >= inkMaxChroma) and no wider than ringMaxPx; an opaque near-black ring of any width is black-control
  const grow = (r, e) => ({ x: r.x - e, y: r.y - e, w: r.w + 2 * e, h: r.h + 2 * e });
  const rings = []; const inkRings = [];
  for (const r of controls) for (const ring of r.rings || []) {
    if (ring.alpha <= 0.5) continue;
    if (ring.chroma >= p.inkMaxChroma && ring.ext <= p.ringMaxPx) rings.push({ box: r, grown: grow(r, ring.ext) });
    else if (ring.chroma < p.inkMaxChroma && ring.luma < C.pixelDarkLuma) inkRings.push({ box: r, grown: grow(r, ring.ext), el: r.el });
  }
  const g = pocket.blockPx || p.blockPx;
  const parts = {};
  const bad = new Map();
  const ink = [];
  const add = (k, n = 1) => { parts[k] = (parts[k] || 0) + n * g * g; };
  for (const c of pocket.cells) {
    const pt = { x: c.x + g / 2, y: c.y + g / 2 };
    const top = idx.at(pt);
    if (top && top.dark) {
      let k;
      if (top.media) k = 'media';
      else if (top.cssImage) k = 'css-image';
      else if (top.control && top.chroma != null && top.chroma < p.inkMaxChroma) k = 'black-control';
      else if (accent(top)) k = 'control';
      else k = 'surface';
      add(k);
      if (k !== 'control') { const key = `${k}|${top.el}`; bad.set(key, (bad.get(key) || 0) + 1); }
      continue;
    }
    if (icons.some((r) => inside(pt, r))) { add('icon'); continue; }
    // 4px quantisation: a block straddling the edge of an accent control or of a control's ring (antialiased edges, a
    // 1-2px gap between a focus ring and the next control) is credited by overlap, not by its centre (<= g/2 = 2px)
    const B = { x: c.x, y: c.y, w: g, h: g };
    if (accentBoxes.some((r) => overlaps(B, r)) || rings.some((r) => overlaps(B, r.grown) && !within(B, r.box))) { add('control'); continue; }
    const inkRing = inkRings.find((r) => inside(pt, r.grown) && !inside(pt, r.box));
    if (inkRing) { add('black-control'); const key = `black-control|${inkRing.el} (ring)`; bad.set(key, (bad.get(key) || 0) + 1); continue; }
    ink.push(pt);
  }
  if (ink.length) {
    const xs = ink.map((q) => q.x); const ys = ink.map((q) => q.y);
    const bb = { x0: Math.min(...xs) - g / 2, y0: Math.min(...ys) - g / 2, x1: Math.max(...xs) + g / 2, y1: Math.max(...ys) + g / 2 };
    // cloud-fix4b K6: glyph ink is text only when it fits ONE line box AND is no wider / taller than one em of that line
    // (+ one block of grid quantisation): solid ink cannot cross a glyph's side bearings, so a run of glyphs never forms
    // one solid pocket wider than a glyph; a bar drawn with glyphs does
    const line = textLines.find((r) => { const t = Math.max(2, r.h / 4); const em = (r.fontPx || r.h) + g; return bb.x0 >= r.x - t && bb.y0 >= r.y - t && bb.x1 <= r.x + r.w + t && bb.y1 <= r.y + r.h + t && bb.x1 - bb.x0 <= em && bb.y1 - bb.y0 <= em; });
    if (line) add('text', ink.length);
    else { add('unpainted', ink.length); bad.set('unpainted|-', ink.length); }
  }
  const failing = [...bad.entries()].map(([k, n]) => { const [kind, el] = k.split('|'); return { kind, el: el === '-' ? null : el, area: n * g * g, why: BAD[kind] }; }).sort((x, y) => y.area - x.area);
  const approvedKinds = Object.keys(parts).filter((k) => ['control', 'icon', 'text'].includes(k));
  const primary = failing[0] ? failing[0].kind : approvedKinds.sort((x, y) => parts[y] - parts[x])[0];
  return { kind: primary, approved: failing.length === 0, el: failing[0] ? failing[0].el : null, parts, failing, why: failing[0] ? failing[0].why : `approved: ${approvedKinds.join(' + ')}` };
}

async function measurePockets(browser, shot, probe, { fullPage, frame, present, toShot }) {
  const geo = { fullPage };
  const S = pocketWindow(probe.maxFontPx);
  const approved = present.filter((r) => isDarkRule(r.rule)).map((r) => ({ id: r.id, ...toShot(r.rect) }));
  const media = probe.media.map((m) => shotRect(m, geo));
  const gutter = probe.gutter ? [{ x: probe.gutter.x, y: 0, w: probe.gutter.w, h: frame.h }] : [];
  const res = await darkPockets(browser, shot, { darkLuma: C.pixelDarkLuma, S, g: POCKET.blockPx, excludes: [...approved, ...media, ...gutter], withCells: true });
  const painters = probe.painters.map((r) => ({ ...r, ...shotRect(r, geo), ...(r.control ? { control: { ...r.control, box: shotRect(r.control.box, geo) } } : {}) }));
  const icons = probe.icons.map((r) => ({ ...r, ...shotRect(r, geo) }));
  const textLines = probe.textLines.map((r) => shotRect(r, geo));
  const controls = probe.controls.map((r) => ({ ...r, ...shotRect(r, geo) }));
  const regionAt = (pt) => present.filter((r) => r.visibleRect && inside(pt, toShot(r.rect))).sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h).map((r) => r.id).find((id) => !/\.page$|\.canvas$/.test(id)) || null;
  const frameW = frame.w - (probe.gutter ? probe.gutter.w : 0);
  const list = res.pockets.map((pk) => {
    const a = attributeBlocks({ ...pk, blockPx: res.g }, { painters, icons, textLines, controls });
    return { x: pk.x, y: pk.y, w: pk.w, h: pk.h, area: pk.area, widthFrac: +(pk.w / Math.max(frameW, 1)).toFixed(3), region: regionAt(pk.seed), ...a };
  });
  return {
    S: res.S, blockPx: res.g, maxFontPx: probe.maxFontPx, frame: { w: frame.w, h: frame.h }, gutter: probe.gutter,
    excluded: { approvedRegions: approved.map((r) => r.id), media: media.length, mediaTags: [...new Set(probe.media.map((m) => m.tag))], gutter: !!probe.gutter }, cssImagePainters: probe.cssImages, unlistedMedia: probe.unlistedMedia, painters: probe.painters.length,
    unapproved: list.filter((x) => !x.approved), approved: list.filter((x) => x.approved).slice(0, 12), approvedCount: list.filter((x) => x.approved).length,
    approvedByKind: list.filter((x) => x.approved).reduce((m, x) => { for (const k of Object.keys(x.parts)) m[k] = (m[k] || 0) + 1; return m; }, {}),
  };
}

// Status of each region of a subject measurement; `baseline` (same surface/locale/viewport on base c65f742) is optional.
export function evaluateRegions(subject, baseline, STATUS) {
  const out = [];
  const baseById = new Map((baseline?.regions || []).map((r) => [r.id, r]));
  const baseByRegion = new Map((baseline?.regions || []).filter((r) => !r.absent).map((r) => [r.regionId, r]));
  for (const r of subject.regions) {
    const pol = DARK_POLICY.regions.find((p) => p.id === r.regionId);
    const b = baseById.get(r.id) || baseByRegion.get(r.regionId) || null;
    const baseVerdict = b ? (b.absent ? 'absent' : b.verdict) : (baseline ? 'absent' : 'not measured');
    const row = { id: r.id, rule: r.rule, provenance: pol?.provenance || [], selector: r.sel || null, el: r.cls || null, verdict: r.absent ? 'absent' : r.verdict, cssBg: r.cssBg || null, cssRelLum: r.cssRelLum ?? null, cssIgnored: r.cssIgnored || null, pixels: r.pixels || null, masked: r.masked || [], base: baseVerdict };
    if (r.absent) { row.status = 'ABSENT'; row.note = `no element for ${r.tried.join(' | ')}`; out.push(row); continue; }
    if (r.verdict === 'out-of-frame') { row.status = 'ABSENT'; row.note = 'outside the measured frame'; out.push(row); continue; }
    const dark = r.verdict === 'dark';
    const light = r.verdict === 'light' || r.verdict === 'light(css-only)';
    if (r.rule === 'light') {
      row.status = light ? STATUS.PASS : STATUS.FAIL;
      row.note = light ? 'light' : `${r.verdict} where the policy requires light (no Owner/base/reference allowance)`;
    } else if (r.rule === 'dark-unresolved') {
      // dark without Owner or base authority (reference only): never a PASS while dark - UNRESOLVED until the Owner decides
      row.status = light ? STATUS.PASS : STATUS.FAIL;
      row.note = light ? 'light' : `${r.verdict} - UNRESOLVED: dark only by the reference (no Owner/base authority); Owner decision required`;
    } else if (r.rule === 'dark-required') {
      row.status = dark ? STATUS.PASS : STATUS.FAIL;
      row.note = dark ? 'dark (Owner-required)' : `${r.verdict} where the Owner requires dark on screen`;
      // informational only: an Owner-required dark region needs no base precedent
      if (pol?.requireBaseDark && baseline) row.note += baseVerdict === 'dark' ? '; also dark in base c65f742' : `; ${baseVerdict} in base c65f742 (Owner-required, not a base allowance)`;
    } else {
      row.status = STATUS.PASS;
      row.note = dark ? 'dark - allowed by provenance' : `${r.verdict} (dark allowed, not required)`;
      if (pol?.requireBaseDark && dark && baseline) {
        if (baseVerdict !== 'dark') { row.status = STATUS.FAIL; row.note = `dark now but ${baseVerdict} in base c65f742: a Task-16 darkening, not a preserved region (allowance void)`; }
        else row.note += '; verified dark in base c65f742';
      }
    }
    if (dark && baseline && baseVerdict !== 'dark') row.newDarkVsBase = true;
    out.push(row);
  }
  if (subject.pockets) out.push(pocketRow(subject.surface, subject.pockets, STATUS));
  return out;
}

// One row per measured surface: no unapproved dark pocket (cloud-fix4b, A17 F4). FAILS on any pocket that is not an
// approved dark region (masked), embedded media (masked), an accent-filled control, glyph ink inside a text line or a small icon.
export function pocketRow(surface, pk, STATUS) {
  const bad = pk.unapproved;
  const desc = (x) => `${x.kind} ${x.w}x${x.h}@${x.x},${x.y} area ${x.area}px2 (${Math.round(x.widthFrac * 100)}% width)${x.el ? ` ${x.el}` : ''}${x.region ? ` in ${x.region}` : ''}`;
  return {
    id: `${surface}.dark-pockets`, rule: 'no-unapproved-dark-pocket', provenance: ['OWNER-BLACK-SCOPE-2026-10-05', 'OWNER-NO-AUTO-BLACKEN'], selector: '@screenshot', el: null,
    verdict: bad.length ? 'dark-pocket' : 'none', status: bad.length ? STATUS.FAIL : STATUS.PASS,
    note: bad.length ? `unapproved dark pocket(s) (solid >= ${pk.S}x${pk.S}px): ${bad.slice(0, 4).map(desc).join('; ')}` : `no unapproved solid dark area >= ${pk.S}x${pk.S}px (${pk.approvedCount} approved: ${Object.entries(pk.approvedByKind || {}).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`,
    pixels: null, masked: pk.excluded.approvedRegions, pockets: pk,
  };
}
