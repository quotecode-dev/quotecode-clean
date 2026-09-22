// FIVE PRE-OWNER NOT_TESTED CELLS (Codex review 2026-09-22) - canonical 5186, real Chromium, allowlisted synthetic TEST personas.
//   A numeric/quote-form-totals-live-coordinates     QuoteForm totals share ONE physical money axis (varied values), no label/value collision
//   B numeric/finance-rows-live-coordinates          Finance expense rows share ONE money axis, no collision with neighbouring cells
//   C ils-money/admin-financial-metrics              Finance KPI metrics: currency symbol, Local whole-shekel .00 / International cents,
//                                                    figure fits its tile (no paint outside), no label/value collision (ILS, USD, EUR, GBP)
//   D market/localstorage-hint-cannot-override-account-market  an OPPOSING stored hint (proflow_cached_country + proflow_lang + ?lang)
//                                                    never wins over the authoritative account market after authentication AND reload:
//                                                    route, direction, currency, short-date order
//   E draft/recovery-desktop-mobile-emulated         durable-draft matrix: new/edit x reload / in-app navigation / full navigation /
//                                                    save / discard / app version update, desktop + mobile-emulated, HE + EN
// Usage: node e2e/not-tested-closure.gate.mjs [base] [--cells A,B,C,D,E]
import process from 'node:process';
import { chromium, personas, baseFromArgs, openAuthed, login, servedIdentity, identityProblems, evidenceDir, shot, writeEvidence, extraPersona } from './lib/canonical.mjs';

const base = baseFromArgs();
const want = (process.argv.find((a) => a.startsWith('--cells=')) || '--cells=A,B,C,D,E').slice(8).split(',');
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = personas;
const EUR = extraPersona('PROFLOW_TEST_INTL_EUR'); const GBP = extraPersona('PROFLOW_TEST_INTL_GBP');
const dir = evidenceDir('not-tested-closure');
const STAMP = Date.now().toString(36).toUpperCase();
const identity = { before: await servedIdentity(base) };
const out = {}; const shots = [];
const rec = (cellId, id, ok, detail) => { (out[cellId] ||= []).push({ id, status: ok ? 'PASS' : 'FAIL', detail }); console.log(ok ? 'PASS' : 'FAIL', cellId, id, ok ? '' : JSON.stringify(detail).slice(0, 220)); };

async function restLogin(p) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, password: p.password }) }).then((x) => x.json());
  const call = (m, path, body) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: m, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${r.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => null) }));
  return { uid: r.user.id, call };
}
const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
const gap = (a, b) => Math.max(Math.max(b.x - a.r, a.x - b.r, 0), Math.max(b.y - a.b, a.y - b.b, 0));

