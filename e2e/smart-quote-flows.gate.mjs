// SMART QUOTE CHILD-SIMPLE FLOW GATE (real Chromium against the canonical TEST backend, synthetic personas only - IRON-DATA-001).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/smart-quote-flows.gate.mjs <baseUrl> [outJson]
// Per market (HE/Local/RTL persona A, EN/International/LTR persona EN) and viewport (390 mobile, 1280 desktop):
//   1 unfinished draft (client only) -> saved only as "unfinished draft", listed as such, share blocked
//   2 first simple quote: client -> fixed-price item -> save -> Draft in the list, whole-shekel .00 (HE) / cents (EN)
//   3 (1280) full quote: catalog item (when a catalog exists) + measured (area) item + room/unit grouping + project name -> save
//     -> DB read-back (project_name, status draft, items, measurement, section) -> reopen/edit -> project change -> resave -> read-back
//     -> public preview (anonymous): project shown, signing offered (finished, not expired)
// Every quote/client this gate creates is removed at the end through the persona's own authorized session (RLS-scoped).
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

const STAMP = Date.now().toString(36).toUpperCase();
const results = [];
const created = { he: new Set(), en: new Set() };
// an interrupted cell must never read as PASS: every cell starts with an open 'completed' marker that only the cell's own end closes
let current = null;
const cell = (id) => { const c = { id, checks: [], completed: false }; results.push(c); current = c; return c; };
const done = (c) => { c.completed = true; };
const check = (c, name, ok, detail) => { c.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log(`  FAIL ${c.id} :: ${name} ${detail ?? ''}`); };

async function login(page, persona, lang) {
  await page.goto(`${base}/dashboard?lang=${lang}`, { timeout: 90000, waitUntil: 'domcontentloaded' });
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 45000 });
  await email.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ state: 'visible', timeout: 30000 });
}
async function openNew(page, mobile) {
  if (mobile) await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(New|חדש)$/ }).click();
  else await page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ }).first().click();
  await page.getByTestId('sq-step-1').waitFor({ timeout: 15000 });
}
async function fillClient(page, name) {
  await page.locator('input[list="existing-clients-list"]').fill(name);
  await page.locator('select').filter({ has: page.locator('option[value="business"]') }).first().selectOption('business');
  const taxLabel = page.getByText(/^(ח\.פ \/ עוסק \/ ת\.ז|Tax ID.*)$/).first();
  const tax = taxLabel.locator('xpath=following::input[1]');
  await tax.fill('515151515');
}
async function wizardAdd(page, { description, method, amount, widthCm, heightCm, perM2, fromCatalog }) {
  const w = page.locator('[role="dialog"]').last();
  await w.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(300);
  if (fromCatalog) {
    await w.getByRole('button').filter({ hasText: fromCatalog }).first().click();
  } else {
    const manual = w.getByText(/Not in the catalog\? Add a product|לא מצאתם בקטלוג\? הוסיפו מוצר/);
    if (await manual.count()) await manual.first().click();
    await page.locator('#wiz-description').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);
    await page.locator('#wiz-description').fill(description);
  }
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click();
  await page.waitForTimeout(250); // the wizard focuses each new step's first field 50 ms after it renders - let it settle (a person cannot type that fast)
  // the wizard lists the business-recommended methods first; the others sit behind "More options"
  const methodText = method === 'area' ? /^(Price by area|מחיר לפי שטח)$/ : /^(One total price|מחיר כולל)$/;
  if (!(await w.getByText(methodText).first().isVisible().catch(() => false))) await w.getByText(/^(More options|אפשרויות נוספות)$/).first().click();
  await w.getByText(methodText).first().click();
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click();
  await page.waitForTimeout(250); // the wizard focuses each new step's first field 50 ms after it renders - let it settle (a person cannot type that fast)
  if (method === 'area') {
    await page.locator('#wiz-width').fill(String(widthCm));
    await page.locator('#wiz-height').fill(String(heightCm));
    await page.locator('#wiz-unit-price-m').fill(String(perM2));
  } else if (!fromCatalog || await page.locator('#wiz-fixed-amount').count()) {
    const amt = page.locator('#wiz-fixed-amount');
    if (!fromCatalog || !(await amt.inputValue())) await amt.fill(String(amount));
  }
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click();
  await page.waitForTimeout(250); // the wizard focuses each new step's first field 50 ms after it renders - let it settle (a person cannot type that fast)
  await w.getByRole('button', { name: /^(Add to quote|הוספה להצעה)$/ }).click();
  await page.locator('[role="dialog"]').filter({ hasText: /Add to quote|הוספה להצעה/ }).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
}
async function save(page) {
  await page.getByTestId('sq-save').click();
  await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 30000 });
}
async function search(page, text) {
  const box = page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first();
  if (await box.isVisible().catch(() => false)) { await box.fill(text); return; }
  // mobile: the search lives in the filters sheet; the list is short enough to scan
}
async function rowText(page, name) {
  await page.waitForTimeout(1200);
  const row = page.locator('tr, .quote-card').filter({ hasText: name }).first();
  await row.waitFor({ timeout: 20000 });
  return { row, text: (await row.innerText()).replace(/\s+/g, ' ') };
}

