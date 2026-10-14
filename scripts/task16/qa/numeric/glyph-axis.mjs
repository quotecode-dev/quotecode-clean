// Task 16 local fix 6 (R2) - PROTECTED SUMMARY GLYPH-AXIS GATE (IRON-NUMERIC-001 / IRON-PRINT-001; QA tooling only).
// Real Chromium, real Rubik, DOM Range measurements of the rendered glyphs - NOT text-box edges.
// For every protected summary row of the quote document (subtotal, discount, net, VAT, final total; section subtotals as
// their own group when present) it locates the decimal point, the ones digit and the tens digit of the displayed amount
// with a Range per character and asserts that their centre x coordinates coincide across rows (<= TOL px):
//   axis/decimal, axis/ones, axis/tens   max - min of the glyph centres across the protected rows <= 0.5px
//   metrics/identical                    one computed font-size / family for every protected amount (no hero size)
//   figures/tabular-lining               font-variant-numeric tabular-nums + lining-nums, "tnum" on every amount
//   isolation/ltr                        direction ltr + unicode-bidi isolate on every amount
//   single-line                          each amount is one line box (Range client rects on one line)
//   values/ils-whole                     HE (ILS) amounts end in .00 (IRON-ILS-001 display); EN keeps cents
//   items/centred                        Quantity / Unit price / Amount item cells: ink centre within 1px of the cell centre
//                                        (the explicit item-column exception) - totals are NOT centred
// Outputs: screen and print media on /:lang/sample-quote (HE/EN x classic/modern/visual x 390/1280); Direct PDF: the REAL
// tile -> Compact flow on /quote/:id (get-public-quote / quote-presentation mocked with the same sample DTO), glyphs measured
// inside the .pq-pdf-capturing state the PDF is rasterised from; the downloaded PDF and a print PDF are saved per cell.
// Negative controls (env GA_MUTATE; never against 5186): final-1.3rem, no-tabular, break-ltr, shift-row-2px,
// center-totals, item-off-center, center-section-summary. GA_SECTIONS=0 skips the sectioned pass.
// Usage: node scripts/task16/qa/numeric/glyph-axis.mjs <appUrl> <outDir> [supabaseUrlToMock]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const [APP, OUT, SUPA_IN] = process.argv.slice(2);
if (!APP || !OUT) { console.error('usage: glyph-axis.mjs <appUrl> <outDir> [supabaseUrlToMock]'); process.exit(2); }
const MUT = process.env.GA_MUTATE || '';
if (MUT && /:5186\b/.test(APP)) { console.error('negative mutations never run against 5186'); process.exit(2); }
const SUPA = (SUPA_IN || 'http://127.0.0.1:54399').replace(/\/$/, '');
const TOL = 0.5;
mkdirSync(join(OUT, 'pdf'), { recursive: true });
const VPS = (process.env.GA_VIEWPORTS || '1280x900,390x844').split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { w, h }; });
const STYLES = (process.env.GA_STYLES || 'classic,modern,visual').split(',');
const LOCALES = (process.env.GA_LOCALES || 'he,en').split(',');
const OUTPUTS = (process.env.GA_OUTPUTS || 'screen,print,direct').split(',');
const MUT_CSS = {
  'final-1.3rem': '.pq-card .pq-total-final-amount{font-size:1.3rem!important}',
  'no-tabular': '.pq-card .pq-totals-box .pf-money{font-variant-numeric:normal!important;font-feature-settings:normal!important}',
  'break-ltr': '.pq-card .pq-totals-box .pf-money{direction:rtl!important;unicode-bidi:normal!important}',
  'center-totals': '.pq-card .pq-totals-box .pq-total-value,.pq-card .pq-totals-box .pq-total-final-amount{text-align:center!important;justify-self:center!important}',
  'item-off-center': '.pq-card td.pq-td-qty,.pq-card td.pq-td-price,.pq-card td.pq-td-total{text-align:right!important}',
};
const cells = [];
const notApplicable = [];
const cell = (id, pass, detail) => { cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail }); if (!pass) console.log(`FAIL ${id} ${JSON.stringify(detail).slice(0, 280)}`); };

