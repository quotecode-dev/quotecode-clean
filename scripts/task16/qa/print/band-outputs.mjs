// Task 16 local fix 6 - ISSUER / METADATA BAND per output (QA tooling only). For HE/EN x classic/modern/visual:
//   screen        the band (.pq-lh-band) is DARK (background luminance < 80, incl. gradients) - Owner black-scope band;
//   print         under print media the band background is WHITE (or transparent) and every band text colour is dark
//                 (luminance < 110) - readable on paper;
//   direct        the REAL Direct PDF flow (first tile -> Compact) on /quote/:id: inside the .pq-pdf-capturing state that
//                 html2canvas rasterises, the band is white and its text dark; the downloaded PDF is saved for inspection.
// Supabase is answered locally (no TEST / Production contact, no write). Landing headers are not touched by this gate.
// Usage: node scripts/task16/qa/print/band-outputs.mjs <appUrl> <devUrl> <outDir> [supabaseUrlToMock]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const [APP, DEV, OUT, SUPA_IN] = process.argv.slice(2);
if (!APP || !DEV || !OUT) { console.error('usage: band-outputs.mjs <appUrl> <devUrl> <outDir> [supabaseUrlToMock]'); process.exit(2); }
const SUPA = (SUPA_IN || 'http://127.0.0.1:54399').replace(/\/$/, '');
mkdirSync(join(OUT, 'pdf'), { recursive: true });
const cells = [];
const cell = (id, pass, detail) => { cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail }); if (!pass) console.log(`FAIL ${id} ${JSON.stringify(detail).slice(0, 260)}`); };
function bandProbe() {
  const lum = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x)); if (a === 0) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return Math.round((0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)) * 255); };
  const band = document.querySelector('.pq-card .pq-lh-band');
  if (!band) return null;
  const cs = getComputedStyle(band);
  const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(lum).filter((x) => x !== null);
  const bg = lum(cs.backgroundColor);
  const texts = [...band.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width).map((e) => ({ t: e.textContent.trim().slice(0, 18), lum: lum(getComputedStyle(e).color) }));
  return { bg, stops, bgImage: cs.backgroundImage === 'none' ? 'none' : 'gradient', texts };
}
const browser = await chromium.launch();
const dp = await (await browser.newContext()).newPage();
await dp.goto(`${DEV}/he/sample-quote`, { waitUntil: 'load', timeout: 120000 });
let identity = null; try { identity = await (await fetch(`${APP}/version.json`, { cache: 'no-store' })).json(); } catch { /* reported */ }
for (const locale of ['he', 'en']) for (const style of ['classic', 'modern', 'visual']) {
  const id = `${locale}/${style}`;
  const s = await dp.evaluate(async ({ locale, style }) => { const m = await import('/src/quoteDocument/sampleQuotes.js'); const x = m.buildSampleQuote({ locale, style, length: 'short', images: true }); return { quoteData: x.quoteData, presentation: x.presentation }; }, { locale, style });
  const dto = JSON.parse(JSON.stringify(s.quoteData)); dto.business = { ...dto.business, phone: locale === 'he' ? '050-1234567' : '+1 555 0100' };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.route(`${SUPA}/**`, (r) => { const u = new URL(r.request().url()); let body = {}; if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto; else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = s.presentation; else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
  const page = await ctx.newPage();
  await page.goto(`${APP}/quote/${dto.quote.id}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('.pq-card .pq-lh-band', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  const scr = await page.evaluate(bandProbe);
  const darkScreen = scr && (scr.bgImage === 'gradient' ? scr.stops.length > 0 && scr.stops.every((l) => l < 80) : scr.bg !== null && scr.bg < 80);
  cell(`${id}/screen/band-dark`, !!darkScreen, scr);
  await page.screenshot({ path: join(OUT, `${locale}-${style}-screen-band.png`), clip: await page.evaluate(() => { const b = document.querySelector('.pq-card .pq-lh-band').getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, width: b.width, height: b.height }; }), fullPage: true });
  await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(200);
  const pr = await page.evaluate(bandProbe);
  const whitePrint = pr && pr.bgImage === 'none' && (pr.bg === null || pr.bg > 240) && pr.texts.every((t) => t.lum !== null && t.lum < 110);
  cell(`${id}/print/band-white-text-dark`, !!whitePrint, pr);
  writeFileSync(join(OUT, 'pdf', `${locale}-${style}-print.pdf`), await page.pdf({ format: 'A4', printBackground: true }));
  await page.emulateMedia({ media: 'screen' }); await page.waitForTimeout(200);
  await page.evaluate(`window.__bp = ${bandProbe.toString()}; window.__cap = null; { const pg = document.querySelector('.pq-page'); new MutationObserver(() => { if (!window.__cap && pg.classList.contains('pq-pdf-capturing')) window.__cap = window.__bp(); }).observe(pg, { attributes: true, attributeFilter: ['class'] }); }`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), (async () => { await page.locator('.pq-action-tile').first().click(); await page.locator('[role="dialog"] button').nth(1).click(); })()]);
  await dl.saveAs(join(OUT, 'pdf', `${locale}-${style}-direct.pdf`));
  const cap = await page.evaluate(() => window.__cap);
  const whiteDirect = cap && cap.bgImage === 'none' && (cap.bg === null || cap.bg > 240) && cap.texts.every((t) => t.lum !== null && t.lum < 110);
  cell(`${id}/direct/band-white-text-dark`, !!whiteDirect, cap || { captured: false });
  await ctx.close();
}
await browser.close();
const fail = cells.filter((c) => c.result === 'FAIL');
writeFileSync(join(OUT, 'band-outputs.json'), JSON.stringify({ gate: 'task16 issuer/metadata band per output', app: APP, servedIdentity: identity && { buildSha: identity.buildSha, buildInputDigest: identity.buildInputDigest, dirty: identity.dirty, mode: identity.mode }, pass: cells.length - fail.length, fail: fail.length, cells }, null, 1));
console.log(`BAND OUTPUTS GATE: ${cells.length - fail.length} PASS / ${fail.length} FAIL (${identity ? String(identity.buildSha).slice(0, 12) : 'identity unknown'})`);
process.exit(fail.length ? 1 : 0);
