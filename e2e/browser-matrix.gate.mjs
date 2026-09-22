// SUPPORTED-BROWSER MATRIX SMOKE (OD-3). Engines available locally only - nothing is claimed for an engine that did not run.
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/browser-matrix.gate.mjs <baseUrl> [outJson]
// Engines: Chromium (Chrome proxy), Microsoft Edge (installed channel), Firefox, WebKit (Safari ENGINE - not the Safari app),
// Chromium + Pixel 7 emulation (Chrome Android proxy), WebKit + iPhone 14 emulation (iOS Safari proxy).
// Samsung Internet, real Safari (macOS/iOS) and physical devices are NOT available here -> NOT_TESTED (Owner physical test, OD-F2).
// Per engine: HE + EN landing renders, HE persona login -> dashboard list, new quote shows the 4 steps, a public quote renders
// (screen + print emulation where supported) with the correct market money format.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = process.argv[2] || 'http://localhost:5198';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const pw = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
const { createClient } = await import('@supabase/supabase-js');

// one synthetic public quote (HE/ILS) for the customer view, removed at the end
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth } = await sb.auth.signInWithPassword({ email: PERSONA_A.email, password: PERSONA_A.password });
const uid = auth.user.id;
const { data: cl } = await sb.from('clients').insert([{ company_name: 'Browser Matrix Synthetic', email: '', user_id: uid, client_type: 'business' }]).select();
const { data: num } = await sb.rpc('allocate_quote_number', { p_user_id: uid });
const { data: q } = await sb.from('quotes').insert([{ user_id: uid, client_id: cl[0].id, quote_number: typeof num === 'number' ? num : undefined, status: 'sent', valid_until: '2099-12-13', currency: 'ILS', client_type: 'business', tax_rate: 0.18, subtotal: 191.16, total: 225.57, discount: 0 }]).select();
await sb.rpc('save_quote_structured', { p_quote_id: q[0].id, p_financial: null, p_sections: [], p_items: [{ client_key: 'k0', id: null, section_client_key: null, description: 'Synthetic matrix item', quantity: 1, unit_price: 191.16, total_price: 191.16, sort_order: 0, measurements: [] }], p_removed_section_ids: [], p_removed_item_ids: [] });

const ENGINES = [
  { id: 'chromium-desktop', label: 'Chromium desktop (Chrome proxy)', launch: () => pw.chromium.launch(), ctx: { viewport: { width: 1366, height: 900 } } },
  { id: 'edge-desktop', label: 'Microsoft Edge desktop (installed)', launch: () => pw.chromium.launch({ channel: 'msedge' }), ctx: { viewport: { width: 1366, height: 900 } } },
  { id: 'firefox-desktop', label: 'Firefox desktop', launch: () => pw.firefox.launch(), ctx: { viewport: { width: 1366, height: 900 } }, noPrintEmulation: false },
  { id: 'webkit-desktop', label: 'WebKit desktop (Safari engine proxy)', launch: () => pw.webkit.launch(), ctx: { viewport: { width: 1366, height: 900 } } },
  { id: 'chromium-pixel7', label: 'Chromium + Pixel 7 emulation (Chrome Android proxy)', launch: () => pw.chromium.launch(), ctx: pw.devices['Pixel 7'], mobile: true },
  { id: 'webkit-iphone14', label: 'WebKit + iPhone 14 emulation (iOS Safari proxy)', launch: () => pw.webkit.launch(), ctx: pw.devices['iPhone 14'], mobile: true },
];
const results = [];
for (const e of ENGINES) {
  const c = { id: e.id, label: e.label, checks: [] };
  const check = (name, ok, detail) => { c.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log(`  FAIL ${c.id} :: ${name} ${detail ?? ''}`); };
  results.push(c);
  let browser;
  try {
    browser = await e.launch();
    c.version = browser.version();
    const ctx = await browser.newContext(e.ctx);
    const page = await ctx.newPage();
    for (const lang of ['he', 'en']) {
      await page.goto(`${base}/${lang}?lang=${lang}`, { timeout: 90000 });
      await page.locator('h1').first().waitFor({ timeout: 45000 });
      const dir = await page.evaluate(() => document.documentElement.dir);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${lang} landing renders (${lang === 'he' ? 'rtl' : 'ltr'}, no overflow)`, dir === (lang === 'he' ? 'rtl' : 'ltr') && overflow <= 1, `dir=${dir} overflow=${overflow}`);
    }
    await page.goto(`${base}/dashboard?lang=he`, { timeout: 90000 });
    await page.getByPlaceholder('user@example.com').waitFor({ timeout: 45000 });
    await page.getByPlaceholder('user@example.com').fill(PERSONA_A.email);
    await page.locator('input[name="user_password_field"]').fill(PERSONA_A.password);
    await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
    await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 45000 });
    check('login -> dashboard', true);
    if (e.mobile) await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(New|חדש)$/ }).click();
    else await page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ }).first().click();
    await page.getByTestId('sq-step-4').waitFor({ timeout: 20000 });
    check('new quote shows the 4-step flow', (await page.getByTestId('sq-step-1').count()) === 1);
    const pub = await ctx.newPage();
    await pub.goto(`${base}/public-quote/${q[0].id}`, { timeout: 90000 });
    await pub.locator('.pq-card').waitFor({ timeout: 45000 });
    await pub.waitForTimeout(1000);
    const text = (await pub.locator('.pq-card').innerText()).replace(/\s+/g, ' ');
    check('public quote renders with whole-shekel .00 money', /₪191\.00/.test(text) && !/₪[\d,]+\.(?!00)\d\d/.test(text), (text.match(/₪[\d,.]+/g) || []).join(' '));
    try { await pub.emulateMedia({ media: 'print' }); const hidden = await pub.evaluate(() => [...document.querySelectorAll('.no-print')].every((el) => getComputedStyle(el).display === 'none')); check('print emulation hides controls', hidden); }
    catch (err) { c.notTested = [`print emulation unsupported on this engine: ${String(err.message).slice(0, 80)}`]; }
    await ctx.close();
  } catch (err) { check('engine smoke completed', false, String(err.message).split(String.fromCharCode(10))[0].slice(0, 160)); }
  if (browser) await browser.close();
}
await sb.from('quotes').delete().eq('id', q[0].id);
await sb.from('clients').delete().eq('id', cl[0].id);
for (const id of ['samsung-internet', 'safari-macos-app', 'safari-ios-physical', 'chrome-android-physical']) results.push({ id, status: 'NOT_TESTED', checks: [], note: 'not available in this environment - Owner physical-device acceptance (OD-F2)' });
for (const c of results) if (!c.status) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status === 'FAIL');
const summary = { gate: 'SUPPORTED-BROWSER MATRIX SMOKE', base, at: new Date().toISOString(), failed: failed.length, verdict: failed.length ? 'FAIL' : 'PARTIAL', note: 'PARTIAL by construction: physical Samsung Internet / Safari / Android devices are Owner tests', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
for (const c of results) console.log(`${c.status.padEnd(10)} ${c.id}${c.version ? ` (${c.version})` : ''}`);
console.log(`SUPPORTED-BROWSER MATRIX SMOKE: ${summary.verdict}`);
process.exit(failed.length ? 1 : 0);