// in-page probe (works under any media and inside the capture state)
function probe() {
  const glyphs = (el) => {
    const chars = []; const walk = (n) => { if (n.nodeType === 3) { for (let i = 0; i < n.textContent.length; i += 1) chars.push({ n, i, c: n.textContent[i] }); } else n.childNodes.forEach(walk); }; walk(el);
    const at = (k) => { if (k < 0 || !chars[k]) return null; const r = document.createRange(); r.setStart(chars[k].n, chars[k].i); r.setEnd(chars[k].n, chars[k].i + 1); const b = r.getBoundingClientRect(); return b.width ? Math.round((b.left + b.width / 2) * 100) / 100 : null; };
    const text = chars.map((x) => x.c).join('');
    const dot = text.lastIndexOf('.');
    const digitsBefore = []; for (let k = dot - 1; k >= 0 && digitsBefore.length < 2; k -= 1) if (/\d/.test(chars[k].c)) digitsBefore.push(k);
    const all = document.createRange(); all.selectNodeContents(el); const rects = [...all.getClientRects()].filter((r) => r.width > 0);
    const tops = new Set(rects.map((r) => Math.round(r.top)));
    const cs = getComputedStyle(el);
    return { text: text.trim(), decimal: dot >= 0 ? at(dot) : null, ones: digitsBefore[0] !== undefined ? at(digitsBefore[0]) : null, tens: digitsBefore[1] !== undefined ? at(digitsBefore[1]) : null, lines: tops.size, fontSize: cs.fontSize, fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), fontWeight: cs.fontWeight, fvn: cs.fontVariantNumeric, ffs: cs.fontFeatureSettings, dir: cs.direction, ub: cs.unicodeBidi, textAlign: cs.textAlign };
  };
  const card = document.querySelector('.pq-card');
  const rows = [...card.querySelectorAll('.pq-totals-box .pq-total-value, .pq-totals-box .pq-total-final-amount')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ kind: e.classList.contains('pq-total-final-amount') ? 'final' : 'row', ...glyphs(e) }));
  // section summaries: the collapsed summary row amount AND the expanded subtotal row amount (both protected summary values)
  const sections = [...card.querySelectorAll('tbody tr')].filter((tr) => tr.classList.contains('pq-section-subtotal-row') || tr.querySelector('.pq-section-toggle[aria-expanded="false"]')).map((tr) => tr.querySelector('td.pq-td-total .pf-money')).filter((e) => e && e.getBoundingClientRect().width > 0).map((e) => ({ kind: e.closest('tr').classList.contains('pq-section-subtotal-row') ? 'section-subtotal' : 'section-summary', ...glyphs(e) }));
  const centre = [];
  for (const td of card.querySelectorAll('td.pq-td-qty, td.pq-td-price, td.pq-td-total')) {
    if (!td.getBoundingClientRect().width || td.closest('tr.pq-section-subtotal-row') || td.closest('tr').querySelector('.pq-section-toggle')) continue; // items only: summary rows are not items
    const r = document.createRange(); r.selectNodeContents(td); const ink = r.getBoundingClientRect(); const box = td.getBoundingClientRect(); const cs = getComputedStyle(td);
    const inner = { l: box.left + parseFloat(cs.paddingLeft), r: box.right - parseFloat(cs.paddingRight) };
    centre.push({ cls: td.className, off: Math.round(((ink.left + ink.right) / 2 - (inner.l + inner.r) / 2) * 100) / 100 });
  }
  return { rows, sections, centre };
}

