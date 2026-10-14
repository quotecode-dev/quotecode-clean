// Task 16 cloud-fix3 (A6) - NATIVE PRINT PAGINATION GATE + causal probe (LOCAL-DEV, mocked functions, synthetic data).
//
// Renders the REAL public route /quote/:id (SmartPublicQuote -> PublicQuote / PublicQuoteEn) of one or more production
// builds (e.g. the approved base c65f742 and the candidate), with get-public-quote / quote-presentation answered by
// Playwright route mocks carrying the SYNTHETIC fixtures of ./fixtures.mjs. For every target x fixture x locale x style it
//   - measures the document blocks under print media (top/bottom/height/margins of every .pq-card block, the footer and
//     the approval block), so a page overflow can be attributed to a block;
//   - prints with Chromium (emulateMedia print + page.pdf A4, printBackground) and records the page count and the text of
//     every page (pdftotext per page);
//   - classifies each page: blank, footer-only (every word belongs to the document footer), approval-only (every word
//     belongs to the approval/signature block or the footer) or body;
//   - optionally (PP_DIRECT=1) downloads the Direct PDF through the real tile (Compact) and records its page count.
// Gate mode (PP_ASSERT=1; cells for the targets in PP_ASSERT_TARGETS, default all):
//   print/pages            short fixtures: exactly the EXPECTED count (1, or 2 where the content is taller than one A4
//                          page at the screen type - each such case is a recorded waiver with its measured height);
//                          long-18 / long-40: >= 2 pages
//   print/type-equals-screen  (cloud-fix4) every document element has the SAME computed font-size / line-height /
//                          weight under print media as on screen (no print-only type density)
//   print/approval-after-body (cloud-fix4, semantic) DOM: the approval / status record follows every body block (table,
//                          attachments, totals, terms / notes) and starts below them in the print layout; PDF: on the
//                          last page the approval title line sits BELOW every body word
//   print/signature-in-approval (cloud-fix4, semantic) the signature line (unsigned) / signature image (signed) is a DOM
//                          descendant of the approval block AND inside its box; unsigned: the signature-line label is on
//                          the last PDF page below the approval title (within 160pt)
//   print/no-blank-page    no page without text
//   print/no-footer-only   no page that holds only the document footer
//   print/no-approval-only no page that holds only the approval / signature block (+ footer)
//   print/approval-last    the approval block is on the LAST page only, and that page also holds body content
//   print/footer-last      the footer is on the last page, together with body content
//   print/all-rows         every item row description of the fixture is in the PDF text
//   print/totals-present   the grand-total label is in the PDF text
//   direct/pages           (PP_DIRECT=1) Direct PDF: short = 1 page, long >= 2
// Exit 0 = all PASS, 1 = any FAIL, 2 = setup error.
//
// Usage: node scripts/task16/qa/print/print-pagination.mjs <outDir> <name>=<buildUrl> [<name>=<buildUrl> ...]
//   env PP_FIXTURES=a,b  PP_LOCALES=he,en  PP_STYLES=classic,modern,visual  PP_VIEWPORT=1280x900  PP_DIRECT=1
//       PP_ASSERT=1  PP_ASSERT_TARGETS=cand  PP_DROP_ROWS=n (negative control: the PRINTED quote loses its last n rows
//       while the expectation keeps them)  PW_CHROMIUM=<chrome>
// URLs must be 127.0.0.1/localhost and never port 5186. No TEST/Production contact: the builds point at the dead local
// http://127.0.0.1:54399 and every request to it is fulfilled here.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { build, contentFingerprint, PAGINATION_FIXTURES, PRINT_WAIVERS, presentationFor } from './fixtures.mjs';
import { A4_CONTENT_H, approvalPlacement, assertLocal, classifyPages, missingRows, newQuoteContext, norm, openQuote, pdfPages, probePrint, probeType, rawText, words } from './printLib.mjs';

const [OUT, ...targetArgs] = process.argv.slice(2);
if (!OUT || !targetArgs.length) { console.error('usage: print-pagination.mjs <outDir> <name>=<url> ...'); process.exit(2); }
const TARGETS = targetArgs.map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
try { TARGETS.forEach((t) => assertLocal(t.url)); } catch (e) { console.error(e.message); process.exit(2); }
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const FIXTURES = list(process.env.PP_FIXTURES, PAGINATION_FIXTURES.map((f) => f.name));
const LOCALES = list(process.env.PP_LOCALES, ['he', 'en']);
const STYLES = list(process.env.PP_STYLES, ['classic', 'modern', 'visual']);
const [VW, VH] = (process.env.PP_VIEWPORT || '1280x900').split('x').map(Number);
const DIRECT = process.env.PP_DIRECT === '1';
const ASSERT = process.env.PP_ASSERT === '1';
const ASSERT_TARGETS = list(process.env.PP_ASSERT_TARGETS, TARGETS.map((t) => t.name));
const DROP_ROWS = Number(process.env.PP_DROP_ROWS || 0);
mkdirSync(join(OUT, 'pdf'), { recursive: true });

