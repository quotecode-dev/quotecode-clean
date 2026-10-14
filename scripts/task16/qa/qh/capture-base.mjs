// Task 16 - capture the REAL base c65f742 Quote History geometry for layout-regression-gate.mjs (LOCAL-DEV, synthetic data).
// Build the base tree exactly like the candidate (VITE_SUPABASE_URL=http://127.0.0.1:54399 VITE_SUPABASE_ANON_KEY=test-anon
// npx vite build --outDir <dir>; npx vite preview --outDir <dir> --host 127.0.0.1 --port <port> --strictPort), then:
//   node scripts/task16/qa/qh/capture-base.mjs http://127.0.0.1:<port> scripts/task16/qa/qh/base-c65f742.json
// Same Chromium, fixtures, viewports and measurement code as the gate (qh/fixtures.mjs + qh/measure.mjs).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { account, mockAccount, QH_VARIANTS } from './fixtures.mjs';
import { measureQH } from './measure.mjs';

export const QH_VIEWPORTS = [[320, 780], [360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [820, 1180], [1180, 820], [1280, 800], [1440, 900]];

export async function measureCell(browser, url, variant, market, w, h) {
  const lang = market === 'Local' ? 'he' : 'en';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 1024, hasTouch: true });
  await mockAccount(ctx, account(market, variant), lang);
  const page = await ctx.newPage();
  await page.goto(`${url}/dashboard?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-work-screen', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const m = await measureQH(page);
  await ctx.close();
  return m;
}

if (process.argv[1] && process.argv[1].endsWith('capture-base.mjs')) {
  const [url, out] = process.argv.slice(2);
  const u = url ? new URL(url) : null;
  if (!u || !out || u.hostname !== '127.0.0.1' || u.port === '5186') { console.error('usage: capture-base.mjs http://127.0.0.1:<port> <out.json> (never 5186)'); process.exit(2); }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const cells = {};
  for (const variant of QH_VARIANTS) for (const market of ['Local', 'International']) for (const [w, h] of QH_VIEWPORTS) {
    const m = await measureCell(browser, url, variant, market, w, h);
    const key = `${variant}/${market === 'Local' ? 'he' : 'en'}/${w}x${h}`;
    cells[key] = { list: m.list, rowsFull: m.rowsFull, items: m.items, greetingH: m.greetingH, greetLines: m.greetLines, statsLines: m.statsLines, greetingBadgeWraps: m.greetingBadgeWraps, qhHeadLines: m.qhHeadLines, minFont: m.minFont, overlaps: m.overlaps, overflowX: m.overflowX, amountsClipped: m.amountsClipped, thOverflow: m.thOverflow, targets: m.targets };
    console.log(key, m.list, m.rowsFull, m.greetingH);
  }
  await browser.close();
  writeFileSync(out, JSON.stringify({ source: 'base c65f742 production build, LOCAL-DEV mocked synthetic fixtures (qh/fixtures.mjs), measured by qh/measure.mjs', url, chromium: process.env.PW_CHROMIUM || 'playwright default', capturedAt: new Date().toISOString(), cells }, null, 1) + '\n');
  console.log(`wrote ${out} (${Object.keys(cells).length} cells)`);
}