const judge = (id, p, locale) => {
  const spread = (a) => (a.length ? Math.round((Math.max(...a) - Math.min(...a)) * 100) / 100 : null);
  const rows = p.rows;
  cell(`${id}/rows-found`, rows.length >= 2 && rows.some((r) => r.kind === 'final'), { n: rows.length });
  if (rows.length < 2) return;
  const dec = rows.map((r) => r.decimal).filter((x) => x !== null); const ones = rows.map((r) => r.ones).filter((x) => x !== null); const tens = rows.map((r) => r.tens).filter((x) => x !== null);
  const values = rows.map((r) => `${r.kind}:${r.text}`);
  cell(`${id}/axis/decimal`, dec.length === rows.length && spread(dec) <= TOL, { spread: spread(dec), x: dec, values });
  cell(`${id}/axis/ones`, ones.length === rows.length && spread(ones) <= TOL, { spread: spread(ones), x: ones });
  cell(`${id}/axis/tens`, tens.length >= 2 && spread(tens) <= TOL, { spread: spread(tens), x: tens });
  cell(`${id}/metrics/identical`, new Set(rows.map((r) => `${r.fontSize}|${r.fontFamily}`)).size === 1 && rows[0].fontFamily === 'Rubik', { sizes: rows.map((r) => r.fontSize), family: rows[0].fontFamily, weights: rows.map((r) => r.fontWeight) });
  cell(`${id}/figures/tabular-lining`, rows.every((r) => /tabular-nums/.test(r.fvn) && /lining-nums/.test(r.fvn) && /tnum/.test(r.ffs)), { fvn: [...new Set(rows.map((r) => r.fvn))], ffs: [...new Set(rows.map((r) => r.ffs))] });
  cell(`${id}/isolation/ltr`, rows.every((r) => r.dir === 'ltr' && /isolate/.test(r.ub)), { dir: [...new Set(rows.map((r) => r.dir))], ub: [...new Set(rows.map((r) => r.ub))] });
  cell(`${id}/single-line`, rows.every((r) => r.lines === 1), { lines: rows.map((r) => r.lines) });
  cell(`${id}/values/${locale === 'he' ? 'ils-whole' : 'cents-kept'}`, locale === 'he' ? rows.every((r) => /\.00$/.test(r.text) && r.text.includes('₪')) : rows.every((r) => /\.\d\d$/.test(r.text) && !r.text.includes('₪')), { values });
  if (p.sections.length) {
    const s = p.sections;
    cell(`${id}/sections/axis-decimal-ones`, s.length >= 2 && spread(s.map((r) => r.decimal)) <= TOL && spread(s.map((r) => r.ones)) <= TOL, { n: s.length, decimal: s.map((r) => r.decimal), ones: s.map((r) => r.ones), values: s.map((r) => `${r.kind}:${r.text}`) });
    cell(`${id}/sections/metrics-figures-ltr`, new Set(s.map((r) => r.fontSize)).size === 1 && s.every((r) => /tabular-nums/.test(r.fvn) && r.dir === 'ltr' && /isolate/.test(r.ub) && r.lines === 1), { sizes: [...new Set(s.map((r) => r.fontSize))] });
  }
  const off = p.centre.filter((c) => Math.abs(c.off) > 1);
  if (p.centre.length) cell(`${id}/items/centred`, off.length === 0, { cells: p.centre.length, offCentre: off.slice(0, 4) });
  else notApplicable.push(`${id}/items/centred (no item rows visible: collapsed sections / Compact Direct PDF)`);
};

