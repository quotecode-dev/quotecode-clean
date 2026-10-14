// @vitest-environment node
// Task 16 cloud-fix4b (A18): dark-pocket rule (A17 F4) + light footer policy (Codex review of 5117916, item 1).
import { describe, it, expect } from 'vitest';
import { solidDarkComponents } from './common.mjs';
import { DARK_POLICY, pocketWindow, attributeBlocks, pocketRow, evaluateRegions } from './darkscope.mjs';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_TESTED: 'NOT TESTED' };
const grid = (bw, bh, fill) => { const g = new Uint8Array(bw * bh); for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) g[y * bw + x] = fill(x, y) ? 1 : 0; return g; };

describe('solidDarkComponents (opening by a k x k square)', () => {
  it('thin strokes (text, rules) never form a component', () => {
    // 3-block-wide vertical strokes every 6 blocks + a 1-block horizontal rule: nothing holds a 4x4 square
    const g = grid(60, 40, (x, y) => x % 6 < 3 || y === 20);
    expect(solidDarkComponents(g, 60, 40, 4)).toHaveLength(0);
  });
  it('a solid 5x5-block patch is one component with the opened area', () => {
    const g = grid(30, 30, (x, y) => x >= 10 && x < 15 && y >= 3 && y < 8);
    const c = solidDarkComponents(g, 30, 30, 4);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ x0: 10, y0: 3, x1: 15, y1: 8, blocks: 25 });
  });
  it('withBlocks returns the covered blocks of each component', () => {
    const g = grid(30, 30, (x, y) => x >= 10 && x < 15 && y >= 3 && y < 8);
    expect(solidDarkComponents(g, 30, 30, 4, { withBlocks: true })[0].cells).toHaveLength(25);
  });
  it('a full-width band is one component spanning the width; two separate pockets stay separate', () => {
    const g = grid(50, 40, (x, y) => (y >= 30 && y < 36) || (x < 6 && y < 6));
    const c = solidDarkComponents(g, 50, 40, 4);
    expect(c).toHaveLength(2);
    expect(Math.max(...c.map((k) => k.x1 - k.x0))).toBe(50);
  });
});

describe('pocket window (derived from the largest text on the surface)', () => {
  it('S = max(16, 0.25 em of the largest font, on the 4px grid)', () => {
    expect(pocketWindow(12)).toBe(16);
    expect(pocketWindow(52)).toBe(16);
    expect(pocketWindow(72)).toBe(20);
    expect(pocketWindow(120)).toBe(32);
  });
});

// a pocket covering the given rects (4px blocks), as darkPockets returns it with withCells
const pocketOf = (...rects) => {
  const cells = [];
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y += 4) for (let x = r.x; x < r.x + r.w; x += 4) cells.push({ x, y });
  const xs = cells.map((c) => c.x); const ys = cells.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) + 4 - Math.min(...xs), h: Math.max(...ys) + 4 - Math.min(...ys), blockPx: 4, cells, seed: { x: cells[0].x + 2, y: cells[0].y + 2 } };
};
const tab = (chroma, extra = {}) => ({ x: 100, y: 100, w: 128, h: 56, dark: true, el: 'button.tl-tab', chroma, control: { tag: 'button', w: 128, h: 56, box: { x: 100, y: 100, w: 128, h: 56 }, overflowPx: 0 }, ...extra });

