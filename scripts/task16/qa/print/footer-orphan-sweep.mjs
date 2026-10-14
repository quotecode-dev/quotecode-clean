// Task 16 cloud-fix3 (A6) - FOOTER-ORPHAN SWEEP (LOCAL-DEV, mocked functions, synthetic data). Causal probe, not a gate.
//
// A footer-only last page appears when the document content (up to the approval block) still fits the page but the
// footer does not. Whether a given quote lands in that window depends on its content height, so this sweep walks the
// notes length in small steps (fillerText, ~SW_STEP characters) for each content profile and prints every DTO through the
// real /quote/:id route of each target, recording the page count and the page kinds (body / footer-only / approval-only).
// Usage: node scripts/task16/qa/print/footer-orphan-sweep.mjs <outDir> <name>=<buildUrl> ...
//   env SW_LOCALES=he,en SW_STYLES=classic SW_ROWS=1,2,3,4 SW_PROFILES=min,full SW_MAX=1600 SW_STEP=40 SW_VIEWPORT=1280x900
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { build, fillerText, presentationFor } from './fixtures.mjs';
import { assertLocal, classifyPages, newQuoteContext, openQuote, probePrint } from './printLib.mjs';

const [OUT, ...targetArgs] = process.argv.slice(2);
if (!OUT || !targetArgs.length) { console.error('usage: footer-orphan-sweep.mjs <outDir> <name>=<url> ...'); process.exit(2); }
const TARGETS = targetArgs.map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
try { TARGETS.forEach((t) => assertLocal(t.url)); } catch (e) { console.error(e.message); process.exit(2); }
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const LOCALES = list(process.env.SW_LOCALES, ['he', 'en']);
const STYLES = list(process.env.SW_STYLES, ['classic']);
const ROWS = list(process.env.SW_ROWS, ['1', '2', '3', '4']).map(Number);
const PROFILES = list(process.env.SW_PROFILES, ['min', 'full']);
const MAX = Number(process.env.SW_MAX || 1600);
const STEP = Number(process.env.SW_STEP || 40);
const SIGNED = process.env.SW_SIGNED === '1';
const [VW, VH] = (process.env.SW_VIEWPORT || '1280x900').split('x').map(Number);
mkdirSync(OUT, { recursive: true });
const tmpPdf = join(OUT, 'sweep-tmp.pdf');

const PROFILE = {
  min: { clientDetails: 'none', attn: 'none', business: 'min', terms: 'short' },
  full: { clientDetails: 'full', attn: 'full', business: 'full', terms: 'medium', discount: 5 },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const rows = [];
for (const target of TARGETS) for (const locale of LOCALES) for (const style of STYLES) for (const nRows of ROWS) for (const prof of PROFILES) {
  for (let chars = 0; chars <= MAX; chars += STEP) {
    const fx = build({ name: 'sweep', locale, rows: nRows, ...PROFILE[prof], signed: SIGNED, notesText: chars ? fillerText(locale, chars) : null });
    const ctx = await newQuoteContext(browser, { viewport: { width: VW, height: VH }, dto: fx.quoteData, presentation: presentationFor(style) });
    const page = await ctx.newPage();
    const r = { target: target.name, locale, style, rows: nRows, profile: prof, notesChars: chars };
    try {
      await openQuote(page, target.url, fx.quoteData);
      await page.emulateMedia({ media: 'print' });
      const pr = await page.evaluate(probePrint);
      writeFileSync(tmpPdf, await page.pdf({ format: 'A4', printBackground: true }));
      const pages = classifyPages(tmpPdf, pr.footerText, pr.approvalText);
      Object.assign(r, { pages: pages.length, kinds: pages.map((p) => p.kind), cardBottom: pr.card?.bottom, footerTop: pr.footer?.top, footerBottom: pr.footer?.bottom, approvalBottom: pr.approval?.bottom });
    } catch (e) { r.error = String(e.message || e).slice(0, 200); }
    await ctx.close();
    rows.push(r);
    const orphan = (r.kinds || []).some((k) => k !== 'body');
    if (orphan || r.error) console.log(`${orphan ? 'ORPHAN' : 'ERROR '} ${JSON.stringify(r)}`);
    if (r.pages >= 2 && !orphan) { // past the one-page boundary with a real second page: this profile is done
      console.log(`  boundary ${target.name}/${locale}/${style}/rows${nRows}/${prof}: 2 body pages at notesChars=${chars}`);
      break;
    }
  }
}
await browser.close();
rmSync(tmpPdf, { force: true });
const orphans = rows.filter((r) => (r.kinds || []).some((k) => k !== 'body'));
writeFileSync(join(OUT, 'footer-orphan-sweep.json'), JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, viewport: `${VW}x${VH}`, step: STEP, signed: SIGNED, targets: TARGETS, total: rows.length, orphans: orphans.length, rows }, null, 1));
console.log(`SWEEP: ${rows.length} prints, ${orphans.length} with a non-body page`);
for (const t of TARGETS) console.log(`  ${t.name}: ${orphans.filter((r) => r.target === t.name).length} orphan prints`);
