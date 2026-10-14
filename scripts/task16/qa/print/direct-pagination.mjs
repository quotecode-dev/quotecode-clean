// Task 16 cloud-fix3 (A6) - DIRECT PDF PAGINATION PROBE (LOCAL-DEV, mocked functions, synthetic data).
// The Direct PDF is a raster (html2canvas + jsPDF), so its pages have no text to classify. This probe reproduces its page
// slicing exactly: on a Vite DEV server of the tree under test it opens the real /quote/:id route (mocked functions),
// applies the capture state generateQuotePdf's clone uses (.pq-pdf-capturing on .pq-page, card width 718px, window
// 1100px), then imports the tree's own src/utils/generateQuotePdf.js and runs ITS measurePaginationBlocks +
// computePageBoundaries (+ the totals safety zone, as generateQuotePdf builds it) at scale 1. Every page slice is then
// classified by the document blocks it shows: body | approval-only | footer-only.
// Cells: direct/no-footer-only, direct/no-approval-only, direct/pages (every short fixture: 1 page, or <= 2 for a recorded
// print waiver - fixtures.mjs PRINT_WAIVERS).
// Usage: node scripts/task16/qa/print/direct-pagination.mjs <outDir> <name>=<devUrl> ...
//   env DP_FIXTURES DP_LOCALES DP_STYLES DP_SWEEP=1 (adds the footer-orphan sweep notes lengths, Classic) DP_ASSERT=1
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { build, fillerText, PAGINATION_FIXTURES, PRINT_WAIVERS, presentationFor } from './fixtures.mjs';
import { assertLocal, newQuoteContext, openQuote } from './printLib.mjs';

const [OUT, ...targetArgs] = process.argv.slice(2);
const TARGETS = targetArgs.map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
TARGETS.forEach((t) => assertLocal(t.url));
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const FIXTURES = list(process.env.DP_FIXTURES, PAGINATION_FIXTURES.map((f) => f.name));
const LOCALES = list(process.env.DP_LOCALES, ['he', 'en']);
const STYLES = list(process.env.DP_STYLES, ['classic', 'modern', 'visual']);
const ASSERT = process.env.DP_ASSERT === '1';
mkdirSync(OUT, { recursive: true });

function sliceProbe() {
  return (async () => {
    const m = await import('/src/utils/generateQuotePdf.js');
    const pg = document.querySelector('.pq-page');
    const card = document.querySelector('.pq-card');
    pg.classList.add('pq-pdf-capturing');
    card.style.width = `${m.PDF_DOCUMENT_WIDTH_PX}px`;
    card.style.maxWidth = 'none';
    card.style.boxSizing = 'border-box';
    await new Promise((r) => setTimeout(r, 120));
    const { blocks, totals, units, end } = m.measurePaginationBlocks(card);
    const box = m.getA4ContentBoxPt();
    const pxPerPt = m.PDF_DOCUMENT_WIDTH_PX / box.contentWidthPt; // scale 1: canvas width = 718 CSS px
    const pageH = box.contentHeightPt * pxPerPt;
    const totalsPx = totals.map((b) => ({ top: b.bottom, bottom: b.bottom + 24 * pxPerPt, pushTo: b.bottom + 6 * pxPerPt }));
    const unitPx = units.map((b) => ({ top: b.top, bottom: b.bottom, maxWasteRatio: 0.5 }));
    const all = [...blocks, ...totalsPx, ...unitPx].sort((a, b) => a.top - b.top);
    const cardRect = card.getBoundingClientRect();
    const H = cardRect.height;
    // the tree's own slicing: computeDocumentBoundaries (cloud-fix3) when it exists, else the plain computePageBoundaries
    const boundaries = m.computeDocumentBoundaries ? m.computeDocumentBoundaries(H, pageH, all, end || null) : m.computePageBoundaries(H, pageH, all);
    // document blocks in capture order (Modern: the body wrappers' children)
    const flat = [];
    for (const ch of card.children) {
      if (/pq-body-grid/.test(ch.className)) { for (const c2 of ch.children) for (const c3 of c2.children) flat.push(c3); } else if (/pq-doc-end/.test(ch.className)) { for (const c2 of ch.children) flat.push(c2); } else flat.push(ch);
    }
    const kindOf = (e) => (e.matches('.pq-doc-foot') ? 'footer' : e.matches('.pq-approval, .pq-doc-status') ? 'approval' : 'body');
    const rects = flat.map((e) => { const r = e.getBoundingClientRect(); return { kind: kindOf(e), cls: String(e.className).split(' ').slice(0, 2).join('.'), top: r.top - cardRect.top, bottom: r.bottom - cardRect.top }; }).filter((b) => b.bottom > b.top);
    const pages = [];
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const [a, b] = [boundaries[i], boundaries[i + 1]];
      const shown = rects.filter((r) => r.bottom > a + 1 && r.top < b - 1);
      const kinds = new Set(shown.map((r) => r.kind));
      const kind = !shown.length ? 'blank' : kinds.has('body') ? 'body' : kinds.has('approval') ? 'approval-only' : 'footer-only';
      pages.push({ page: i + 1, from: Math.round(a), to: Math.round(b), kind, blocks: shown.map((r) => r.cls) });
    }
    pg.classList.remove('pq-pdf-capturing');
    card.style.width = '100%'; card.style.maxWidth = '';
    return { cardH: Math.round(H * 10) / 10, pageH: Math.round(pageH * 10) / 10, boundaries: boundaries.map((x) => Math.round(x)), pages };
  })();
}

