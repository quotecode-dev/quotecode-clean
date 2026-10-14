// NUMERIC GEOMETRY BROWSER GATE (real Chromium, real fonts, real coordinates). Usage:
//   node e2e/numeric-geometry.gate.mjs <baseUrl> [outJson]
// Requires Playwright resolvable (e.g. NODE_PATH / C:\tkrtool) and the dev server serving e2e/numeric-harness.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:5191';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');
const TOL = 0.75; // px: sub-pixel rounding only
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail ?? ''}`); };

const browser = await chromium.launch();
for (const lang of ['he', 'en']) {
  for (const [dev, vp] of [['mobile', { width: 360, height: 800 }], ['mobile-narrow', { width: 320, height: 700 }], ['desktop', { width: 1440, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(`${base}/e2e/numeric-harness/index.html?lang=${lang}${process.env.LEGACY ? '&legacy=1' : ''}`);
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const tag = `${lang}/${dev}`;
    // fonts: real Rubik faces must be loaded, not a fallback
    const fonts = await page.evaluate(() => [...document.fonts].map(f => `${f.family}:${f.weight}:${f.status}`));
    check(`${tag} Rubik faces loaded, none errored`, fonts.some(f => /^Rubik:.*:loaded/.test(f)) && !fonts.some(f => /:error$/.test(f)), fonts.filter(f => /loaded|error/.test(f)).slice(0, 8).join(','));
    // NUMERIC OPENTYPE CONTRACT: the loaded Rubik really has tnum (tabular widths equal, proportional widths differ)
    const ot = await page.evaluate(() => {
      const w = (txt, feat) => { const s = document.createElement('span'); s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:'Rubik';font-size:40px;font-feature-settings:${feat}`; s.textContent = txt; document.body.appendChild(s); const x = s.getBoundingClientRect().width; s.remove(); return x; };
      return { t1: w('1111111', '"tnum" 1'), t0: w('0000000', '"tnum" 1'), p1: w('1111111', '"tnum" 0'), p0: w('0000000', '"tnum" 0') };
    });
    check(`${tag} NUMERIC OPENTYPE tnum supported (tabular equal, proportional differs)`, Math.abs(ot.t1 - ot.t0) < 0.5 && Math.abs(ot.p1 - ot.p0) > 1, JSON.stringify(ot));
    const sel = dev === 'desktop' ? 'tbody .pf-money' : '[data-testid="quote-card-amount"]';
    const m = await page.evaluate((sel) => {
      const rows = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const tn = el.firstChild?.nodeType === 3 ? el : el.querySelector('*') || el;
        // right edge of the TEXT (ink box), decimal x, and computed style
        const range = document.createRange(); range.selectNodeContents(el);
        const tr = range.getBoundingClientRect();
        const txt = el.textContent; const dot = txt.search(/[.,]\d\d$/);
        let dx = null;
        if (dot >= 0) {
          const node = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.length > dot) || el.lastChild;
          const rg = document.createRange(); rg.setStart(node, Math.min(dot, node.textContent.length - 3 < 0 ? 0 : node.textContent.length - 3)); rg.setEnd(node, node.textContent.length - 2);
          dx = rg.getBoundingClientRect().left;
        }
        const cs = getComputedStyle(el);
        rows.push({ txt, textRight: tr.right, boxRight: r.right, dx, top: r.top, h: r.height,
          fvn: cs.fontVariantNumeric, ff: cs.fontFeatureSettings, dir: cs.direction, ub: cs.unicodeBidi, ta: cs.textAlign });
      }
      return rows;
    }, sel);
    check(`${tag} amounts found`, m.length >= 8, `n=${m.length}`);
    if (m.length) {
      const rights = m.map(x => x.textRight);
      const spread = Math.max(...rights) - Math.min(...rights);
      check(`${tag} shared RIGHT axis (text right edge)`, spread <= TOL, `spread=${spread.toFixed(2)}px`);
      const dxs = m.filter(x => x.dx !== null && !x.txt.includes('-')).map(x => x.dx);
      // decimal axis: rows of equal decimals -> decimal x differs by digit count; assert via right edge of the last two digits
      check(`${tag} tabular+lining figures computed`, m.every(x => /tabular-nums/.test(x.fvn) && /lining-nums/.test(x.fvn) && /tnum/.test(x.ff)), m[0].fvn + '|' + m[0].ff);
      check(`${tag} LTR isolate`, m.every(x => x.dir === 'ltr' && /isolate/.test(x.ub)), `${m[0].dir}/${m[0].ub}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      check(`${tag} no horizontal overflow`, !overflow);
      const heights = new Set(m.map(x => Math.round(x.h)));
      check(`${tag} no unexpected wrap (single line)`, heights.size === 1, [...heights].join(','));
    }
    // digit place value: ones digit of 1/9/10/99 must sit at identical x (last-digit right edge is the same)
    if (dev !== 'desktop') {
      const g = await page.evaluate(() => {
        const els = [...document.querySelectorAll('#totals-grid [data-testid^="tg-"]')];
        return els.map(e => { const r = document.createRange(); r.selectNodeContents(e); return { id: e.dataset.testid, right: r.getBoundingClientRect().right, fs: getComputedStyle(e).fontSize }; });
      });
      const gr = g.map(x => x.right); const gs = Math.max(...gr) - Math.min(...gr);
      check(`${tag} totals grid incl. Grand Total share right axis (hero size differs)`, gs <= TOL && new Set(g.map(x => x.fs)).size > 1, `spread=${gs.toFixed(2)} sizes=${g.map(x => x.fs).join(',')}`);
    }
    // controls stable: the expand chevron + status badge are inside the viewport on every card
    if (dev !== 'desktop') {
      const bad = await page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].filter(b => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length);
      check(`${tag} cards inside viewport`, bad === 0, `bad=${bad}`);
    }
    // PRINT gate: same DOM under print media (html2canvas PDF rasterises this same DOM). Axis + figures must hold.
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate((sel) => {
      const rights = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width).map(e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().right; });
      const g = [...document.querySelectorAll('#totals-grid [data-testid^="tg-"]')].map(e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().right; });
      const el = document.querySelector('#totals-grid [data-testid="tg-grand"]');
      return { n: rights.length, spread: rights.length ? Math.max(...rights) - Math.min(...rights) : 0, gspread: Math.max(...g) - Math.min(...g), fvn: getComputedStyle(el).fontVariantNumeric };
    }, sel);
    check(`${tag} PRINT media: totals axis + tabular figures hold`, pr.gspread <= TOL && /tabular-nums/.test(pr.fvn), `gspread=${pr.gspread.toFixed(2)} amountsSpread=${pr.spread.toFixed(2)}`);
    if (dev === 'desktop') { const pdf = await page.pdf({ format: 'A4' }); check(`${tag} PRINT pdf rendered`, pdf.length > 1000, `bytes=${pdf.length}`); }
    await page.emulateMedia({ media: 'screen' });
    await page.screenshot({ path: `${out ? out.replace(/\.json$/, '') : 'numgate'}-${lang}-${dev}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
const failed = results.filter(r => !r.ok).length;
if (out) fs.writeFileSync(out, JSON.stringify({ base, results }, null, 2));
console.log(failed ? `NUMERIC GEOMETRY BROWSER GATE: FAIL (${failed})` : 'NUMERIC GEOMETRY BROWSER GATE: PASS');
process.exit(failed ? 1 : 0);