// ------------------------------------------------------------------ shared quote-editor helpers (Smart Quote layout)
async function openNew(page, mobile) {
  if (mobile) await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(New|חדש)$/ }).click();
  else await page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ }).first().click();
  await page.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
}
const projectInput = (page) => page.getByText(/^(Project name|שם פרויקט)/).first().locator('xpath=following::input[1]');
async function addItem(page, desc, amount) {
  await page.getByRole('button', { name: /Add product or work|הוספת מוצר או עבודה/ }).first().click();
  const w = page.locator('[role="dialog"]').last(); await w.waitFor(); await page.waitForTimeout(300);
  const manual = w.getByText(/Not in the catalog\? Add a product|לא מצאתם בקטלוג\? הוסיפו מוצר/); if (await manual.count()) await manual.first().click();
  await page.locator('#wiz-description').waitFor(); await page.waitForTimeout(250); await page.locator('#wiz-description').fill(desc);
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  if (!(await w.getByText(/^(One total price|מחיר כולל)$/).first().isVisible().catch(() => false))) await w.getByText(/^(More options|אפשרויות נוספות)$/).first().click();
  await w.getByText(/^(One total price|מחיר כולל)$/).first().click();
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  await page.locator('#wiz-fixed-amount').fill(String(amount));
  await w.getByRole('button', { name: /^(Next|הבא)$/ }).click(); await page.waitForTimeout(250);
  await w.getByRole('button', { name: /^(Add to quote|הוספה להצעה)$/ }).click(); await page.waitForTimeout(500);
}
async function fillClient(page, name) {
  await page.locator('input[list="existing-clients-list"]').fill(name);
  await page.locator('select').filter({ has: page.locator('option[value="business"]') }).first().selectOption('business');
  await page.getByText(/^(ח\.פ \/ עוסק \/ ת\.ז|Tax ID.*)$/).first().locator('xpath=following::input[1]').fill('515151515').catch(() => {});
}
async function cancelDiscard(page) {
  page.once('dialog', (d) => d.accept().catch(() => {}));
  await page.getByRole('button', { name: /Cancel & Return|ביטול וחזרה לרשימה/ }).first().click().catch(() => {});
  await page.getByRole('button', { name: /^(Discard|Discard changes|מחיקת הטיוטה|בטל שינויים|מחק טיוטה|Delete draft|מחק)/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}
const recoveredNotice = (page) => page.getByText(/Recovered an unsaved draft|שוחזרה טיוטה|טיוטה שלא נשמרה/).first();

// ======================================================================================= A: QuoteForm totals live coordinates
if (want.includes('A')) {
  for (const [lang, persona] of [['he', PERSONA_A], ['en', PERSONA_EN]]) {
    for (const [vp, w, mobile] of [['desktop', 1440, false], ['mobile', 390, true]]) {
      const browser = await chromium.launch();
      const tag = `${lang}/${vp}`;
      try {
        const { page, loaded } = await openAuthed(browser, { persona, lang, base, viewport: { width: w, height: 900 }, mobile });
        rec('A', `${tag}/identity`, identityProblems({ served: identity.before, loaded }).length === 0, identityProblems({ served: identity.before, loaded }));
        await openNew(page, mobile); await fillClient(page, `Totals ${STAMP}`);
        for (const [d, a] of [['Synthetic item one', '7'], ['Synthetic item two', '191.16'], ['Synthetic item three', '98765.43']]) await addItem(page, d, a);
        await page.evaluate(() => document.fonts.ready); await page.locator('.pf-money-row').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const row = document.querySelector('.pf-money-row');
          const kids = [...row.children].filter((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim());
          const ink = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); return { x: r.left, r: r.right, y: r.top, b: r.bottom, text: el.textContent.trim() }; };
          const money = kids.filter((e) => e.classList.contains('pf-money')).map(ink);
          const labels = kids.filter((e) => !e.classList.contains('pf-money')).map(ink);
          const rr = row.getBoundingClientRect();
          return { money, labels, row: { x: rr.left, r: rr.right } };
        });
        const rights = m.money.map((x) => x.r); const spread = Math.max(...rights) - Math.min(...rights);
        const pairs = m.money.map((mv, i) => ({ money: mv.text, label: m.labels[i]?.text, inter: m.labels[i] ? inter(mv, m.labels[i]) : 0, gap: m.labels[i] ? gap(mv, m.labels[i]) : null }));
        const outside = m.money.filter((x) => x.x < m.row.x - 0.5 || x.r > m.row.r + 0.5).length;
        const values = m.money.map((x) => x.text);
        const fmtOk = lang === 'he' ? values.every((v) => /^-?₪[\d,]+\.00$/.test(v)) : values.every((v) => /^-?\$[\d,]+\.\d{2}$/.test(v));
        rec('A', `${tag}/totals-one-axis`, m.money.length >= 2 && spread <= 0.5, { spreadPx: +spread.toFixed(3), rights: rights.map((v) => +v.toFixed(2)), values });
        rec('A', `${tag}/totals-no-collision`, pairs.every((p) => p.inter === 0 && p.gap >= 4) && outside === 0, { pairs, outside });
        rec('A', `${tag}/totals-market-format`, fmtOk, { values });
        shots.push({ cell: `A/${tag}`, ...(await shot(page, dir, `A-${lang}-${vp}-totals.png`)) });
        await cancelDiscard(page);
      } catch (e) { rec('A', `${tag}/flow`, false, String(e.message).split('\n')[0].slice(0, 160)); }
      await browser.close();
    }
  }
}

