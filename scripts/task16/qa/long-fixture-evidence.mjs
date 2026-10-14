// Task 16 - Quote Experience V2: evidence for independent-review correction #1 on REAL quotes (the long fixture).
//
// The refined prototype printed a wrong subtotal for its long (18-row) fixture. This script proves the real app does not:
// it creates REAL quotes on TEST through the app's own save path with the refined rows (2 x 1,200 / 3.4 m2 x 450 /
// 1 x 850, 10% discount; the long one = those three rows repeated six times), opens them anonymously as a customer and
// checks every displayed amount against the stored row, then exercises the real Direct PDF action and native Print.
//
// Usage (AVG HTTPS scanning needs the Windows trust store -> --use-system-ca):
//   node --use-system-ca scripts/task16/qa/long-fixture-evidence.mjs --out <dir> --create                # (a) create quotes
//   node --use-system-ca scripts/task16/qa/long-fixture-evidence.mjs --out <dir> --base-url http://localhost:5186   # (b)+(c)
//   (both flags may be combined; without --create, (b)/(c) reuse <dir>/long-fixture-quotes.json)
//   [--env C:/tkrc-pt/.env.localtest.local] [--quotes <json>]
//
// Output: <dir>/long-fixture-quotes.json (created ids), <dir>/long-fixture-evidence.json (PASS / FAIL / NOT TESTED per check),
//         <dir>/<label>-direct.pdf (the real downloaded Direct PDF), <dir>/<label>-print.pdf (print-emulated A4),
//         <dir>/<label>-desktop.png / -390.png. Exit 0 = no FAIL, 1 = a FAIL, 2 = refused / setup error.
//
// TARGET: refuses unless VITE_SUPABASE_URL is exactly https://ljfizgrdyzxddswcedwr.supabase.co (TEST).
// CREDENTIALS: persona e-mails / password / anon key are only passed to createClient / signInWithPassword; never printed or
//   written (every output string passes through redact()). Only user ids truncated to 8 characters are printed.
// WRITES (TEST only, deliberate QA writes): per market (LOCAL_PRO HE/ILS, INTL_PRO EN/USD) one "T16 QA long fixture" quote
//   (18 rows, presentation style visual + 3 sample images) and one "T16 QA short fixture" quote (3 rows, style modern + images),
//   new clients for them, uploaded sample PNGs (public/task16-samples/*.png). No e-mail is sent, nothing is deleted.
// SOURCE OF TRUTH: rows and financials come from src/quoteDocument/sampleQuotes.js (buildSampleItems /
//   computeSampleFinancials = calculateQuoteFinancials over withActiveQuantities - the save path's own rules), loaded through
//   Vite's SSR module loader so the app code is used as-is; persistence is src/utils/quoteSaveOrchestrator.js persistQuote.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertAllowlistedPersona } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));

const TEST_REF = 'ljfizgrdyzxddswcedwr';
const TEST_URL = `https://${TEST_REF}.supabase.co`;
const FN = 'quote-presentation';
const DEFAULT_ENV = 'C:/tkrc-pt/.env.localtest.local';
const PASSWORD_KEY = 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD';
// IRON-DATA-001: allowlisted synthetic personas only (fail-closed sha256 check before any sign-in). Password: the
// persona's own *_PASSWORD key when present, else the plan-persona password.
const pwdFor = (env, emailKey) => env[emailKey.replace(/_EMAIL$/, '_PASSWORD')] || env[PASSWORD_KEY];
const MARKETS = [
  { market: 'LOCAL', persona: 'LOCAL_PRO', emailKey: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', locale: 'he', country: 'Local', currency: 'ILS' },
  { market: 'INTL', persona: 'INTL_PRO', emailKey: 'PROFLOW_TEST_INTL_PRO_EMAIL', locale: 'en', country: 'International', currency: 'USD' },
];
const VARIANTS = [
  { kind: 'long', length: 'long', style: 'visual' },
  { kind: 'short', length: 'short', style: 'modern' },
];
const PASS = 'PASS'; const FAIL = 'FAIL'; const NT = 'NOT TESTED';

// ------------------------------------------------------------------------------------------------------------- utils
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i += 1; } else out[a.slice(2)] = true;
  }
  return out;
}
function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
let SECRETS = [];
function redact(text) {
  let s = String(text);
  for (const v of SECRETS) if (v && v.length >= 3) s = s.split(v).join('<redacted>');
  s = s.replace(/eyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]{2,}){1,2}/g, '<jwt>');
  s = s.replace(/([?&]token=)[^&"\s]+/g, '$1<redacted>');
  s = s.replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '<key>');
  return s;
}
const say = (msg) => process.stdout.write(redact(msg) + '\n');
const short = (id) => (typeof id === 'string' ? `${id.slice(0, 8)}…` : String(id));
const writeJson = (file, obj) => fs.writeFileSync(file, redact(JSON.stringify(obj, null, 2)) + '\n');
const cents = (n) => Math.round(Number(n) * 100);

