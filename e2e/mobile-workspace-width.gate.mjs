// IRON-MOBILE-WIDTH-001 - MOBILE WORKSPACE WIDTH GATE (real Chromium, real layout, mobile emulation => overlay scrollbars). Usage:
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/mobile-workspace-width.gate.mjs <baseUrl> [outJson]
// Logs in as the allowlisted synthetic TEST personas (fail-closed loader), opens every authenticated mobile work screen at
// 320/360/390/412 in HE/Local/RTL and EN/International/LTR and measures:
//   viewport width | workspace (.dash-main-content) inset | screen card (.pf-screen) inset + its own inline padding | first content edge |
//   overflow | bottom-nav clearance | (Quote History) money-slot dead gap.
// More-menu destinations (Catalog/Settings) are opened via role=menuitem: the hidden desktop sidebar repeats the same visible label,
// so a text locator can resolve to an invisible node (the cause of the earlier 8 unreachable Catalog cells).
// Fails when: a canonical token is missing, the workspace inset differs from the token, a work screen's card padding differs from the
// screen-inset token (a second/other gutter), the first content edge is further from the viewport than workspace+screen insets (a nested
// gutter), the page overflows horizontally, the bottom nav overlaps, or a Quote History amount slot is wider than its widest amount.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] || 'http://localhost:5198';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, PERSONA_SUPER_ADMIN } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);

const TOL = 1; // px
const WIDTHS = [320, 360, 390, 412];
const MARKETS = [['he', 'HE/Local/RTL', PERSONA_A], ['en', 'EN/International/LTR', PERSONA_EN]];
const SURFACES = [
  { id: 'quotes', kind: 'work', open: async (p) => p.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().click() },
  { id: 'clients', kind: 'work', open: async (p) => p.getByRole('button', { name: /^(Clients|לקוחות)$/ }).first().click() },
  { id: 'finances', kind: 'work', open: async (p) => p.getByRole('button', { name: /^(Finances|פיננסים)$/ }).first().click() },
  { id: 'catalog', kind: 'work', marker: /(Catalog|קטלוג)/, open: async (p) => { await p.getByRole('button', { name: /^(More|עוד)$/ }).click(); await p.getByRole('menuitem', { name: /^(Catalog|קטלוג)$/ }).click(); } },
  { id: 'settings', kind: 'work', marker: /(Settings|הגדרות)/, open: async (p) => { await p.getByRole('button', { name: /^(More|עוד)$/ }).click(); await p.getByRole('menuitem', { name: /^(Settings|הגדרות)$/ }).click(); } },
  { id: 'new-quote', kind: 'form', open: async (p) => p.getByRole('button', { name: /^(New|חדש)$/ }).first().click() },
];

async function login(page, persona, lang) {
  await page.goto(`${base}/dashboard?lang=${lang}`);
  await page.waitForLoadState('load');
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 45000 });
  await email.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.waitForFunction(() => !!localStorage.getItem('sb-ljfizgrdyzxddswcedwr-auth-token'), { timeout: 30000 });
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ state: 'visible', timeout: 25000 });
}

const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const px = (v) => parseFloat(v) || 0;
  const inset = (el) => { const r = el.getBoundingClientRect(); return { left: +r.left.toFixed(2), right: +(vw - r.right).toFixed(2), width: +r.width.toFixed(2) }; };
  const root = getComputedStyle(document.documentElement);
  const token = (n) => { const v = root.getPropertyValue(n).trim(); return v ? px(v) : null; };
  const main = document.querySelector('.dash-main-content');
  const screen = document.querySelector('.dash-main-content .pf-screen');
  const nav = document.querySelector('.mobile-bottom-nav');
  const res = { vw, tokens: { workspace: token('--pf-mobile-workspace-inset'), screen: token('--pf-mobile-screen-inset') }, scrollOverflow: document.documentElement.scrollWidth - vw };
  if (main) { const cs = getComputedStyle(main); res.main = { ...inset(main), padL: px(cs.paddingLeft), padR: px(cs.paddingRight), padB: px(cs.paddingBottom) }; }
  if (screen) {
    const cs = getComputedStyle(screen); res.screen = { ...inset(screen), padL: px(cs.paddingLeft), padR: px(cs.paddingRight), isWork: screen.classList.contains('pf-work-screen') };
    const body = screen.querySelector('.pf-screen-body');
    // first RENDERED content box (zero-area nodes such as live regions / hidden helpers are not content and carry no gutter)
    const rendered = (host) => host && [...host.children].find((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const first = rendered(body) || rendered(screen);
    if (first) res.firstContent = inset(first);
  }
  if (nav) { const r = nav.getBoundingClientRect(); res.nav = { top: +r.top.toFixed(2), height: +r.height.toFixed(2) }; }
  // Quote History: every card amount slot must be no wider than the widest rendered amount (shared axis, no dead gap)
  const slots = [...document.querySelectorAll('.quote-card .pf-money-slot')];
  if (slots.length) {
    const inkWidth = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect().width; };
    const widths = slots.map((s) => s.getBoundingClientRect().width);
    const ink = slots.map(inkWidth);
    res.slots = { count: slots.length, slotMin: +Math.min(...widths).toFixed(2), slotMax: +Math.max(...widths).toFixed(2), widestInk: +Math.max(...ink).toFixed(2) };
    const card = document.querySelector('.quote-card'); const t = card && card.querySelector('.pf-money-slot');
    if (card && t) { const cr = card.getBoundingClientRect(); const sr = t.getBoundingClientRect(); res.slots.titleRoom = +(cr.width - sr.width).toFixed(2); }
  }
  return res;
});