// Expected native-Print page counts (cloud-fix4, A13). The document prints at its SCREEN type (ledger D24) with the base
// panels restored (D19 / D20 / D23 / D27, D09 subject); the A4 layout layer (gaps, arrangement, media sizes - never type)
// fits every short fixture on ONE page except fixtures.mjs PRINT_WAIVERS (2 pages asserted, real content on page 2).
const SHORT_FIXTURES = ['short-1item-min', 'short-2items', 'short-3items-attn', 'test-like', 'test-like-logo', 'test-like-attach', 'test-like-signed', 'short-4items-longnotes'];
const EXPECTED = Object.fromEntries(PAGINATION_FIXTURES.map((f) => [f.name, SHORT_FIXTURES.includes(f.name) ? 'short' : '>=2']));
const expectedFor = (fixture, style, locale) => {
  const e = EXPECTED[fixture];
  if (e !== 'short') return e;
  return PRINT_WAIVERS[`${fixture}/${locale}/${style}`] ? 2 : 1;
};
const GRAND_TOTAL = { he: 'סה"כ לתשלום', en: 'Total' };

const cells = [];
const cell = (id, pass, detail) => cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail });
const pageCountOk = (exp, n) => (typeof exp === 'number' ? n === exp : exp === '>=2' ? n >= 2 : true);

let browser;
try { browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); } catch (e) { console.error(`cannot launch Chromium: ${e.message}`); process.exit(2); }

