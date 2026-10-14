// Task 16 - DARK-SCOPE GATE (LOCAL-DEV, mocked backend). Decides light/dark PER REGION and fails any dark region that
// dark-scope-policy.json does not allow with provenance. Optional base build (c65f742) and the approved reference are
// measured too: base-preserved allowances are re-verified on base, and every region that is dark in the subject but not
// in base is flagged (newDarkVsBase) - it must then carry an Owner/reference provenance or it already FAILS the rule.
//
// Surfaces: landing (+ opened drawer), app (dashboard / Quote History, mocked synthetic session), creator (New Quote,
// same session), doc (real public route /quote/:id, get-public-quote mocked with synthetic sample DTOs), print (same
// route, print media emulation). No persona, no credentials, no TEST/Production contact.
//
// Usage:
//   node scripts/task16/qa/fidelity/dark-scope-gate.mjs --base-url http://127.0.0.1:41901 --out <dir>
//        [--compare-url http://127.0.0.1:41900]   base c65f742 build (same mocks)
//        [--src-root <tree>]                       tree whose src/quoteDocument/sampleQuotes.js builds the DTOs (doc/print)
//        [--subject-tree <tree>]                   recorded as git identity of the subject
//        [--ref-dir <revision-r2-refined>]         reference landing (default: the preserved repo copy)
//        [--surfaces landing,app,creator,doc,print] [--locales he,en] [--viewports 1440x900,...] [--styles classic,modern,visual]
// Exit: 0 all PASS, 1 any FAIL, 2 setup error.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, parseArgs, ensureDir, writeJson, isMain, STATUS } from '../lib.mjs';
import { VIEWPORTS, REPO_REF_DIR, assertLocalUrl, launchOptions, mockedAppContext, mockedPublicContext, loadSampleDtos, runIdentity } from './common.mjs';
import { measureSurface, evaluateRegions, DARK_POLICY } from './darkscope.mjs';

const QUOTE_ID = '00000000-0000-4000-9000-0000000000aa';

async function settle(page, ms = 600) {
  await page.evaluate(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 4000))])).catch(() => {});
  await page.waitForTimeout(ms);
}

async function landingTarget(browser, url, loc, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await settle(page);
  const main = await measureSurface(page, browser, 'landing', { fullPage: true });
  // drawer (only where a menu toggle is visible)
  let drawer = null;
  const toggle = page.locator('.tl-menu-toggle, .tablet-menu-toggle').filter({ visible: true }).first();
  if (await toggle.count()) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await toggle.click();
    await page.waitForTimeout(350);
    drawer = await measureSurface(page, browser, 'landing-drawer', { fullPage: false });
    await page.keyboard.press('Escape').catch(() => {});
  }
  await ctx.close();
  return { main, drawer };
}

async function appTarget(browser, baseUrl, market, w, h) {
  const { ctx, lang } = await mockedAppContext(browser, { market, width: w, height: h });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/dashboard?lang=${lang}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('.pf-work-screen', { timeout: 20000 }).catch(() => {});
  await settle(page, 900);
  const app = await measureSurface(page, browser, 'app', { fullPage: false });
  let creator = null;
  let creatorError = null;
  let sheet = null;
  let sheetError = null;
  try {
    // the New Quote entry is a desktop control: open the creator at 1440x900, then return to the cell viewport (the
    // creator stays open) - the same preparation fidelity-compare uses for the persona creator cells
    if (w < 1024) await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ }).filter({ visible: true }).first().click({ timeout: 15000 });
    await page.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
    if (w < 1024) await page.setViewportSize({ width: w, height: h });
    await page.locator('.qp-preview .pq-card').first().waitFor({ timeout: 8000 }).catch(() => {});
    await settle(page, 1200);
    creator = await measureSurface(page, browser, 'creator', { fullPage: false });
    // stack layout: no split preview - open the preview sheet ('Open preview' / 'פתחו תצוגה מקדימה') and measure it
    if (!(await page.locator('.qp-preview').filter({ visible: true }).count())) {
      const open = page.getByRole('button', { name: /^(Open preview|פתחו תצוגה מקדימה)$/ }).first();
      if (await open.count()) {
        await open.scrollIntoViewIfNeeded().catch(() => {});
        await open.click({ timeout: 10000 });
        await page.locator('.qp-preview-col.is-open .pq-card').first().waitFor({ timeout: 10000 }).catch(() => {});
        await settle(page, 1000);
        sheet = await measureSurface(page, browser, 'creator-sheet', { fullPage: false });
      } else sheetError = 'no split preview and no Open preview button';
    }
  } catch (e) { creatorError = String(e).split('\n')[0].slice(0, 200); }
  await ctx.close();
  return { app, creator, creatorError, sheet, sheetError };
}

