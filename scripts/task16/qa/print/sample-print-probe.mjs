// Task 16 cloud-fix3 (A6) - /:lang/sample-quote native-Print block probe (LOCAL-DEV, synthetic sample data). Causal probe.
// Prints the sample page exactly like qa-print-pdf.mjs (1280x900, emulateMedia print, page.pdf A4 printBackground
// preferCSSPageSize) and records, per target, the page count, the page kinds and the height of every document block
// under print media, so two builds can be compared block by block.
// Usage: node scripts/task16/qa/print/sample-print-probe.mjs <outDir> <name>=<buildUrl> ...
//   env SP_LOCALES=he,en SP_STYLES=classic,modern,visual SP_LENGTHS=short,long
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { assertLocal, classifyPages, probePrint } from './printLib.mjs';

const [OUT, ...targetArgs] = process.argv.slice(2);
if (!OUT || !targetArgs.length) { console.error('usage: sample-print-probe.mjs <outDir> <name>=<url> ...'); process.exit(2); }
const TARGETS = targetArgs.map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1).replace(/\/$/, '') }; });
try { TARGETS.forEach((t) => assertLocal(t.url)); } catch (e) { console.error(e.message); process.exit(2); }
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const LOCALES = list(process.env.SP_LOCALES, ['he', 'en']);
const STYLES = list(process.env.SP_STYLES, ['classic']);
const LENGTHS = list(process.env.SP_LENGTHS, ['short']);
mkdirSync(join(OUT, 'pdf'), { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const runs = [];
for (const t of TARGETS) for (const locale of LOCALES) for (const style of STYLES) for (const length of LENGTHS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const id = `${t.name}/${locale}/${style}/${length}`;
  await page.goto(`${t.url}/${locale}/sample-quote?style=${style}&length=${length}&detail=compact&images=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pq-card');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(probePrint);
  const pdf = join(OUT, 'pdf', `${id.replace(/\//g, '-')}.pdf`);
  writeFileSync(pdf, await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  const pages = classifyPages(pdf, pr.footerText, pr.approvalText);
  runs.push({ id, pages: pages.map((p) => p.kind), card: pr.card, footer: pr.footer, approval: pr.approval, blocks: pr.blocks });
  console.log(`${id.padEnd(30)} pages=[${pages.map((p) => p.kind).join(',')}] card=${pr.card.top}->${pr.card.bottom} (h ${pr.card.h}) footer=${pr.footer?.top}->${pr.footer?.bottom}`);
  await ctx.close();
}
await browser.close();
// side-by-side block table (first two targets)
if (TARGETS.length >= 2) {
  for (const locale of LOCALES) for (const style of STYLES) for (const length of LENGTHS) {
    const a = runs.find((r) => r.id === `${TARGETS[0].name}/${locale}/${style}/${length}`);
    const b = runs.find((r) => r.id === `${TARGETS[1].name}/${locale}/${style}/${length}`);
    console.log(`\n${locale}/${style}/${length}: block heights (outer = h + margins) ${TARGETS[0].name} vs ${TARGETS[1].name}`);
    const keys = [...new Set([...a.blocks, ...b.blocks].map((x) => `${x.depth}:${x.cls}`))];
    for (const k of keys) {
      const fa = a.blocks.find((x) => `${x.depth}:${x.cls}` === k);
      const fb = b.blocks.find((x) => `${x.depth}:${x.cls}` === k);
      const o = (x) => (x ? +(x.h + x.mt + x.mb).toFixed(1) : 0);
      console.log(`  ${k.padEnd(48)} ${String(o(fa)).padStart(7)} ${String(o(fb)).padStart(7)}  d=${(o(fb) - o(fa)).toFixed(1)}`);
    }
    console.log(`  ${'CARD'.padEnd(48)} ${String(a.card.h).padStart(7)} ${String(b.card.h).padStart(7)}  d=${(b.card.h - a.card.h).toFixed(1)}`);
  }
}
writeFileSync(join(OUT, 'sample-print-probe.json'), JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, targets: TARGETS, runs }, null, 1));
