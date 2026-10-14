// Task 16 - Quote History usable-room comparison, base c65f742 vs candidate(s), SAME synthetic fixtures, SAME Chromium,
// SAME viewports (LOCAL-DEV; production-mode builds on 127.0.0.1 with VITE_SUPABASE_URL=http://127.0.0.1:54399; every
// backend request is a Playwright route mock). NOT the official IRON-QH-LAYOUT-001 / IRON-MOBILE-WIDTH-001 gate.
// Usage: node scripts/task16/qa/qh/qh-room-compare.mjs <outDir> base=<url> name=<url> [name=<url> ...]
// Env: PW_CHROMIUM=<chromium path>; QH_VARIANTS=std,rev8 (default: all); QH_SHOTS=1 for screenshots.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { account, mockAccount, QH_VARIANTS } from './fixtures.mjs';
import { measureQH, compareTargets } from './measure.mjs';
import { QH_VIEWPORTS as VIEWPORTS } from './capture-base.mjs';

const OUT = process.argv[2];
const TARGETS = process.argv.slice(3).map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1) }; });
if (!OUT || !TARGETS.length || !TARGETS.some((t) => t.name === 'base')) { console.error('usage: qh-room-compare.mjs <outDir> base=<url> name=<url> ...'); process.exit(2); }
for (const t of TARGETS) { const u = new URL(t.url); if (u.hostname !== '127.0.0.1' || u.port === '5186') { console.error(`refused non-local or 5186 url ${t.url}`); process.exit(2); } }
mkdirSync(OUT, { recursive: true });
const VARIANTS = (process.env.QH_VARIANTS || QH_VARIANTS.join(',')).split(',');
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const rows = [];
for (const variant of VARIANTS) {
  for (const market of ['Local', 'International']) {
    const lang = market === 'Local' ? 'he' : 'en';
    for (const [w, h] of VIEWPORTS) {
      const per = {};
      for (const t of TARGETS) {
        const acc = account(market, variant);
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 1024, hasTouch: true });
        await mockAccount(ctx, acc, lang);
        const page = await ctx.newPage();
        await page.goto(`${t.url}/dashboard?lang=${lang}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.pf-work-screen', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(700);
        per[t.name] = await measureQH(page);
        if (process.env.QH_SHOTS === '1') { mkdirSync(join(OUT, 'shots'), { recursive: true }); await page.screenshot({ path: join(OUT, 'shots', `${t.name}-${variant}-${lang}-${w}x${h}.png`) }); }
        await ctx.close();
      }
      const base = per.base;
      for (const t of TARGETS) {
        const m = per[t.name];
        rows.push({ variant, lang, vp: `${w}x${h}`, target: t.name, ...m, deltaList: m.list !== null && base.list !== null ? m.list - base.list : null, shrunkTargets: t.name === 'base' ? [] : compareTargets(base.targets, m.targets) });
      }
      const line = TARGETS.map((t) => `${t.name}:${per[t.name].list}/${per[t.name].rowsFull}r/g${per[t.name].greetingH}`).join('  ');
      console.log(`${variant} ${lang} ${w}x${h}  ${line}`);
    }
  }
}
await browser.close();
writeFileSync(join(OUT, 'qh-room-compare.json'), JSON.stringify({ tool: 'qh-room-compare (LOCAL-DEV, synthetic mocked data)', generatedAt: new Date().toISOString(), targets: TARGETS, variants: VARIANTS, rows }, null, 1));
// markdown table
const md = ['| fixture | loc | viewport | build | list px (Δ base) | rows fully visible | greeting card h | greeting lines / stats lines / badge row wraps | QH header lines | metrics | min font px | min target h px | targets shrunk vs base | amounts clipped | overlaps | overflow-x |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.variant} | ${r.lang} | ${r.vp} | ${r.target} | ${r.list} (${r.deltaList >= 0 ? '+' : ''}${r.deltaList}) | ${r.rowsFull}/${r.items} | ${r.greetingH} | ${r.greetLines} / ${r.statsLines} / ${r.greetingBadgeWraps === null ? '-' : r.greetingBadgeWraps ? 'yes' : 'no'} | ${r.qhHeadLines} | ${r.metrics ? 'yes' : 'no'} | ${r.minFont} | ${r.minTargetH} | ${r.shrunkTargets.length ? r.shrunkTargets.map((s) => `${s.k} ${s.dim} ${s.base}->${s.cand}`).join('; ') : '0'} | ${r.amountsClipped}/${r.amounts.length} | ${r.overlaps} | ${r.overflowX} |`);
writeFileSync(join(OUT, 'qh-room-compare.md'), md.join('\n') + '\n');
console.log(`wrote ${join(OUT, 'qh-room-compare.json')} and .md (${rows.length} rows)`);
