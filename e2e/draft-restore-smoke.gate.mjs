// DURABLE DRAFT CORE-RESTORE SMOKE on the SMART-QUOTE layout (IRON-QUOTE-004 subset; the 4x28 matrix is a separate cell).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/draft-restore-smoke.gate.mjs <baseUrl> [outJson]
// Run against the Owner test URL (plain-http LAN origin, like the Owner's phone). Per market (HE persona A, EN persona EN) and
// viewport (1440 desktop, 390 mobile-EMULATED - not a physical device):
//   R1 an unsaved NEW quote (client + project + one item) survives a hard reload: recovered notice + values restored
//   R2 a successful save discards the draft: a reload afterwards shows no recovery and an empty editor on "New"
//   R3 an unsaved EDIT of the saved quote survives a hard reload
// Created data is removed at the end through the persona's own session.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = process.argv[2] || 'http://192.168.1.189:5186';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
const { createClient } = await import('@supabase/supabase-js');

const results = [];
const STAMP = Date.now().toString(36).toUpperCase();
async function login(page, persona, lang) {
  await page.goto(`${base}/dashboard?lang=${lang}`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('user@example.com').waitFor({ timeout: 60000 });
  await page.getByPlaceholder('user@example.com').fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 });
}
async function openNew(page, mobile) {
  if (mobile) await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(New|חדש)$/ }).click();
  else await page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ }).first().click();
  await page.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
}
const projectInput = (page) => page.getByText(/^(Project name|שם פרויקט)/).first().locator('xpath=following::input[1]');
async function addItem(page, desc) {
  await page.getByRole('button', { name: /Add product or work|הוספת מוצר או עבודה/ }).first().click();
  const w = page.locator('[role="dialog"]').last(); await w.waitFor(); await page.waitForTimeout(300);
  const manual = w.getByText(/Not in the catalog\? Add a product|לא מצאתם בקטלוג\? הוסיפו מוצר/); if (await manual.count()) await manual.first().click();
  await page.locator('#wiz-description').waitFor(); await page.waitForTimeout(250); await page.locator('#wiz-description').fill(desc);
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  if (!(await w.getByText(/^(One total price|מחיר כולל)$/).first().isVisible().catch(() => false))) await w.getByText(/^(More options|אפשרויות נוספות)$/).first().click();
  await w.getByText(/^(One total price|מחיר כולל)$/).first().click();
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  await page.locator('#wiz-fixed-amount').fill('191.16');
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  await w.getByRole('button', { name: /^(Add to quote|הוספה להצעה)$/ }).click(); await page.waitForTimeout(500);
}
const recoveredNotice = (page) => page.getByText(/Recovered an unsaved draft|שוחזרה טיוטה|טיוטה שלא נשמרה/).first();

for (const [lang, persona] of [['he', PERSONA_A], ['en', PERSONA_EN]]) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: persona.email, password: persona.password });
  for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile-emulated', 390, 844]]) {
    const mobile = vp !== 'desktop';
    const tag = `${lang.toUpperCase()}/${vp}`;
    const client = `Draft Smoke ${STAMP} ${lang}${w}`;
    const project = `${lang === 'he' ? 'פרויקט טיוטה' : 'Draft project'} ${STAMP}`;
    const desc = lang === 'he' ? 'פריט טיוטה סינתטי' : 'Synthetic draft item';
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })).newPage();
    const rec = (id, ok, detail = '') => { results.push({ id: `${tag}/${id}`, status: ok ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 200) }); console.log(ok ? 'PASS' : 'FAIL', tag, id, detail ? `| ${String(detail).slice(0, 120)}` : ''); };
    try {
      await login(page, persona, lang);
      // R1
      await openNew(page, mobile);
      await page.locator('input[list="existing-clients-list"]').fill(client);
      await page.locator('select').filter({ has: page.locator('option[value="business"]') }).first().selectOption('business');
      await page.getByText(/^(ח\.פ \/ עוסק \/ ת\.ז|Tax ID.*)$/).first().locator('xpath=following::input[1]').fill('515151515').catch(() => {});
      await addItem(page, desc);
      await page.getByTestId('sq-more-details-toggle').click();
      await projectInput(page).fill(project);
      await page.waitForTimeout(1200); // > 350 ms debounce
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByTestId('sq-step-1').waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      const r1 = { notice: await recoveredNotice(page).isVisible().catch(() => false), client: await page.locator('input[list="existing-clients-list"]').inputValue(), project: await projectInput(page).inputValue().catch(() => ''), item: (await page.getByText(desc).count()) > 0 };
      rec('R1-hard-reload-restores-unsaved-new-quote', r1.client === client && r1.project === project && r1.item, JSON.stringify(r1));
      // R2
      await page.getByTestId('sq-save').click();
      await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 45000 });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      const editorAfterReload = await page.getByTestId('sq-step-1').count();
      await openNew(page, mobile);
      const fresh = await page.locator('input[list="existing-clients-list"]').inputValue();
      rec('R2-successful-save-discards-the-draft', editorAfterReload === 0 && fresh === '', JSON.stringify({ editorAfterReload, freshClient: fresh }));
      await page.getByRole('button', { name: /Cancel & Return|ביטול וחזרה לרשימה/ }).first().click().catch(() => {});
      page.once('dialog', (d) => d.accept());
      await page.waitForTimeout(800);
      // R3 (edit draft)
      const { data: cl } = await sb.from('clients').select('id').eq('company_name', client);
      const { data: qs } = await sb.from('quotes').select('id').in('client_id', (cl || []).map((x) => x.id));
      if (!mobile) {
        await page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first().fill(client);
        await page.waitForTimeout(1200);
        await page.locator('tr').filter({ hasText: client }).first().getByRole('button', { name: /Show more details|הצג פרטים נוספים/ }).click();
        await page.getByRole('button', { name: /^(Edit|ערוך)$/ }).first().click();
        await page.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
        await projectInput(page).fill(`${project} EDIT`);
        await page.waitForTimeout(1200);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.getByTestId('sq-step-1').waitFor({ timeout: 60000 });
        await page.waitForTimeout(1500);
        const edited = await projectInput(page).inputValue().catch(() => '');
        rec('R3-hard-reload-restores-unsaved-edit', edited === `${project} EDIT`, edited);
        const { data: dbq } = await sb.from('quotes').select('project_name').eq('id', qs?.[0]?.id);
        rec('R3b-unsaved-edit-not-written-to-the-database', dbq?.[0]?.project_name === project, dbq?.[0]?.project_name);
      }
      for (const q of qs || []) await sb.from('quotes').delete().eq('id', q.id);
      for (const c of cl || []) await sb.from('clients').delete().eq('id', c.id);
    } catch (e) { rec('flow-completed', false, String(e.message).split(String.fromCharCode(10))[0]); }
    await browser.close();
  }
}
const failed = results.filter((r) => r.status !== 'PASS');
const summary = { gate: 'DURABLE DRAFT CORE-RESTORE SMOKE', base, at: new Date().toISOString(), cells: results.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS', note: 'subset of the 4x28 matrix; mobile is EMULATED, not a physical device (OD-F2 remains an Owner test)', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`DURABLE DRAFT CORE-RESTORE SMOKE: ${summary.verdict} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
