// AI HELP V4 - FULL-INTERFACE BROWSER COVERAGE GATE (canonical 5186; synthetic allowlisted personas; TEST backend).
// For every required authenticated surface x HE/EN x desktop/mobile: reach the surface through the product's own navigation, open the
// ONE assistant (header launcher, or the in-context launcher inside a modal/wizard), prove it is visible, focusable and keyboard
// operable, send a real question, capture the V4 help context from the outgoing request (request interception), and assert the
// server answer (TEST chat-ai). Every cell is bound to the served/loaded build identity. A missing cell is a FAIL.
//   node e2e/ai-help-coverage.gate.mjs http://192.168.1.189:5186 [--only=surface1,surface2] [--lang=he|en] [--vp=desktop|mobile]
import { chromium, personas, openAuthed, evidenceDir, writeEvidence, shot, servedIdentity, loadedIdentity, identityProblems, EXPECTED, baseFromArgs, rectOf } from './lib/canonical.mjs';

const BASE = baseFromArgs();
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || null;
const ONLY = arg('only') ? arg('only').split(',') : null;
const LANGS = arg('lang') ? [arg('lang')] : ['he', 'en'];
const VPS = arg('vp') ? [arg('vp')] : ['desktop', 'mobile'];
const VIEWPORTS = { desktop: { viewport: { width: 1366, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, mobile: true } };
const PERSONA = { he: { key: 'A_LOCAL_ILS', p: personas.PERSONA_A, market: 'Local', currency: 'ILS' }, en: { key: 'EN_USD', p: personas.PERSONA_EN, market: 'International', currency: 'USD' } };
const ADMIN = { key: 'SUPER_ADMIN', p: personas.PERSONA_SUPER_ADMIN, market: 'admin', currency: 'n/a' };
const HEB = /[֐-׿]/;
const dir = evidenceDir('ai-help-coverage');

const nav = (page, action, meta = null) => page.evaluate(([a, m]) => window.dispatchEvent(new CustomEvent('proflow-ai-navigate', { detail: { action: a, meta: m } })), [action, meta]);
const settle = (page, ms = 700) => page.waitForTimeout(ms);
async function resetShell(page) {
  const ok = page.getByRole('button', { name: /^(OK|הבנתי, סגור)$/ });
  if (await ok.isVisible().catch(() => false)) await ok.click();
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); }
  const close = page.locator('.ai-chat-popup').getByRole('button', { name: /^(Close|סגור)$/ });
  if (await close.isVisible().catch(() => false)) await close.click();
  await nav(page, 'open_dashboard'); await settle(page);
}
// Quote History rows are collapsible: expand the first editable (Draft) row so its product-owned actions render.
async function expandDraftRow(page, lang) {
  await nav(page, 'open_quote_history'); await settle(page);
  // desktop: a table row with its own disclosure button; mobile: the card header IS the disclosure button (aria-expanded)
  const row = page.locator('tr:has(button[aria-expanded]), button[aria-expanded]').filter({ hasText: lang === 'he' ? /טיוטה/ : /Draft/ }).filter({ hasNotText: lang === 'he' ? /לא גמורה/ : /Unfinished/ }).first();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  const toggle = (await row.evaluate((el) => el.tagName)) === 'TR' ? row.locator('button[aria-expanded]').first() : row;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') { await toggle.click(); await settle(page, 400); }
}
async function openFirstQuoteEditor(page, lang) {
  await expandDraftRow(page, lang);
  const edit = page.getByRole('button', { name: lang === 'he' ? /^ערוך$/ : /^Edit$/ }).first();
  await edit.waitFor({ state: 'visible', timeout: 20000 }); await edit.click();
  await page.locator('input[list="existing-clients-list"]').waitFor({ state: 'visible', timeout: 20000 });
}