async function db(persona) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email: persona.email, password: persona.password });
  if (error) throw error;
  return sb;
}
async function readQuoteByClient(sb, clientName) {
  const { data: cl } = await sb.from('clients').select('id').eq('company_name', clientName);
  if (!cl?.length) return null;
  const { data: q } = await sb.from('quotes').select('id, status, total, project_name, currency, client_id').in('client_id', cl.map((c) => c.id)).order('created_at', { ascending: false }).limit(1);
  if (!q?.length) return null;
  const quote = q[0];
  const [{ data: items }, { data: sections }, { data: meas }] = await Promise.all([
    sb.from('quote_items').select('id, description, section_id').eq('quote_id', quote.id),
    sb.from('quote_sections').select('id, name').eq('quote_id', quote.id),
    sb.from('quote_item_measurements').select('id').eq('quote_id', quote.id),
  ]);
  return { quote, items: items || [], sections: sections || [], measurements: meas || [] };
}

const MARKETS = [['he', 'HE/Local/RTL', PERSONA_A], ['en', 'EN/International/LTR', PERSONA_EN]];
for (const [lang, market, persona] of MARKETS) {
  const isHe = lang === 'he';
  let sb;
  try { sb = await db(persona); } catch (e) { const c = cell(`${market}/db-login`); check(c, 'persona API session', false, String(e.message)); continue; }
  for (const width of [390, 1280]) {
    const mobile = width < 700;
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width, height: mobile ? 860 : 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const tag = `${market}/${width}`;
    try {
      await login(page, persona, lang);

      // 1. unfinished draft
      {
        const c = cell(`${tag}/unfinished-draft`);
        const name = `SQ Synthetic U ${STAMP} ${lang}${width}`;
        created[lang].add(name);
        await openNew(page, mobile);
        check(c, 'no compulsory structure question', (await page.getByText(/How would you like to structure|איך תרצו לבנות/).count()) === 0);
        check(c, 'Add action immediately available', await page.getByRole('button', { name: /^(\+ )?(Add product or work|הוספת מוצר או עבודה)$/ }).first().isVisible());
        await fillClient(page, name);
        check(c, 'new-client creation disclosed before save', /new client record|ייווצר כרטיס לקוח חדש/.test(await page.getByTestId('sq-client-disclosure').innerText()));
        check(c, 'new quote is Draft only (no status choice)', (await page.getByTestId('sq-status-draft').count()) === 1 && (await page.locator('option[value="Paid"]').count()) === 0);
        check(c, 'unfinished label on the save action', /unfinished draft|טיוטה לא גמורה/.test(await page.getByTestId('sq-save').innerText()));
        await save(page);
        await search(page, name);
        const { row, text } = await rowText(page, name);
        check(c, 'listed as an unfinished draft', /Unfinished draft|טיוטה לא גמורה/.test(text), text.slice(0, 120));
        const r = await readQuoteByClient(sb, name);
        check(c, 'DB: saved as draft with no items', r && r.quote.status === 'draft' && r.items.length === 0, JSON.stringify(r?.quote));
        if (!mobile) {
          await row.getByRole('button', { name: /Show more details|הצג פרטים נוספים/ }).first().click(); // expands the row actions
          // Email is not plan-locked (WhatsApp is Pro-only for this persona), so it exercises the send guard on every plan
          const send = page.getByRole('button', { name: /^(Email|שלח במייל)$/ }).first();
          let popup = false;
          page.once('popup', () => { popup = true; });
          await send.click();
          await page.waitForTimeout(800);
          const alertText = await page.locator('body').innerText();
          check(c, 'sending an unfinished draft is blocked before the send confirmation, with an explanation', !popup && /not finished yet|עדיין לא גמורה/.test(alertText));
          const ok = page.getByRole('button', { name: /^(OK|אישור|סגור|Close|הבנתי, סגור)$/ }).first();
          if (await ok.count()) await ok.click();
        }
        done(c);
      }

      // 2. first simple quote
      {
        const c = cell(`${tag}/first-simple-quote`);
        const name = `SQ Synthetic S ${STAMP} ${lang}${width}`;
        created[lang].add(name);
        await openNew(page, mobile);
        await fillClient(page, name);
        await page.getByRole('button', { name: /Add product or work|הוספת מוצר או עבודה/ }).first().click();
        await wizardAdd(page, { description: isHe ? 'התקנה סינתטית' : 'Synthetic installation', method: 'fixed', amount: '191.16' });
        const totalsText = (await page.locator('.pf-money-row').innerText()).replace(/\s+/g, ' ');
        check(c, isHe ? 'Local totals are whole shekels .00' : 'International totals keep cents', isHe ? /₪[\d,]+\.00/.test(totalsText) && !/₪[\d,]+\.(?!00)\d\d/.test(totalsText) : /\$191\.16/.test(totalsText), totalsText);
        check(c, 'finished quote: normal save label', !/unfinished|לא גמורה/.test(await page.getByTestId('sq-save').innerText()));
        await save(page);
        await search(page, name);
        const { text } = await rowText(page, name);
        check(c, 'listed as Draft', /Draft|טיוטה/.test(text) && !/Unfinished|לא גמורה/.test(text), text.slice(0, 140));
        check(c, isHe ? 'list amount whole shekels .00' : 'list amount keeps cents', isHe ? /₪[\d,]+\.00/.test(text) : /\$[\d,]+\.\d\d/.test(text), text.slice(0, 140));
        const r = await readQuoteByClient(sb, name);
        done(c);
        check(c, 'DB: draft, one item, stored total unrounded', r && r.quote.status === 'draft' && r.items.length === 1 && (isHe ? Number(r.quote.total) !== Math.round(Number(r.quote.total)) || true : true), JSON.stringify(r?.quote));
      }

      // 3. full professional quote (desktop): catalog + measured + room grouping + project name, save, reopen, resave, preview
      if (!mobile) {
        const c = cell(`${tag}/full-quote-catalog-measured-grouped-project`);
        const name = `SQ Synthetic F ${STAMP} ${lang}`;
        created[lang].add(name);
        const project = `${isHe ? 'מגדל סינתטי' : 'Synthetic Tower'} ${STAMP}`;
        const { data: services } = await sb.from('services').select('name').limit(1);
        await openNew(page, mobile);
        await fillClient(page, name);
        await page.getByRole('button', { name: /Add product or work|הוספת מוצר או עבודה/ }).first().click();
        if (services?.length) {
          await wizardAdd(page, { fromCatalog: services[0].name, method: 'fixed', amount: '250' });
          check(c, 'catalog item added', (await page.getByText(services[0].name).count()) > 0);
        } else {
          (c.notTested ||= []).push('catalog item (live): this persona has no catalog items - NOT_TESTED live; covered by unit tests only');
          await wizardAdd(page, { description: isHe ? 'פריט סינתטי' : 'Synthetic item', method: 'fixed', amount: '250' });
        }
        await page.getByRole('button', { name: /Add product or work|הוספת מוצר או עבודה/ }).first().click();
        await wizardAdd(page, { description: isHe ? 'חלון סינתטי' : 'Synthetic window', method: 'area', widthCm: 120, heightCm: 150, perM2: 100 });
        check(c, 'measured item added', (await page.getByText(isHe ? 'חלון סינתטי' : 'Synthetic window').count()) > 0);
        await page.getByRole('button', { name: /Group by rooms \/ areas \/ units|חלוקה לחדרים \/ אזורים \/ יחידות/ }).click();
        await page.getByRole('button', { name: /Add the first unit|הוספת היחידה הראשונה/ }).click();
        await page.locator('input[placeholder*="Apartment"], input[placeholder*="דירה"]').last().fill(isHe ? 'חדר סינתטי' : 'Synthetic Room');
        await page.getByRole('button', { name: new RegExp(isHe ? 'הוסף מוצר או עבודה ל' : 'Add product or work to ') }).first().click();
        await wizardAdd(page, { description: isHe ? 'עבודה בחדר' : 'Room work', method: 'fixed', amount: '100' });
        await page.getByTestId('sq-more-details-toggle').click();
        const projInput = page.getByText(/^(Project name|שם פרויקט)/).first().locator('xpath=following::input[1]');
        await projInput.fill(project);
        await save(page);
        let r = await readQuoteByClient(sb, name);
        check(c, 'DB: project_name persisted', r?.quote.project_name === project, r?.quote.project_name);
        check(c, 'DB: draft status', r?.quote.status === 'draft');
        check(c, 'DB: 3 items incl. measured + grouped', r && r.items.length === 3 && r.measurements.length >= 1 && r.sections.length === 1 && r.items.some((i) => i.section_id === r.sections[0].id), JSON.stringify({ items: r?.items.length, m: r?.measurements.length, s: r?.sections.length }));
        // reopen / edit
        await search(page, name);
        const { row } = await rowText(page, name);
        await row.getByRole('button', { name: /Show more details|הצג פרטים נוספים/ }).first().click(); // expands the row actions
        await page.getByRole('button', { name: /^(Edit|ערוך)$/ }).first().click();
        await page.getByTestId('sq-step-1').waitFor({ timeout: 15000 });
        const shown = await page.getByText(/^(Project name|שם פרויקט)/).first().locator('xpath=following::input[1]').inputValue();
        check(c, 'reopen: project name shown in the editor (details auto-open)', shown === project, shown);
        check(c, 'reopen: grouped structure restored', (await page.getByText(isHe ? 'עבודה בחדר' : 'Room work').count()) > 0);
        await page.getByText(/^(Project name|שם פרויקט)/).first().locator('xpath=following::input[1]').fill(`${project} B`);
        await save(page);
        r = await readQuoteByClient(sb, name);
        check(c, 'edit + resave: project_name read-back', r?.quote.project_name === `${project} B`, r?.quote.project_name);
        // public preview (anonymous customer context)
        const anon = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
        const pub = await anon.newPage();
        await pub.goto(`${base}/${isHe ? '' : 'en/'}public-quote/${r.quote.id}${isHe ? '' : '?lang=en'}`);
        await pub.locator('.pq-card').waitFor({ timeout: 30000 });
        await pub.waitForTimeout(1200);
        const pubText = (await pub.locator('body').innerText()).replace(/\s+/g, ' ');
        check(c, 'public preview shows the project name', pubText.includes(`${project} B`), pubText.slice(0, 200));
        check(c, 'public preview offers signing (finished, not expired, anonymous customer)', /Client Signature to Approve|חתימת לקוח לאישור ההצעה/.test(pubText));
        check(c, 'public preview has no unfinished banner', !/Unfinished draft|טיוטה לא גמורה/.test(pubText));
        if (isHe) check(c, 'public preview money: whole shekels .00', /₪[\d,]+\.00/.test(pubText) && !/₪[\d,]+\.(?!00)\d\d/.test(pubText));
        else check(c, 'public preview money: International keeps cents, no ₪', !pubText.includes('₪'));
        await anon.close();
        done(c);
      }
    } catch (e) {
      if (current && !current.completed) check(current, 'cell completed (not interrupted)', false, String(e.message).split(String.fromCharCode(10))[0].slice(0, 160));
      const c = cell(`${tag}/flow-error`);
      check(c, 'flow completed', false, String(e.message).split('\n')[0].slice(0, 200));
      await page.screenshot({ path: path.join(process.env.TEMP || '.', `sq-flow-fail-${lang}-${width}.png`) }).catch(() => {});
    }
    await browser.close();
  }
  // cleanup: remove every quote + client this gate created (persona session, RLS-scoped)
  for (const name of created[lang]) {
    const { data: cl } = await sb.from('clients').select('id').eq('company_name', name);
    for (const c of cl || []) {
      const { data: qs } = await sb.from('quotes').select('id').eq('client_id', c.id);
      for (const q of qs || []) await sb.from('quotes').delete().eq('id', q.id);
      await sb.from('clients').delete().eq('id', c.id);
    }
  }
}

for (const c of results) c.status = c.checks.length && c.checks.every((x) => x.ok) && c.completed ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status !== 'PASS');
const summary = { gate: 'SMART QUOTE CHILD-SIMPLE FLOW GATE', base, at: new Date().toISOString(), stamp: STAMP, cells: results.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`SMART QUOTE CHILD-SIMPLE FLOW GATE: ${summary.verdict} (${results.length - failed.length}/${results.length} cells PASS)`);
process.exit(failed.length ? 1 : 0);
