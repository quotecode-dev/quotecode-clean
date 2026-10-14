// Task 16 - authenticated creator QA (persona login, quote editor, presentation/style panel, media, resize state
// retention, save -> reopen -> issue -> anonymous public page (Direct PDF + Print), mobile shell side, Escape/focus,
// 44px touch targets) plus a locked-style check for a lower-tier persona.
//
// Usage: node scripts/task16/qa/qa-app-persona.mjs --base-url http://localhost:5186 [--out DIR]
//          [--personas LOCAL_PRO,INTL_PRO] [--locked-personas INTL_EUR,INTL_GBP,PERSONA_SUPER_ADMIN] [--env C:/tkrc-pt/.env.localtest.local]
//          [--allow-writes]
//
// CREDENTIAL SAFETY: persona e-mails/password are read from the env file and used ONLY as Playwright fill() input and
// in the auth request. They are never printed, logged or written; every output string passes through redact(), and
// every screenshot masks any element showing the persona e-mail. No screenshot is taken while the login form holds a
// value. The run refuses unless the env file's VITE_SUPABASE_URL is the TEST project, and the browser aborts any
// password-grant request not addressed to the TEST project. The session token stays inside the page (REST lookups run
// in-page) and is never returned to the script.
// WRITES (only with --allow-writes): one image upload, one quote save (client "T16 QA ..."), one issue per persona.
import fs from 'node:fs';
import path from 'node:path';
import {
  loadPlaywright, parseArgs, resolveBaseUrl, outDir, writeJson, summarize, slug, isMain, REPO_ROOT,
  pass, fail, notTested, probeOverflow, TEST_PROJECT_REF, assertAllowlistedPersona,
} from './lib.mjs';
import { printProbe, blockVerdict, directPdf, countPdfPages } from './qa-print-pdf.mjs';

