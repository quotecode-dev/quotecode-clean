// Task 16 - LAYOUT REGRESSION GATE for the Owner corrections of 2026-10-05 (cloud). Real Chromium against a production-
// mode build served on 127.0.0.1 (never 5186). Static routes need no backend; the Quote History cells use Playwright
// route mocks with one SYNTHETIC account per market (no persona, no TEST/Production contact) - so this is LOCAL-DEV
// evidence, NOT the official IRON-MOBILE-WIDTH-001 / IRON-QH-LAYOUT-001 gates and NOT Owner acceptance.
// Build:  VITE_SUPABASE_URL=http://127.0.0.1:54399 VITE_SUPABASE_ANON_KEY=test-anon npx vite build --outDir <dir>
// Serve:  npx vite preview --outDir <dir> --host 127.0.0.1 --port <port> --strictPort
// Run:    node scripts/task16/qa/layout-regression-gate.mjs <baseUrl> <outJson>   (exit 1 on any FAIL)
// Optional: PW_CHROMIUM=<path> for a pre-installed Chromium.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { REV8_TOTAL, QH_VARIANTS } from './qh/fixtures.mjs';
import { compareTargets } from './qh/measure.mjs';
import { measureCell, QH_VIEWPORTS } from './qh/capture-base.mjs';

const BASE = process.argv[2];
const OUT = process.argv[3] || 'layout-regression-gate.json';
const cells = [];
const cell = (id, pass, detail) => { cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail }); };

