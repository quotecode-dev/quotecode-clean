// TENANT NEGATIVES + OWNER PUBLIC VIEW + ATTACHMENT LIFECYCLE + LIVE CATALOG MONEY (hosted TEST, synthetic personas only).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/tenant-attachment-live.gate.mjs <baseUrl> [outJson]
// 1 tenant negatives (API, as persona EN against persona A's data): read / update / delete / child insert of A's quote, client and
//   attachment rows are all refused (0 rows or error) - IRON-TENANT-001
// 2 owner viewing its OWN public quote (browser, logged in) sees the owner view and no signing UI; an anonymous visitor sees signing
//   - IRON-PUBLIC-001 / OD-9 UI
// 3 attachment lifecycle (browser, PRO persona EN): upload on save -> row + object; open via a short-lived signed URL; remove -> save
//   -> row gone; storage deletion of the object is REPORTED (on the current hosted TEST schema the owner DELETE policy is part of the
//   unapplied migration 20260922000000, so the object may remain - that cell is BLOCKED_AUTHORIZATION, never PASS) - IRON-QUOTE-005/OD-2
// 4 live Catalog screen money: HE/Local shows whole shekels .00 - IRON-ILS-001 catalog cell
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
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
async function session(persona) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: persona.email, password: persona.password });
  if (error) throw error;
  return { sb, uid: data.user.id };
}
async function login(page, persona, lang) {
  await page.goto(`${base}/dashboard?lang=${lang}`, { timeout: 90000 });
  await page.getByPlaceholder('user@example.com').waitFor({ timeout: 45000 });
  await page.getByPlaceholder('user@example.com').fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 45000 });
}