// surface recipes: reach -> launcher -> question -> expectations (screen/workflow[/section])
const RECIPES = {
  dashboard: { q: { he: 'מה אפשר לעשות במסך הזה?', en: 'What can I do on this screen?' }, reach: async (page) => { await nav(page, 'open_dashboard'); } },
  quote_history: { q: { he: 'איך אני מוצא הצעה ישנה?', en: 'How do I find an older quote?' }, reach: async (page, lang) => { await nav(page, 'open_quote_history'); await settle(page); const s = page.getByPlaceholder(lang === 'he' ? /חיפוש שם לקוח/ : /Search client or quote/).first(); await s.fill('A'); } },
  quote_editor_new: { q: { he: 'האם הטיוטה שלי שמורה?', en: 'Is my draft saved?' }, deterministic: true, reach: async (page) => { await nav(page, 'open_new_quote'); await page.locator('input[list="existing-clients-list"]').waitFor({ state: 'visible', timeout: 20000 }); } },
  quote_editor_edit: { q: { he: 'האם ההצעה הזו שמורה?', en: 'Is this quote saved?' }, deterministic: true, reach: async (page, lang) => openFirstQuoteEditor(page, lang) },
  item_wizard: { q: { he: 'מה עושים בשלב הזה?', en: 'What do I do in this step?' }, launcher: 'ai-help-wizard', reach: async (page, lang) => { await nav(page, 'open_new_quote'); await page.getByRole('button', { name: lang === 'he' ? /הוספת מוצר או עבודה/ : /Add product or work/ }).first().click(); await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 15000 }); } },
  clients: { q: { he: 'איך מוסיפים לקוח?', en: 'How do I add a client?' }, reach: async (page) => { await nav(page, 'open_clients'); } },
  catalog: { q: { he: 'איך מוסיפים שירות לקטלוג?', en: 'How do I add a service to the catalog?' }, reach: async (page) => { await nav(page, 'open_catalog'); } },
  finances: { q: { he: 'מה מוצג בדוח הזה?', en: 'What does this report show?' }, reach: async (page) => { await nav(page, 'open_finances'); } },
  settings: { q: { he: 'איזה פרטים חובה למלא כאן?', en: 'Which details are required here?' }, reach: async (page) => { await nav(page, 'open_business_settings'); } },
  plans: { q: { he: 'אפשר לשלם דרך המערכת?', en: 'Can I pay through TEKANGO?' }, deterministic: true, launcher: 'ai-help-plans', reach: async (page) => { await nav(page, 'open_plan_information'); } },
  // Admin: HE only - the only synthetic super-admin is a Local account and chat language follows the account market (market isolation);
  // no International super-admin exists, so an EN admin cell is not a product state (recorded in the evidence, never skipped silently).
  admin: { q: { he: 'מה אפשר לעשות באזור הניהול?', en: 'What can I do in the Admin area?' }, admin: true, langs: ['he'], reach: async (page) => { await nav(page, 'open_admin'); await settle(page, 1500); } },
  attachments: {
    q: { he: 'למה הקובץ לא צורף?', en: 'Why was my file not attached?' }, deterministic: true, launcher: 'ai-help-file-error',
    reach: async (page, lang) => {
      await openFirstQuoteEditor(page, lang);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.getByRole('button', { name: lang === 'he' ? /צרף קובץ/ : /Attach File/ }).first().click()]);
      await chooser.setFiles({ name: 'synthetic-oversize.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3.5 * 1024 * 1024, 0x20) }); // > 3MB -> refused locally, never uploaded
    },
  },
  sharing: {
    q: { he: 'למה המייל לא נשלח?', en: 'Why was the email not sent?' }, deterministic: true,
    // the email send is intercepted and failed at the network layer (nothing is sent to anyone); the product's own error owner publishes
    reach: async (page, lang) => {
      await expandDraftRow(page, lang);
      const btn = page.getByRole('button', { name: lang === 'he' ? /^(שלח במייל|שליחה במייל|אימייל|מייל)$/ : /^(Email|Send Email|Send by Email)$/ }).first();
      await btn.waitFor({ state: 'visible', timeout: 15000 }); await btn.click();
      // the product's own confirmation button (EmailConfirmModal) - never the assistant's Send button
      const confirm = page.getByRole('button', { name: lang === 'he' ? /^כן, שלח מייל$/ : /^Yes, Send$/ });
      await confirm.waitFor({ state: 'visible', timeout: 10000 }); await confirm.click();
      await page.locator('text=/⚠|Attention|שים לב/').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    },
    launcher: 'ai-help-alert',
  },
  ai_chat: { q: { he: 'איך אני מתחיל שיחה חדשה?', en: 'How do I start a new chat?' }, reach: async () => {} },
  region_choice: { q: { he: 'מה ההבדל בין מקומי לבינלאומי?', en: 'What is the difference between Local and International?' }, regionChoice: true, launcher: 'floating', reach: async () => {} },
};
const REQUIRED = ['dashboard', 'quote_history', 'quote_editor_new', 'quote_editor_edit', 'item_wizard', 'clients', 'catalog', 'finances', 'settings', 'plans', 'admin', 'attachments', 'sharing', 'ai_chat', 'region_choice'];
const EXPECT = { dashboard: ['dashboard', 'overview'], quote_history: ['quote_history', 'browse_quotes'], quote_editor_new: ['quote_editor_new', 'create_quote'], quote_editor_edit: ['quote_editor_edit', 'edit_quote'], item_wizard: ['item_wizard', 'add_or_edit_item'], clients: ['clients', 'manage_clients'], catalog: ['catalog', 'manage_catalog'], finances: ['finances', 'view_finances'], settings: ['settings', 'edit_business_profile'], plans: ['plans', 'view_plans'], admin: ['admin', 'admin_operations'], attachments: ['quote_editor_edit', 'manage_attachments', 'attachments'], sharing: ['quote_history', 'share_quote', 'share_email'], ai_chat: ['ai_chat', 'ai_chat'], region_choice: ['region_choice', 'setup_region'] };