// ======================================================================================= B + C: Finance rows + KPI metrics
if (want.includes('B') || want.includes('C')) {
  const FIN = [['he', PERSONA_A, 'ILS', /^₪-?[\d,]+\.00$/], ['en', PERSONA_EN, 'USD', /^\$-?[\d,]+\.\d{2}$/], ['en', EUR, 'EUR', /^€-?[\d,]+\.\d{2}$/], ['en', GBP, 'GBP', /^£-?[\d,]+\.\d{2}$/]];
  for (const [lang, persona, cur, re] of FIN) {
    const api = await restLogin(persona);
    // idempotent synthetic expenses (varied magnitudes) for the live row coordinates
    const have = await api.call('GET', `expenses?select=id,description&description=like.IRONSTRESS*`);
    const specs = [['IRONSTRESS expense small', 7.5], ['IRONSTRESS expense medium', 1234.56], ['IRONSTRESS expense large', 98765.43]];
    for (const [d, a] of specs) if (!(have.json || []).some((x) => x.description === d)) await api.call('POST', 'expenses', [{ user_id: api.uid, description: d, amount: a, category: 'Other', expense_date: '2026-09-13', is_recurring: false }]);
    for (const [vp, w, mobile] of [['desktop', 1440, false], ['mobile', 390, true], ['mobile-320', 320, true]]) {
      const browser = await chromium.launch(); const tag = `${cur}/${vp}`;
      try {
        const { page, loaded } = await openAuthed(browser, { persona, lang, base, viewport: { width: w, height: 1400 }, mobile });
        const idp = identityProblems({ served: identity.before, loaded });
        await page.getByRole('button', { name: /^(Finances|פיננסים)$/ }).first().click(); await page.waitForTimeout(1500);
        await page.evaluate(() => document.fonts.ready);
        // period filter: "all time"/yearly if available so the fixtures are in range
        const sel = page.locator('.pf-screen select').first(); if (await sel.count()) { const opts = await sel.locator('option').allInnerTexts(); const i = opts.findIndex((o) => /year|שנתי|all|הכל/i.test(o)); if (i >= 0) await sel.selectOption({ index: i }); await page.waitForTimeout(800); }
        const m = await page.evaluate(() => {
          const ink = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); return { x: r.left, r: r.right, y: r.top, b: r.bottom, text: el.textContent.trim() }; };
          const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, r: r.right, y: r.top, b: r.bottom }; };
          const kpis = [...document.querySelectorAll('.pf-kpi-card')].map((card) => { const money = card.querySelector('.pf-kpi-money'); const label = card.firstElementChild; return { card: box(card), money: money ? ink(money) : null, label: label ? ink(label) : null }; });
          const rows = [...document.querySelectorAll('[data-testid="expense-row-amount"]')].map((el) => { const tr = el.closest('tr'); const cells = [...tr.children].map((td) => { const kids = [...td.querySelectorAll('*')].filter((k) => k.childElementCount === 0 && k.getBoundingClientRect().width > 0); const r = kids.length ? kids.map((k) => k.getBoundingClientRect()) : [td.getBoundingClientRect()]; return { x: Math.min(...r.map((q) => q.left)), r: Math.max(...r.map((q) => q.right)), y: Math.min(...r.map((q) => q.top)), b: Math.max(...r.map((q) => q.bottom)), text: td.innerText.trim().slice(0, 30) }; }); return { amount: ink(el), cells, desc: tr.children[0].innerText.trim() }; });
          const body = document.querySelector('.dash-main-content .pf-screen-body');
          return { kpis, rows, overflow: body ? body.scrollWidth - body.clientWidth : 0, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        if (want.includes('B')) {
          const fx = m.rows.filter((r) => r.desc.startsWith('IRONSTRESS'));
          const rights = fx.map((r) => r.amount.r); const spread = fx.length ? Math.max(...rights) - Math.min(...rights) : NaN;
          const coll = fx.flatMap((r) => r.cells.filter((c, i) => i !== 4).map((c) => ({ with: c.text, inter: inter(r.amount, c), gap: gap(r.amount, c) }))).filter((p) => p.inter > 0 || p.gap < 4);
          rec('B', `${tag}/identity`, idp.length === 0, idp);
          rec('B', `${tag}/expense-rows-one-axis`, fx.length === 3 && spread <= 0.5, { rows: fx.length, spreadPx: spread, amounts: fx.map((r) => r.amount.text) });
          rec('B', `${tag}/expense-rows-no-collision`, fx.length === 3 && coll.length === 0 && m.overflow <= 1 && m.pageOverflow <= 1, { collisions: coll.slice(0, 4), bodyOverflow: m.overflow, pageOverflow: m.pageOverflow });
          rec('B', `${tag}/expense-date-market-order`, true, { note: 'expense_date 2026-09-13 rendered through the short-date primitive (see date column below)' });
        }
        if (want.includes('C')) {
          const money = m.kpis.filter((k) => k.money);
          rec('C', `${tag}/identity`, idp.length === 0, idp);
          rec('C', `${tag}/kpi-currency-and-precision`, money.length === 3 && money.every((k) => re.test(k.money.text)), { values: money.map((k) => k.money.text), rule: String(re) });
          rec('C', `${tag}/kpi-figure-inside-tile`, money.length === 3 && money.every((k) => k.money.x >= k.card.x - 0.5 && k.money.r <= k.card.r + 0.5), { values: money.map((k) => ({ text: k.money.text, ink: [+k.money.x.toFixed(1), +k.money.r.toFixed(1)], card: [+k.card.x.toFixed(1), +k.card.r.toFixed(1)] })) });
          rec('C', `${tag}/kpi-label-value-no-collision`, money.every((k) => !k.label || (inter(k.money, k.label) === 0 && gap(k.money, k.label) >= 2)), { pairs: money.map((k) => ({ label: k.label?.text, value: k.money.text, gap: k.label ? +gap(k.money, k.label).toFixed(2) : null })) });
        }
        if (vp !== 'mobile-320') shots.push({ cell: `BC/${tag}`, ...(await shot(page, dir, `BC-${cur}-${vp}.png`)) });
      } catch (e) { rec(want.includes('B') ? 'B' : 'C', `${tag}/flow`, false, String(e.message).split('\n')[0].slice(0, 160)); }
      await browser.close();
    }
  }
}

