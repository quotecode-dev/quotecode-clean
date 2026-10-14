// Task 16 - print / PDF output QA of the public sample quote pages.
// Usage: node scripts/task16/qa/qa-print-pdf.mjs --base-url http://127.0.0.1:5417 [--out DIR] [--locales he,en]
//          [--styles classic,modern,visual] [--no-direct-pdf]
// For each locale x style x length (short, long): print-emulated DOM assertions + Chromium page.pdf (A4) saved and
// page-counted. Then the page's own "Download PDF" path (QuotePrintModeModal -> generateQuotePdf -> download event)
// when the sample page exposes it. Output: <out>/print-pdf/matrix.json + PDFs.
// cloud-fix3 (A6): page counts are ASSERTED, not informational. Per PDF (pdftotext per page):
//   shortPageCount   short sample (images on): ONE page in Classic, Modern and Visual - ASSERTED in every style (cloud-fix4b,
//                    U13 / F5b: the Owner rejection S-REJ "short Modern/Visual print sometimes 2 pages"). The expectation is
//                    BOUND to the rendered sample content (fixtureBound: item rows + images + a fingerprint of the card's
//                    text and image sources, SAMPLE_BINDING): a sample whose content changed FAILS instead of being judged
//                    against an expectation made for other content.
//   typeEqualsScreen (cloud-fix4) computed font-size / line-height / weight of every document element: print = screen
//   approvalAfterBody / signatureInApproval (cloud-fix4, SEMANTIC placement, see print/printLib.mjs approvalPlacement):
//                    the approval record follows every body block in the DOM and in the print layout, its title is below
//                    every body word of the last PDF page, the signature line is inside the approval block (DOM + box)
//                    and below the approval title on the last page
//   longIsMultiPage  long sample >= 2 pages (kept; not sufficient on its own - see the next checks)
//   noBlankPage / noFooterOnlyPage / noApprovalOnlyPage   no page without text, holding only the document footer, or only the
//                    approval / signature block (+ footer)
//   approvalOnLastPage  the approval block is on the LAST page only, together with preceding body content
//   allRowsPresent   every item row of the sample (3 short / 18 long, descriptions below) is in the PDF text
// --pw-chromium / PW_CHROMIUM selects a pre-installed Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { approvalPlacement, classifyPages, missingRows, probePrint, probeType } from './print/printLib.mjs';
import {
  loadPlaywright, parseArgs, resolveBaseUrl, outDir, writeJson, summarize, slug, isMain,
  pass, fail, notTested,
} from './lib.mjs';
import { sampleUrl, openSample } from './qa-public-sample.mjs';

const STYLES = ['classic', 'modern', 'visual'];
// Asserted native-Print page counts of the SHORT sample (null = recorded only).
export const SHORT_PAGES = { classic: 1, visual: 1, modern: 1 };
// cloud-fix4b: the content the SHORT_PAGES expectation was measured on (rows, images, sha256 of the card text + image
// sources, first 16 hex) per locale / style; filled from a run of this script (detail.fingerprint).
export const SAMPLE_BINDING = {
  'he/classic': { rows: 3, images: 0, fp: 'ef774666af9c2f69' }, 'he/modern': { rows: 3, images: 5, fp: '21288061eb9916c9' },
  'he/visual': { rows: 3, images: 5, fp: '21288061eb9916c9' }, 'en/classic': { rows: 3, images: 0, fp: 'ad6d8dfe2c0c7639' },
  'en/modern': { rows: 3, images: 5, fp: 'e49c3f35a2eba860' }, 'en/visual': { rows: 3, images: 5, fp: 'aaf0df1020ced45f' },
};
async function domFingerprint(page) {
  const d = await page.evaluate(() => {
    const card = document.querySelector('.pq-card');
    const imgs = [...card.querySelectorAll('img')].filter((i) => i.closest('.pq-media')).map((i) => (i.currentSrc || i.src).split('/').pop());
    const text = card.innerText.replace(/\s+/g, ' ').replace(/\d{2}\/\d{2}\/\d{4}/g, '<date>').trim();
    return { rows: card.querySelectorAll('table.pq-commercial-table tbody tr').length, images: imgs.length, payload: JSON.stringify({ text, imgs }) };
  });
  const { createHash } = await import('node:crypto');
  return { rows: d.rows, images: d.images, fp: createHash('sha256').update(d.payload).digest('hex').slice(0, 16) };
}
// The synthetic sample rows (src/quoteDocument/sampleQuotes.js CONTENT; long = the 3 rows x 6, rows 4+ suffixed " · N").
// Kept as an independent copy on purpose: the check must fail when the renderer (or the sample) loses a row.
const SAMPLE_ROWS = {
  he: ['מערכת מדפי אלון', 'משטח עבודה מעץ אלון', 'התקנה וכיוון סופי'],
  en: ['Custom oak shelving', 'Solid oak worktop', 'Installation & final alignment'],
};
export function sampleRowDescriptions(locale, length) {
  const rows = SAMPLE_ROWS[locale === 'en' ? 'en' : 'he'];
  const out = [];
  for (let r = 0; r < (length === 'long' ? 6 : 1); r += 1) rows.forEach((d) => { const i = out.length; out.push(i > 2 ? `${d} · ${i + 1}` : d); });
  return out;
}
const TOTALS_SEL = '.pq-totals-box, .pq-totals-grid, [data-testid="pq-totals"], .pq-total-final-amount';
const SIGNATURE_SEL = '[data-testid*="signature" i], [class*="pq-sig"], [class*="signature"], [data-testid*="approval" i], [class*="pq-approval"]';