export const DEFAULT_ENV = 'C:/tkrc-pt/.env.localtest.local';
export const PASSWORD_KEY = 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD';
// IRON-DATA-001: ONLY allowlisted synthetic personas (sha256(email) in synthetic-personas.json testPersonas, checked
// fail-closed in login()). Tier fixtures on TEST: LOCAL_PRO / INTL_PRO entitled (visual), INTL_EUR classic (Modern +
// Visual locked), INTL_GBP modern (Visual locked), PERSONA_SUPER_ADMIN classic (locked; admin nav present).
export const PERSONAS = {
  LOCAL_PRO: { key: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', pwdKey: PASSWORD_KEY, lang: 'he' },
  INTL_PRO: { key: 'PROFLOW_TEST_INTL_PRO_EMAIL', pwdKey: PASSWORD_KEY, lang: 'en' },
  INTL_EUR: { key: 'PROFLOW_TEST_INTL_EUR_EMAIL', pwdKey: 'PROFLOW_TEST_INTL_EUR_PASSWORD', lang: 'en' },
  INTL_GBP: { key: 'PROFLOW_TEST_INTL_GBP_EMAIL', pwdKey: 'PROFLOW_TEST_INTL_GBP_PASSWORD', lang: 'en' },
  PERSONA_SUPER_ADMIN: { key: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL', pwdKey: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD', lang: 'he' },
};
// Presentation panel selectors: worker D1's qp-* test ids, plus the generic t16-* convention.
const STYLE_SEL = '[data-testid^="qp-quote-style-select-"], [data-testid^="t16-style"][aria-pressed], [data-testid^="t16-style"] [aria-pressed]';
const DETAIL_SEL = '[data-testid^="qp-detail-"], [data-testid^="t16-detail"][aria-pressed], [data-testid^="t16-detail"] [aria-pressed]';
const MEDIA_ITEM_SEL = '[data-testid^="qp-media-item-"]';
const SAMPLE_IMAGE = path.join(REPO_ROOT, 'public', 'task16-samples', 'shelf.png');
const styleOf = (testid) => (String(testid || '').match(/(classic|modern|visual)/) || [])[1] || null;

export function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

export function makeRedactor(secrets) {
  const list = secrets.filter((s) => typeof s === 'string' && s.length >= 3);
  return (text) => {
    let out = String(text);
    for (const s of list) out = out.split(s).join('[REDACTED]');
    return out;
  };
}

export const T = {
  he: {
    signIn: /Sign In|התחבר/, quotesNav: /^(Quotes|הצעות מחיר)$/, newQuote: /^(New Quote|הצעת מחיר חדשה)$/,
    addItem: /הוספת מוצר או עבודה/, manual: /לא מצאתם בקטלוג/, next: /^הבא$/, fixed: /^מחיר כולל/, more: /^אפשרויות נוספות$/, addToQuote: /^הוספה להצעה$/,
    search: /Search client or quote #|חיפוש שם לקוח/, showMore: /Show more details|הצג פרטים נוספים/, edit: /^ערוך$/,
    pdf: /הורד כ-PDF|הורדת PDF/, print: /הדפס מסמך|הדפסה/, compactChoice: /תמציתי|מקוצר/,
    items: ['T16 QA פריט ראשון', 'T16 QA פריט שני'],
  },
  en: {
    signIn: /Sign In|התחבר/, quotesNav: /^(Quotes|הצעות מחיר)$/, newQuote: /^(New Quote|הצעת מחיר חדשה)$/,
    addItem: /Add product or work/, manual: /Not in the catalog\? Add a product/, next: /^Next$/, fixed: /^One total price/, more: /^More options$/, addToQuote: /^Add to quote$/,
    search: /Search client or quote #|חיפוש שם לקוח/, showMore: /Show more details|הצג פרטים נוספים/, edit: /^Edit$/,
    pdf: /Download PDF/, print: /Print Document|Print/, compactChoice: /Compact/,
    items: ['T16 QA first item', 'T16 QA second item'],
  },
};

async function addItem(page, t, description, amount) {
  await page.getByRole('button', { name: t.addItem }).first().click();
  const w = page.locator('[role="dialog"]').last();
  await w.waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  const manual = w.getByText(t.manual);
  if (await manual.count()) await manual.first().click();
  await page.locator('#wiz-description').waitFor({ timeout: 15000 });
  await page.locator('#wiz-description').fill(description);
  await w.getByRole('button', { name: t.next }).click();
  await page.waitForTimeout(300);
  if (!(await w.getByText(t.fixed).first().isVisible().catch(() => false))) await w.getByText(t.more).first().click();
  await w.getByText(t.fixed).first().click();
  await w.getByRole('button', { name: t.next }).click();
  await page.waitForTimeout(300);
  await page.locator('#wiz-fixed-amount').fill(String(amount));
  await w.getByRole('button', { name: t.next }).click();
  await page.waitForTimeout(300);
  await w.getByRole('button', { name: t.addToQuote }).click();
  await w.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// Snapshot of everything that must survive a viewport change (no reload).
async function editorState(page, items) {
  return page.evaluate(({ items, STYLE_SEL, DETAIL_SEL, MEDIA_ITEM_SEL }) => {
    const client = document.querySelector('input[list="existing-clients-list"]');
    const text = document.body.innerText;
    const pressed = (sel) => [...document.querySelectorAll(sel)].filter((el) => el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true')
      .map((el) => el.getAttribute('data-testid') || el.innerText.trim().slice(0, 40));
    return {
      clientName: client ? client.value : null,
      itemsPresent: items.map((d) => text.includes(d)),
      selectedStyle: pressed(STYLE_SEL),
      selectedDetail: pressed(DETAIL_SEL),
      mediaCount: document.querySelectorAll(MEDIA_ITEM_SEL).length,
    };
  }, { items, STYLE_SEL, DETAIL_SEL, MEDIA_ITEM_SEL });
}

async function findStylePanel(page) {
  const cards = page.locator(STYLE_SEL);
  if (await cards.count()) return cards;
  await page.locator('[data-testid="qp-panel"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await cards.first().waitFor({ timeout: 15000 }).catch(() => {});
  return (await cards.count()) ? cards : null;
}

async function isLocked(page, style) {
  return (await page.locator(`[data-testid="qp-quote-style-locked-${style}"]`).count()) > 0;
}

async function touchTargets(page) {
  return page.evaluate(() => {
    const sel = ['[data-testid="sq-save"]', '[data-testid^="qp-quote-style-select-"]', '[data-testid^="qp-detail-"]', '[data-testid="qp-open-preview"]', '[data-testid="qp-media-upload"]', '[data-testid="qp-issue-button"]', '[data-testid^="t16-"][aria-pressed]', '.mobile-bottom-nav button', '.dash-drawer-toggle'];
    const seen = new Set();
    const out = [];
    for (const s of sel) {
      for (const el of document.querySelectorAll(s)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') continue;
        out.push({ sel: s, testid: el.getAttribute('data-testid'), text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return out;
  });
}

async function escapeAndFocus(page, opener, label, dialogSel = '[role="dialog"], [role="alertdialog"]') {
  if (!(await opener.count())) return notTested(`${label}: opener not present`);
  await opener.first().scrollIntoViewIfNeeded().catch(() => {});
  await opener.first().evaluate((el) => el.setAttribute('data-t16qa-opener', '1'));
  await opener.first().click();
  const dlg = page.locator(dialogSel).filter({ visible: true });
  const opened = await dlg.first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (!opened) return notTested(`${label}: no dialog appeared`);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  const closed = await dlg.first().waitFor({ state: 'hidden', timeout: 5000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(200);
  const focusBack = await page.evaluate(() => !!document.activeElement && document.activeElement.getAttribute('data-t16qa-opener') === '1');
  await opener.first().evaluate((el) => el.removeAttribute('data-t16qa-opener')).catch(() => {});
  if (!closed) return fail(`${label}: Escape did not close the dialog`);
  return focusBack ? pass(`${label}: closed, focus returned`) : fail(`${label}: closed but focus did not return to the opener`);
}

// In-page REST read with the page's own session (the token never leaves the page). Remembers apikey + origin from
// the app's own Supabase traffic.
function trackSupabase(page) {
  const sb = { origin: null, apikey: null };
  page.on('request', (r) => {
    const u = r.url();
    if (!u.includes(`${TEST_PROJECT_REF}.supabase.co/rest/v1/`)) return;
    const h = r.headers();
    if (h.apikey) { sb.apikey = h.apikey; sb.origin = new URL(u).origin; }
  });
  return sb;
}
async function restGet(page, sb, query) {
  if (!sb.origin || !sb.apikey) throw new Error('supabase REST origin not observed yet');
  return page.evaluate(async ({ url, apikey }) => {
    const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
    const tok = k ? JSON.parse(localStorage.getItem(k)).access_token : null;
    const r = await fetch(url, { headers: { apikey, Authorization: `Bearer ${tok}` } });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, { url: `${sb.origin}/rest/v1/${query}`, apikey: sb.apikey });
}

export async function login(page, base, cfg, t, creds) {
  // Fail-closed allowlist gate BEFORE anything is typed into the login form (the label is the env key name, never the address).
  assertAllowlistedPersona(creds.email, String(cfg.key || 'persona').replace(/^PROFLOW_TEST_|_EMAIL$/g, ''));
  await page.goto(`${base}/dashboard?lang=${cfg.lang}`, { timeout: 120000 });
  const emailField = page.getByPlaceholder('user@example.com');
  if (!(await emailField.waitFor({ timeout: 90000 }).then(() => true).catch(() => false))) {
    await page.reload({ timeout: 120000 });
    await emailField.waitFor({ timeout: 90000 });
  }
  await emailField.fill(creds.email);
  await page.locator('input[name="user_password_field"]').fill(creds.password);
  await page.getByRole('button', { name: t.signIn }).first().click();
  const quotesNav = page.getByRole('button', { name: t.quotesNav }).first();
  if (await quotesNav.waitFor({ timeout: 90000 }).then(() => true).catch(() => false)) return pass();
  await page.reload({ timeout: 120000 });
  if (await quotesNav.waitFor({ timeout: 60000 }).then(() => true).catch(() => false)) return pass({ retried: true });
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(creds.email);
    await page.locator('input[name="user_password_field"]').fill(creds.password);
    await page.getByRole('button', { name: t.signIn }).first().click();
  }
  await quotesNav.waitFor({ timeout: 90000 });
  return pass({ retried: true });
}

export async function openNewQuote(page, t) {
  await page.getByRole('button', { name: t.newQuote }).first().click();
  await page.getByTestId('sq-step-1').waitFor({ timeout: 30000 });
}

// Reload, find the saved quote by client name in the list and open it for editing (desktop layout).
async function reopenQuote(page, t, clientName) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ timeout: 120000 });
  await page.getByRole('button', { name: t.quotesNav }).first().waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: t.quotesNav }).first().click().catch(() => {});
  await page.getByPlaceholder(t.search).first().fill(clientName);
  await page.waitForTimeout(1500);
  const row = page.locator('tr, [data-testid*="quote-card"], .quote-card').filter({ hasText: clientName }).first();
  await row.waitFor({ timeout: 30000 });
  const more = row.getByRole('button', { name: t.showMore });
  if (await more.count()) await more.first().click();
  await page.getByRole('button', { name: t.edit }).filter({ visible: true }).first().click();
  await page.getByTestId('sq-step-1').waitFor({ timeout: 30000 });
  await page.locator(STYLE_SEL).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500); // presentation draft + signed media URLs load asynchronously
}

async function resizeSequences(page, items, reference, shot, prefix) {
  const out = {};
  const sequences = [[[768, 1024], [1024, 768], [768, 1024]], [[820, 1180], [1180, 820], [820, 1180]]];
  for (const seq of sequences) {
    const key = `${prefix}resizeRetains_${seq[0][0]}x${seq[0][1]}_${seq[1][0]}x${seq[1][1]}`;
    try {
      const diffs = [];
      const overflow = [];
      let navigations = 0;
      const onNav = (fr) => { if (fr === page.mainFrame()) navigations += 1; };
      page.on('framenavigated', onNav);
      for (const [w, h] of seq) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(600);
        const st = await editorState(page, items);
        for (const field of ['clientName', 'mediaCount']) if (st[field] !== reference[field]) diffs.push({ at: `${w}x${h}`, field, before: field === 'clientName' ? 'set' : reference[field], got: field === 'clientName' ? (st[field] === null ? 'input absent' : 'changed') : st[field] });
        for (const field of ['itemsPresent', 'selectedStyle', 'selectedDetail']) if (st[field].join() !== reference[field].join()) diffs.push({ at: `${w}x${h}`, field, before: reference[field], got: st[field] });
        const o = await probeOverflow(page);
        if (o.scrollWidth > o.innerWidth) overflow.push({ at: `${w}x${h}`, ...o });
        await shot(`${prefix}editor-${w}x${h}`);
      }
      page.off('framenavigated', onNav);
      if (navigations) out[key] = notTested({ reason: 'the page reloaded during the sequence - state retention not measurable', navigations, diffs });
      else if (diffs.length || overflow.length) out[key] = fail({ diffs, overflow });
      else out[key] = pass({ style: reference.selectedStyle, detail: reference.selectedDetail, media: reference.mediaCount });
    } catch (e) {
      out[key] = fail(String(e).split('\n')[0].slice(0, 300));
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  return out;
}

async function publicQuoteChecks(browser, base, cfg, t, qid, chosenStyle, mediaCount, dir, name, maskText) {
  const checks = {};
  const isHe = cfg.lang === 'he';
  const url = isHe ? `${base}/public-quote/${qid}` : `${base}/en/public-quote/${qid}?lang=en`;
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await anon.addInitScript(() => { window.__t16PrintCalls = 0; window.print = () => { window.__t16PrintCalls += 1; }; });
  const pub = await anon.newPage();
  const shot = async (label) => { const f = path.join(dir, `${slug(`${name}-public-${label}`)}.png`); await pub.screenshot({ path: f, fullPage: true, timeout: 30000, mask: maskText ? [pub.getByText(maskText, { exact: false })] : [] }).catch(() => {}); return f; };
  try {
    await pub.goto(url, { timeout: 120000 });
    const ok = await pub.locator('.pq-card').first().waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
    if (!ok) { checks.publicRenders = fail({ reason: 'no .pq-card', url: url.replace(qid, '<qid>') }); return { checks }; }
    await pub.evaluate(async () => {
      const imgs = [...document.querySelectorAll('.pq-card img')];
      await Promise.race([Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))), new Promise((r) => setTimeout(r, 10000))]);
    });
    const info = await pub.evaluate(() => {
      const card = document.querySelector('.pq-card');
      const imgs = [...card.querySelectorAll('.pq-media img')];
      return {
        cls: card.className, dir: getComputedStyle(card).direction,
        th: card.querySelectorAll('thead th').length,
        mediaImgs: imgs.length, mediaLoaded: imgs.filter((i) => i.naturalWidth > 0).length,
        missingTiles: card.querySelectorAll('[data-pq-media-state="missing"]').length,
        buttonsInCard: [...card.querySelectorAll('button, [role="button"]')].filter((b) => b.getAttribute('aria-expanded') === null && b.getBoundingClientRect().width > 0).map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40)),
      };
    });
    checks.publicRenders = pass({ url: url.replace(qid, '<qid>') });
    checks.publicStyle = chosenStyle && info.cls.split(/\s+/).includes(`pq-style-${chosenStyle}`) ? pass(info.cls) : fail({ want: `pq-style-${chosenStyle}`, got: info.cls });
    checks.publicDirection = info.dir === (isHe ? 'rtl' : 'ltr') ? pass(info.dir) : fail(info.dir);
    checks.publicFourColumns = info.th === 4 ? pass() : fail({ th: info.th });
    checks.publicMedia = mediaCount ? (info.mediaImgs >= 1 && info.mediaLoaded === info.mediaImgs && !info.missingTiles ? pass(info) : fail(info)) : notTested('no media attached in the editor');
    checks.publicNoActionButtonsInCard = info.buttonsInCard.length ? fail(info.buttonsInCard) : pass();
    for (const [w, h] of [[1280, 900], [390, 844], [320, 640]]) {
      await pub.setViewportSize({ width: w, height: h });
      await pub.waitForTimeout(400);
      const o = await probeOverflow(pub);
      checks[`publicNoOverflow_${w}`] = o.scrollWidth <= o.innerWidth ? pass() : fail(o);
      await shot(`${w}x${h}`);
    }
    await pub.setViewportSize({ width: 1280, height: 900 });
    // Direct PDF (generateQuotePdf -> download)
    checks.publicDirectPdf = await directPdf(pub, cfg.lang, dir).catch((e) => fail(String(e).split('\n')[0].slice(0, 200)));
    await pub.waitForTimeout(500);
    // Print: the chooser must call window.print (stubbed), then the print-emulated document is checked + saved.
    const printBtn = pub.locator('button').filter({ hasText: t.print }).filter({ visible: true });
    if (await printBtn.count()) {
      await printBtn.first().click();
      const dlg = pub.locator('[role="dialog"]').filter({ visible: true });
      if (await dlg.first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
        const c = dlg.first().locator('button').filter({ hasText: t.compactChoice });
        if (await c.count()) await c.first().click();
      }
      await pub.waitForTimeout(800);
      const calls = await pub.evaluate(() => window.__t16PrintCalls);
      checks.publicPrintInvoked = calls > 0 ? pass({ printCalls: calls }) : fail({ printCalls: calls });
    } else checks.publicPrintInvoked = notTested('no visible Print button');
    await pub.emulateMedia({ media: 'print' });
    await pub.waitForTimeout(200);
    const p = await printProbe(pub);
    checks.publicPrintNoFixedOverlays = p.fixedOverlays.length ? fail(p.fixedOverlays) : pass();
    const nonDisclosure = p.controls.filter((x) => x.ariaExpanded === null);
    checks.publicPrintNoControls = nonDisclosure.length ? fail(p.controls) : pass();
    checks.publicPrintTheadRepeats = p.theadDisplay === 'table-header-group' ? pass() : fail({ theadDisplay: p.theadDisplay });
    checks.publicPrintTotals = blockVerdict(p.totals, 'totals');
    checks.publicPrintSignature = blockVerdict(p.signature, 'signature');
    const buf = await pub.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pdfFile = path.join(dir, `${slug(name)}-public-print.pdf`);
    fs.writeFileSync(pdfFile, buf);
    checks.publicPrintPdf = countPdfPages(buf) > 0 ? pass({ file: pdfFile, pages: countPdfPages(buf) }) : fail({ file: pdfFile });
  } finally {
    await anon.close();
  }
  return { checks };
}