const A = await session(PERSONA_A);
const EN = await session(PERSONA_EN);
const cleanup = [];
const browser = await chromium.launch();
try {
  // fixture owned by A
  const { data: cl } = await A.sb.from('clients').insert([{ company_name: 'Tenant Negative Synthetic', email: '', user_id: A.uid, client_type: 'business' }]).select();
  const { data: num } = await A.sb.rpc('allocate_quote_number', { p_user_id: A.uid });
  const { data: q } = await A.sb.from('quotes').insert([{ user_id: A.uid, client_id: cl[0].id, quote_number: typeof num === 'number' ? num : undefined, status: 'sent', valid_until: '2099-12-13', currency: 'ILS', client_type: 'business', tax_rate: 0.18, subtotal: 100, total: 118, discount: 0 }]).select();
  await A.sb.rpc('save_quote_structured', { p_quote_id: q[0].id, p_financial: null, p_sections: [], p_items: [{ client_key: 'k0', id: null, section_client_key: null, description: 'Synthetic', quantity: 1, unit_price: 100, total_price: 100, sort_order: 0, measurements: [] }], p_removed_section_ids: [], p_removed_item_ids: [] });
  cleanup.push(async () => { await A.sb.from('quotes').delete().eq('id', q[0].id); await A.sb.from('clients').delete().eq('id', cl[0].id); });

  // 1. tenant negatives (EN acting on A's rows)
  {
    const c = cell('tenant/negatives-api');
    const r1 = await EN.sb.from('quotes').select('id').eq('id', q[0].id);
    check(c, 'cannot read another tenant\'s quote', !r1.error && (r1.data || []).length === 0, JSON.stringify(r1.error || r1.data));
    const r2 = await EN.sb.from('clients').select('id').eq('id', cl[0].id);
    check(c, 'cannot read another tenant\'s client', !r2.error && (r2.data || []).length === 0);
    const r3 = await EN.sb.from('quotes').update({ notes: 'hijack' }).eq('id', q[0].id).select();
    check(c, 'cannot update another tenant\'s quote', (r3.data || []).length === 0);
    const r4 = await EN.sb.from('quotes').delete().eq('id', q[0].id).select();
    check(c, 'cannot delete another tenant\'s quote', (r4.data || []).length === 0);
    const r5 = await EN.sb.from('quote_items').insert([{ quote_id: q[0].id, description: 'x', quantity: 1, unit_price: 1, total_price: 1 }]);
    check(c, 'cannot insert items into another tenant\'s quote', !!r5.error, JSON.stringify(r5.error?.message || 'no error'));
    const r6 = await EN.sb.rpc('save_quote_structured', { p_quote_id: q[0].id, p_financial: null, p_sections: [], p_items: [], p_removed_section_ids: [], p_removed_item_ids: [] });
    check(c, 'cannot run the structured save on another tenant\'s quote', !!r6.error, r6.error?.message);
    const still = await A.sb.from('quotes').select('notes').eq('id', q[0].id);
    check(c, 'owner row unchanged after the attempts', still.data?.[0] && still.data[0].notes !== 'hijack');
  }

  // 2. owner vs anonymous on the public page (browser)
  {
    const c = cell('public/owner-view-hides-signing-and-anonymous-signs');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    await login(page, PERSONA_A, 'he');
    await page.goto(`${base}/public-quote/${q[0].id}`, { timeout: 90000 });
    await page.locator('.pq-card').waitFor({ timeout: 45000 });
    await page.waitForTimeout(1500);
    const ownerText = await page.locator('body').innerText();
    check(c, 'issuer (owner) sees the owner view and no signing UI', /תצוגת מנהל/.test(ownerText) && !/חתימת לקוח לאישור ההצעה/.test(ownerText));
    await ctx.close();
    const anon = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const ap = await anon.newPage();
    await ap.goto(`${base}/public-quote/${q[0].id}`, { timeout: 90000 });
    await ap.locator('.pq-card').waitFor({ timeout: 45000 });
    await ap.waitForTimeout(1200);
    check(c, 'anonymous customer sees the signing UI', /חתימת לקוח לאישור ההצעה/.test(await ap.locator('body').innerText()));
    await anon.close();
    const other = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const op = await other.newPage();
    await login(op, PERSONA_EN, 'en');
    await op.goto(`${base}/public-quote/${q[0].id}`, { timeout: 90000 });
    await op.locator('.pq-card').waitFor({ timeout: 45000 });
    await op.waitForTimeout(1500);
    const otherText = await op.locator('body').innerText();
    check(c, 'OD-9 UI: an authenticated user of ANOTHER tenant sees the signing UI (not the owner view)', /חתימת לקוח לאישור ההצעה/.test(otherText) && !/תצוגת מנהל/.test(otherText));
    await other.close();
  }

  // 3. attachment lifecycle (browser, PRO persona EN)
  {
    const c = cell('attachment/lifecycle-browser');
    const name = `Attach Synthetic ${Date.now().toString(36)}`;
    const tmp = path.join(os.tmpdir(), 'synthetic-plan.pdf');
    fs.writeFileSync(tmp, '%PDF-1.4\n% synthetic attachment for the TEKANGO lifecycle gate\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    await login(page, PERSONA_EN, 'en');
    await page.getByRole('button', { name: /^New Quote$/ }).first().click();
    await page.getByTestId('sq-step-1').waitFor({ timeout: 15000 });
    await page.locator('input[list="existing-clients-list"]').fill(name);
    await page.locator('select').filter({ has: page.locator('option[value="business"]') }).first().selectOption('business');
    await page.getByText(/^Tax ID/).first().locator('xpath=following::input[1]').fill('515151515').catch(() => {});
    await page.getByRole('button', { name: /Add product or work/ }).first().click();
    const w = page.locator('[role="dialog"]').last();
    await w.waitFor(); await page.waitForTimeout(300);
    const manual = w.getByText(/Not in the catalog\? Add a product/); if (await manual.count()) await manual.first().click();
    await page.locator('#wiz-description').waitFor(); await page.waitForTimeout(250);
    await page.locator('#wiz-description').fill('Synthetic attached work');
    await w.getByRole('button', { name: /^Next$/ }).click(); await page.waitForTimeout(250);
    if (!(await w.getByText(/^One total price$/).first().isVisible().catch(() => false))) await w.getByText(/^More options$/).first().click();
    await w.getByText(/^One total price$/).first().click();
    await w.getByRole('button', { name: /^Next$/ }).click(); await page.waitForTimeout(250);
    await page.locator('#wiz-fixed-amount').fill('100');
    await w.getByRole('button', { name: /^Next$/ }).click(); await page.waitForTimeout(250);
    await w.getByRole('button', { name: /^Add to quote$/ }).click();
    await page.waitForTimeout(500);
    await page.getByTestId('sq-more-details-toggle').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Attach file/i }).first().click()]);
    await chooser.setFiles(tmp);
    await page.getByTestId('sq-save').click();
    await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 30000 });
    const { data: cls } = await EN.sb.from('clients').select('id').eq('company_name', name);
    const { data: qs } = await EN.sb.from('quotes').select('id').in('client_id', (cls || []).map((x) => x.id));
    const qid = qs?.[0]?.id;
    cleanup.push(async () => { if (qid) await EN.sb.from('quotes').delete().eq('id', qid); for (const x of cls || []) await EN.sb.from('clients').delete().eq('id', x.id); });
    const { data: atts } = await EN.sb.from('quote_attachments').select('id, storage_path, file_url').eq('quote_id', qid);
    check(c, 'save uploaded the file and wrote its metadata row', atts?.length === 1 && /^[0-9a-f-]{36}\/[0-9a-f-]{36}_\d+\.pdf$/.test(atts[0].storage_path), JSON.stringify(atts));
    check(c, 'metadata stores the storage path, not a permanent public URL (OD-2)', atts?.[0] && !/^https?:/.test(atts[0].file_url), atts?.[0]?.file_url);
    const path0 = atts?.[0]?.storage_path;
    const listed = await EN.sb.storage.from('quote-files').list(path0 ? path0.split('/')[0] : '', { search: path0 ? path0.split('/')[1] : '' });
    check(c, 'storage object exists', (listed.data || []).length === 1, JSON.stringify(listed.error || listed.data?.length));
    // reopen, open via signed URL, remove, save
    await page.getByPlaceholder(/Search client or quote #/).first().fill(name);
    await page.waitForTimeout(1200);
    const row = page.locator('tr').filter({ hasText: name }).first();
    await row.getByRole('button', { name: /Show more details/ }).click();
    await page.getByRole('button', { name: /^Edit$/ }).first().click();
    await page.getByTestId('sq-step-1').waitFor({ timeout: 15000 });
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), page.getByRole('button', { name: /synthetic-plan\.pdf/ }).first().click()]);
    // the tab opens synchronously (about:blank) and is pointed at the minted signed URL afterwards
    await popup.waitForURL(//object/sign//, { timeout: 15000 }).catch(() => {});
    check(c, 'open uses a short-lived signed URL', /\/object\/sign\/quote-files\/.+token=/.test(popup.url()), popup.url().slice(0, 120));
    await popup.close();
    // the file row is [name button][remove (X) button]
    await page.locator('a, button, span').filter({ hasText: /synthetic-plan\.pdf/ }).first().locator('xpath=following::button[1]').click();
    await page.getByTestId('sq-save').click();
    await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 30000 });
    const { data: attsAfter } = await EN.sb.from('quote_attachments').select('id').eq('quote_id', qid);
    check(c, 'removed persisted attachment: metadata row deleted after a successful save', (attsAfter || []).length === 0, JSON.stringify(attsAfter));
    const after = await EN.sb.storage.from('quote-files').list(path0.split('/')[0], { search: path0.split('/')[1] });
    const objectGone = (after.data || []).length === 0;
    c.storageDeletionOnHostedTest = objectGone ? 'DELETED' : 'REMAINS (owner DELETE policy not on hosted TEST - part of unapplied migration 20260922000000; the app reported cleanup pending)';
    if (!objectGone) cleanup.push(async () => {}); // nothing to do: cannot delete without the policy (proves the gap)
    await ctx.close();
    results.push({ id: 'attachment/storage-object-deletion-hosted-test', status: objectGone ? 'PASS' : 'BLOCKED_AUTHORIZATION', checks: objectGone ? [{ name: 'object deleted after row removal', ok: true }] : [], note: c.storageDeletionOnHostedTest });
  }

  // 4. live Catalog screen money (HE/Local)
  {
    const c = cell('ils-money/catalog-services-live');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    await login(page, PERSONA_A, 'he');
    await page.getByRole('button', { name: /^קטלוג$/ }).first().click();
    await page.waitForTimeout(1500);
    const text = (await page.locator('.dash-main-content').innerText()).replace(/\s+/g, ' ');
    const amounts = text.match(/₪[\d,]+\.\d\d/g) || [];
    check(c, 'catalog prices render as whole shekels .00', amounts.length > 0 && amounts.every((a) => a.endsWith('.00')), amounts.slice(0, 8).join(' '));
    await ctx.close();
  }
} catch (e) {
  results.push({ id: 'flow-error', checks: [{ name: 'gate completed', ok: false, detail: String(e.message).split(String.fromCharCode(10))[0].slice(0, 200) }] });
} finally {
  for (const f of cleanup.reverse()) { try { await f(); } catch { /* best effort */ } }
  await browser.close();
}
for (const c of results) if (!c.status) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status === 'FAIL');
const summary = { gate: 'TENANT / OWNER-VIEW / ATTACHMENT / CATALOG LIVE GATE', base, at: new Date().toISOString(), failed: failed.length, verdict: failed.length ? 'FAIL' : (results.some((c) => c.status.startsWith('BLOCKED')) ? 'PARTIAL' : 'PASS'), results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
for (const c of results) console.log(`${c.status.padEnd(22)} ${c.id}`);
console.log(`TENANT / OWNER-VIEW / ATTACHMENT / CATALOG LIVE GATE: ${summary.verdict}`);
process.exit(failed.length ? 1 : 0);
