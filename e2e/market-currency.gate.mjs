// MARKET / LOCALE / CURRENCY GATE (OD-8: ILS + USD + EUR + GBP; synthetic personas only - IRON-DATA-001).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/market-currency.gate.mjs <baseUrl> [outJson]
// Isolation without persona mutation: the designated personas are HE/Local/ILS (A) and EN/International/USD (EN). EUR and GBP are
// exercised at QUOTE level (synthetic EUR/GBP quotes owned by the EN persona - the persona's own market state is never changed).
// Authenticated EUR/GBP account views need dedicated EUR/GBP personas that are NOT designated yet -> reported as BLOCKED cells.
// Cells: public quote (screen + print) per currency, market routing without bleed (an International quote opened on the HE route
// stays EN/LTR), landing pricing currency by the visitor's geo country (IL ₪ / US $ / GB ≈£ / euro area ≈€ estimates, USD billing;
// non-euro Europe, stale or missing rate -> USD + notice), monthly + annual, 390 + 1280 px.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = process.argv[2] || 'http://localhost:5198';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
const { createClient } = await import('@supabase/supabase-js');

const results = [];
const cell = (id) => { const c = { id, checks: [] }; results.push(c); return c; };
const check = (c, name, ok, detail) => { c.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log(`  FAIL ${c.id} :: ${name} ${detail ?? ''}`); };
const HEBREW = /[\u0590-\u05FF]/;

async function session(persona) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: persona.email, password: persona.password });
  if (error) throw error;
  return { sb, uid: data.user.id };
}
async function makeQuote({ sb, uid }, { currency, taxRate, name }) {
  const { data: cl } = await sb.from('clients').insert([{ company_name: name, email: '', user_id: uid, client_type: 'business' }]).select();
  const { data: num } = await sb.rpc('allocate_quote_number', { p_user_id: uid });
  const items = [{ d: 'Synthetic item A', q: 1, p: 191.16 }, { d: 'Synthetic item B', q: 2, p: 100.5 }];
  const subtotal = items.reduce((s, i) => s + i.q * i.p, 0);
  const total = Math.round(subtotal * (1 + taxRate) * 100) / 100;
  const { data: q, error } = await sb.from('quotes').insert([{ user_id: uid, client_id: cl[0].id, quote_number: typeof num === 'number' ? num : undefined, status: 'sent', valid_until: '2099-12-13', currency, client_type: 'business', tax_rate: taxRate, subtotal, total, discount: 0 }]).select();
  if (error) throw error;
  await sb.rpc('save_quote_structured', { p_quote_id: q[0].id, p_financial: null, p_sections: [], p_items: items.map((it, i) => ({ client_key: `k${i}`, id: null, section_client_key: null, description: it.d, quantity: it.q, unit_price: it.p, total_price: it.q * it.p, sort_order: i, measurements: [] })), p_removed_section_ids: [], p_removed_item_ids: [] });
  return { id: q[0].id, clientId: cl[0].id, total };
}
async function cardText(page, url, print) {
  await page.goto(url, { timeout: 90000 });
  await page.locator('.pq-card').waitFor({ timeout: 45000 });
  await page.waitForTimeout(1200);
  if (print) await page.emulateMedia({ media: 'print' });
  return page.evaluate(() => ({ text: document.querySelector('.pq-card').innerText.replace(/\s+/g, ' '), dir: document.querySelector('.pq-page')?.getAttribute('dir'), lang: document.documentElement.lang }));
}

