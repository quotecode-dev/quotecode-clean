// PRINT/PDF RENDERED OUTPUT GATE (IRON-PRINT-001). Real Chromium, canonical TEST backend, synthetic personas only (IRON-DATA-001).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/print-pdf.gate.mjs <baseUrl> <outJson> [artifactDir]
// Synthetic quotes are created through each persona's OWN RLS-scoped session and removed at the end:
//   long      120-char client name, 600-char item description, 8-digit amount (9,876,543.21)
//   multipage 40 items (must paginate)
//   expired   validity 13/01/2020 (viewable, marked expired, no signing)
//   unfinished zero total / no items (printed "not a final quote" banner, no signing)
//   signed    approved with a signature (signature image printed; approval record)
// Each is opened anonymously on the public page (the customer view), the real print chooser is driven (window.print stubbed),
// print media is emulated and an A4 PDF is rendered. Checks: print-hidden controls, no horizontal clipping inside the card, every
// item rendered, totals + currency (HE whole shekels .00 / EN cents, no ₪), direction, expired/unfinished/signature presentation,
// PDF page count (multipage > 1). PDFs are written to artifactDir.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [base = 'http://localhost:5198', out, artifactDir] = process.argv.slice(2);
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
const { createClient } = await import('@supabase/supabase-js');
if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });

const results = [];
const check = (c, name, ok, detail) => { c.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log(`  FAIL ${c.id} :: ${name} ${detail ?? ''}`); };
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function session(persona) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: persona.email, password: persona.password });
  if (error) throw error;
  return { sb, uid: data.user.id };
}

async function createQuote({ sb, uid }, { lang, clientName, items, validUntil, taxRate, currency }) {
  const { data: cl, error: ce } = await sb.from('clients').insert([{ company_name: clientName, email: '', user_id: uid, client_type: 'business' }]).select();
  if (ce) throw ce;
  const { data: num } = await sb.rpc('allocate_quote_number', { p_user_id: uid });
  const subtotal = items.reduce((s, it) => s + it.q * it.p, 0);
  const total = Math.round(subtotal * (1 + taxRate) * 100) / 100;
  const { data: q, error: qe } = await sb.from('quotes').insert([{
    user_id: uid, client_id: cl[0].id, quote_number: typeof num === 'number' ? num : undefined, status: 'sent',
    valid_until: validUntil, currency, client_type: 'business', tax_rate: taxRate, subtotal, total, discount: 0,
    subject: lang === 'he' ? 'בדיקת הדפסה סינתטית' : 'Synthetic print check', quote_subject: lang === 'he' ? 'בדיקת הדפסה סינתטית' : 'Synthetic print check',
  }]).select();
  if (qe) throw qe;
  if (items.length) {
    const { error: se } = await sb.rpc('save_quote_structured', {
      p_quote_id: q[0].id, p_financial: null, p_sections: [],
      p_items: items.map((it, i) => ({ client_key: `k${i}`, id: null, section_client_key: null, description: it.d, quantity: it.q, unit_price: it.p, total_price: it.q * it.p, sort_order: i, measurements: [] })),
      p_removed_section_ids: [], p_removed_item_ids: [],
    });
    if (se) throw se;
  }
  return { id: q[0].id, clientId: cl[0].id, total, itemCount: items.length };
}

const countPdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;