export function countPdfPages(buf) {
  const text = buf.toString('latin1');
  const pages = text.match(/\/Type\s*\/Page(?![s\w])/g);
  return pages ? pages.length : 0;
}

export async function printProbe(page) {
  return page.evaluate(({ TOTALS_SEL, SIGNATURE_SEL }) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    };
    const desc = (el) => ({ tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '', text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), ariaExpanded: el.getAttribute('aria-expanded') });
    const card = document.querySelector('.pq-card');
    if (!card) return null;
    const cardRect = card.getBoundingClientRect();
    const inside = (el) => {
      const r = el.getBoundingClientRect();
      return r.left >= cardRect.left - 1 && r.right <= cardRect.right + 1 && r.top >= cardRect.top - 1 && r.bottom <= cardRect.bottom + 1;
    };
    const clipped = (el) => {
      // An ancestor (up to the card) with overflow other than visible that is smaller than the element clips it.
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
          const ar = a.getBoundingClientRect();
          if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) return desc(a);
        }
        if (a === card) break;
      }
      return el.scrollWidth > el.clientWidth + 1 ? { selfOverflow: true, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null;
    };
    const controls = [...document.querySelectorAll('button, [role="button"], .pq-action-tile, a.pq-action, [role="dialog"], input, textarea, canvas')]
      .filter(visible).map((el) => ({ ...desc(el), insideCard: card.contains(el) }));
    const thead = card.querySelector('thead');
    const totals = [...card.querySelectorAll(TOTALS_SEL)].filter(visible);
    const sig = [...card.querySelectorAll(SIGNATURE_SEL)].filter(visible);
    const footerEl = card.querySelector('.pq-doc-foot');
    const approvalEl = card.querySelector('.pq-approval, .pq-doc-status');
    return {
      footerText: footerEl && visible(footerEl) ? footerEl.innerText : '',
      approvalText: approvalEl && visible(approvalEl) ? approvalEl.innerText : '',
      cardVisible: visible(card),
      fixedOverlays: [...document.querySelectorAll('body *')].filter((el) => !card.contains(el) && getComputedStyle(el).position === 'fixed' && visible(el)).map(desc),
      controls,
      theadDisplay: thead ? getComputedStyle(thead).display : null,
      totals: totals.slice(0, 3).map((el) => ({ ...desc(el), insideCard: inside(el), clippedBy: clipped(el) })),
      signature: sig.slice(0, 3).map((el) => ({ ...desc(el), insideCard: inside(el), clippedBy: clipped(el) })),
    };
  }, { TOTALS_SEL, SIGNATURE_SEL });
}

export function blockVerdict(list, name) {
  if (!list.length) return fail(`no visible ${name} element (selectors: ${name === 'totals' ? TOTALS_SEL : SIGNATURE_SEL})`);
  const bad = list.filter((x) => !x.insideCard || x.clippedBy);
  return bad.length ? fail(bad) : pass(list.map((x) => x.cls || x.tag));
}