// Quote History vs the REAL base c65f742 geometry: qh/base-c65f742.json was captured by qh/capture-base.mjs from a base
// production build with the SAME synthetic fixtures (qh/fixtures.mjs: std / rev8 = 8-digit header revenue / long8 / basic8
// / free8 / trial8), the same Chromium and the same measurement code (qh/measure.mjs). QH_BASE_URL=<base preview url>
// re-measures base live instead. Rules (no tolerance, phones = tablets = desktop): list room >= base, fully visible rows
// >= base, greeting card not taller / not more lines than base, every amount complete (no ellipsis / clip; the 8-digit
// revenue shows all its digits), no text below 12px, no control smaller than base where it is under 44px, no text
// overlap, no horizontal overflow, and no Task 16 status-count metrics (R25 rollback to the base structure).
const QH_BASE = JSON.parse(readFileSync(new URL('./qh/base-c65f742.json', import.meta.url), 'utf8')).cells;
const QH_GATE_VARIANTS = (process.env.QH_GATE_VARIANTS || QH_VARIANTS.join(',')).split(',');

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// ---------- landing ----------
for (const loc of ['he', 'en']) {
  for (const width of [320, 360, 390, 412, 768, 1024, 1440]) {
    const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
    await page.goto(`${BASE}/${loc}`, { waitUntil: 'networkidle' });
    const r = await page.evaluate(async () => {
      const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const other = location.pathname.startsWith('/he') ? '/en' : '/he';
      const crossInHeader = [...document.querySelectorAll('.tl-header a')].filter((a) => a.getAttribute('href') === other && vis(a)).length;
      let crossInDrawer = 0;
      const t = document.querySelector('.tl-menu-toggle');
      if (vis(t)) { t.click(); await new Promise((x) => setTimeout(x, 150)); crossInDrawer = [...document.querySelectorAll('#tl-menu-drawer a')].filter((a) => a.getAttribute('href') === other).length; document.querySelector('.tl-drawer-close')?.click(); await new Promise((x) => setTimeout(x, 100)); }
      const logo = document.querySelector('.tl-logo').getBoundingClientRect();
      const cta = document.querySelector('.tl-actions').getBoundingClientRect();
      const menuEl = document.querySelector('.tl-menu'); const menu = vis(menuEl) ? [menuEl.getBoundingClientRect().left, menuEl.getBoundingClientRect().right] : null;
      const navEl = document.querySelector('.tl-nav'); const nb = navEl.getBoundingClientRect(); const ncs = getComputedStyle(navEl);
      const navInner = [nb.left + parseFloat(ncs.paddingLeft), nb.right - parseFloat(ncs.paddingRight)];
      const centred = [...document.querySelectorAll('.tl-landing section *, .tl-landing footer *')].filter((el) => vis(el) && !el.closest('.tl-doc, button, .tl-tabs, .tl-cycle') && el.tagName !== 'BUTTON' && getComputedStyle(el).textAlign === 'center' && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)).length;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const hreflang = document.querySelectorAll('link[rel="alternate"][hreflang]').length;
      const auth = [...document.querySelectorAll('a[href^="/dashboard"]')].length;
      return { crossInHeader, crossInDrawer, logo: [logo.left, logo.right], cta: [cta.left, cta.right], menu, navInner, vw: innerWidth, centred, canonical, hreflang, auth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const id = `landing/${loc}/${width}`;
    cell(`${id}/no-visible-language-switch`, r.crossInHeader === 0 && r.crossInDrawer === 0, { header: r.crossInHeader, drawer: r.crossInDrawer });
    cell(`${id}/alternates-and-auth-kept`, r.canonical.endsWith(`/${loc}`) && r.hreflang >= 3 && r.auth >= 2, { canonical: r.canonical, hreflang: r.hreflang, auth: r.auth });
    // the ACTION GROUP (.tl-actions: sign-in + trial CTA + menu) is measured, not one button
    // Owner 2026-10-06 (NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT): HE logo far right -> links (when visible) right after it ->
    // actions far left; EN logo far left -> links -> actions far right. Links are judged only when visible (no hidden nodes).
    if (loc === 'he') cell(`${id}/logo-right-links-then-actions-left`, Math.abs(r.logo[1] - r.navInner[1]) <= 4 && Math.abs(r.cta[0] - r.navInner[0]) <= 4 && (!r.menu || (r.menu[1] <= r.logo[0] && r.logo[0] - r.menu[1] <= 24 && r.menu[0] >= r.cta[1])), { logo: r.logo, menu: r.menu, actions: r.cta, navInner: r.navInner });
    else cell(`${id}/logo-left-links-then-actions-right`, Math.abs(r.logo[0] - r.navInner[0]) <= 4 && Math.abs(r.cta[1] - r.navInner[1]) <= 4 && (!r.menu || (r.menu[0] >= r.logo[1] && r.menu[1] <= r.cta[0])), { logo: r.logo, menu: r.menu, actions: r.cta, navInner: r.navInner });
    cell(`${id}/section-text-starts-on-language-side`, r.centred === 0, { centredTextBlocks: r.centred });
    cell(`${id}/no-horizontal-overflow`, r.overflow <= 0, { overflow: r.overflow });
    if (width <= 1024) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const hits = await page.evaluate(() => { const l = document.querySelector('.ai-support-btn')?.getBoundingClientRect(); if (!l) return 0; return [...document.querySelectorAll('.tl-footer a, .tl-footer button, .tl-footer p')].map((e) => e.getBoundingClientRect()).filter((b) => b.right > l.left && b.left < l.right && b.bottom > l.top && b.top < l.bottom).length; });
      cell(`${id}/footer-clear-of-ai-launcher`, hits === 0, { overlaps: hits });
    }
    await page.context().close();
  }
}

// ---------- quotation header band (sample route = real renderer, synthetic data) ----------
const dark = (rgb) => { if (!rgb) return false; const m = rgb.match(/\d+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) < 80 && (m[3] === undefined || m[3] > 0); };
const white = (rgb) => !!rgb && /^rgb\(255, 255, 255\)$|^rgba\(255, 255, 255, 1\)$/.test(rgb) || /rgba\(0, 0, 0, 0\)/.test(rgb);
for (const loc of ['he', 'en']) {
  for (const style of ['classic', 'modern', 'visual']) {
    for (const width of [390, 1440]) {
      const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
      await page.goto(`${BASE}/${loc}/sample-quote?style=${style}&length=short`, { waitUntil: 'networkidle' });
      const probe = () => page.evaluate(() => {
        const band = document.querySelector('.pq-lh-band');
        const title = document.querySelector('.pq-letterhead .pq-doc-title');
        const name = band?.querySelector('.pq-lh-name');
        return { bg: band ? getComputedStyle(band).backgroundColor : null, nameColor: name ? getComputedStyle(name).color : null, titleOutside: band && title ? !band.contains(title) : false, metaCentred: [...document.querySelectorAll('.pq-meta-cell')].every((c) => getComputedStyle(c).textAlign === 'center'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const s = await probe();
      const id = `quote/${loc}/${style}/${width}`;
      cell(`${id}/screen-band-black`, !!s.bg && dark(s.bg) && /255, 255, 255/.test(s.nameColor || ''), s);
      cell(`${id}/title-outside-band-meta-centred`, s.titleOutside && s.metaCentred, { titleOutside: s.titleOutside, metaCentred: s.metaCentred });
      cell(`${id}/no-horizontal-overflow`, s.overflow <= 0, { overflow: s.overflow });
      if (width === 1440) {
        await page.emulateMedia({ media: 'print' });
        const p = await probe();
        cell(`${id}/print-band-white-dark-text`, white(p.bg) && !/255, 255, 255/.test(p.nameColor || ''), p);
        await page.emulateMedia({ media: 'screen' });
        const cap = await page.evaluate(() => { const pg = document.querySelector('.pq-page'); const band = document.querySelector('.pq-lh-band'); if (!pg || !band) return 'missing .pq-lh-band'; pg.classList.add('pq-pdf-capturing'); const b = getComputedStyle(band).backgroundColor; pg.classList.remove('pq-pdf-capturing'); return b; });
        cell(`${id}/direct-pdf-capture-keeps-existing-white`, white(cap), { captureBg: cap });
      }
      await page.context().close();
    }
  }
}

// ---------- Quote History + greeting card (mocked synthetic accounts, base c65f742 parity) ----------
const REV8_DIGITS = REV8_TOTAL.toLocaleString('en-US');
for (const variant of QH_GATE_VARIANTS) {
  for (const market of ['Local', 'International']) {
    const lang = market === 'Local' ? 'he' : 'en';
    for (const [w, h] of QH_VIEWPORTS) {
      const key = `${w}x${h}`;
      const m = await measureCell(browser, BASE, variant, market, w, h);
      const base = process.env.QH_BASE_URL ? await measureCell(browser, process.env.QH_BASE_URL, variant, market, w, h) : QH_BASE[`${variant}/${lang}/${key}`];
      const id = `quote-history/${variant}/${lang}/${key}`;
      if (!base) { cell(`${id}/base-reference`, false, { missing: `${variant}/${lang}/${key}` }); continue; }
      const amountTexts = m.amounts.map((a) => a.text);
      cell(`${id}/rendered`, m.items >= 4, { items: m.items });
      cell(`${id}/qh-header-lines-vs-base`, m.qhHeadLines !== null && m.qhHeadLines <= base.qhHeadLines, { qhHeadLines: m.qhHeadLines, base: base.qhHeadLines, rule: 'title/Export CSV/search/filter lines <= base (Export stays on the title row where it is in base)' });
      cell(`${id}/list-room-vs-base`, m.list !== null && m.list >= base.list, { list: m.list, base: base.list, delta: m.list === null ? null : m.list - base.list, rule: '>= base (phones, tablets, desktop)' });
      cell(`${id}/visible-rows-vs-base`, m.rowsFull >= base.rowsFull, { rowsFull: m.rowsFull, base: base.rowsFull });
      // <=1000px the stats are their own row, so their text lines are judged too; >1000px they sit INSIDE the fixed 44px
      // title row (1001-1180: the revenue stat stacks label over value there to end the base title/stats overlap), so the
      // row itself is judged: card height and greeting lines <= base, plus no-text-overlap below.
      cell(`${id}/greeting-card-vs-base`, m.greetingH !== null && m.greetingH <= base.greetingH + 0.5 && m.greetLines <= base.greetLines && (w > 1000 || m.statsLines <= base.statsLines), { height: m.greetingH, baseHeight: base.greetingH, lines: m.greetLines, baseLines: base.greetLines, statsLines: m.statsLines, baseStatsLines: base.statsLines, statsLinesJudged: w <= 1000 });
      if (w <= 768) cell(`${id}/greeting-one-row`, m.greetingBadgeWraps === false || base.greetingBadgeWraps === true, { wraps: m.greetingBadgeWraps, baseWraps: base.greetingBadgeWraps, rule: 'one row unless base also wraps with the same data' });
      cell(`${id}/greeting-card-black`, !!m.greetingBg && dark(m.greetingBg), { bg: m.greetingBg });
      cell(`${id}/amounts-complete`, m.amountsClipped === 0 && (variant === 'std' || (m.revenueText || '').includes(REV8_DIGITS)), { clipped: m.amounts.filter((a) => a.clipped.length), revenue: m.revenueText, amounts: amountTexts.length });
      cell(`${id}/text-not-below-12px`, m.minFont !== null && m.minFont >= 12, { minFont: m.minFont, text: m.minFontText });
      const shrunk = compareTargets(base.targets, m.targets);
      cell(`${id}/touch-targets-not-shrunk`, shrunk.length === 0, { shrunk, minTargetH: m.minTargetH });
      cell(`${id}/no-text-overlap`, m.overlaps === 0, { overlaps: m.overlaps, samples: m.overlapSamples, baseOverlaps: base.overlaps });
      cell(`${id}/no-horizontal-overflow`, m.overflowX <= 0, { overflow: m.overflowX });
      if (m.thOverflow !== null) cell(`${id}/table-header-fits-slot`, m.thOverflow <= 0, { thOverflow: m.thOverflow, baseThOverflow: base.thOverflow });
      cell(`${id}/no-status-count-metrics`, m.metrics === false, { metrics: m.metrics, rule: 'R25: base c65f742 structure, no metric row / inline counts' });
    }
  }
}
await browser.close();
const fail = cells.filter((c) => c.result !== 'PASS');
writeFileSync(OUT, JSON.stringify({ gate: 'task16-layout-regression (LOCAL-DEV, mocked backend for Quote History)', base: BASE, generatedAt: new Date().toISOString(), pass: cells.length - fail.length, fail: fail.length, cells }, null, 1));
console.log(`LAYOUT REGRESSION GATE (LOCAL-DEV): ${cells.length - fail.length} PASS / ${fail.length} FAIL`);
for (const f of fail) console.log(`  FAIL ${f.id} ${JSON.stringify(f.detail)}`);
process.exit(fail.length ? 1 : 0);