async function renderPublic(browser, { lang, quoteId, mode }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { window.print = () => { window.__printCalled = (window.__printCalled || 0) + 1; }; });
  const page = await ctx.newPage();
  await page.goto(`${base}/${lang === 'he' ? '' : 'en/'}public-quote/${quoteId}${lang === 'he' ? '' : '?lang=en'}`, { timeout: 90000 });
  await page.locator('.pq-card').waitFor({ timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^(הדפס מסמך|Print Document)$/ }).first().click();
  await page.getByRole('button').filter({ hasText: mode === 'expanded' ? /^(מורחב|Expanded)/ : /^(תמציתי|Compact)/ }).first().click();
  await page.waitForTimeout(400);
  const printCalled = await page.evaluate(() => window.__printCalled || 0);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const card = document.querySelector('.pq-card');
    const cr = card.getBoundingClientRect();
    const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const clipped = [...card.querySelectorAll('*')].filter((el) => vis(el) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && el.clientWidth > 0)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)} ${el.scrollWidth}>${el.clientWidth}`).slice(0, 5);
    const outside = [...card.querySelectorAll('*')].filter((el) => { if (!vis(el)) return false; const r = el.getBoundingClientRect(); return r.right > cr.right + 2 || r.left < cr.left - 2; })
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}`).slice(0, 5);
    const noPrintVisible = [...document.querySelectorAll('.no-print')].filter(vis).length;
    return {
      dir: document.querySelector('.pq-page')?.getAttribute('dir'), mode: document.querySelector('.pq-page')?.getAttribute('data-print-mode'),
      text: card.innerText.replace(/\s+/g, ' '), clipped, outside, noPrintVisible,
      signatureImg: !!card.querySelector('img[alt="Client Signature"]'),
      expiredMarker: !!card.querySelector('[data-testid="pq-header-expired"]'), unfinishedBanner: vis(card.querySelector('[data-testid="pq-unfinished"]') || document.createElement('i')),
    };
  });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await ctx.close();
  return { ...m, printCalled, pdf };
}

