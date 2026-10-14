// Task 16 cloud-fix3 (A6) - CAUSAL TOGGLES for the native-Print footer orphan (LOCAL-DEV, synthetic data). Not a gate.
// Prints one document (the /:lang/sample-quote page, or the public route /quote/:id with a synthetic fixture) under a
// series of single-change toggles injected into the page (a <style> tag, applied before printing) and records the page
// count, the page kinds (body / footer-only / approval-only) and the card height. Each toggle undoes or alters ONE
// candidate change, so the table shows which change moves the footer to its own page.
// Usage: node scripts/task16/qa/print/causal-toggles.mjs <outDir> <name>=<buildUrl> ...
//   env CT_PATH=sample|public  CT_LOCALE=he|en  CT_STYLE=classic  CT_LENGTH=short (sample)
//       CT_FIXTURE='{"rows":1,"profile":"full","notesChars":1120}' (public)  CT_TOGGLES=a,b (default all)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { build, fillerText, presentationFor } from './fixtures.mjs';
import { assertLocal, classifyPages, newQuoteContext, openQuote, probePrint } from './printLib.mjs';

const [OUT, ...targetArgs] = process.argv.slice(2);
const TARGETS = targetArgs.map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
TARGETS.forEach((t) => assertLocal(t.url));
const PATH = process.env.CT_PATH || 'sample';
const LOCALE = process.env.CT_LOCALE || 'he';
const STYLE = process.env.CT_STYLE || 'classic';
const LENGTH = process.env.CT_LENGTH || 'short';
const FX = JSON.parse(process.env.CT_FIXTURE || '{"rows":1,"profile":"full","notesChars":0}');
mkdirSync(join(OUT, 'pdf'), { recursive: true });