async function runPersona(browser, base, name, cfg, creds, dir, args, redact) {
  const checks = {};
  const shots = [];
  const isHe = cfg.lang === 'he';
  const t = T[cfg.lang];
  const writes = !!args['allow-writes'];
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
  const clientName = `T16 QA ${name} ${stamp}`;
  const items = t.items.map((d) => `${d} ${stamp}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(redact(String(e)).slice(0, 300)));
  await page.route('**/auth/v1/token**', (route) => (new URL(route.request().url()).hostname.includes(TEST_PROJECT_REF) ? route.continue() : route.abort()));
  const sb = trackSupabase(page);
  const shot = async (label) => {
    const f = path.join(dir, `${slug(`${name}-${label}`)}.png`);
    await page.screenshot({ path: f, fullPage: false, timeout: 30000, mask: [page.getByText(creds.email, { exact: false })] }).then(() => shots.push(f)).catch(() => {});
  };
  const step = async (key, fn) => {
    try { checks[key] = await fn(); } catch (e) { checks[key] = fail(redact(String(e)).split('\n')[0].slice(0, 300)); }
    return checks[key].status === 'PASS';
  };

  try {
    if (!(await step('login', () => login(page, base, cfg, t, creds)))) return { name, checks, shots, errors };
    await shot('dashboard');

    const editorOpen = await step('newQuoteEditor', async () => {
      await openNewQuote(page, t);
      await page.locator('input[list="existing-clients-list"]').fill(clientName);
      // Client type is a required <select> for a new quote (native validation blocks the save otherwise).
      await page.locator('select[data-help-field="client_type"]').selectOption('private').catch(() => {});
      for (let i = 0; i < items.length; i += 1) await addItem(page, t, items[i], 100 + i * 50);
      const st = await editorState(page, items);
      return st.clientName === clientName && st.itemsPresent.every(Boolean) ? pass() : fail({ itemsPresent: st.itemsPresent, clientNameMatches: st.clientName === clientName });
    });
    if (!editorOpen) return { name, checks, shots, errors };

    let chosenStyle = null;
    await step('stylePanel', async () => {
      const cards = await findStylePanel(page);
      if (!cards) return notTested('no style cards found (qp-quote-style-select-* / t16-style*)');
      const n = await cards.count();
      let chosen = null;
      for (const want of ['modern', 'visual', 'classic']) {
        for (let i = 0; i < n; i += 1) {
          const c = cards.nth(i);
          const tid = (await c.getAttribute('data-testid')) || '';
          const disabled = (await c.getAttribute('aria-disabled')) === 'true' || (await c.isDisabled().catch(() => false));
          if (styleOf(tid) === want && !disabled && !(await isLocked(page, want)) && (await c.isVisible())) { chosen = c; break; }
        }
        if (chosen) break;
      }
      if (!chosen) return notTested({ reason: 'no enabled style card matched modern/visual/classic', cards: n });
      await chosen.click();
      await page.waitForTimeout(400);
      const tid = await chosen.getAttribute('data-testid');
      chosenStyle = styleOf(tid);
      const pressed = await chosen.getAttribute('aria-pressed');
      return pressed === 'true' ? pass({ chosen: tid }) : fail({ chosen: tid, ariaPressed: pressed });
    });
    await step('detailToggle', async () => {
      const target = page.locator('[data-testid="qp-detail-expanded"]').filter({ visible: true });
      if (!(await target.count())) return notTested('no qp-detail-expanded control');
      await target.first().click();
      await page.waitForTimeout(300);
      return (await target.first().getAttribute('aria-pressed')) === 'true' ? pass('expanded') : fail('aria-pressed not true after click');
    });
    await step('mediaUpload', async () => {
      if (!writes) return notTested('writes disabled (upload stores an asset)');
      const input = page.getByTestId('qp-media-file');
      if (!(await input.count())) return notTested({ reason: 'no media input (style without images?)', style: chosenStyle });
      await input.setInputFiles(SAMPLE_IMAGE);
      await page.locator(MEDIA_ITEM_SEL).first().waitFor({ timeout: 90000 });
      const err = await page.getByTestId('qp-media-error').count();
      return err ? fail('qp-media-error shown') : pass({ items: await page.locator(MEDIA_ITEM_SEL).count() });
    });
    await shot('editor-1280');

    const before = await editorState(page, items);
    Object.assign(checks, await resizeSequences(page, items, before, shot, ''));
    await step('escapeClosesWizard', () => escapeAndFocus(page, page.getByRole('button', { name: t.addItem }), 'add-item wizard'));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await shot('editor-390');
    await step('touchTargets44_390', async () => {
      const fineList = await touchTargets(page);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
      await page.waitForTimeout(300);
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      const list = await touchTargets(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
      await cdp.detach().catch(() => {});
      if (!list.length) return notTested('no primary controls found at 390');
      const small = list.filter((x) => x.h < 44 || x.w < 44);
      const detail = { pointerCoarse: coarse, measured: list.length, smallWithFinePointer: fineList.filter((x) => x.h < 44 || x.w < 44).map((x) => x.testid || x.text) };
      return small.length ? fail({ ...detail, small }) : pass(detail);
    });
    await step('mobileShellSide', async () => {
      const toggle = page.locator('.dash-drawer-toggle').filter({ visible: true });
      const bottomNav = await page.locator('.mobile-bottom-nav').filter({ visible: true }).count();
      if (!(await toggle.count())) return notTested({ reason: 'no visible drawer toggle at 390 (bottom navigation shell)', bottomNavVisible: bottomNav > 0 });
      const r = await escapeAndFocus(page, toggle, 'drawer').catch(() => null);
      await toggle.first().click();
      await page.waitForTimeout(400);
      const rect = await page.evaluate(() => { const el = document.getElementById('authenticated-sidebar'); if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, vw: window.innerWidth }; });
      await page.keyboard.press('Escape');
      if (!rect) return fail('drawer opened but #authenticated-sidebar not found');
      const sideOk = isHe ? Math.abs(rect.right - rect.vw) <= 2 : Math.abs(rect.left) <= 2;
      return sideOk ? pass({ rect, escape: r?.status }) : fail({ want: isHe ? 'right' : 'left', rect, escape: r?.status });
    });
    await page.setViewportSize({ width: 1280, height: 900 });

    if (!writes) {
      for (const k of ['saveDraft', 'reopenRestores', 'issue', 'publicFlowRan']) checks[k] = notTested('writes disabled (pass --allow-writes)');
      return { name, checks, shots, errors };
    }

    let qid = null;
    const saved = await step('saveDraft', async () => {
      await page.getByTestId('sq-save').scrollIntoViewIfNeeded().catch(() => {});
      await page.getByTestId('sq-save').click();
      const closed = await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 60000 }).then(() => true).catch(() => false);
      if (!closed) {
        // The editor stayed open: capture what blocked the save (validation / alert / dialog text), then fail.
        const blockers = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], [role="alertdialog"], [role="dialog"], [role="status"], [aria-invalid="true"], [data-testid*="error"], [data-testid*="block"]')]
          .filter((el) => el.getBoundingClientRect().height > 0)
          .map((el) => ({ tag: el.tagName.toLowerCase(), testid: el.getAttribute('data-testid'), id: el.id, text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 200) })).slice(0, 10));
        await shot('save-blocked');
        await page.getByTestId('sq-save').scrollIntoViewIfNeeded().catch(() => {});
        await shot('save-blocked-at-button');
        return fail({ reason: 'editor did not close after save', blockers });
      }
      await page.waitForTimeout(1500);
      const cl = await restGet(page, sb, `clients?select=id&company_name=eq.${encodeURIComponent(clientName)}`);
      const clientId = cl.json?.[0]?.id;
      const qs = clientId ? await restGet(page, sb, `quotes?select=id,status&client_id=eq.${clientId}`) : { json: [] };
      qid = qs.json?.[0]?.id || null;
      return qid ? pass({ status: qs.json[0].status }) : fail({ reason: 'saved quote not found by client name', restStatus: qs.status });
    });
    if (!saved) return { name, checks, shots, errors };

    await step('reopenRestores', async () => {
      await reopenQuote(page, t, clientName);
      const st = await editorState(page, items);
      const diffs = [];
      if (st.clientName !== clientName) diffs.push('clientName');
      if (!st.itemsPresent.every(Boolean)) diffs.push({ items: st.itemsPresent });
      if (st.selectedStyle.join() !== before.selectedStyle.join()) diffs.push({ style: { before: before.selectedStyle, got: st.selectedStyle } });
      if (st.mediaCount !== before.mediaCount) diffs.push({ media: { before: before.mediaCount, got: st.mediaCount } });
      const detailKept = st.selectedDetail.join() === before.selectedDetail.join();
      await shot('reopened-1280');
      return diffs.length ? fail({ diffs, detailKept }) : pass({ detailKept, detailNote: detailKept ? undefined : 'detail is a preview/print preference (not persisted)' });
    });
    const reopened = await editorState(page, items);
    Object.assign(checks, await resizeSequences(page, items, reopened, shot, 'reopened_'));

    await step('issue', async () => {
      const btn = page.getByTestId('qp-issue-button');
      if (!(await btn.count())) return notTested('no qp-issue-button (quote not a saved draft?)');
      await btn.scrollIntoViewIfNeeded();
      if (await btn.isDisabled()) return notTested({ reason: 'issue button disabled', why: (await page.locator('#qp-issue-why').innerText().catch(() => '')).slice(0, 120) });
      await btn.click();
      const confirm = page.getByTestId('qp-issue-confirm');
      if (!(await confirm.waitFor({ timeout: 10000 }).then(() => true).catch(() => false))) return fail('no issue confirmation dialog');
      await confirm.click();
      await page.getByTestId('qp-issue-button').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
      const stillThere = await page.getByTestId('qp-issue-button').count();
      const err = await page.locator('.qp-root [role="alert"]').filter({ visible: true }).allInnerTexts();
      await shot('issued');
      return !stillThere && !err.length ? pass() : fail({ issueButtonStillPresent: !!stillThere, alerts: err.map((x) => x.slice(0, 120)) });
    });

    await step('publicFlowRan', async () => {
      const r = await publicQuoteChecks(browser, base, cfg, t, qid, chosenStyle, before.mediaCount, dir, name, creds.email);
      for (const [k, v] of Object.entries(r.checks)) checks[k] = v;
      return pass('see public* checks');
    });
  } finally {
    await context.close();
  }
  return { name, lang: cfg.lang, checks, shots, errors };
}

// Lower-tier persona: locked styles are marked, a locked choice opens the explanation dialog, never selects it,
// Escape closes it and focus returns. No writes.
async function runLockedPersona(browser, base, name, cfg, creds, dir, redact) {
  const checks = {};
  const shots = [];
  const t = T[cfg.lang];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(redact(String(e)).slice(0, 300)));
  await page.route('**/auth/v1/token**', (route) => (new URL(route.request().url()).hostname.includes(TEST_PROJECT_REF) ? route.continue() : route.abort()));
  const step = async (key, fn) => {
    try { checks[key] = await fn(); } catch (e) { checks[key] = fail(redact(String(e)).split('\n')[0].slice(0, 300)); }
    return checks[key].status === 'PASS';
  };
  try {
    if (!(await step('login', () => login(page, base, cfg, t, creds)))) return { name, checks, shots, errors };
    if (!(await step('newQuoteEditor', async () => { await openNewQuote(page, t); return pass(); }))) return { name, checks, shots, errors };
    const locked = [];
    await step('lockedStylesMarked', async () => {
      const cards = await findStylePanel(page);
      if (!cards) return notTested('no style cards found');
      for (const s of ['classic', 'modern', 'visual']) if (await isLocked(page, s)) locked.push(s);
      const classicLocked = locked.includes('classic');
      if (classicLocked) return fail({ locked, reason: 'Classic must always be included' });
      return locked.length ? pass({ locked }) : notTested({ reason: 'this persona tier includes every style - nothing locked', locked });
    });
    if (locked.length) {
      const style = locked[0];
      const btn = page.locator(`[data-testid="qp-quote-style-select-${style}"]`);
      await step('lockedChoiceOpensDialog', async () => {
        const r = await escapeAndFocus(page, btn, `locked ${style} explanation`, '[data-testid="qp-locked-drawer"], [data-testid="qp-locked-dialog"], [role="dialog"]');
        const pressed = await btn.first().getAttribute('aria-pressed');
        if (pressed === 'true') return fail({ reason: 'locked style became selected', style });
        return r.status === 'PASS' ? pass({ style, escape: r.detail }) : r;
      });
      await step('lockedDialogContent', async () => {
        await btn.first().click();
        const dlg = page.locator('[data-testid="qp-locked-drawer"], [data-testid="qp-locked-dialog"]').first(); // refined R2: inline drawer (not a modal)
        await dlg.waitFor({ timeout: 8000 });
        const shotFile = path.join(dir, `${slug(`${name}-locked-dialog`)}.png`);
        await page.screenshot({ path: shotFile, mask: [page.getByText(creds.email, { exact: false })] }).then(() => shots.push(shotFile)).catch(() => {});
        const text = await dlg.innerText();
        const hasClose = await page.getByTestId('qp-locked-close').count();
        await page.getByTestId('qp-locked-close').first().click().catch(() => {});
        const noPriceLeak = !/₪\s?\d|\$\s?\d|€\s?\d/.test(text);
        return hasClose && noPriceLeak ? pass({ chars: text.length }) : fail({ hasClose: !!hasClose, noPriceLeak });
      });
    }
  } finally {
    await context.close();
  }
  return { name, lang: cfg.lang, mode: 'locked', checks, shots, errors };
}

export async function runAppPersona(args) {
  const base = resolveBaseUrl(args);
  const dir = outDir(args, 'app-persona');
  const envFile = String(args.env || process.env.T16_QA_ENV || DEFAULT_ENV);
  if (!fs.existsSync(envFile)) throw new Error(`persona env file not found: ${envFile}`);
  const env = readEnv(envFile);
  if (!String(env.VITE_SUPABASE_URL || '').includes(TEST_PROJECT_REF)) throw new Error('refusing to run: env file VITE_SUPABASE_URL is not the TEST project');
  const requested = [...String(args.personas || 'LOCAL_PRO,INTL_PRO').split(','), ...String(args['locked-personas'] || '').split(',')].filter(Boolean);
  const unknown = requested.filter((n) => !PERSONAS[n]);
  if (unknown.length) throw new Error(`refusing: persona(s) not in the IRON-DATA-001 allowlisted set: ${unknown.join(', ')}`);
  const names = String(args.personas || 'LOCAL_PRO,INTL_PRO').split(',').filter((n) => PERSONAS[n]);
  const lockedNames = String(args['locked-personas'] || '').split(',').filter((n) => PERSONAS[n]);
  const secrets = [...[...names, ...lockedNames].flatMap((n) => [env[PERSONAS[n].key], env[PERSONAS[n].pwdKey]])];
  const redact = makeRedactor(secrets);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const cells = [];
  try {
    for (const [n, locked] of [...names.map((x) => [x, false]), ...lockedNames.map((x) => [x, true])]) {
      const cfg = PERSONAS[n];
      const email = env[cfg.key];
      const password = env[cfg.pwdKey];
      if (!email || !password) { cells.push({ id: n, checks: { login: notTested(`${cfg.key} or ${cfg.pwdKey} missing in env file`) } }); continue; }
      try { assertAllowlistedPersona(email, n); } catch (e) { cells.push({ id: n, checks: { login: fail(String(e.message)) } }); continue; }
      const r = locked
        ? await runLockedPersona(browser, base, n, cfg, { email, password }, dir, redact)
        : await runPersona(browser, base, n, cfg, { email, password }, dir, args, redact);
      cells.push({ id: locked ? `${n}/locked` : n, ...r });
    }
  } finally {
    await browser.close();
  }
  const result = { kind: 'task16-app-persona', base, writes: !!args['allow-writes'], generatedAt: new Date().toISOString(), summary: summarize(cells), cells };
  const file = writeJson(path.join(dir, 'matrix.json'), result, redact);
  return { file, summary: JSON.parse(redact(JSON.stringify(result.summary))) };
}

if (isMain(import.meta.url)) {
  runAppPersona(parseArgs()).then((r) => {
    console.log(JSON.stringify({ matrix: r.file, totals: r.summary.totals, failures: r.summary.failures.length }, null, 2));
    process.exitCode = r.summary.totals.FAIL ? 1 : 0;
  }).catch((e) => { console.error(String(e && e.message ? e.message : e).slice(0, 300)); process.exitCode = 2; });
}