const runs = [];
for (const target of TARGETS) for (const fname of FIXTURES) for (const locale of LOCALES) for (const style of STYLES) {
  const spec = PAGINATION_FIXTURES.find((f) => f.name === fname);
  if (!spec) { console.error(`unknown fixture ${fname}`); process.exit(2); }
  const fx = build({ ...spec, locale });
  const dto = JSON.parse(JSON.stringify(fx.quoteData));
  if (DROP_ROWS > 0) dto.items = dto.items.slice(0, Math.max(0, dto.items.length - DROP_ROWS));
  const id = `${target.name}/${fname}/${locale}/${style}`;
  const fileId = id.replace(/\//g, '-');
  const run = { id, target: target.name, fixture: fname, locale, style, viewport: `${VW}x${VH}`, droppedRows: DROP_ROWS || undefined };
  const ctx = await newQuoteContext(browser, { viewport: { width: VW, height: VH }, dto, presentation: presentationFor(style) });
  const page = await ctx.newPage();
  try {
    await openQuote(page, target.url, dto);
    const typeScreen = await page.evaluate(probeType);
    await page.emulateMedia({ media: 'print' });
    const typePrint = await page.evaluate(probeType);
    const pr = await page.evaluate(probePrint);
    run.print = { a4ContentH: +A4_CONTENT_H.toFixed(1), card: pr.card, footer: pr.footer, approval: pr.approval, blocks: pr.blocks };
    const pdf = join(OUT, 'pdf', `${fileId}-print.pdf`);
    writeFileSync(pdf, await page.pdf({ format: 'A4', printBackground: true }));
    await page.emulateMedia({ media: 'screen' });
    const n = pdfPages(pdf);
    run.printPages = n;
    run.pages = classifyPages(pdf, pr.footerText, pr.approvalText);
    const missing = missingRows(pdf, fx.rowDescriptions);
    const all = norm(rawText(pdf));
    run.rows = { expected: fx.rowDescriptions.length, missing };
    run.typeDiff = Object.keys(typeScreen).filter((k) => JSON.stringify(typeScreen[k]) !== JSON.stringify(typePrint[k])).map((k) => ({ el: k, screen: typeScreen[k], print: typePrint[k] }));
    run.typeElements = Object.keys(typeScreen).length;
    run.semantic = pr.semantic;
    run.placement = pr.semantic && pr.semantic.kind !== 'status'
      ? approvalPlacement(pdf, { approvalTitle: pr.semantic.approvalTitle, approvalText: pr.approvalText, footerText: pr.footerText, signatureLineText: pr.semantic.signatureLineText })
      : null;
    if (DIRECT) {
      const tile = page.locator('.pq-action-tile').first();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        (async () => { await tile.click(); await page.locator('[role="dialog"] button').nth(1).click(); })(),
      ]);
      const dpdf = join(OUT, 'pdf', `${fileId}-direct.pdf`);
      await download.saveAs(dpdf);
      run.directPages = pdfPages(dpdf);
    }
    if (ASSERT && ASSERT_TARGETS.includes(target.name)) {
      const exp = expectedFor(fname, style, locale);
      const waiver = PRINT_WAIVERS[`${fname}/${locale}/${style}`];
      const fpNow = contentFingerprint(dto, presentationFor(style)); // the content actually printed (PP_DROP_ROWS changes it)
      run.fingerprint = fpNow;
      // cloud-fix4b: a 2-page waiver only covers the exact content it was measured on (rows + images + fingerprint)
      if (waiver) cell(`${id}/print/waiver-bound`, waiver.fp === fpNow.fp && waiver.rows === fpNow.rows && waiver.images === fpNow.images, { waiver, now: fpNow });
      if (exp != null) cell(`${id}/print/pages`, pageCountOk(exp, n), { pages: n, expected: exp, waiver, fingerprint: fpNow, cardH: pr.card?.h, a4ContentH: +A4_CONTENT_H.toFixed(1) });
      cell(`${id}/print/type-equals-screen`, run.typeElements > 10 && run.typeDiff.length === 0, { elements: run.typeElements, diff: run.typeDiff.slice(0, 6) });
      const sem = pr.semantic;
      const pl = run.placement;
      cell(`${id}/print/approval-after-body`, !!sem && sem.bodyBlocks > 0 && sem.bodyBlocksNotBeforeApproval.length === 0 && sem.approvalTop >= sem.bodyBottom - 0.5
        && (sem.kind === 'status' || (!!pl && pl.titleFound && pl.bodyAbove)), { semantic: sem, placement: pl });
      if (sem && sem.kind !== 'status') {
        cell(`${id}/print/signature-in-approval`, !!sem.signature && sem.signature.insideApprovalDom && sem.signature.insideApprovalBox && (sem.kind === 'signed' || pl?.signatureBelow === true), { signature: sem.signature, placement: pl });
      }
      cell(`${id}/print/no-blank-page`, run.pages.every((p) => p.kind !== 'blank'), run.pages.map((p) => p.kind));
      cell(`${id}/print/no-footer-only`, run.pages.every((p) => p.kind !== 'footer-only'), run.pages.map((p) => ({ page: p.page, kind: p.kind, words: p.words })));
      cell(`${id}/print/no-approval-only`, run.pages.every((p) => p.kind !== 'approval-only'), run.pages.map((p) => ({ page: p.page, kind: p.kind, words: p.words })));
      const last = run.pages[run.pages.length - 1];
      if (pr.approvalText) cell(`${id}/print/approval-last`, !!last && last.hasApproval && last.bodyWords > 0 && run.pages.slice(0, -1).every((p) => !p.hasApproval), { lastPage: last, approvalPages: run.pages.filter((p) => p.hasApproval).map((p) => p.page) });
      if (pr.footerText) cell(`${id}/print/footer-last`, !!last && last.hasFooter && last.bodyWords > 0, { lastPage: last });
      cell(`${id}/print/all-rows`, missing.length === 0 && fx.rowDescriptions.length > 0, run.rows);
      cell(`${id}/print/totals-present`, words(GRAND_TOTAL[locale]).every((x) => words(all).includes(x)), { want: GRAND_TOTAL[locale] });
      if (DIRECT && exp != null) cell(`${id}/direct/pages`, pageCountOk(exp, run.directPages) || (exp === 2 && run.directPages === 1), { pages: run.directPages, expected: exp, note: 'a print waiver (2) also accepts a 1-page Direct PDF (its trailing-slice merge)' });
    }
  } catch (e) {
    run.error = String(e.message || e).slice(0, 300);
    if (ASSERT && ASSERT_TARGETS.includes(target.name)) cell(`${id}/rendered`, false, { error: run.error });
  }
  runs.push(run);
  await ctx.close();
  const f = run.print?.footer;
  console.log(`${id.padEnd(46)} print=${run.printPages ?? '-'}${DIRECT ? ` direct=${run.directPages ?? '-'}` : ''} pages=[${(run.pages || []).map((p) => p.kind).join(',')}] cardBottom=${run.print?.card?.bottom ?? '-'} footerBottom=${f ? f.bottom : '-'} rowsMissing=${run.rows ? run.rows.missing.length : '-'}${run.error ? ` ERROR ${run.error}` : ''}`);
}
await browser.close();

const fail = cells.filter((c) => c.result !== 'PASS');
writeFileSync(join(OUT, 'print-pagination.json'), JSON.stringify({
  gate: 'task16 print pagination (LOCAL-DEV, mocked functions, synthetic fixtures - not TEST, not Owner acceptance)',
  targets: TARGETS, fixtures: FIXTURES, locales: LOCALES, styles: STYLES, viewport: `${VW}x${VH}`, direct: DIRECT, dropRows: DROP_ROWS,
  expected: EXPECTED, waivers: PRINT_WAIVERS, generatedAt: new Date().toISOString(), node: process.version,
  pass: cells.length - fail.length, fail: fail.length, cells, runs,
}, null, 1));
if (ASSERT) {
  console.log(`PRINT PAGINATION GATE: ${cells.length - fail.length} PASS / ${fail.length} FAIL`);
  for (const x of fail) console.log(`  FAIL ${x.id} ${JSON.stringify(x.detail).slice(0, 300)}`);
  process.exit(fail.length ? 1 : 0);
}
process.exit(0);