async function docTarget(browser, baseUrl, w, h, dto, locale) {
  // business phone set (as public-quote-outputs.mjs does) so all four action tiles render (Call / WhatsApp included)
  const quoteData = { ...dto.quoteData, business: { ...dto.quoteData.business, phone: locale === 'he' ? '050-1234567' : '+1 555 0100' } };
  const ctx = await mockedPublicContext(browser, { width: w, height: h, dto: quoteData, presentation: dto.presentation });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/quote/${QUOTE_ID}`, { waitUntil: 'networkidle', timeout: 120000 });
  const ok = await page.waitForSelector('.pq-card, .pq-header-box', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!ok) { await ctx.close(); return { error: 'public quote did not render (.pq-card)' }; }
  await settle(page, 700);
  const screen = await measureSurface(page, browser, 'doc', { fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const print = await measureSurface(page, browser, 'print', { fullPage: true });
  await ctx.close();
  return { screen, print };
}

function summarizeRows(rows) {
  const t = { PASS: 0, FAIL: 0, 'NOT TESTED': 0, ABSENT: 0 };
  for (const r of rows) t[r.status] = (t[r.status] || 0) + 1;
  return t;
}

export async function runDarkScope(args) {
  const subjectUrl = assertLocalUrl(args['base-url'] || process.env.BASE_URL);
  const compareUrl = args['compare-url'] ? assertLocalUrl(args['compare-url']) : null;
  const refDir = path.resolve(String(args['ref-dir'] || REPO_REF_DIR));
  const out = ensureDir(path.resolve(String(args.out || 'dark-scope-out')));
  const surfaces = String(args.surfaces || 'landing,app,creator,doc,print').split(',');
  const locales = String(args.locales || 'he,en').split(',');
  const styles = String(args.styles || 'classic,modern,visual').split(',');
  const viewports = args.viewports ? String(args.viewports).split(',').map((s) => s.split('x').map(Number)) : VIEWPORTS;
  const identity = runIdentity(args['subject-tree'] || null);
  identity.compareTree = args['compare-tree'] ? runIdentity(args['compare-tree']).tree : null;

  let dtos = null;
  if (surfaces.includes('doc') || surfaces.includes('print')) {
    if (!args['src-root']) throw new Error('--src-root is required for doc/print (synthetic sample DTOs)');
    dtos = await loadSampleDtos(path.resolve(String(args['src-root'])), locales.flatMap((locale) => styles.map((style) => ({ locale, style, length: 'short', images: true }))));
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(launchOptions());
  const cells = [];
  const raw = [];
  const push = (id, surface, locale, vp, subject, baseline, reference) => {
    const rows = evaluateRegions(subject, baseline, STATUS);
    if (reference) {
      const refById = new Map(reference.regions.filter((r) => !r.absent).map((r) => [r.regionId, r]));
      for (const row of rows) { const rr = refById.get(row.id.split('#')[0]) || refById.get(row.id); row.reference = rr ? rr.verdict : 'absent'; }
    }
    cells.push({ id, surface, locale, viewport: vp, rows, totals: summarizeRows(rows) });
    raw.push({ id, subject, baseline, reference });
  };
  try {
    for (const locale of locales) {
      const market = locale === 'he' ? 'Local' : 'International';
      for (const [w, h] of viewports) {
        const vp = `${w}x${h}`;
        if (surfaces.includes('landing')) {
          const s = await landingTarget(browser, `${subjectUrl}/${locale}`, locale, w, h);
          const b = compareUrl ? await landingTarget(browser, `${compareUrl}/${locale}`, locale, w, h) : null;
          const r = fs.existsSync(path.join(refDir, `landing-${locale}.html`)) ? await landingTarget(browser, pathToFileURL(path.join(refDir, `landing-${locale}.html`)).href, locale, w, h) : null;
          push(`landing/${locale}/${vp}`, 'landing', locale, vp, s.main, b?.main, r?.main);
          if (s.drawer) push(`landing-drawer/${locale}/${vp}`, 'landing-drawer', locale, vp, s.drawer, b?.drawer || null, r?.drawer || null);
        }
        if (surfaces.includes('app') || surfaces.includes('creator')) {
          const s = await appTarget(browser, subjectUrl, market, w, h);
          const b = compareUrl ? await appTarget(browser, compareUrl, market, w, h) : null;
          if (surfaces.includes('app')) push(`app/${locale}/${vp}`, 'app', locale, vp, s.app, b?.app);
          if (surfaces.includes('creator')) {
            if (s.creator) push(`creator/${locale}/${vp}`, 'creator', locale, vp, s.creator, b?.creator || null);
            if (s.sheet) push(`creator-sheet/${locale}/${vp}`, 'creator-sheet', locale, vp, s.sheet, null);
            else if (s.sheetError) cells.push({ id: `creator-sheet/${locale}/${vp}`, surface: 'creator-sheet', locale, viewport: vp, rows: [{ id: 'creator-sheet', status: STATUS.NOT_TESTED, note: s.sheetError }], totals: { 'NOT TESTED': 1 } });
            if (!s.creator) cells.push({ id: `creator/${locale}/${vp}`, surface: 'creator', locale, viewport: vp, rows: [{ id: 'creator', status: STATUS.NOT_TESTED, note: s.creatorError }], totals: { 'NOT TESTED': 1 } });
          }
        }
        if (dtos && (surfaces.includes('doc') || surfaces.includes('print'))) {
          for (const style of styles) {
            const dto = dtos[`${locale}/${style}`];
            const s = await docTarget(browser, subjectUrl, w, h, dto, locale);
            const b = compareUrl ? await docTarget(browser, compareUrl, w, h, dto, locale) : null;
            if (s.error) { cells.push({ id: `doc/${locale}/${style}/${vp}`, surface: 'doc', locale, viewport: vp, rows: [{ id: 'doc', status: STATUS.FAIL, note: s.error }], totals: { FAIL: 1 } }); continue; }
            if (surfaces.includes('doc')) push(`doc/${locale}/${style}/${vp}`, 'doc', locale, vp, s.screen, b && !b.error ? b.screen : null);
            if (surfaces.includes('print')) push(`print/${locale}/${style}/${vp}`, 'print', locale, vp, s.print, b && !b.error ? b.print : null);
          }
        }
        process.stderr.write(`dark-scope ${locale} ${vp} done\n`);
      }
    }
  } finally {
    await browser.close();
  }

  const totals = { PASS: 0, FAIL: 0, 'NOT TESTED': 0, ABSENT: 0 };
  const failures = [];
  const newDark = [];
  const matrix = {};
  for (const c of cells) {
    for (const r of c.rows) {
      totals[r.status] = (totals[r.status] || 0) + 1;
      if (r.status === STATUS.FAIL) failures.push({ cell: c.id, region: r.id, verdict: r.verdict, note: r.note, cssBg: r.cssBg, pixels: r.pixels });
      if (r.newDarkVsBase) newDark.push({ cell: c.id, region: r.id, rule: r.rule, status: r.status, provenance: r.provenance });
      const key = `${c.surface}:${r.id.replace(/#.*/, (m) => (c.surface === 'landing' && r.id.startsWith('landing.section') ? m : ''))}`;
      matrix[key] ||= {};
      matrix[key][`${c.locale}/${c.viewport}${c.id.split('/').length > 3 ? `/${c.id.split('/')[2]}` : ''}`] = `${r.verdict || ''}|${r.status}${r.base && r.base !== 'not measured' ? `|base:${r.base}` : ''}${r.reference ? `|ref:${r.reference}` : ''}`;
    }
  }
  const result = {
    kind: 'task16-dark-scope-gate', evidenceClass: 'LOCAL-DEV (production build, mocked backend, synthetic data)',
    subject: subjectUrl, compare: compareUrl, referenceDir: refDir, identity, policyVersion: DARK_POLICY.version,
    classification: DARK_POLICY.classification, generatedAt: new Date().toISOString(),
    viewports: viewports.map((v) => v.join('x')), locales, styles, surfaces,
    totals, failures, newDarkVsBase: newDark, matrix, cells,
  };
  const file = writeJson(path.join(out, 'dark-scope-gate.json'), result);
  writeJson(path.join(out, 'dark-scope-raw.json'), raw);
  return { file, totals, failures: failures.length, newDarkVsBase: newDark.length };
}

if (isMain(import.meta.url)) {
  runDarkScope(parseArgs()).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = r.totals.FAIL ? 1 : 0;
  }).catch((e) => { console.error(String(e && e.stack ? e.stack : e).slice(0, 800)); process.exitCode = 2; });
}
