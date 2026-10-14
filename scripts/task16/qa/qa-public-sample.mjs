// Task 16 - responsive QA of the public sample quote pages (/he/sample-quote, /en/sample-quote).
// Usage: node scripts/task16/qa/qa-public-sample.mjs --base-url http://127.0.0.1:5417 [--out DIR]
//          [--locales he,en] [--styles classic,modern,visual] [--combos default|full] [--shots named|all|none]
//          [--reload-per-viewport]
// Output: <out>/public-sample/matrix.json (PASS / FAIL / NOT TESTED per check per cell) + screenshots.
import path from 'node:path';
import {
  loadPlaywright, parseArgs, resolveBaseUrl, outDir, writeJson, summarize, slug,
  pass, fail, notTested, probeOverflow, viewportMeta, viewportMetaVerdict, isMain,
} from './lib.mjs';

export const NAMED_VIEWPORTS = [
  [1440, 900], [390, 844], [320, 640], [768, 1024], [1024, 768], [820, 1180], [1180, 820],
];
export const BREAKPOINT_VIEWPORTS = [[640, 900], [641, 900], [767, 900], [769, 900], [1023, 900]];
// 768 / 1024 widths are already covered by the named viewports.

const STYLES = ['classic', 'modern', 'visual'];

function combos(mode, styles) {
  const out = [];
  for (const style of styles) {
    if (mode === 'full') {
      for (const length of ['short', 'long']) for (const detail of ['compact', 'expanded']) for (const images of [1, 0]) out.push({ style, length, detail, images });
    } else {
      out.push({ style, length: 'short', detail: 'compact', images: 1 });
      out.push({ style, length: 'long', detail: 'expanded', images: 1 });
      out.push({ style, length: 'short', detail: 'compact', images: 0 });
    }
  }
  return out;
}

export function sampleUrl(base, locale, c) {
  const q = new URLSearchParams({ style: c.style, length: c.length, detail: c.detail, images: String(c.images) });
  return `${base}/${locale}/sample-quote?${q}`;
}

// Wait for the card and for every image inside it to settle (decode or error), bounded.
export async function waitForCard(page, timeout = 20000) {
  try {
    await page.locator('.pq-card').first().waitFor({ state: 'visible', timeout });
  } catch {
    return false;
  }
  await page.evaluate(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 5000))])).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.pq-card img')];
    const settle = (img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }))
      .then(() => (img.naturalWidth && img.decode ? img.decode().catch(() => {}) : null));
    await Promise.race([Promise.all(imgs.map(settle)), new Promise((r) => setTimeout(r, 8000))]);
  });
  return true;
}

// Navigate + wait; one reload retry absorbs a dev-server reload / slow first compile.
export async function openSample(page, url, timeout = 20000) {
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).then(() => true).catch(() => false);
  if ((await go()) && (await waitForCard(page, timeout))) return true;
  return (await go()) && waitForCard(page, timeout);
}

// Every DOM probe for one cell in a single evaluate (cheap at many viewports).
async function probeCard(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.pq-card');
    if (!card) return null;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const describe = (el) => ({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
      text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      ariaExpanded: el.getAttribute('aria-expanded'),
      testid: el.getAttribute('data-testid'),
    });
    const table = card.querySelector('table.pq-commercial-table') || card.querySelector('table');
    const headerCells = table ? [...table.querySelectorAll('thead th')].filter(visible) : [];
    // Smallest computed font-size among elements that directly own visible text inside the table body.
    let minFont = null; let minFontEl = null;
    if (table) {
      for (const el of table.querySelectorAll('tbody *')) {
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!ownText || !visible(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (minFont === null || fs < minFont) { minFont = fs; minFontEl = describe(el); }
      }
    }
    const actionSel = '.pq-action-tile, .pq-action-tiles, a.pq-action, [role="dialog"], canvas, .no-print-visible-controls';
    const actionInside = [...card.querySelectorAll(actionSel)].filter(visible).map(describe);
    const buttonsInside = [...card.querySelectorAll('button, [role="button"]')].filter(visible).map(describe);
    const imgs = [...card.querySelectorAll('img')].filter((i) => !String(i.src).startsWith('data:'));
    const media = card.querySelectorAll('.pq-media');
    const brokenImgs = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src);
    const missingTiles = card.querySelectorAll('[data-pq-media-state="missing"]').length;
    return {
      cardClass: card.className,
      direction: getComputedStyle(card).direction,
      headerCount: headerCells.length,
      headerTexts: headerCells.map((th) => th.innerText.trim()),
      hasTable: !!table,
      minFont, minFontEl,
      actionInside, buttonsInside,
      imgCount: imgs.length, brokenImgs, mediaCount: media.length, missingTiles,
    };
  });
}