const checks = [];
function check(scope, name, ok, detail) {
  const status = ok === null ? NT : ok ? PASS : FAIL;
  checks.push({ scope, name, status, detail: detail === undefined ? null : JSON.parse(redact(JSON.stringify(detail))) });
  say(`  [${status}] ${scope} :: ${name}`);
}

// App modules through Vite's SSR loader (extensionless imports + .jsx), no Vite config/plugins, no server listening.
async function loadAppModules() {
  const { createServer } = require('vite');
  const vite = await createServer({
    root: REPO_ROOT, configFile: false, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: 'automatic' },
  });
  try {
    const samples = await vite.ssrLoadModule('/src/quoteDocument/sampleQuotes.js');
    const money = await vite.ssrLoadModule('/src/utils/money.js');
    const quoteNumber = await vite.ssrLoadModule('/src/utils/quoteNumber.js');
    return { samples, money, quoteNumber };
  } finally {
    await vite.close();
  }
}

// ------------------------------------------------------------------------------------------------------------- (a) create
async function signIn(createClient, url, anonKey, email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) return { client: null, uid: null, errorCode: String(error?.code || (error?.status ? `http_${error.status}` : 'no_user')) };
  return { client, uid: data.user.id, errorCode: null };
}
async function invoke(client, body) {
  try {
    const { data, error } = await client.functions.invoke(FN, { body });
    if (!error) return { status: 200, ok: true, data };
    let payload = null;
    try { payload = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch { payload = null; }
    return { status: error.context?.status ?? null, ok: false, code: payload?.error ?? error.name ?? 'error', message: payload?.message ?? error.message };
  } catch (e) {
    return { status: null, ok: false, code: 'exception', message: e?.message || String(e) };
  }
}

async function createFixtures({ env, url, anonKey, mods, outDir }) {
  const { createClient } = require('@supabase/supabase-js');
  const { persistQuote, newUuid } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'utils', 'quoteSaveOrchestrator.js')).href);
  const { buildSampleItems, buildSampleMedia, computeSampleFinancials, SAMPLE_DISCOUNT_PERCENT } = mods.samples;
  const created = [];
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  for (const m of MARKETS) {
    const scope = `create/${m.persona}`;
    const p = await signIn(createClient, url, anonKey, env[m.emailKey], pwdFor(env, m.emailKey));
    if (!p.client) { check(scope, 'sign-in', false, { authErrorCode: p.errorCode }); continue; }
    say(`persona ${m.persona}: uid ${short(p.uid)}`);
    // Sample images (the same art as the sample route), uploaded once per persona through the function (server-validated).
    const assets = {};
    for (const name of ['shelf', 'joint', 'worktop']) {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, 'public', 'task16-samples', `${name}.png`));
      const r = await invoke(p.client, { action: 'upload_media', filename: `t16-qa-${name}.png`, contentType: 'image/png', dataBase64: bytes.toString('base64') });
      if (r.ok && r.data?.asset?.id) assets[name] = r.data.asset.id;
      check(scope, `upload ${name}.png`, r.ok && !!r.data?.asset?.id, r.ok ? { assetId: r.data.asset.id, width: r.data.asset.width, height: r.data.asset.height } : { status: r.status, code: r.code });
    }
    const sampleMedia = buildSampleMedia(m.locale); // url = /task16-samples/<file>.svg -> map to the uploaded PNG of the same art
    const mediaRefs = sampleMedia.map((x, order) => {
      const name = String(x.url).split('/').pop().replace(/\.svg$/, '');
      return assets[name] ? { assetId: assets[name], caption: x.caption, alt: x.alt, role: x.role, itemKey: x.itemKey, order } : null;
    }).filter(Boolean);

    for (const v of VARIANTS) {
      const label = `${m.locale}-${v.kind}`;
      const items = buildSampleItems(m.locale, v.length);
      const fin = computeSampleFinancials(items, { country: m.country, clientType: 'business', discount: SAMPLE_DISCOUNT_PERCENT });
      const clientName = `T16 QA ${v.kind} fixture ${m.locale.toUpperCase()} ${stamp}`;
      const subject = `T16 QA ${v.kind} fixture`;
      const plan = {
        userId: p.uid, isNew: true, quoteId: newUuid(), existingClientId: null,
        clientPayload: { company_name: clientName, email: '', phone: '', client_type: 'business', tax_id: '', address: '', notes: '', user_id: p.uid },
        header: {
          client_type: 'business', currency: m.currency, subtotal: fin.subtotal, tax_rate: fin.taxRate, total: fin.total,
          discount: SAMPLE_DISCOUNT_PERCENT, status: 'draft', valid_until: null, terms: '', warranty: '', notes: '', subject, quote_subject: subject,
        },
        attnFields: { attn_name: null, attn_role: null }, attnUserEntered: false, projectName: null, descriptionUpdates: [],
        structured: {
          financial: null, sections: [],
          items: items.map((it, idx) => ({
            client_key: `new_${idx}`, id: null, section_client_key: null, description: it.description, quantity: it.quantity,
            unit_price: it.unit_price, total_price: it.total_price, pricing_unit: it.pricing_unit, calculated_quantity: it.calculated_quantity,
            quantity_source: it.quantity_source, specification: it.specification, calculation_method: it.calculation_method, sort_order: idx, measurements: [],
          })),
          removedSectionIds: [], removedItemIds: [],
        },
        newFiles: [], removedAttachments: [], now: () => Date.now(),
      };
      const r = await persistQuote(p.client, plan);
      const ok = r.outcome === 'ok' && !!r.quoteId;
      check(scope, `${label} quote saved through persistQuote`, ok, { outcome: r.outcome, path: r.path, stage: r.stage || null, quoteId: r.quoteId || null, error: r.error ? { code: r.error.code, message: r.error.message } : null });
      if (!ok) continue;
      let style = v.style;
      let s = await invoke(p.client, { action: 'save_quote', quoteId: r.quoteId, style, media: mediaRefs });
      if (!s.ok && s.code === 'style_not_entitled') { style = 'classic'; s = await invoke(p.client, { action: 'save_quote', quoteId: r.quoteId, style, media: [] }); }
      check(scope, `${label} presentation saved (${style})`, s.ok, s.ok ? { style, media: mediaRefs.length } : { status: s.status, code: s.code });
      created.push({ label, market: m.market, persona: m.persona, owner: short(p.uid), locale: m.locale, quoteId: r.quoteId, rows: items.length, style, mediaCount: style === 'classic' ? 0 : mediaRefs.length,
        expected: { subtotal: fin.subtotal, discountPercent: SAMPLE_DISCOUNT_PERCENT, discountAmount: fin.discountAmount, netAmount: fin.netAmount, taxRate: fin.taxRate, taxAmount: fin.taxAmount, total: fin.total } });
    }
    await p.client.auth.signOut().catch(() => {});
  }
  const file = path.join(outDir, 'long-fixture-quotes.json');
  writeJson(file, { createdAt: new Date().toISOString(), project: TEST_REF, quotes: created });
  say(`wrote ${file}`);
  return created;
}