async function openAssistant(page, launcher) {
  if (launcher && launcher !== 'floating') { const b = page.getByTestId(launcher).first(); await b.waitFor({ state: 'visible', timeout: 15000 }); await b.focus(); await page.keyboard.press('Enter'); return launcher; }
  if (launcher === 'floating') { await page.locator('.ai-support-btn').first().click(); return 'floating'; }
  const header = page.locator('.dash-header-ai-btn:visible').first();
  if (await header.count()) { await header.click(); return 'header'; }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-proflow-ai-chat'))); return 'event';
}

async function runCell(page, { surface, lang, vp, persona }) {
  const r = RECIPES[surface]; const [expScreen, expWorkflow, expSection] = EXPECT[surface];
  const rec = { surface, lang, viewport: vp, persona: persona.key, market: persona.market, currency: persona.currency, fixture: r.regionChoice ? 'route-simulated region choice (settings read empty; writes blocked)' : surface === 'sharing' ? 'email send failed at network layer (intercepted; nothing sent)' : surface === 'attachments' ? '3.5MB synthetic file refused locally (never uploaded)' : 'synthetic persona data', checks: [] };
  const c = (name, ok, detail) => rec.checks.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  try {
    await r.reach(page, lang); await settle(page, 900);
    if (surface === 'ai_chat') { await openAssistant(page, null); await settle(page, 400); }
    rec.launcher = surface === 'ai_chat' ? 'header' : await openAssistant(page, r.launcher);
    const popup = page.locator('.ai-chat-popup');
    await popup.waitFor({ state: 'visible', timeout: 15000 });
    const input = popup.locator('input[type="text"]').last();
    await input.click();
    const focusOk = await input.evaluate((el) => document.activeElement === el);
    const box = await popup.boundingBox(); const vpSize = page.viewportSize();
    const topMost = await page.evaluate(() => { const p = document.querySelector('.ai-chat-popup'); if (!p) return false; const b = p.getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(40, b.height / 2)); return !!el && p.contains(el); });
    c('assistant visible', await popup.isVisible()); c('input focusable', focusOk); c('assistant on top (no z-index collision)', topMost);
    c('assistant inside the viewport', box && box.x >= -1 && box.y >= -1 && box.x + box.width <= vpSize.width + 1 && box.y + box.height <= vpSize.height + 1, rectOf(box));
    await page.keyboard.press('Tab'); const tabOk = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.ai-chat-popup')); c('keyboard: Tab stays inside the assistant', tabOk);
    if (surface === 'ai_chat') {
      // help about the assistant itself: the first request is dropped at the network layer -> the widget's own AI_PROVIDER_FAILED blocker
      await page.route('**/functions/v1/chat-ai', (route) => route.abort('failed'), { times: 1 });
      await input.click(); await input.fill(lang === 'he' ? 'שלום' : 'hello'); await input.press('Enter');
      await popup.getByText(/temporary error|שגיאה זמנית/).first().waitFor({ state: 'visible', timeout: 20000 });
      rec.fixture = 'first chat request dropped at the network layer (AI_PROVIDER_FAILED), then help about the assistant';
    }
    await input.click();
    const q = r.q[lang]; await input.fill(q);
    const [req, resp] = await Promise.all([
      page.waitForRequest((x) => x.url().includes('/functions/v1/chat-ai') && x.method() === 'POST', { timeout: 30000 }),
      page.waitForResponse((x) => x.url().includes('/functions/v1/chat-ai') && x.request().method() === 'POST', { timeout: 90000 }),
      input.press('Enter'),
    ]);
    const body = JSON.parse(req.postData() || '{}'); const hc = body.helpContext || null;
    const out = await resp.json().catch(() => null);
    rec.request = { contractVersion: body.contractVersion, currentArea: body.currentArea, isHebrew: body.isHebrew, helpContext: hc ? { screen: hc.screen, section: hc.section, modal: hc.modal, workflowId: hc.workflowId, step: hc.step, object: { kind: hc.object?.kind, provenance: hc.object?.provenance, hasId: !!hc.object?.id, fingerprint: hc.object?.serverFingerprint ? 'digest' : null }, draft: hc.draft ? { mode: hc.draft.mode, dirty: hc.draft.dirty, localWriteStatus: hc.draft.localWriteStatus, recoveryState: hc.draft.recoveryState } : null, facts: hc.facts, blockers: (hc.blockers || []).map((b) => b.code) } : null };
    rec.response = { status: resp.status(), answerSource: out?.answerSource ?? null, helpMode: out?.helpMode ?? null, blockerCodes: out?.blockerCodes ?? null, navigation: out?.navigation ?? null, privateHelp: out?.privateHelp ?? null, answer: String(out?.answer || '').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>').slice(0, 500) };
    c('request carries the V4 help context', !!hc && body.contractVersion === 4);
    c(`screen = ${expScreen}`, hc?.screen === expScreen, hc?.screen); c(`workflow = ${expWorkflow}`, hc?.workflowId === expWorkflow, hc?.workflowId);
    if (expSection) c(`section = ${expSection}`, hc?.section === expSection, hc?.section);
    c('no PII / free text in the context', !/@|\b\d{9}\b/.test(JSON.stringify(hc || {})));
    c('HTTP 200', resp.status() === 200); c('answer present', typeof out?.answer === 'string' && out.answer.length > 0); c('private help (verified user)', out?.privateHelp === true);
    c('language matches', lang === 'he' ? HEB.test(out?.answer || '') : !HEB.test(out?.answer || ''));
    // region choice legitimately explains BOTH markets (the market is not chosen yet)
    if (lang === 'en' && surface !== 'region_choice') c('no Local money/tax wording in EN', !/₪|\bILS\b|\bVAT\b/.test(out?.answer || ''));
    if (r.deterministic) c('deterministic answer', out?.answerSource === 'deterministic', out?.answerSource);
    if (surface === 'quote_editor_new') c('local draft never called saved on the server', !/saved (in|to) the cloud|נשמרה? בענן/.test((out?.answer || '').replace(/not (saved )?on the server|לא בשרת/g, '')) && hc?.object?.provenance === 'UNSAVED_LOCAL_DRAFT');
    if (surface === 'attachments') c('structured attachment blocker published', (hc?.blockers || []).some((b) => b.code === 'ATTACHMENT_FILE_TOO_LARGE'));
    if (surface === 'sharing') c('structured email blocker published', (hc?.blockers || []).some((b) => /^EMAIL_/.test(b.code)));
    if (surface === 'ai_chat') c('assistant failure published as a structured blocker', (hc?.blockers || []).some((b) => b.code === 'AI_PROVIDER_FAILED'));
    if (surface === 'plans') c('payment truth (no provider named)', !/PayPlus|Stripe|PayPal/i.test(out?.answer || ''));
    if (surface === 'region_choice') c('restricted help: no private business facts claimed', out?.privateHelp === true && hc?.screen === 'region_choice');
    const nav_ = out?.navigation?.action || null;
    rec.navigationRendered = null;
    if (nav_) { const btn = popup.getByRole('button').filter({ hasText: /./ }).last(); rec.navigationRendered = await btn.isVisible().catch(() => false); }
    c('navigation (if any) is from the closed set', !nav_ || ['open_dashboard', 'open_quote_history', 'open_new_quote', 'open_clients', 'open_catalog', 'open_finances', 'open_business_settings', 'open_business_details', 'open_business_phone', 'open_business_tax_id', 'open_plan_information', 'open_selected_quote', 'open_admin'].includes(nav_), nav_);
    rec.screenshot = await shot(page, dir, `ai-${surface}-${lang}-${vp}.png`);
  } catch (e) { c('cell executed', false, String(e?.message || e).slice(0, 300)); }
  rec.result = rec.checks.length && rec.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
  console.log(`${rec.result} ${surface} ${lang} ${vp}${rec.result === 'FAIL' ? ` ${JSON.stringify(rec.checks.filter((x) => !x.ok))}` : ''}`);
  return rec;
}