function evaluateCell(probe, overflow, metas, ctx) {
  const { locale, c, vw } = ctx;
  const checks = {};
  if (!probe) {
    const reason = 'route did not render .pq-card (route missing or render error)';
    for (const k of ['noHorizontalOverflow', 'fourHeaderCells', 'bodyFontMin12', 'noActionControlsInCard', 'buttonsInCard', 'viewportMetaZoomable', 'imagesLoaded', 'styleClass', 'direction']) checks[k] = notTested(reason);
    return checks;
  }
  checks.noHorizontalOverflow = overflow.scrollWidth <= overflow.innerWidth ? pass({ scrollWidth: overflow.scrollWidth, innerWidth: overflow.innerWidth }) : fail(overflow);
  checks.fourHeaderCells = probe.headerCount === 4 ? pass(probe.headerTexts) : fail({ hasTable: probe.hasTable, headerCount: probe.headerCount, headerTexts: probe.headerTexts });
  if (vw === 320 || vw === 390) {
    checks.bodyFontMin12 = probe.minFont === null ? fail('no table body text found') : probe.minFont >= 12 ? pass({ minFontPx: probe.minFont }) : fail({ minFontPx: probe.minFont, element: probe.minFontEl });
  } else checks.bodyFontMin12 = notTested('asserted at 320/390 only');
  checks.noActionControlsInCard = probe.actionInside.length ? fail(probe.actionInside) : pass();
  // Disclosure toggles (aria-expanded) are document interactions; any other <button> in the capture root is reported.
  const nonDisclosure = probe.buttonsInside.filter((b) => b.ariaExpanded === null);
  checks.buttonsInCard = nonDisclosure.length ? fail({ nonDisclosure, all: probe.buttonsInside }) : pass({ disclosureToggles: probe.buttonsInside.length });
  checks.viewportMetaZoomable = viewportMetaVerdict(metas);
  if (c.style === 'classic') {
    checks.imagesLoaded = probe.mediaCount === 0 ? pass('classic: no media area') : fail({ reason: 'classic rendered a media area', mediaCount: probe.mediaCount });
  } else if (c.images) {
    if (probe.mediaCount === 0) checks.imagesLoaded = fail('images=1 but no .pq-media area rendered');
    else checks.imagesLoaded = probe.brokenImgs.length ? fail({ broken: probe.brokenImgs }) : pass({ images: probe.imgCount, missingTiles: probe.missingTiles });
  } else {
    checks.imagesLoaded = probe.mediaCount === 0 ? pass('images=0: media area omitted') : fail({ reason: 'images=0 but a media area rendered (empty box?)', mediaCount: probe.mediaCount });
  }
  checks.styleClass = probe.cardClass.split(/\s+/).includes(`pq-style-${c.style}`) ? pass(probe.cardClass) : fail(probe.cardClass);
  const wantDir = locale === 'he' ? 'rtl' : 'ltr';
  checks.direction = probe.direction === wantDir ? pass(wantDir) : fail({ want: wantDir, got: probe.direction });
  return checks;
}

export async function runPublicSample(args) {
  const base = resolveBaseUrl(args);
  const dir = outDir(args, 'public-sample');
  const shotsDir = outDir(args, path.join('public-sample', 'shots'));
  const locales = String(args.locales || 'he,en').split(',').filter(Boolean);
  const styles = String(args.styles || STYLES.join(',')).split(',').filter((s) => STYLES.includes(s));
  const shots = String(args.shots || 'named');
  const list = combos(String(args.combos || 'default'), styles);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const cells = [];
  const errors = [];
  try {
    for (const locale of locales) {
      for (const c of list) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push({ locale, ...c, error: String(e).slice(0, 300) }));
        const url = sampleUrl(base, locale, c);
        let loaded = false;
        const viewports = [...NAMED_VIEWPORTS.map((v) => [...v, true]), ...BREAKPOINT_VIEWPORTS.map((v) => [...v, false])];
        for (const [w, h, named] of viewports) {
          if (args['reload-per-viewport'] || !loaded) {
            await page.setViewportSize({ width: w, height: h });
            loaded = await openSample(page, url, named ? 20000 : 8000);
          } else {
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(200);
          }
          const id = `${locale}/${c.style}/${c.length}/${c.detail}/img${c.images}/${w}x${h}`;
          let ready; let probe; let overflow; let metas;
          try {
            ready = loaded && (await waitForCard(page, named ? 20000 : 5000));
            probe = ready ? await probeCard(page) : null;
            overflow = await probeOverflow(page);
            metas = await viewportMeta(page);
          } catch (e) {
            // e.g. a dev-server reload mid-probe: record and re-open on the next viewport.
            cells.push({ id, locale, ...c, viewport: `${w}x${h}`, url, probeError: String(e).split(String.fromCharCode(10))[0].slice(0, 200), checks: evaluateCell(null, null, [], { locale, c, vw: w }) });
            loaded = false;
            continue;
          }
          const cell = { id, locale, ...c, viewport: `${w}x${h}`, url, checks: evaluateCell(probe, overflow, metas, { locale, c, vw: w }) };
          if (ready && (shots === 'all' || (shots === 'named' && named))) {
            const file = path.join(shotsDir, `${slug(id)}.png`);
            try { await page.screenshot({ path: file, fullPage: true, timeout: 20000, animations: 'disabled' }); cell.screenshot = file; } catch (e) { cell.screenshotError = String(e).split(String.fromCharCode(10))[0].slice(0, 200); }
          }
          cells.push(cell);
          if (!ready && !args['reload-per-viewport']) break; // route missing: one NOT TESTED cell per combo is enough
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const result = { kind: 'task16-public-sample', base, generatedAt: new Date().toISOString(), summary: summarize(cells), pageErrors: errors, cells };
  const file = writeJson(path.join(dir, 'matrix.json'), result);
  return { file, summary: result.summary, pageErrors: errors.length };
}

if (isMain(import.meta.url)) {
  runPublicSample(parseArgs()).then((r) => {
    console.log(JSON.stringify({ matrix: r.file, totals: r.summary.totals, failures: r.summary.failures.length, pageErrors: r.pageErrors }, null, 2));
    process.exitCode = r.summary.totals.FAIL ? 1 : 0;
  }).catch((e) => { console.error(e); process.exitCode = 2; });
}