// ------------------------------------------------------------------------------------------------------------- DB truth
async function readStored({ url, anonKey, env }, q) {
  // Owner read of the stored row + items (RLS as the owner) - the values the customer page must display.
  const { createClient } = require('@supabase/supabase-js');
  const m = MARKETS.find((x) => x.persona === q.persona);
  const p = await signIn(createClient, url, anonKey, env[m.emailKey], pwdFor(env, m.emailKey));
  if (!p.client) return { error: `sign-in ${p.errorCode}` };
  const { data: quote, error } = await p.client.from('quotes').select('id, quote_number, subtotal, discount, tax_rate, total, currency, client_type, status').eq('id', q.quoteId).single();
  const { data: rows, error: e2 } = await p.client.from('quote_items').select('total_price, unit_price, quantity, calculated_quantity').eq('quote_id', q.quoteId);
  await p.client.auth.signOut().catch(() => {});
  if (error || e2) return { error: (error || e2).message };
  return { quote, rows };
}

// ------------------------------------------------------------------------------------------------------------- (b)+(c) browser
async function verifyInBrowser({ baseUrl, outDir, quotes, mods, ctx: dbCtx }) {
  const { chromium } = require('playwright');
  const { formatWholeMoney, formatMoney } = mods.money;
  const browser = await chromium.launch();
  try {
    for (const q of quotes) {
      const scope = `public/${q.label}`;
      const stored = await readStored(dbCtx, q);
      if (stored.error) { check(scope, 'stored row readable by owner', false, { error: stored.error }); continue; }
      const he = q.locale === 'he';
      const sym = he ? '₪' : '$';
      const fmt = (n) => `${sym}${he ? formatWholeMoney(n) : formatMoney(n)}`;
      const db = stored.quote;
      const rowSum = stored.rows.reduce((s, r) => s + cents(r.total_price), 0) / 100;
      check(scope, 'DB: subtotal == Σ stored row totals', cents(rowSum) === cents(db.subtotal), { rowCount: stored.rows.length, rowSum, subtotal: db.subtotal });
      if (q.rows === 18) check(scope, 'DB: long fixture subtotal is 28,680 before discount', cents(db.subtotal) === 2868000, { subtotal: db.subtotal });
      check(scope, 'DB: stored subtotal/total equal the save-path computation', cents(db.subtotal) === cents(q.expected.subtotal) && cents(db.total) === cents(q.expected.total), { stored: { subtotal: db.subtotal, total: db.total }, expected: q.expected });

      // Expected customer display. HE (IRON-ILS-001): whole shekels ".00"; business VAT = whole total - whole net (residual
      // rule, so net + VAT always equals the shown total). EN: cents, no VAT line, discount = subtotal - total.
      const expected = he
        ? (() => {
          const discountAmount = Math.round((Number(db.subtotal) * (Number(db.discount) / 100) + Number.EPSILON) * 100) / 100;
          const net = Math.round((Number(db.subtotal) - discountAmount) * 100) / 100;
          const totalWhole = Math.round(Number(db.total));
          return { subtotal: fmt(db.subtotal), discount: fmt(discountAmount), vat: `${sym}${formatWholeMoney(totalWhole - Math.round(net))}`, total: fmt(db.total) };
        })()
        : { subtotal: fmt(db.subtotal), discount: fmt(Math.max(Number(db.subtotal) - Number(db.total), 0)), vat: null, total: fmt(db.total) };

      const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
      await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
      const page = await context.newPage();
      const target = `${baseUrl.replace(/\/+$/, '')}/quote/${q.quoteId}?lang=${q.locale}`;
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.locator('.pq-card .pq-totals-box').waitFor({ timeout: 120000 });
        await page.waitForTimeout(1500);
      } catch (e) {
        check(scope, 'public page rendered', false, { target, error: String(e.message).split('\n')[0] });
        await context.close();
        continue;
      }
      const read = () => page.evaluate(() => {
        const card = document.querySelector('.pq-card');
        const box = card.querySelector('.pq-totals-box');
        const spans = [...box.querySelectorAll(':scope > span')].map((s) => s.textContent.trim());
        const pairs = [];
        for (let i = 0; i + 1 < spans.length; i += 2) pairs.push([spans[i], spans[i + 1]]);
        const rowTotals = [...card.querySelectorAll('table.pq-commercial-table tbody tr')].map((tr) => tr.querySelectorAll('td')[3]?.textContent.trim());
        return {
          style: card.getAttribute('data-pq-style'), pairs, finalAmount: box.querySelector('.pq-total-final-amount')?.textContent.trim(),
          rowCount: rowTotals.length, rowTotals, allMoney: (card.textContent.match(/[₪$][\d,]+\.\d\d/g) || []),
          mediaCount: card.querySelectorAll('.pq-media-figure').length, thumbs: card.querySelectorAll('.pq-media-thumb').length,
          // cloud-fix4 (D21a, base position): screen-only action UI (.no-print + [data-html2canvas-ignore]) may sit in the card;
          // any action control that would reach Print or the Direct PDF capture still FAILS.
          actionsInsideCard: [...card.querySelectorAll('.pq-action-tiles, canvas, a[href^="tel:"]')].some((e) => !(e.closest('.no-print') && e.closest('[data-html2canvas-ignore]'))),
          scrollOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      const shown = await read();
      const byLabel = (re) => (shown.pairs.find(([l]) => re.test(l)) || [])[1] || null;
      const shownSubtotal = byLabel(/סיכום ביניים|Subtotal/);
      const shownDiscount = byLabel(/הנחה|Discount/);
      const shownVat = byLabel(/מע"מ/);
      const pageRowSum = shown.rowTotals.reduce((s, t) => s + cents(String(t).replace(/[^\d.]/g, '')), 0) / 100;
      check(scope, 'presentation style rendered', shown.style === q.style, { expected: q.style, rendered: shown.style, media: shown.mediaCount, thumbs: shown.thumbs });
      check(scope, `all ${q.rows} rows displayed`, shown.rowCount === q.rows, { displayed: shown.rowCount });
      if (q.style !== 'classic') check(scope, 'showcase media + row thumbnails rendered (item-role images bound by itemKey)', shown.mediaCount >= 3 && shown.thumbs >= 2, { showcase: shown.mediaCount, thumbs: shown.thumbs });
      check(scope, 'displayed subtotal == stored subtotal (formatted)', shownSubtotal === expected.subtotal, { shown: shownSubtotal, expected: expected.subtotal });
      check(scope, 'displayed discount == stored discount (formatted)', shownDiscount === expected.discount, { shown: shownDiscount, expected: expected.discount });
      if (he) check(scope, 'displayed VAT == whole total - whole net', shownVat === expected.vat, { shown: shownVat, expected: expected.vat });
      check(scope, 'displayed total == stored total (formatted)', shown.finalAmount === expected.total, { shown: shown.finalAmount, expected: expected.total });
      check(scope, 'Σ displayed row totals == stored subtotal', cents(pageRowSum) === cents(db.subtotal), { pageRowSum, subtotal: db.subtotal });
      if (he) check(scope, 'IRON-ILS-001: every displayed ₪ amount ends in .00', shown.allMoney.length > 0 && shown.allMoney.every((a) => a.endsWith('.00')), { sample: shown.allMoney.slice(-6) });
      else check(scope, 'International: cents shown, no ₪', shown.allMoney.length > 0 && shown.allMoney.every((a) => a.startsWith('$')), { sample: shown.allMoney.slice(-6) });
      check(scope, 'no printable / capturable action control inside the capture root', !shown.actionsInsideCard);
      await page.screenshot({ path: path.join(outDir, `${q.label}-desktop.png`), fullPage: true }).catch(() => {});

      // (c1) real Direct PDF: the page's own "Download PDF" tile -> Compact -> generateQuotePdf (html2canvas + jsPDF).
      try {
        const pdfTile = page.getByRole('button', { name: he ? /הורד כ-PDF/ : /Download PDF/ });
        await pdfTile.click();
        const downloadP = page.waitForEvent('download', { timeout: 120000 });
        const captureP = page.waitForFunction(() => {
          const pg = document.querySelector('.pq-page.pq-pdf-capturing');
          if (!pg) return null;
          const box = document.querySelector('.pq-card .pq-totals-box');
          return { final: box?.querySelector('.pq-total-final-amount')?.textContent.trim(), rows: document.querySelectorAll('.pq-card table.pq-commercial-table tbody tr').length };
        }, null, { timeout: 60000, polling: 50 }).then((h) => h.jsonValue()).catch(() => null);
        await page.getByRole('button').filter({ hasText: he ? /^תמציתי/ : /^Compact/ }).first().click();
        const [download, capture] = await Promise.all([downloadP, captureP]);
        const pdfFile = path.join(outDir, `${q.label}-direct.pdf`);
        await download.saveAs(pdfFile);
        const buf = fs.readFileSync(pdfFile);
        const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
        check(scope, 'Direct PDF downloaded (real action)', buf.slice(0, 5).toString() === '%PDF-' && pages >= 1, { file: path.basename(pdfFile), bytes: buf.length, pages, suggested: download.suggestedFilename() });
        check(scope, 'Direct PDF capture DOM had the correct total + every row', !!capture && capture.final === expected.total && capture.rows === q.rows, { capture, expectedTotal: expected.total });
        if (q.rows === 3) check(scope, 'Direct PDF: short quote fits one A4 page', pages === 1, { pages });
      } catch (e) {
        check(scope, 'Direct PDF downloaded (real action)', false, { error: String(e.message).split('\n')[0] });
      }

      // (c2) native Print: the real chooser (window.print stubbed), then print-emulated A4 PDF of the page.
      try {
        await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }; });
        await page.getByRole('button', { name: he ? /^הדפס מסמך$/ : /^Print Document$/ }).click();
        await page.getByRole('button').filter({ hasText: he ? /^תמציתי/ : /^Compact/ }).first().click();
        await page.waitForTimeout(400);
        const printCalls = await page.evaluate(() => window.__printCalls);
        await page.emulateMedia({ media: 'print' });
        const noPrintVisible = await page.evaluate(() => [...document.querySelectorAll('.no-print')].filter((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0).length);
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
        const printFile = path.join(outDir, `${q.label}-print.pdf`);
        fs.writeFileSync(printFile, pdf);
        const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
        check(scope, 'native Print chooser invoked window.print', printCalls >= 1, { printCalls });
        check(scope, 'print hides every .no-print control', noPrintVisible === 0, { noPrintVisible });
        check(scope, q.rows === 3 ? 'native Print: short quote = 1 A4 page' : 'native Print: long quote paginates', q.rows === 3 ? pages === 1 : pages >= 2, { file: path.basename(printFile), pages });
        await page.emulateMedia({ media: 'screen' });
      } catch (e) {
        check(scope, 'native Print', false, { error: String(e.message).split('\n')[0] });
      }

      // Phone width: same totals, no horizontal page scroll.
      try {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.waitForTimeout(500);
        const phone = await read();
        check(scope, '390px: same displayed total, no horizontal page scroll', phone.finalAmount === expected.total && !phone.scrollOverflow, { total: phone.finalAmount, scrollOverflow: phone.scrollOverflow });
        await page.screenshot({ path: path.join(outDir, `${q.label}-390.png`), fullPage: true }).catch(() => {});
      } catch (e) {
        check(scope, '390px view', false, { error: String(e.message).split('\n')[0] });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out || args.out === true || (!args.create && !args['base-url'])) {
    say('usage: node --use-system-ca scripts/task16/qa/long-fixture-evidence.mjs --out <dir> [--create] [--base-url <url>] [--quotes <json>] [--env <file>]');
    return 2;
  }
  const outDir = path.resolve(String(args.out));
  const env = readEnv(String(args.env && args.env !== true ? args.env : DEFAULT_ENV));
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  SECRETS = [anonKey, env[PASSWORD_KEY], ...MARKETS.flatMap((m) => [env[m.emailKey], pwdFor(env, m.emailKey)])].filter(Boolean);
  let host = null;
  try { const u = new URL(url); host = u.protocol === 'https:' && !u.port && !u.username ? u.hostname : null; } catch { host = null; }
  if (url !== TEST_URL || host !== `${TEST_REF}.supabase.co`) { say('REFUSED: VITE_SUPABASE_URL is not exactly the TEST project (value not printed)'); return 2; }
  const missing = ['VITE_SUPABASE_ANON_KEY', ...MARKETS.map((m) => m.emailKey)].filter((k) => !env[k]);
  if (MARKETS.some((m) => !pwdFor(env, m.emailKey))) missing.push(PASSWORD_KEY);
  if (missing.length) { say(`REFUSED: env file lacks ${missing.join(', ')} (names only)`); return 2; }
  try { for (const m of MARKETS) assertAllowlistedPersona(env[m.emailKey], m.persona); } catch (e) { say(`REFUSED (IRON-DATA-001): ${e.message}`); return 2; }
  if (args['base-url'] && args['base-url'] !== true) {
    let b; try { b = new URL(String(args['base-url'])); } catch { b = null; }
    if (!b || !['localhost', '127.0.0.1'].includes(b.hostname)) { say('REFUSED: --base-url must be a local candidate server (localhost / 127.0.0.1)'); return 2; }
  }
  fs.mkdirSync(outDir, { recursive: true });
  say(`project ${TEST_REF} (TEST)`);
  const mods = await loadAppModules();
  const startedAt = new Date().toISOString();

  let quotes = null;
  if (args.create) quotes = await createFixtures({ env, url, anonKey, mods, outDir });
  else {
    const file = path.resolve(String(args.quotes && args.quotes !== true ? args.quotes : path.join(outDir, 'long-fixture-quotes.json')));
    if (!fs.existsSync(file)) { say(`REFUSED: no quotes file (${file}); run with --create first`); return 2; }
    quotes = JSON.parse(fs.readFileSync(file, 'utf8')).quotes;
  }
  if (args['base-url'] && args['base-url'] !== true) {
    await verifyInBrowser({ baseUrl: String(args['base-url']), outDir, quotes, mods, ctx: { url, anonKey, env } });
  } else {
    check('public', 'customer page / Direct PDF / Print', null, { reason: 'no --base-url given (candidate not served yet)' });
  }
  const failed = checks.filter((c) => c.status === FAIL).length;
  const report = { gate: 'T16 long-fixture evidence (independent-review correction #1)', project: TEST_REF, startedAt, finishedAt: new Date().toISOString(),
    baseUrl: args['base-url'] && args['base-url'] !== true ? String(args['base-url']) : null, quotes, verdict: failed ? 'FAIL' : 'PASS',
    counts: { pass: checks.filter((c) => c.status === PASS).length, fail: failed, notTested: checks.filter((c) => c.status === NT).length }, checks };
  writeJson(path.join(outDir, 'long-fixture-evidence.json'), report);
  say(`verdict ${report.verdict} (${report.counts.pass} PASS / ${report.counts.fail} FAIL / ${report.counts.notTested} NOT TESTED)`);
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { say(`ERROR: ${e?.message || e}`); process.exit(2); });