const browser = await chromium.launch();
const dp = await (await browser.newContext()).newPage();
await dp.goto(`${APP}/he/sample-quote`, { waitUntil: 'load', timeout: 120000 });
let identity = null; try { identity = await (await fetch(`${APP}/version.json`, { cache: 'no-store' })).json(); } catch { /* reported */ }
const DTOS = {};
// sample DTOs from the build under test (its own bundled sample builder is exercised through the sample route; for the
// Direct-PDF route the same data is reproduced from the page's sample controls - see dtoFor below)
async function dtoFor(page) { return page.evaluate(() => window.__T16_SAMPLE__ || null); }
for (const locale of LOCALES) for (const style of STYLES) for (const vp of VPS) {
  const base = `${locale}/${style}/${vp.w}`;
  for (const output of OUTPUTS.filter((o) => o !== 'direct')) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/${locale}/sample-quote?style=${style}&length=short&detail=compact&images=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('.pq-card .pq-totals-box', { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    if (MUT_CSS[MUT]) await page.addStyleTag({ content: MUT_CSS[MUT] });
    if (MUT === 'shift-row-2px') await page.evaluate(() => { const v = [...document.querySelectorAll('.pq-card .pq-totals-box .pq-total-value')]; const t = v[v.length - 1]; t.style.position = 'relative'; t.style.left = '2px'; });
    if (output === 'print') await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(200);
    const p = await page.evaluate(probe);
    judge(`${base}/${output}`, p, locale);
    if (output === 'print' && !MUT) { writeFileSync(join(OUT, 'pdf', `${locale}-${style}-${vp.w}-print.pdf`), await page.pdf({ format: 'A4', printBackground: true })); }
    if (!MUT) await page.screenshot({ path: join(OUT, `${locale}-${style}-${vp.w}-${output}-totals.png`), clip: await page.evaluate(() => { const b = document.querySelector('.pq-card .pq-totals-box').getBoundingClientRect(); return { x: Math.max(0, b.left - 8), y: Math.max(0, b.top + scrollY - 8), width: b.width + 16, height: b.height + 16 }; }).catch(() => undefined), fullPage: true }).catch(() => {});
    DTOS[base] = DTOS[base] || await dtoFor(page);
    await ctx.close();
  }
}
// Direct PDF: the real tile -> Compact flow on /quote/:id, glyphs measured inside the capture state
if (OUTPUTS.includes('direct')) {
  const dtoPage = await (await browser.newContext()).newPage();
  for (const locale of LOCALES) for (const style of STYLES) {
    // build the sample DTO with the app's own sample builder through a dev module when available; otherwise fall back to
    // a direct import from the served module graph is impossible on a production build - the DTO is taken from the dev URL
    const devUrl = process.env.GA_DEV || null;
    if (!devUrl) { cell(`${locale}/${style}/direct`, false, { error: 'GA_DEV (a dev server of the same tree) is required for the Direct-PDF route DTO' }); continue; }
    await dtoPage.goto(`${devUrl}/he/sample-quote`, { waitUntil: 'load', timeout: 120000 });
    const s = await dtoPage.evaluate(async ({ locale, style }) => { const m = await import('/src/quoteDocument/sampleQuotes.js'); const x = m.buildSampleQuote({ locale, style, length: 'short', images: true }); return { quoteData: x.quoteData, presentation: x.presentation }; }, { locale, style });
    const dto = JSON.parse(JSON.stringify(s.quoteData)); dto.business = { ...dto.business, phone: locale === 'he' ? '050-1234567' : '+1 555 0100' };
    for (const vp of VPS) {
      const id = `${locale}/${style}/${vp.w}/direct`;
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, acceptDownloads: true });
      // every Supabase request is answered locally: no TEST / Production contact, no write
      await ctx.route(`${SUPA}/**`, (r) => { const u = new URL(r.request().url()); let body = {}; if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto; else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = s.presentation; else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
      const page = await ctx.newPage();
      await page.goto(`${APP}/quote/${dto.quote.id}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForSelector('.pq-card .pq-totals-box', { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
      if (MUT_CSS[MUT]) await page.addStyleTag({ content: MUT_CSS[MUT] });
      if (MUT === 'shift-row-2px') await page.evaluate(() => { const v = [...document.querySelectorAll('.pq-card .pq-totals-box .pq-total-value')]; const t = v[v.length - 1]; t.style.position = 'relative'; t.style.left = '2px'; });
      await page.evaluate(`window.__probe = ${probe.toString()}; window.__cap = null; { const pg = document.querySelector('.pq-page'); new MutationObserver(() => { if (!window.__cap && pg.classList.contains('pq-pdf-capturing')) window.__cap = window.__probe(); }).observe(pg, { attributes: true, attributeFilter: ['class'] }); }`);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), (async () => { await page.locator('.pq-action-tile').first().click(); await page.locator('[role="dialog"] button').nth(1).click(); })()]);
      if (!MUT) await dl.saveAs(join(OUT, 'pdf', `${locale}-${style}-${vp.w}-direct.pdf`));
      const cap = await page.evaluate(() => window.__cap);
      if (!cap) cell(`${id}/capture-observed`, false, { captured: false }); else judge(id, cap, locale);
      await ctx.close();
    }
  }
}
// SECTIONED quotes (IRON-NUMERIC-001 "section subtotal where present"): collapsed summary rows (screen) and expanded subtotal
// rows (screen / print / Direct capture) must share one glyph axis; subtotals of different magnitudes (9.00 vs 2,120.00).
if (process.env.GA_SECTIONS !== '0') {
  const fx = await import(new URL('../print/fixtures.mjs', import.meta.url).href);
  for (const locale of LOCALES) for (const style of STYLES) for (const vp of VPS) {
    const b = fx.build({ name: 'sections', rows: 6, notes: 'short', terms: 'short', clientDetails: 'full', attn: 'name', business: 'full', discount: 5, locale });
    const dto = b.quoteData;
    dto.items = dto.items.map((it, i) => ({ ...it, section_id: i < 1 ? 'sec-a' : i < 3 ? 'sec-b' : 'sec-c' }));
    dto.items[0] = { ...dto.items[0], quantity: 1, unit_price: 9, price: 9, total_price: 9 };
    dto.sections = [{ id: 'sec-a', name: 'A', sort_order: 0 }, { id: 'sec-b', name: 'B', sort_order: 1 }, { id: 'sec-c', name: 'C', sort_order: 2 }];
    const id = `${locale}/${style}/${vp.w}/sections`;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, acceptDownloads: true });
    await ctx.route(`${SUPA}/**`, (r) => { const u = new URL(r.request().url()); let body = {}; if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto; else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = fx.presentationFor(style); else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
    const page = await ctx.newPage();
    await page.goto(`${APP}/quote/${dto.quote.id}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('.pq-card .pq-section-toggle', { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    if (MUT_CSS[MUT]) await page.addStyleTag({ content: MUT_CSS[MUT] });
    if (MUT === 'center-section-summary') await page.addStyleTag({ content: '.pq-card td.pq-td-total{text-align:center!important}' });
    judge(`${id}/collapsed/screen`, await page.evaluate(probe), locale);
    for (const t of await page.locator('.pq-card .pq-section-toggle').all()) await t.click();
    await page.waitForTimeout(300);
    judge(`${id}/expanded/screen`, await page.evaluate(probe), locale);
    await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(200);
    judge(`${id}/expanded/print`, await page.evaluate(probe), locale);
    if (!MUT) writeFileSync(join(OUT, 'pdf', `${locale}-${style}-${vp.w}-sections-print.pdf`), await page.pdf({ format: 'A4', printBackground: true }));
    await page.emulateMedia({ media: 'screen' }); await page.waitForTimeout(200);
    await page.evaluate(`window.__probe = ${probe.toString()}; window.__cap = null; { const pg = document.querySelector('.pq-page'); new MutationObserver(() => { if (!window.__cap && pg.classList.contains('pq-pdf-capturing')) window.__cap = window.__probe(); }).observe(pg, { attributes: true, attributeFilter: ['class'] }); }`);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), (async () => { await page.locator('.pq-action-tile').first().click(); await page.locator('[role="dialog"] button').nth(1).click(); })()]);
    if (!MUT) await dl.saveAs(join(OUT, 'pdf', `${locale}-${style}-${vp.w}-sections-direct.pdf`));
    const cap = await page.evaluate(() => window.__cap);
    if (!cap) cell(`${id}/expanded/direct/capture-observed`, false, { captured: false }); else judge(`${id}/expanded/direct`, cap, locale);
    await ctx.close();
  }
}
await browser.close();
const fail = cells.filter((c) => c.result === 'FAIL');
writeFileSync(join(OUT, `glyph-axis${MUT ? `-${MUT}` : ''}.json`), JSON.stringify({ gate: 'task16 protected summary glyph axis (IRON-NUMERIC-001)', app: APP, mutation: MUT || null, tolerancePx: TOL, servedIdentity: identity && { buildSha: identity.buildSha, buildInputDigest: identity.buildInputDigest, dirty: identity.dirty, mode: identity.mode }, pass: cells.length - fail.length, fail: fail.length, notApplicable, cells }, null, 1));
console.log(`GLYPH AXIS GATE${MUT ? ` [negative: ${MUT}]` : ''}: ${cells.length - fail.length} PASS / ${fail.length} FAIL (${identity ? String(identity.buildSha).slice(0, 12) : 'identity unknown'})`);
process.exit(fail.length ? 1 : 0);