export async function directPdf(page, locale, dir) {
  const label = locale === 'he' ? /הורד כ-PDF|הורדת PDF|PDF/ : /Download PDF|PDF/;
  const btn = page.locator('button').filter({ hasText: label }).filter({ visible: true });
  if (!(await btn.count())) return notTested('no visible PDF button on the sample page (preview mode hides it?)');
  // cloud-fix4 (D21a, base position): the button may sit inside the card, but only as screen-only app UI
  const insideCard = await btn.first().evaluate((el) => !!el.closest('.pq-card'));
  const screenOnly = await btn.first().evaluate((el) => !!el.closest('.no-print[data-html2canvas-ignore="true"]'));
  const downloadP = page.waitForEvent('download', { timeout: 90000 });
  await btn.first().click();
  const dialog = page.locator('[role="dialog"]').filter({ visible: true });
  const chooserOpened = await dialog.first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
  if (chooserOpened) {
    const choice = dialog.first().locator('button').filter({ hasText: locale === 'he' ? /תמציתי/ : /Compact/ });
    if (await choice.count()) await choice.first().click();
  }
  let download;
  try { download = await downloadP; } catch (e) { return fail(`no download event within 90s: ${String(e).slice(0, 160)}`); }
  const file = path.join(dir, `direct-${locale}-${slug(download.suggestedFilename() || 'quote.pdf')}`);
  await download.saveAs(file);
  const buf = fs.readFileSync(file);
  const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
  const pages = countPdfPages(buf);
  const detail = { file, bytes: buf.length, pages, suggestedFilename: download.suggestedFilename(), buttonInsideCard: insideCard, buttonScreenOnly: screenOnly };
  return isPdf && pages > 0 && (!insideCard || screenOnly) ? pass(detail) : fail(detail);
}