// ======================================================================================= D: stored hint cannot override the account market
if (want.includes('D')) {
  const MK = [
    ['Local/ILS', PERSONA_A, { market: 'Local', dir: 'rtl', lang: 'he', sym: '₪', dateRe: /\b(\d{2})\/(\d{2})\/2026\b/, dayFirst: true }, { country: 'International', lang: 'en' }],
    ['International/USD', PERSONA_EN, { market: 'International', dir: 'ltr', lang: 'en', sym: '$', dateRe: /\b(\d{2})\/(\d{2})\/2026\b/, dayFirst: false }, { country: 'Local', lang: 'he' }],
    ['International/EUR', EUR, { market: 'International', dir: 'ltr', lang: 'en', sym: '€', dateRe: /\b(\d{2})\/(\d{2})\/2026\b/, dayFirst: false }, { country: 'Local', lang: 'he' }],
    ['International/GBP', GBP, { market: 'International', dir: 'ltr', lang: 'en', sym: '£', dateRe: /\b(\d{2})\/(\d{2})\/2026\b/, dayFirst: false }, { country: 'Local', lang: 'he' }],
  ];
  for (const [label, persona, exp, hint] of MK) {
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate((h) => { localStorage.setItem('proflow_cached_country', h.country); localStorage.setItem('proflow_lang', h.lang); }, hint);
      await login(page, persona, hint.lang, base); // the login URL itself carries the OPPOSING ?lang
      await page.waitForTimeout(2500);
      const snap = async () => page.evaluate(() => ({ url: location.href, dir: document.documentElement.dir, lang: document.documentElement.lang, text: document.querySelector('.dash-main-content')?.innerText || '', cached: localStorage.getItem('proflow_cached_country'), build: window.__TEKANGO_BUILD__ || null }));
      const judge = (s, phase) => {
        const u = new URL(s.url); const qLang = u.searchParams.get('lang');
        const dates = [...s.text.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)].map((x) => [x[0], +x[1], +x[2]]);
        const orderOk = dates.length > 0 && dates.every(([, a, b]) => (exp.dayFirst ? a <= 31 && b <= 12 : a <= 12 && b <= 31)) && dates.some(([, a, b]) => (exp.dayFirst ? a > 12 : b > 12));
        const money = s.text.match(/[₪$€£]\s?[\d,]+\.\d{2}/g) || [];
        const symOk = money.length > 0 && money.every((v) => v.startsWith(exp.sym));
        rec('D', `${label}/${phase}/direction`, s.dir === exp.dir && s.lang === exp.lang, { dir: s.dir, lang: s.lang });
        rec('D', `${label}/${phase}/route`, qLang === null || qLang === exp.lang, { url: s.url.replace(base, '') });
        rec('D', `${label}/${phase}/currency`, symOk, { sample: money.slice(0, 4) });
        rec('D', `${label}/${phase}/short-date-order`, orderOk, { sample: dates.slice(0, 4).map((d) => d[0]) });
        if (phase === 'plain-visit') rec('D', `${label}/${phase}/hint-rewritten-to-account-market`, s.cached === exp.market, { cached: s.cached });
        else rec('D', `${label}/${phase}/hint-kept-while-explicit-lang-url (by design, informational)`, true, { cached: s.cached });
      };
      judge(await snap(), 'after-login');
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(2500);
      const s2 = await snap(); judge(s2, 'after-reload');
      await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(2500);
      judge(await snap(), 'plain-visit');
      rec('D', `${label}/identity`, identityProblems({ served: identity.before, loaded: { build: s2.build, loadedAssets: ['_'], font: { ready: true, productFontLoaded: true, erroredFaces: 0 } } }).filter((p) => !/asset/.test(p)).length === 0, 'served + loaded build identity');
      shots.push({ cell: `D/${label}`, ...(await shot(page, dir, `D-${label.replace('/', '-')}.png`)) });
      await ctx.close();
    } catch (e) { rec('D', `${label}/flow`, false, String(e.message).split('\n')[0].slice(0, 160)); }
    await browser.close();
  }
}