describe('attributeBlocks (every block credited to the topmost opaque painter)', () => {
  it('ACCENT-filled control (teal, chroma 0.243) = approved content, whatever its size', () => {
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 56 }), { painters: [tab(0.243)] })).toMatchObject({ kind: 'control', approved: true });
    const tall = { ...tab(0.243), h: 104, control: { tag: 'button', w: 128, h: 104, box: { x: 100, y: 100, w: 128, h: 104 }, overflowPx: 0 } };
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 104 }), { painters: [tall] }).approved).toBe(true);
  });
  it('NEGATIVE: a control filled with near-black ink (#17272d, chroma 0.086) is black-control', () => {
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 56 }), { painters: [tab(0.086)] })).toMatchObject({ kind: 'black-control', approved: false });
  });
  it('NEGATIVE (A17 K3): a dark strip merged with the selected accent tab FAILS - the tab approves only its own box', () => {
    const strip = { x: 0, y: 156, w: 1048, h: 80, dark: true, el: 'div.strip', chroma: 0.063, control: null };
    const r = attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 56 }, { x: 0, y: 156, w: 1048, h: 80 }), { painters: [tab(0.243), strip] });
    expect(r).toMatchObject({ approved: false, kind: 'surface', el: 'div.strip' });
    expect(r.parts.control).toBe(128 * 56);
    expect(r.parts.surface).toBe(1048 * 80);
  });
  it('K5: an opaque ACCENT focus ring <= ringMaxPx is the control; wider or near-black rings are not', () => {
    const ring = (ext, chroma, luma = 0.2) => ({ x: 100, y: 100, w: 128, h: 56, el: 'a.tl-cta', rings: [{ kind: 'outline', ext, chroma, luma, alpha: 1 }] });
    const strip = (h) => pocketOf({ x: 100, y: 100, w: 128, h: 56 }, { x: 100, y: 156, w: 128, h });
    expect(attributeBlocks(strip(4), { painters: [tab(0.243)], controls: [ring(5, 0.243)] }).approved).toBe(true);
    expect(attributeBlocks(strip(40), { painters: [tab(0.243)], controls: [ring(5, 0.243)] })).toMatchObject({ approved: false, kind: 'unpainted' });
    expect(attributeBlocks(strip(40), { painters: [tab(0.243)], controls: [ring(40, 0.243)] })).toMatchObject({ approved: false, kind: 'unpainted' });
    expect(attributeBlocks(strip(40), { painters: [tab(0.243)], controls: [ring(40, 0.063, 0.1)] })).toMatchObject({ approved: false, kind: 'black-control' });
    const translucent = { ...ring(5, 0.243), rings: [{ kind: 'box-shadow', ext: 5, chroma: 0.243, luma: 0.2, alpha: 0.3 }] };
    expect(attributeBlocks(strip(4), { painters: [tab(0.243)], controls: [translucent] }).approved).toBe(false);
  });
  it('a LIGHT control\'s accent focus ring next to an accent control is the ring; dark pixels INSIDE a light control are not', () => {
    const toggle = { x: 200, y: 100, w: 60, h: 44, el: 'button.tl-menu-toggle', rings: [{ kind: 'outline', ext: 5, chroma: 0.243, luma: 0.34, alpha: 1 }] };
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 96, h: 44 }, { x: 196, y: 100, w: 4, h: 44 }), { painters: [{ ...tab(0.243), w: 96, h: 44, control: { tag: 'a', w: 96, h: 44, box: { x: 100, y: 100, w: 96, h: 44 } } }], controls: [toggle] }).approved).toBe(true);
    expect(attributeBlocks(pocketOf({ x: 204, y: 104, w: 40, h: 32 }), { controls: [toggle] })).toMatchObject({ approved: false, kind: 'unpainted' });
  });
  it('K6: glyph ink wider than one em of its line is not text (a bar drawn with glyphs)', () => {
    const line = { x: 188, y: 400, w: 1050, h: 64, fontPx: 64 };
    expect(attributeBlocks(pocketOf({ x: 200, y: 404, w: 48, h: 48 }), { textLines: [line] })).toMatchObject({ approved: true, kind: 'text' });
    expect(attributeBlocks(pocketOf({ x: 188, y: 400, w: 1048, h: 64 }), { textLines: [line] })).toMatchObject({ approved: false, kind: 'unpainted' });
  });
  it('4px quantisation: a block straddling an accent control edge (centre 2px outside it) is credited by overlap', () => {
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 56 }, { x: 96, y: 100, w: 4, h: 56 }), { painters: [{ ...tab(0.243), x: 98, w: 130 }] }).approved).toBe(true);
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 128, h: 56 }, { x: 80, y: 100, w: 20, h: 56 }), { painters: [{ ...tab(0.243), x: 98, w: 130 }] }).approved).toBe(false);
  });
  it('NEGATIVE: the exposed body canvas / a dark footer is a surface (topmost = smallest painter)', () => {
    const painters = [{ x: 0, y: 0, w: 1440, h: 5000, dark: true, el: 'html.', control: null }, { x: 0, y: 90, w: 1440, h: 200, dark: true, el: 'footer.tl-footer', control: null }];
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 40, h: 24 }), { painters })).toMatchObject({ kind: 'surface', el: 'footer.tl-footer' });
  });
  it('a LIGHT painter on top hides the dark canvas behind it: ink on a white card is text, not the html surface', () => {
    const painters = [{ x: 0, y: 0, w: 1440, h: 5000, dark: true, el: 'html.', control: null }, { x: 50, y: 50, w: 800, h: 800, dark: false, el: 'div.pq-card', control: null }];
    expect(attributeBlocks(pocketOf({ x: 212, y: 476, w: 16, h: 16 }), { painters, textLines: [{ x: 160, y: 466, w: 700, h: 62 }] })).toMatchObject({ kind: 'text', approved: true });
  });
  it('NEGATIVE: dark pixels without a dark background (border / shadow sidebar) are unpainted; ink beyond one line box too', () => {
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 40, h: 24 }), { painters: [] })).toMatchObject({ kind: 'unpainted', approved: false });
    expect(attributeBlocks(pocketOf({ x: 620, y: 156, w: 96, h: 900 }), { textLines: [{ x: 600, y: 150, w: 400, h: 24 }] })).toMatchObject({ kind: 'unpainted', approved: false });
  });
  it('NEGATIVE (A17 K1): a CSS url() background is css-image, control or not', () => {
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 40, h: 24 }), { painters: [{ x: 0, y: 90, w: 860, h: 123, dark: true, el: 'details.', cssImage: true, chroma: null, control: null }] })).toMatchObject({ kind: 'css-image', approved: false });
  });
  it('NEGATIVE (A17 K1r): an img that is not in an allowlisted content-media container paints like a fill', () => {
    expect(attributeBlocks(pocketOf({ x: 188, y: 200, w: 1048, h: 96 }), { painters: [{ x: 188, y: 200, w: 1050, h: 96, dark: true, media: 'img', el: 'img.', control: null }] })).toMatchObject({ kind: 'media', approved: false });
  });
  it('small inline svg icon = approved; a pocket larger than the icon box is not', () => {
    expect(attributeBlocks(pocketOf({ x: 104, y: 104, w: 16, h: 16 }), { icons: [{ x: 100, y: 100, w: 24, h: 24 }] })).toMatchObject({ kind: 'icon', approved: true });
    expect(attributeBlocks(pocketOf({ x: 100, y: 100, w: 40, h: 24 }), { icons: [{ x: 100, y: 100, w: 24, h: 24 }] }).approved).toBe(false);
  });
});