export async function runPrintPdf(args) {
  const base = resolveBaseUrl(args);
  const dir = outDir(args, 'print-pdf');
  const locales = String(args.locales || 'he,en').split(',').filter(Boolean);
  const styles = String(args.styles || STYLES.join(',')).split(',').filter((s) => STYLES.includes(s));
  const { chromium } = loadPlaywright();
  const exe = args['pw-chromium'] || process.env.PW_CHROMIUM;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const cells = [];
  const errors = [];
  try {
    for (const locale of locales) {
      for (const style of styles) {
        for (const length of ['short', 'long']) {
          const c = { style, length, detail: 'compact', images: 1 };
          const id = `${locale}/${style}/${length}`;
          const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
          const page = await context.newPage();
          page.on('pageerror', (e) => errors.push({ id, error: String(e).slice(0, 300) }));
          const url = sampleUrl(base, locale, c);
          const checks = {};
          const ready = await openSample(page, url);
          if (!ready) {
            for (const k of ['cardVisible', 'noVisibleControls', 'noFixedOverlays', 'theadRepeats', 'totalsPresent', 'signaturePresent', 'pdfGenerated', 'longIsMultiPage', 'shortPageCount', 'noFooterOnlyPage', 'allRowsPresent']) checks[k] = fail('route did not render .pq-card');
            cells.push({ id, locale, ...c, url, checks });
            await context.close();
            continue;
          }
          const typeScreen = await page.evaluate(probeType);
          const fingerprint = await domFingerprint(page);
          await page.emulateMedia({ media: 'print' });
          await page.waitForTimeout(150);
          const p = await printProbe(page);
          const typePrint = await page.evaluate(probeType);
          const typeDiff = Object.keys(typeScreen).filter((k) => JSON.stringify(typeScreen[k]) !== JSON.stringify(typePrint[k])).map((k) => ({ el: k, screen: typeScreen[k], print: typePrint[k] }));
          checks.typeEqualsScreen = Object.keys(typeScreen).length > 10 && !typeDiff.length ? pass({ elements: Object.keys(typeScreen).length }) : fail({ elements: Object.keys(typeScreen).length, diff: typeDiff.slice(0, 6) });
          const sem = (await page.evaluate(probePrint)).semantic;
          checks.cardVisible = p.cardVisible ? pass() : fail('.pq-card not visible under print media');
          const nonDisclosure = p.controls.filter((x) => x.ariaExpanded === null);
          checks.noFixedOverlays = p.fixedOverlays.length ? fail(p.fixedOverlays) : pass();
          checks.noVisibleControls = nonDisclosure.length ? fail(p.controls) : pass({ disclosureTogglesVisible: p.controls.length });
          checks.theadRepeats = p.theadDisplay === 'table-header-group' ? pass() : fail({ theadDisplay: p.theadDisplay });
          checks.totalsPresent = blockVerdict(p.totals, 'totals');
          checks.signaturePresent = blockVerdict(p.signature, 'signature');
          const pdfFile = path.join(dir, `${slug(id)}.pdf`);
          try {
            const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
            fs.writeFileSync(pdfFile, buf);
            const pages = countPdfPages(buf);
            checks.pdfGenerated = pages > 0 ? pass({ file: pdfFile, pages, bytes: buf.length }) : fail({ file: pdfFile, pages });
            checks.longIsMultiPage = length === 'long' ? (pages > 1 ? pass({ pages }) : fail({ pages })) : notTested('short sample - see shortPageCount');
            if (length === 'short') {
              const want = SHORT_PAGES[style];
              const bound = SAMPLE_BINDING[`${locale}/${style}`];
              checks.fixtureBound = bound && bound.fp === fingerprint.fp && bound.rows === fingerprint.rows && bound.images === fingerprint.images ? pass({ fingerprint }) : fail({ recorded: bound, fingerprint });
              checks.shortPageCount = pages === want ? pass({ pages, expected: want, fingerprint }) : fail({ pages, expected: want, fingerprint });
            }
            const kinds = classifyPages(pdfFile, p.footerText, p.approvalText);
            const kindList = kinds.map((k) => ({ page: k.page, kind: k.kind, words: k.words }));
            checks.noBlankPage = kinds.every((k) => k.kind !== 'blank') ? pass(kindList) : fail(kindList);
            checks.noFooterOnlyPage = kinds.every((k) => k.kind !== 'footer-only') ? pass(kindList) : fail(kindList);
            checks.noApprovalOnlyPage = kinds.every((k) => k.kind !== 'approval-only') ? pass(kindList) : fail(kindList);
            const last = kinds[kinds.length - 1];
            checks.approvalOnLastPage = p.approvalText
              ? (last && last.hasApproval && last.bodyWords > 0 && kinds.slice(0, -1).every((k) => !k.hasApproval) ? pass({ lastPage: last }) : fail({ lastPage: last, approvalPages: kinds.filter((k) => k.hasApproval).map((k) => k.page) }))
              : fail('no approval block found under print media');
            const pl = sem && sem.kind !== 'status' ? approvalPlacement(pdfFile, { approvalTitle: sem.approvalTitle, approvalText: p.approvalText, footerText: p.footerText, signatureLineText: sem.signatureLineText }) : null;
            checks.approvalAfterBody = sem && sem.bodyBlocks > 0 && !sem.bodyBlocksNotBeforeApproval.length && sem.approvalTop >= sem.bodyBottom - 0.5 && (sem.kind === 'status' || (pl && pl.titleFound && pl.bodyAbove))
              ? pass({ semantic: sem, placement: pl }) : fail({ semantic: sem, placement: pl });
            if (sem && sem.kind !== 'status') {
              checks.signatureInApproval = sem.signature && sem.signature.insideApprovalDom && sem.signature.insideApprovalBox && (sem.kind === 'signed' || (pl && pl.signatureBelow === true))
                ? pass({ signature: sem.signature, placement: pl }) : fail({ signature: sem.signature, placement: pl });
            }
            const rows = sampleRowDescriptions(locale, length);
            const missing = missingRows(pdfFile, rows);
            checks.allRowsPresent = missing.length === 0 ? pass({ rows: rows.length }) : fail({ rows: rows.length, missing });
          } catch (e) {
            checks.pdfGenerated = fail(String(e).slice(0, 200));
            checks.longIsMultiPage = notTested('pdf failed');
          }
          await page.emulateMedia({ media: 'screen' });
          cells.push({ id, locale, ...c, url, checks });
          await context.close();
        }
      }
      if (!args['no-direct-pdf']) {
        for (const style of styles) {
          const id = `${locale}/${style}/direct-pdf`;
          const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
          const page = await context.newPage();
          page.on('pageerror', (e) => errors.push({ id, error: String(e).slice(0, 300) }));
          const url = sampleUrl(base, locale, { style, length: 'short', detail: 'compact', images: 1 });
          const ready = await openSample(page, url);
          let r;
          try { r = ready ? await directPdf(page, locale, dir) : notTested('route did not render .pq-card'); } catch (e) { r = fail(String(e).slice(0, 200)); }
          cells.push({ id, locale, style, url, checks: { directPdfDownload: r } });
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  const result = { kind: 'task16-print-pdf', base, generatedAt: new Date().toISOString(), shortPages: SHORT_PAGES, notes: ['Page kinds, approval position and row presence are asserted on the PDF text (pdftotext per page); control / overlay / thead / totals / signature checks run on the print-emulated DOM.'], summary: summarize(cells), pageErrors: errors, cells };
  const file = writeJson(path.join(dir, 'matrix.json'), result);
  return { file, summary: result.summary, pageErrors: errors.length };
}

if (isMain(import.meta.url)) {
  runPrintPdf(parseArgs()).then((r) => {
    console.log(JSON.stringify({ matrix: r.file, totals: r.summary.totals, failures: r.summary.failures.length, pageErrors: r.pageErrors }, null, 2));
    process.exitCode = r.summary.totals.FAIL ? 1 : 0;
  }).catch((e) => { console.error(e); process.exitCode = 2; });
}