const browser = await chromium.launch();
const sEN = await session(PERSONA_EN);
const sA = await session(PERSONA_A);
const made = [];
try {
  const quotes = {
    ILS: [sA, await makeQuote(sA, { currency: 'ILS', taxRate: 0.18, name: 'Market Synthetic ILS' })],
    USD: [sEN, await makeQuote(sEN, { currency: 'USD', taxRate: 0, name: 'Market Synthetic USD' })],
    EUR: [sEN, await makeQuote(sEN, { currency: 'EUR', taxRate: 0, name: 'Market Synthetic EUR' })],
    GBP: [sEN, await makeQuote(sEN, { currency: 'GBP', taxRate: 0, name: 'Market Synthetic GBP' })],
  };
  for (const [, [s, q]] of Object.entries(quotes)) made.push([s, q]);
  const SYM = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
  for (const [cur, [, q]] of Object.entries(quotes)) {
    for (const print of [false, true]) {
      const c = cell(`public-quote/${cur}/${print ? 'print' : 'screen'}`);
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      const page = await ctx.newPage();
      try {
        const local = cur === 'ILS';
        const r = await cardText(page, `${base}/${local ? '' : 'en/'}public-quote/${q.id}${local ? '' : '?lang=en'}`, print);
        const sym = SYM[cur];
        const amounts = r.text.match(new RegExp(`\\${sym}[\\d,]+\\.\\d\\d`, 'g')) || [];
        check(c, `direction ${local ? 'rtl' : 'ltr'} / lang ${local ? 'he' : 'en'}`, r.dir === (local ? 'rtl' : 'ltr') && r.lang === (local ? 'he' : 'en'), `${r.dir}/${r.lang}`);
        check(c, `amounts use ${sym}`, amounts.length >= 3, amounts.slice(0, 5).join(' '));
        if (local) {
          check(c, 'ILS: whole shekels .00 only', amounts.every((a) => a.endsWith('.00')), amounts.join(' '));
          check(c, 'Local VAT terminology (מע"מ) shown', /מע"מ/.test(r.text));
        } else {
          check(c, `${cur}: cents preserved (191.16 line present)`, r.text.includes(`${sym}191.16`), amounts.join(' '));
          check(c, 'no ₪ and no other market symbol', !r.text.includes('₪') && Object.entries(SYM).filter(([k]) => k !== cur && k !== 'ILS').every(([, v]) => !r.text.includes(`${v}1`) && !r.text.includes(`${v}2`) && !r.text.includes(`${v}4`)));
          check(c, 'no Hebrew text / Local VAT terminology on an International quote', !HEBREW.test(r.text));
        }
      } catch (e) { check(c, 'rendered', false, String(e.message).split(String.fromCharCode(10))[0].slice(0, 160)); }
      await ctx.close();
    }
  }
  // market routing: an International quote opened on the HE route must still render as EN/LTR (the quote's market decides)
  {
    const c = cell('routing/international-quote-on-he-route');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    const r = await cardText(page, `${base}/public-quote/${quotes.EUR[1].id}`, false);
    check(c, 'EN/LTR rendering, € amounts, no Hebrew (no market bleed)', r.dir === 'ltr' && r.text.includes('€191.16') && !HEBREW.test(r.text), `${r.dir} ${r.text.slice(0, 80)}`);
    await ctx.close();
  }
} finally {
  for (const [s, q] of made) { await s.sb.from('quotes').delete().eq('id', q.id); await s.sb.from('clients').delete().eq('id', q.clientId); }
}
// landing pricing currency by the visitor's GEO country (Task 39, Owner final scope / OD-08): IL -> the Hebrew landing in ₪; abroad -> the
// English landing in USD, with GB £ / euro-area € shown ONLY as a labelled estimate from the rate source (billing stays USD). The geo
// country and the rate payload are CONTROLLED inputs here (request stubs for /api/geo and the rate source) - TEST evidence of the
// behaviour, never a LIVE geo proof. Only the plan-card amounts are checked (not example amounts in the page), monthly AND annual.
const RATE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const ratePayload = (ageHours) => ({ provider: 'https://www.exchangerate-api.com', base: 'USD', date: '2026-10-13', time_last_updated: Math.floor(Date.now() / 1000 - ageHours * 3600), rates: { USD: 1, GBP: 0.75, EUR: 0.9, ILS: 3.7 } });
const PRICING = [
  // [id, country, rate: 'fresh' | 'stale' | 'down', lang, month amount, year amount, estimate?]
  ['IL', 'IL', 'fresh', 'he', '₪30.00', '₪306.00', false],
  ['US', 'US', 'fresh', 'en', '$18.00', '$184.00', false],
  ['GB', 'GB', 'fresh', 'en', '≈£13.50', '≈£138.00', true],
  ['DE', 'DE', 'fresh', 'en', '≈€16.20', '≈€165.60', true],
  ['FR', 'FR', 'fresh', 'en', '≈€16.20', '≈€165.60', true],
  ['CH-not-euro', 'CH', 'fresh', 'en', '$18.00', '$184.00', false],
  ['GB-stale-rate', 'GB', 'stale', 'en', '$18.00', '$184.00', false],
  ['GB-rate-source-down', 'GB', 'down', 'en', '$18.00', '$184.00', false],
];
for (const [id, country, rateMode, lang, monthAmt, yearAmt, isEstimate] of PRICING) {
  for (const width of [390, 1280]) {
    const c = cell(`landing-pricing/${id}/${width}`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700 });
    const page = await ctx.newPage();
    await page.route('**/api/geo', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ country }) }));
    await page.route(RATE_URL, (r) => (rateMode === 'down' ? r.fulfill({ status: 503, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ratePayload(rateMode === 'stale' ? 30 : 1)) })));
    try {
      await page.goto(`${base}/${lang}?lang=${lang}`, { timeout: 90000 });
      const card = page.locator('[data-plan-card="all_inclusive"]');
      await card.waitFor({ timeout: 45000 });
      await page.waitForTimeout(1500);
      const amount = async () => (await card.locator('.tl-plan-amount').first().innerText()).trim();
      const month = await amount();
      check(c, `monthly plan-card amount ${monthAmt}`, month === monthAmt, month);
      await card.locator('input[data-period="year"]').check();
      await page.waitForTimeout(300);
      const year = await amount();
      check(c, `annual plan-card amount ${yearAmt}`, year === yearAmt, year);
      const cardText = (await card.innerText()).replace(/\s+/g, ' ');
      const note = ((await page.locator('[data-price-note]').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
      if (lang === 'he') check(c, 'Local: ₪ only, VAT included', !/[$£€]/.test(cardText) && /מע/.test(note + cardText), note);
      else if (isEstimate) {
        check(c, 'estimate labelled and billing disclosed in USD on the card', /estimate/.test(cardText) && /Charged in USD: \$184\.00/.test(cardText), cardText.slice(0, 200));
        check(c, 'price note: estimate + source + as-of date + charged in USD', /are estimates/.test(note) && /ExchangeRate-API/.test(note) && /\d{4}-\d{2}-\d{2}/.test(note) && /charged in US dollars/.test(note), note);
        check(c, 'never ILS on the International landing', !/₪|\bILS\b|\bNIS\b/.test(await page.locator('body').innerText()));
      } else {
        check(c, 'USD only on the card (no £ / € / ₪)', !/[£€₪]/.test(cardText), cardText.slice(0, 160));
        const wantsNotice = rateMode !== 'fresh' && country === 'GB';
        check(c, wantsNotice ? 'true notice: the estimate is not available, prices in USD' : 'plain USD disclosure', wantsNotice ? /GBP estimate is not available right now/.test(note) : /Prices are in US dollars\. Charged in USD\./.test(note), note);
      }
    } catch (e) { check(c, 'rendered', false, String(e.message).slice(0, 160)); }
    await ctx.close();
  }
}
await browser.close();
// explicitly blocked cells (never inferred)
for (const cur of ['EUR', 'GBP']) {
  results.push({ id: `authenticated-account/${cur}`, status: 'BLOCKED_OWNER_TEST', checks: [], note: `No designated synthetic ${cur} persona (OD-8 requires isolated personas; the EN/USD persona is never switched). Needs an Owner-designated ${cur} synthetic persona on TEST.` });
}
for (const c of results) if (!c.status) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status === 'FAIL');
const blocked = results.filter((c) => c.status.startsWith('BLOCKED'));
const summary = { gate: 'MARKET / LOCALE / CURRENCY GATE', base, at: new Date().toISOString(), cells: results.length, failed: failed.length, blocked: blocked.length, verdict: failed.length ? 'FAIL' : (blocked.length ? 'PARTIAL' : 'PASS'), results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`MARKET / LOCALE / CURRENCY GATE: ${summary.verdict} (${results.length - failed.length - blocked.length} PASS, ${failed.length} FAIL, ${blocked.length} BLOCKED)`);
process.exit(failed.length ? 1 : 0);