// Admin uses the same authenticated shell (AdminScreenFrame => .pf-screen.pf-work-screen). Only a Local synthetic super-admin is
// allowlisted, so Admin cells run HE/Local/RTL only; EN Admin stays NOT_TESTED (no EN super-admin persona; none is created here).
const ADMIN_SURFACES = [
  { id: 'admin-overview', kind: 'work', marker: /(סקירה כללית|Admin Overview)/, open: async (p) => { await p.getByRole('button', { name: /^(More|עוד)$/ }).click(); await p.getByRole('menuitem', { name: /^(סקירה כללית|Admin Overview)$/ }).click(); } },
  { id: 'admin-users', kind: 'work', marker: /(משתמשים|Users)/, open: async (p) => { await p.getByRole('button', { name: /^(More|עוד)$/ }).click(); await p.getByRole('menuitem', { name: /^(משתמשים|Users)$/ }).click(); } },
];

const results = [];
const check = (cell, name, ok, detail) => { cell.checks.push({ name, ok, detail }); if (!ok) console.log(`  FAIL ${cell.id} :: ${name} ${detail ?? ''}`); };

const RUNS = [...MARKETS.map(([l, m, p]) => [l, m, p, SURFACES]), ['he', 'HE/Local/RTL/admin', PERSONA_SUPER_ADMIN, ADMIN_SURFACES]];
for (const [lang, market, persona, surfaces] of RUNS) {
  for (const w of WIDTHS) {
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: w, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    try { try { await login(page, persona, lang); } catch { await page.waitForTimeout(1500); await login(page, persona, lang); } } catch (e) { results.push({ id: `${market}/${w}/login`, checks: [{ name: 'login', ok: false, detail: String(e.message).slice(0, 120) }] }); console.log(`  FAIL ${market}/${w} login`); await browser.close(); continue; }
    for (const s of surfaces) {
      const cell = { id: `${market}/${w}px/${s.id}`, market, width: w, surface: s.id, checks: [] };
      try {
        await s.open(page); await page.waitForTimeout(1200);
        if (s.marker) { const h = await page.locator('.dash-main-content .pf-screen h2').first().innerText().catch(() => ''); check(cell, 'intended screen opened', s.marker.test(h), `h2=${h.slice(0, 60)}`); }
        const m = await measure(page); cell.measured = m;
        check(cell, 'canonical tokens exist (--pf-mobile-workspace-inset, --pf-mobile-screen-inset)', m.tokens.workspace != null && m.tokens.screen != null, JSON.stringify(m.tokens));
        const ws = m.tokens.workspace ?? 6; const sc = m.tokens.screen ?? 8;
        check(cell, 'no horizontal overflow', m.scrollOverflow <= TOL, `overflow=${m.scrollOverflow}`);
        check(cell, `workspace inset == token ${ws}px on both sides`, !!m.main && Math.abs(m.main.left - 0) <= TOL && Math.abs(m.main.right - 0) <= TOL && Math.abs(m.main.padL - ws) <= TOL && Math.abs(m.main.padR - ws) <= TOL, m.main ? `padL=${m.main.padL} padR=${m.main.padR}` : 'no .dash-main-content');
        check(cell, `screen surface inset == workspace inset ${ws}px (no extra outer gutter)`, !!m.screen && Math.abs(m.screen.left - ws) <= TOL && Math.abs(m.screen.right - ws) <= TOL, m.screen ? `left=${m.screen.left} right=${m.screen.right}` : 'no .pf-screen');
        if (s.kind === 'work') {
          check(cell, `work-screen card padding == screen token ${sc}px both sides (single canonical inset)`, !!m.screen && m.screen.isWork && Math.abs(m.screen.padL - sc) <= TOL && Math.abs(m.screen.padR - sc) <= TOL, m.screen ? `padL=${m.screen.padL} padR=${m.screen.padR} isWork=${m.screen.isWork}` : '');
          check(cell, `first content edge <= workspace+screen inset (${ws + sc}px) - no nested gutter`, !!m.firstContent && m.firstContent.left <= ws + sc + TOL && m.firstContent.right <= ws + sc + TOL, m.firstContent ? `left=${m.firstContent.left} right=${m.firstContent.right}` : 'no content');
        } else {
          check(cell, 'form screen adds no second horizontal gutter', !!m.screen && m.screen.padL <= TOL && m.screen.padR <= TOL, m.screen ? `padL=${m.screen.padL} padR=${m.screen.padR}` : '');
        }
        if (m.nav && m.main) check(cell, 'bottom-nav clearance is vertical (main padding-bottom >= nav height)', m.main.padB >= m.nav.height - TOL, `padB=${m.main.padB} nav=${m.nav.height}`);
        if (s.id === 'quotes' && m.slots) check(cell, 'money slot == widest rendered amount (no dead gap, shared axis)', m.slots.slotMax - m.slots.widestInk <= 2 && m.slots.slotMax - m.slots.slotMin <= TOL, JSON.stringify(m.slots));
      } catch (e) { check(cell, 'surface reachable', false, String(e.message).slice(0, 120)); }
      cell.status = cell.checks.every((c) => c.ok) ? 'PASS' : 'FAIL';
      results.push(cell);
      // return to a neutral state (Quotes) so the next surface opens from the same base
      try { await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().click({ timeout: 4000 }); } catch { /* new-quote form may prompt; next open() re-validates */ }
    }
    await browser.close();
  }
}

const failed = results.filter((r) => r.status !== 'PASS');
const summary = { gate: 'MOBILE WORKSPACE WIDTH GATE', base, at: new Date().toISOString(), widths: WIDTHS, cells: results.length, failed: failed.length, verdict: failed.length === 0 ? 'PASS' : 'FAIL', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`MOBILE WORKSPACE WIDTH GATE: ${summary.verdict} (${results.length - failed.length}/${results.length} cells PASS)`);
process.exit(failed.length ? 1 : 0);