// :not(#id) lifts every toggle above the page's own !important density rules (.pq-page:not(.pq-preview) ... = 0,4,0)
const P = '.pq-page:not(#pq-causal-toggle)';
// Each toggle = CSS injected for screen AND print (the sample page prints with its screen rules - previewMode).
const TOGGLES = {
  none: '',
  // the recipient as it was in 34c92ea (a light top-ruled block, 17px name) instead of the restored c65f742 card
  'recipient-34c92ea': `${P} .pq-card .pq-recipient{background:none!important;border:0!important;border-top:2px solid var(--pq-accent)!important;border-radius:0!important;padding:10px 0 0!important}
    ${P} .pq-card .pq-recipient-label{margin-bottom:4px!important;font-size:12px!important;font-weight:600!important}
    ${P} .pq-card .pq-recipient-name{font-size:17px!important;font-weight:700!important}
    ${P} .pq-card .pq-recipient-intro{font-size:13px!important}
    ${P} .pq-card .pq-recipient-detail{font-size:14px!important}
    @media print{${P}:not(.pq-preview) .pq-card .pq-recipient{padding:6px 0 0!important}}`,
  // the empty attachments block (restored R-5) not rendered
  'no-empty-attachments': `${P} .pq-card .pq-attachments.pq-attachments--empty{display:none!important}`,
  // both restorations undone
  'recipient-34c92ea+no-empty-attachments': 'COMBO',
  // the screen header band of 3d9fd2a removed (padding 0)
  'no-band-padding': `${P} .pq-letterhead .pq-lh-band{padding:0!important}`,
  // footer spacing reduced to 0 above
  'footer-no-margin': `${P} .pq-card .pq-doc-foot{margin-top:0!important;padding-top:2px!important}`,
  // approval block spacing reduced
  'approval-tight': `${P} .pq-card .pq-approval{margin-top:0!important;padding-top:4px!important;padding-bottom:0!important}`,
  // card bottom padding 0
  'card-no-bottom-padding': `${P} .pq-card{padding-bottom:0!important}`,
  // keep the footer with the approval block (break avoidance between siblings)
  'footer-break-before-avoid': `${P} .pq-card .pq-doc-foot{break-before:avoid!important;break-inside:avoid!important}`,
  // keep approval + footer with the preceding block
  'approval+footer-break-before-avoid': `${P} .pq-card .pq-approval, ${P} .pq-card .pq-doc-foot{break-before:avoid!important;break-inside:avoid!important}`,
  // @page margins 10mm all round
  'page-margin-10mm': '@page{margin:10mm!important}',
};
TOGGLES['recipient-34c92ea+no-empty-attachments'] = `${TOGGLES['recipient-34c92ea']}\n${TOGGLES['no-empty-attachments']}`;
const NAMES = process.env.CT_TOGGLES ? process.env.CT_TOGGLES.split(',') : Object.keys(TOGGLES);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const rows = [];
for (const t of TARGETS) for (const name of NAMES) {
  let ctx;
  let page;
  let fixtureNote;
  if (PATH === 'sample') {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    await page.goto(`${t.url}/${LOCALE}/sample-quote?style=${STYLE}&length=${LENGTH}&detail=compact&images=1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.pq-card');
    fixtureNote = `sample ${LOCALE}/${STYLE}/${LENGTH}`;
  } else {
    const prof = FX.profile === 'min' ? { clientDetails: 'none', attn: 'none', business: 'min', terms: 'short' } : { clientDetails: 'full', attn: 'full', business: 'full', terms: 'medium', discount: 5 };
    const fx = build({ name: 'causal', locale: LOCALE, rows: FX.rows, ...prof, signed: !!FX.signed, notesText: FX.notesChars ? fillerText(LOCALE, FX.notesChars) : null });
    ctx = await newQuoteContext(browser, { viewport: { width: 1280, height: 900 }, dto: fx.quoteData, presentation: presentationFor(STYLE) });
    page = await ctx.newPage();
    await openQuote(page, t.url, fx.quoteData);
    fixtureNote = `public ${LOCALE}/${STYLE} ${JSON.stringify(FX)}`;
  }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (TOGGLES[name]) await page.addStyleTag({ content: TOGGLES[name] });
  await page.waitForTimeout(250);
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(probePrint);
  const pdf = join(OUT, 'pdf', `${t.name}-${PATH}-${LOCALE}-${STYLE}-${name}.pdf`);
  writeFileSync(pdf, await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: PATH === 'sample' }));
  const kinds = classifyPages(pdf, pr.footerText, pr.approvalText).map((p) => p.kind);
  const r = { target: t.name, toggle: name, fixture: fixtureNote, pages: kinds.length, kinds, cardH: pr.card?.h, footer: pr.footer, approval: pr.approval, blocks: pr.blocks };
  rows.push(r);
  console.log(`${t.name.padEnd(6)} ${name.padEnd(40)} pages=${kinds.length} [${kinds.join(',')}] cardH=${pr.card?.h}`);
  await ctx.close();
}
await browser.close();
// per-block print heights (outer = height + margins) of the untoggled document, target by target
const base = rows.filter((r) => r.toggle === 'none');
if (base.length >= 2) {
  const keys = [...new Set(base.flatMap((r) => r.blocks.map((x) => `${x.depth}:${x.cls}`)))];
  const o = (x) => (x ? +(x.h + x.mt + x.mb).toFixed(1) : 0);
  console.log(`\nblock outer heights under print media: ${base.map((r) => r.target).join(' | ')}`);
  for (const k of keys) console.log(`  ${k.padEnd(48)} ${base.map((r) => String(o(r.blocks.find((x) => `${x.depth}:${x.cls}` === k))).padStart(7)).join(' ')}`);
  console.log(`  ${'CARD'.padEnd(48)} ${base.map((r) => String(r.cardH).padStart(7)).join(' ')}`);
}
writeFileSync(join(OUT, `causal-toggles-${PATH}-${LOCALE}-${STYLE}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, path: PATH, locale: LOCALE, style: STYLE, length: LENGTH, fixture: FX, toggles: TOGGLES, rows }, null, 1));