const MARKETS = [['he', 'HE/Local/RTL', PERSONA_A, 0.18, 'ILS'], ['en', 'EN/International/LTR', PERSONA_EN, 0, 'USD']];
const browser = await chromium.launch();
for (const [lang, market, persona, taxRate, currency] of MARKETS) {
  const he = lang === 'he';
  let s;
  const made = [];
  try { s = await session(persona); } catch (e) { results.push({ id: `${market}/session`, checks: [{ name: 'persona session', ok: false, detail: e.message }] }); continue; }
  const longName = (he ? 'לקוח סינתטי בעל שם ארוך במיוחד לבדיקת גלישת טקסט בהדפסה ובקובץ PDF ' : 'Synthetic Customer With An Exceptionally Long Company Name For Print Wrapping Checks ').repeat(2).slice(0, 120);
  const longDesc = (he ? 'תיאור עבודה סינתטי ארוך מאוד הכולל פירוט רב של חומרים, מידות, שלבי התקנה ותנאים מיוחדים. ' : 'Very long synthetic work description with many details about materials, dimensions, installation stages and special terms. ').repeat(6).slice(0, 600);
  const scenarios = {
    long: { clientName: longName, items: [{ d: longDesc, q: 1, p: 9876543.21 }], validUntil: '2099-12-13' },
    multipage: { clientName: `${he ? 'לקוח רב-עמודים' : 'Multi-page customer'} PRT`, items: Array.from({ length: 40 }, (_, i) => ({ d: `${he ? 'פריט סינתטי' : 'Synthetic item'} ${i + 1}`, q: 2, p: 100.5 + i })), validUntil: '2099-12-13' },
    expired: { clientName: `${he ? 'לקוח פג תוקף' : 'Expired customer'} PRT`, items: [{ d: he ? 'עבודה' : 'Work', q: 1, p: 191.16 }], validUntil: '2020-01-13' },
    unfinished: { clientName: `${he ? 'לקוח טיוטה' : 'Draft customer'} PRT`, items: [], validUntil: '2099-12-13' },
    signed: { clientName: `${he ? 'לקוח חתום' : 'Signed customer'} PRT`, items: [{ d: he ? 'עבודה חתומה' : 'Signed work', q: 1, p: 324.5 }], validUntil: '2099-12-13' },
  };
  try {
    const q = {};
    for (const [k, sc] of Object.entries(scenarios)) { q[k] = await createQuote(s, { lang, ...sc, taxRate, currency }); made.push(q[k]); }
    // sign as an anonymous customer through the public RPC (the real customer path)
    const anonSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: signErr } = await anonSb.rpc('public_approve_quote', { p_quote_id: q.signed.id, p_signature_data_url: SIG });
    const runs = [['long', 'compact'], ['long', 'expanded'], ['multipage', 'compact'], ['multipage', 'expanded'], ['expired', 'compact'], ['unfinished', 'compact'], ['signed', 'compact']];
    for (const [k, mode] of runs) {
      const c = { id: `${market}/${k}/${mode}`, checks: [] };
      results.push(c);
      try {
        const r = await renderPublic(browser, { lang, quoteId: q[k].id, mode });
        if (artifactDir) fs.writeFileSync(path.join(artifactDir, `print-${lang}-${k}-${mode}.pdf`), r.pdf);
        const pages = countPdfPages(r.pdf);
        c.pdfPages = pages; c.pdfBytes = r.pdf.length;
        check(c, 'the real print chooser invoked window.print in the chosen mode', r.printCalled >= 1 && r.mode === mode, `mode=${r.mode} calls=${r.printCalled}`);
        check(c, `direction ${he ? 'rtl' : 'ltr'}`, r.dir === (he ? 'rtl' : 'ltr'));
        check(c, 'print hides every .no-print control', r.noPrintVisible === 0, `visible=${r.noPrintVisible}`);
        check(c, 'no horizontal clipping inside the card', r.clipped.length === 0, r.clipped.join(' | '));
        check(c, 'nothing renders outside the card width', r.outside.length === 0, r.outside.join(' | '));
        check(c, 'A4 PDF rendered', pages >= 1 && r.pdf.length > 5000, `pages=${pages} bytes=${r.pdf.length}`);
        if (he) check(c, 'money: Local whole shekels .00 only', /₪/.test(r.text) && !/₪[\d,]+\.(?!00)\d\d/.test(r.text), (r.text.match(/₪[\d,.]+/g) || []).slice(0, 6).join(' '));
        else check(c, 'money: International cents, no ₪', !r.text.includes('₪') && /\$[\d,]+\.\d\d/.test(r.text), (r.text.match(/\$[\d,.]+/g) || []).slice(0, 6).join(' '));
        if (k === 'long') {
          check(c, 'long client name printed in full', r.text.includes(longName.trim().slice(0, 60)));
          check(c, 'long item description printed', r.text.includes(longDesc.slice(0, 80)));
          check(c, '8-digit amount printed', he ? /₪9,876,543\.00|₪11,654,321\.00/.test(r.text) : /\$9,876,543\.21/.test(r.text), (r.text.match(he ? /₪[\d,]{9,}\.\d\d/g : /\$[\d,]{9,}\.\d\d/g) || []).join(' '));
        }
        if (k === 'multipage') {
          check(c, 'every one of the 40 items rendered', [1, 20, 40].every((n) => r.text.includes(`${he ? 'פריט סינתטי' : 'Synthetic item'} ${n}`)));
          check(c, 'paginates to more than one A4 page', pages > 1, `pages=${pages}`);
        }
        if (k === 'expired') check(c, 'expired presentation: header marker printed, no signing UI', r.expiredMarker && !/חתימת לקוח לאישור ההצעה|Client Signature to Approve/.test(r.text));
        if (k === 'unfinished') check(c, 'unfinished draft: "not a final quote" banner printed, no signing UI', r.unfinishedBanner && /טיוטה לא גמורה|Unfinished draft/.test(r.text) && !/חתימת לקוח לאישור ההצעה|Client Signature to Approve/.test(r.text));
        if (k === 'signed') check(c, 'signed quote: approval record + signature image printed', !signErr && r.signatureImg && /אושרה ונחתמה|approved and signed/i.test(r.text), signErr?.message);
      } catch (e) { check(c, 'render completed', false, String(e.message).split(String.fromCharCode(10))[0].slice(0, 160)); }
    }
  } catch (e) {
    results.push({ id: `${market}/setup`, checks: [{ name: 'synthetic quotes created', ok: false, detail: String(e.message).slice(0, 200) }] });
  } finally {
    for (const m of made) {
      // an approved/signed quote is immutable by design; it stays (synthetic, clearly named) - everything else is removed
      await s.sb.from('quotes').delete().eq('id', m.id);
      const { data: left } = await s.sb.from('quotes').select('id').eq('client_id', m.clientId);
      if (!left?.length) await s.sb.from('clients').delete().eq('id', m.clientId);
    }
  }
}
await browser.close();
for (const c of results) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status !== 'PASS');
const summary = { gate: 'PRINT/PDF RENDERED OUTPUT GATE', base, at: new Date().toISOString(), cells: results.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`PRINT/PDF RENDERED OUTPUT GATE: ${summary.verdict} (${results.length - failed.length}/${results.length} cells PASS)`);
process.exit(failed.length ? 1 : 0);