describe('pocket row', () => {
  const base = { S: 16, approvedCount: 2, excluded: { approvedRegions: ['doc.band'] } };
  it('FAILS on any unapproved pocket and PASSES without', () => {
    expect(pocketRow('doc', { ...base, unapproved: [{ kind: 'surface', x: 0, y: 0, w: 390, h: 40, area: 15600, widthFrac: 1, el: 'body.' }] }, STATUS).status).toBe('FAIL');
    expect(pocketRow('doc', { ...base, unapproved: [] }, STATUS).status).toBe('PASS');
  });
  it('evaluateRegions appends the row when the surface carries pockets', () => {
    const rows = evaluateRegions({ surface: 'doc', regions: [], pockets: { ...base, unapproved: [] } }, null, STATUS);
    expect(rows.map((r) => r.id)).toEqual(['doc.dark-pockets']);
  });
});

describe('dark-scope policy (cloud-fix4b)', () => {
  const byId = (id) => DARK_POLICY.regions.find((r) => r.id === id);
  it('landing footer is LIGHT with the Owner provenance; base/reference dark footer provenance is not referenced', () => {
    expect(byId('landing.footer')).toMatchObject({ rule: 'light' });
    expect(byId('landing.footer').provenance).toContain('OWNER-FOOTER-LIGHT-4B');
    const used = DARK_POLICY.regions.flatMap((r) => r.provenance || []);
    for (const k of ['BASE-FOOTER-DARK', 'REF-FOOTER-DARK', 'REF-CLOSING-DARK', 'REF-MG-SIDE-DARK']) {
      expect(used).not.toContain(k);
      expect(DARK_POLICY.provenance[k]).toBeUndefined();
      expect(DARK_POLICY.supersededProvenance[k]).toBeDefined();
    }
  });
  it('every provenance id used by a region is defined; dark rules exist only where the Owner/base allows', () => {
    for (const r of DARK_POLICY.regions) for (const p of r.provenance || []) expect(DARK_POLICY.provenance[p], `${r.id} -> ${p}`).toBeDefined();
    const dark = DARK_POLICY.regions.filter((r) => r.rule !== 'light').map((r) => r.id).sort();
    expect(dark).toEqual(['app.greeting-card', 'app.sidebar', 'creator-sheet.preview-band', 'creator.greeting-card', 'creator.preview-band', 'creator.sidebar', 'doc.band', 'doc.tiles']); // local fix 5: landing.video-player retired (Owner 2026-10-06: videos removed from the landing)
  });
  it('K1r: media are excluded only inside provenance-bearing content containers', () => {
    expect(DARK_POLICY.pockets.mediaAllowlist.length).toBeGreaterThan(0);
    for (const m of DARK_POLICY.pockets.mediaAllowlist) { expect(m.selector).toBeTruthy(); expect(m.provenance).toMatch(/src\//); }
    expect(DARK_POLICY.pockets.derivation.media).toMatch(/K1r/);
    expect(DARK_POLICY.pockets.derivation.attribution).toMatch(/K3/);
  });
  it('K4: every media allowlist entry is scoped to its container (or to a fixed asset src); K5 ring bound documented', () => {
    for (const m of DARK_POLICY.pockets.mediaAllowlist) { expect(m.selector).toMatch(/\s|>|\[src\^=/); expect(m.scope).toBeTruthy(); }
    expect(DARK_POLICY.pockets.mediaAllowlist.map((m) => m.selector)).not.toContain('.tl-figure img');
    expect(DARK_POLICY.pockets.ringMaxPx).toBe(6);
    expect(DARK_POLICY.pockets.derivation.rings).toMatch(/K5/);
    expect(DARK_POLICY.pockets.derivation.text).toMatch(/K6/);
  });
  it('K1: no blanket CSS url() media exclusion - the allowlist is explicit, empty, and every entry would need provenance', () => {
    expect(DARK_POLICY.pockets.cssImageAllowlist).toEqual([]);
    expect(DARK_POLICY.pockets.derivation.cssImages).toMatch(/K1/);
  });
  it('pocket parameters are documented', () => {
    expect(DARK_POLICY.pockets).toMatchObject({ blockPx: 4, minWindowPx: 16, strokeEm: 0.25, iconMaxPx: 48, gutterMaxPx: 20, inkMaxChroma: 0.15 });
    expect(DARK_POLICY.pockets.controlMaxHeightPx).toBeUndefined();
    for (const k of ['S', 'text', 'minArea', 'iconMaxPx', 'controls', 'inkMaxChroma', 'gutter', 'cssImages']) expect(DARK_POLICY.pockets.derivation[k]).toBeTruthy();
  });
});
