// Task 16 cloud-fix4b (A12) - VISUAL IDENTITY check of the table-semantics change (LOCAL-DEV, mocked, synthetic data).
// The semantics change (scope / id / headers / explicit roles on the item table) must not change a pixel: the whole
// document card is screenshotted on /quote/:id of two servers of the SAME build type (before / after) and compared
// byte for byte, HE-ILS + EN-USD x 320 / 390 / 1280 x Classic / Modern / Visual, long-amount fixture.
// Usage: node scripts/task16/qa/a11y/visual-identity.mjs <beforeUrl> <afterUrl>   (exit 1 when any card differs)
import process from 'node:process';
import { chromium } from 'playwright';
import { longAmounts, presentationFor } from '../print/fixtures.mjs';
import { assertLocal, newQuoteContext, openQuote } from '../print/printLib.mjs';

const [BEFORE, AFTER] = process.argv.slice(2);
if (!BEFORE || !AFTER) { console.error('usage: visual-identity.mjs <beforeUrl> <afterUrl>'); process.exit(2); }
[BEFORE, AFTER].forEach(assertLocal);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let diff = 0;
for (const [loc, cur] of [['he', 'ILS'], ['en', 'USD']]) for (const w of [320, 390, 1280]) for (const style of ['classic', 'modern', 'visual']) {
  const fx = longAmounts(loc, cur);
  const shots = [];
  for (const base of [BEFORE, AFTER]) {
    const ctx = await newQuoteContext(browser, { viewport: { width: w, height: 900 }, dto: fx.quoteData, presentation: presentationFor(style) });
    const page = await ctx.newPage(); await openQuote(page, base, fx.quoteData);
    shots.push(await page.locator('.pq-card').screenshot({ animations: 'disabled' }));
    await ctx.close();
  }
  const same = Buffer.compare(shots[0], shots[1]) === 0;
  if (!same) diff += 1;
  console.log(`${loc} ${w} ${style}: card screenshot ${same ? 'IDENTICAL' : 'DIFFERENT'} (${shots[0].length} / ${shots[1].length} bytes)`);
}
await browser.close();
console.log(`VISUAL IDENTITY: ${diff ? `${diff} card(s) DIFFERENT` : 'every card IDENTICAL'}`);
process.exit(diff ? 1 : 0);