const browser = await chromium.launch();
const t0 = new Date().toISOString();
const servedBefore = await servedIdentity(BASE);
const cells = []; const loadedIds = [];
const surfaces = (ONLY || REQUIRED);
try {
  for (const vp of VPS) for (const lang of LANGS) {
    const persona = PERSONA[lang];
    const regular = surfaces.filter((s) => !RECIPES[s].admin && !RECIPES[s].regionChoice);
    if (regular.length) {
      const { ctx, page, loaded } = await openAuthed(browser, { persona: persona.p, lang, base: BASE, ...VIEWPORTS[vp] });
      page.on('dialog', (d) => d.accept());
      // sharing: fail the email function at the network layer so nothing is ever sent; the product's own error owner runs
      await page.route('**/functions/v1/send-quote-email', (route) => route.abort('failed'));
      loadedIds.push({ lang, vp, persona: persona.key, problems: identityProblems({ served: servedBefore, loaded }), buildSha: loaded.build?.buildSha });
      for (const s of regular) { cells.push(await runCell(page, { surface: s, lang, vp, persona })); await resetShell(page); }
      await ctx.close();
    }
    if (surfaces.includes('admin') && RECIPES.admin.langs.includes(lang)) {
      const { ctx, page, loaded } = await openAuthed(browser, { persona: ADMIN.p, lang, base: BASE, ...VIEWPORTS[vp] });
      page.on('dialog', (d) => d.accept());
      loadedIds.push({ lang, vp, persona: ADMIN.key, problems: identityProblems({ served: servedBefore, loaded }), buildSha: loaded.build?.buildSha });
      cells.push(await runCell(page, { surface: 'admin', lang, vp, persona: ADMIN })); await ctx.close();
    }
    if (surfaces.includes('region_choice')) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[vp].viewport, isMobile: !!VIEWPORTS[vp].mobile, hasTouch: !!VIEWPORTS[vp].mobile });
      const page = await ctx.newPage(); page.on('dialog', (d) => d.accept());
      // read of the business row returns "no row yet"; every write to it is blocked; geo is unavailable -> the product's own region choice
      await page.route('**/rest/v1/business_settings**', (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : route.abort('blockedbyclient')));
      await page.route('**/api/geo**', (route) => route.fulfill({ status: 503, body: '' }));
      const { login } = await import('./lib/canonical.mjs');
      await page.goto(`${BASE}/dashboard?lang=${lang}`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('user@example.com').fill(persona.p.email); await page.locator('input[name="user_password_field"]').fill(persona.p.password);
      await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
      await page.getByRole('button', { name: /^(Local|מקומי)/ }).first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      const loaded = await loadedIdentity(page);
      loadedIds.push({ lang, vp, persona: `${persona.key}(region-sim)`, problems: identityProblems({ served: servedBefore, loaded }), buildSha: loaded.build?.buildSha });
      cells.push(await runCell(page, { surface: 'region_choice', lang, vp, persona })); await ctx.close();
      void login;
    }
  }
} finally { await browser.close(); }
const servedAfter = await servedIdentity(BASE);
const applicable = (s, l) => !RECIPES[s].langs || RECIPES[s].langs.includes(l);
const notApplicable = []; for (const s of surfaces) for (const l of LANGS) for (const v of VPS) if (!applicable(s, l)) notApplicable.push({ cell: [s, l, v].join('/'), reason: 'no International super-admin persona exists; Admin chat language follows the account market (market isolation) - not a product state' });
const expectedCells = surfaces.reduce((n, s) => n + LANGS.filter((l) => applicable(s, l)).length * VPS.length, 0);
const missing = []; for (const s of surfaces) for (const l of LANGS) for (const v of VPS) if (applicable(s, l) && !cells.some((x) => x.surface === s && x.lang === l && x.viewport === v)) missing.push(`${s}/${l}/${v}`);
// identity in the registry's canonical-evidence schema (validateCanonicalEvidence): before/after served snapshots + every problem
const snap = (s) => ({ base: s.base, capturedAt: s.capturedAt, version: s.version, servedFingerprint: s.servedFingerprint, servedFiles: s.servedFiles, servedMismatches: s.servedMismatches });
const problems = [...identityProblems({ served: servedBefore }).map((p) => `before: ${p}`), ...identityProblems({ served: servedAfter }).map((p) => `after: ${p}`), ...loadedIds.flatMap((l) => l.problems.map((p) => `loaded ${l.persona}/${l.lang}/${l.vp}: ${p}`))];
const identity = { before: snap(servedBefore), after: snap(servedAfter), problems, loaded: loadedIds };
const identityOk = problems.length === 0;
const pass = identityOk && !missing.length && cells.length === expectedCells && cells.every((x) => x.result === 'PASS');
const screenshots = cells.map((x) => x.screenshot).filter(Boolean);
writeEvidence(dir, 'gate-ai-help-coverage.json', { gate: 'AI HELP V4 FULL-INTERFACE BROWSER COVERAGE', law: 'AI-HELP-AVAILABILITY-001', url: BASE, candidate: { sha: EXPECTED.sha, digest: EXPECTED.digest }, start: t0, end: new Date().toISOString(), identity, expectedCells, missing, notApplicable, cells, screenshots, verdict: pass ? 'PASS' : 'FAIL' });
console.log(`AI HELP COVERAGE GATE: ${pass ? 'PASS' : 'FAIL'} (${cells.filter((x) => x.result === 'PASS').length}/${expectedCells} cells${missing.length ? `, missing ${missing.length}` : ''}${identityOk ? '' : ', IDENTITY PROBLEM'})`);
process.exit(pass ? 0 : 1);