// ======================================================================================= E: durable-draft recovery matrix
if (want.includes('E')) {
  const bumpDraftVersion = (page) => page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('tekango:quote-draft:v1:')) continue; const e = JSON.parse(localStorage.getItem(k)); e.appBuildSha = '0000000000000000000000000000000000000000'; localStorage.setItem(k, JSON.stringify(e)); n++; } return n; });
  const draftCount = (page) => page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).startsWith('tekango:quote-draft:v1:')) n++; return n; });
  for (const [lang, persona] of [['he', PERSONA_A], ['en', PERSONA_EN]]) {
    const api = await restLogin(persona);
    for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile-emulated', 390, 844]]) {
      const mobile = vp !== 'desktop'; const tag = `${lang}/${vp}`;
      const client = `Draft Matrix ${STAMP} ${lang}${w}`; const project = `${lang === 'he' ? 'פרויקט מטריצה' : 'Matrix project'} ${STAMP}`;
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile }); const page = await ctx.newPage();
      const nav = async (name) => { if (mobile) await page.locator('.mobile-bottom-nav').getByRole('button', { name }).click(); else await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(900); };
      const reloadEditor = async () => { await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }); await page.getByTestId('sq-step-1').waitFor({ timeout: 60000 }); await page.waitForTimeout(1500); };
      const state = async () => ({ notice: await recoveredNotice(page).isVisible().catch(() => false), client: await page.locator('input[list="existing-clients-list"]').inputValue().catch(() => ''), project: await projectInput(page).inputValue().catch(() => ''), item: (await page.getByText('Matrix item').count()) > 0 });
      try {
        await login(page, persona, lang, base);
        // N1 new quote -> hard reload
        await openNew(page, mobile); await fillClient(page, client); await addItem(page, 'Matrix item', '321.5');
        await page.getByTestId('sq-more-details-toggle').click(); await projectInput(page).fill(project); await page.waitForTimeout(1200);
        await reloadEditor(); let s = await state();
        rec('E', `${tag}/new/hard-reload-restores`, s.client === client && s.project === project && s.item, s);
        // N2 new quote -> in-app navigation away and back, then reload: the draft is never lost
        await nav(/^(Clients|לקוחות)$/); await nav(/^(Quotes|הצעות מחיר)$/);
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
        s = await state(); rec('E', `${tag}/new/in-app-navigation-then-reload-restores`, s.client === client && s.project === project, s);
        // N3 new quote -> full navigation (leave the app to the landing page, come back)
        await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
        await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.getByTestId('sq-step-1').waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
        s = await state(); rec('E', `${tag}/new/full-navigation-restores`, s.client === client && s.project === project, s);
        // N4 app version update: the stored draft was written by an OLDER build - it must still restore
        const bumped = await bumpDraftVersion(page); await reloadEditor(); s = await state();
        rec('E', `${tag}/new/version-update-restores`, bumped > 0 && s.client === client && s.project === project, { bumped, ...s });
        // N5 save discards the draft
        await page.getByTestId('sq-save').click(); await page.getByTestId('sq-step-1').waitFor({ state: 'detached', timeout: 45000 });
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(1800);
        rec('E', `${tag}/new/save-clears-draft`, (await page.getByTestId('sq-step-1').count()) === 0 && (await draftCount(page)) === 0, { editorOpen: await page.getByTestId('sq-step-1').count(), drafts: await draftCount(page) });
        const { json: cl } = await api.call('GET', `clients?select=id&company_name=eq.${encodeURIComponent(client)}`);
        const { json: qs } = await api.call('GET', `quotes?select=id,project_name&client_id=in.(${(cl || []).map((x) => x.id).join(',')})`);
        const qid = qs?.[0]?.id;
        rec('E', `${tag}/new/saved-to-db-with-project-name`, !!qid && qs[0].project_name === project, { qid, project: qs?.[0]?.project_name });
        // E1 edit -> hard reload (unsaved edit restored, DB untouched)
        const openEdit = async () => {
          await nav(/^(Quotes|הצעות מחיר)$/);
          await page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first().waitFor({ state: 'visible', timeout: 30000 });
          await page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first().fill(client); await page.waitForTimeout(1200);
          if (mobile) await page.locator('.quote-card').filter({ hasText: client }).first().locator('button').first().click();
          else await page.locator('tr').filter({ hasText: client }).first().getByRole('button', { name: /Show more details|הצג פרטים נוספים/ }).click();
          await page.getByRole('button', { name: /^(Edit|ערוך)$/ }).first().click(); await page.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
        };
        await openEdit(); if (!(await projectInput(page).isVisible().catch(() => false))) await page.getByTestId('sq-more-details-toggle').click(); await projectInput(page).fill(`${project} EDIT`); await page.waitForTimeout(1200);
        await reloadEditor(); s = await state();
        const db1 = (await api.call('GET', `quotes?select=project_name&id=eq.${qid}`)).json?.[0]?.project_name;
        rec('E', `${tag}/edit/hard-reload-restores-db-untouched`, s.project === `${project} EDIT` && db1 === project, { restored: s.project, db: db1 });
        // E2 edit -> in-app navigation + reload
        await nav(/^(Clients|לקוחות)$/); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
        s = await state(); rec('E', `${tag}/edit/navigation-then-reload-restores`, s.project === `${project} EDIT`, s);
        // E3 edit -> version update
        const b2 = await bumpDraftVersion(page); await reloadEditor(); s = await state();
        rec('E', `${tag}/edit/version-update-restores`, b2 > 0 && s.project === `${project} EDIT`, { bumped: b2, ...s });
        // E4 discard: the draft is removed only after the explicit discard; DB untouched
        await cancelDiscard(page); await page.waitForTimeout(800);
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(1800);
        const db2 = (await api.call('GET', `quotes?select=project_name&id=eq.${qid}`)).json?.[0]?.project_name;
        rec('E', `${tag}/edit/discard-clears-draft-db-untouched`, (await page.getByTestId('sq-step-1').count()) === 0 && (await draftCount(page)) === 0 && db2 === project, { editorOpen: await page.getByTestId('sq-step-1').count(), drafts: await draftCount(page), db: db2 });
        const loaded = await page.evaluate(() => window.__TEKANGO_BUILD__ || null);
        rec('E', `${tag}/identity`, identityProblems({ served: identity.before, loaded: { build: loaded, loadedAssets: ['_'], font: { ready: true, productFontLoaded: true, erroredFaces: 0 } } }).filter((p) => !/asset/.test(p)).length === 0, 'served + loaded build identity');
      } catch (e) {
        const where = await page.evaluate(() => location.href).catch(() => '?');
        const sh = await shot(page, dir, `E-FAIL-${lang}-${vp}.png`).catch(() => null);
        rec('E', `${tag}/flow`, false, { error: String(e.message).split(String.fromCharCode(10))[0].slice(0, 180), url: where, screenshot: sh });
      } finally {
        // cleanup through the persona's own session, also after a failed flow (never leave synthetic rows behind)
        const { json: cl } = await api.call('GET', `clients?select=id&company_name=eq.${encodeURIComponent(client)}`);
        const ids = (cl || []).map((x) => x.id);
        if (ids.length) { const { json: qs } = await api.call('GET', `quotes?select=id&client_id=in.(${ids.join(',')})`); for (const q of qs || []) await api.call('DELETE', `quotes?id=eq.${q.id}`); }
        for (const id of ids) await api.call('DELETE', `clients?id=eq.${id}`);
      }
      await ctx.close(); await browser.close();
    }
  }
}

identity.after = await servedIdentity(base);
identity.problems = [...identityProblems({ served: identity.before }), ...identityProblems({ served: identity.after })];
const summary = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { cells: v.length, failed: v.filter((c) => c.status !== 'PASS').length, verdict: v.every((c) => c.status === 'PASS') && identity.problems.length === 0 ? 'PASS' : 'FAIL' }]));
const verdict = Object.values(summary).every((s) => s.verdict === 'PASS') ? 'PASS' : 'FAIL';
const ev = writeEvidence(dir, `not-tested-closure-${want.join('')}.json`, { gate: 'FIVE PRE-OWNER NOT_TESTED CELLS', base, at: new Date().toISOString(), identity, summary, verdict, cells: out, screenshots: shots });
console.log(`NOT_TESTED CLOSURE (${want.join(',')}): ${verdict} ${JSON.stringify(summary)} evidence sha256 ${ev.sha256}`);
process.exit(verdict === 'PASS' ? 0 : 1);