const cases = [];
for (const f of FIXTURES) for (const locale of LOCALES) for (const style of STYLES) cases.push({ id: `${f}/${locale}/${style}`, fixture: f, locale, style, fx: build({ ...PAGINATION_FIXTURES.find((x) => x.name === f), locale }) });
if (process.env.DP_SWEEP === '1') {
  for (const locale of LOCALES) for (const rows of [1, 2, 3]) for (let n = 600; n <= 1600; n += 40) {
    cases.push({ id: `sweep/${locale}/classic/rows${rows}/notes${n}`, fixture: 'sweep', style: 'classic', fx: build({ name: 'sweep', locale, rows, clientDetails: 'full', attn: 'full', business: 'full', terms: 'medium', discount: 5, notesText: fillerText(locale, n) }) });
  }
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const cells = [];
const cell = (id, pass, detail) => cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail });
const rows = [];
for (const t of TARGETS) for (const c of cases) {
  const ctx = await newQuoteContext(browser, { viewport: { width: 1100, height: 900 }, dto: c.fx.quoteData, presentation: presentationFor(c.style) });
  const page = await ctx.newPage();
  const id = `${t.name}/${c.id}`;
  try {
    await openQuote(page, t.url, c.fx.quoteData);
    const r = await page.evaluate(sliceProbe);
    rows.push({ id, ...r });
    const kinds = r.pages.map((p) => p.kind);
    if (ASSERT) {
      cell(`${id}/direct/no-footer-only`, !kinds.includes('footer-only'), r.pages);
      cell(`${id}/direct/no-approval-only`, !kinds.includes('approval-only'), r.pages);
      // cloud-fix4: every short fixture is asserted - 1 page, or at most 2 where the print waiver records content taller
      // than A4 (PRINT_WAIVERS; the Direct PDF may still merge a negligible trailing slice into 1 page)
      const short = !/^long|^sweep/.test(c.fixture);
      const waiver = PRINT_WAIVERS[`${c.fixture}/${c.locale}/${c.style}`];
      if (short) cell(`${id}/direct/pages`, waiver ? r.pages.length <= 2 : r.pages.length === 1, { pages: r.pages.length, waiver: waiver ? waiver.reason : null, cardH: r.cardH, pageH: r.pageH });
    }
    if (kinds.some((k) => k !== 'body') || !process.env.DP_QUIET) console.log(`${id.padEnd(52)} pages=${r.pages.length} [${kinds.join(',')}] cardH=${r.cardH}`);
  } catch (e) { rows.push({ id, error: String(e.message || e).slice(0, 200) }); console.log(`${id} ERROR ${String(e.message || e).slice(0, 160)}`); }
  await ctx.close();
}
await browser.close();
const fail = cells.filter((x) => x.result !== 'PASS');
const orphans = rows.filter((r) => (r.pages || []).some((p) => p.kind !== 'body'));
writeFileSync(join(OUT, 'direct-pagination.json'), JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, targets: TARGETS, cases: cases.length, orphans: orphans.map((o) => o.id), pass: cells.length - fail.length, fail: fail.length, cells, rows }, null, 1));
console.log(`DIRECT PAGINATION: ${rows.length} documents, ${orphans.length} with an orphan page${ASSERT ? `; ${cells.length - fail.length} PASS / ${fail.length} FAIL` : ''}`);
for (const x of fail) console.log(`  FAIL ${x.id} ${JSON.stringify(x.detail).slice(0, 240)}`);
process.exit(ASSERT && fail.length ? 1 : 0);
