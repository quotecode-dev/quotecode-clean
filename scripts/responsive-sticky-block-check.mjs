// Responsive sticky screen-block parity check (TEST ONLY, canonical 5186).
// For every viewport class x screen: Header + the screen's static block must not
// move when the inner body scrolls; the inner body owns the scroll; no outer
// page/main-content scroll; Chat opens after scrolling; no horizontal overflow.
// Read-only. Writes release-evidence/responsive-sticky-block.json.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { PERSONA_A, PERSONA_SUPER_ADMIN } from '../e2e/testPersonas.js';

const BASE = 'http://192.168.1.189:5186';
const VIEWPORTS = { 360: [360, 740], 390: [390, 844], 412: [412, 915], '768x1024': [768, 1024], '820x1180': [820, 1180], '1024x768': [1024, 768], '1440x900': [1440, 900] };
const compact = (vp) => ['360', '390', '412', '768x1024'].includes(vp); // <=768px: bottom-nav layout; 820+ uses the sidebar layout
const cells = [];

async function login(page, persona) {
  await page.goto(`${BASE}/dashboard?lang=he`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 45000 });
  await email.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /התחבר/ }).click();
  await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
  await page.waitForTimeout(1200);
}

const measure = (page) => page.evaluate(() => {
  const r = (e) => (e ? e.getBoundingClientRect() : null);
  const hdr = r(document.querySelector('.dash-upper-section'));
  const screen = document.querySelector('.pf-screen');
  if (!screen) return { hasScreen: false };
  const body = screen.querySelector(':scope > .pf-screen-body');
  const kids = [...screen.children];
  const bodyIdx = body ? kids.indexOf(body) : -1;
  const statics = bodyIdx > 0 ? kids.slice(0, bodyIdx) : kids;
  const vis = statics.filter((e) => e.getBoundingClientRect().height > 0);
  const first = vis[0]; const last = vis[vis.length - 1];
  const main = document.querySelector('.dash-main-content');
  return {
    hasScreen: true, hasBody: !!body,
    hdrTop: hdr && Math.round(hdr.top * 10) / 10, hdrBottom: hdr && Math.round(hdr.bottom * 10) / 10,
    staticTop: first && Math.round(r(first).top * 10) / 10, staticBottom: last && Math.round(r(last).bottom * 10) / 10,
    bodyTop: body && Math.round(r(body).top * 10) / 10,
    bodyOverflow: body ? body.scrollHeight > body.clientHeight + 1 : false,
    bodyOverflowY: body ? getComputedStyle(body).overflowY : null,
    bodyScrollTop: body ? Math.round(body.scrollTop) : 0,
    winScrollY: Math.round(window.scrollY), mainScrollTop: main ? Math.round(main.scrollTop) : 0,
    mainOverflows: main ? main.scrollHeight > main.clientHeight + 1 : false,
    docOverflowsY: document.documentElement.scrollHeight > window.innerHeight + 1,
    hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    // A child squashed by flex shrink (content much taller than its box) is untappable.
    squashed: body ? [...body.children].filter((c) => c.getBoundingClientRect().height > 0 && c.scrollHeight > 20 && c.clientHeight < c.scrollHeight * 0.5).length : 0,
    bottomClear: body ? Math.round((window.innerHeight - r(body).bottom)) : null,
  };
});

async function checkScreen(page, name, vp) {
  await page.waitForSelector('.pf-screen', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const a = await measure(page);
  if (!a.hasScreen) { cells.push({ screen: name, viewport: vp, status: 'FAIL', reason: 'no .pf-screen' }); return; }
  // scroll the inner body (if it can scroll) AND attempt an outer wheel scroll
  await page.locator('.pf-screen > .pf-screen-body').first().evaluate((e) => { e.scrollTop = 500; }).catch(() => {});
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  const b = await measure(page);
  const reasons = [];
  if (!a.hasBody) reasons.push('no inner body');
  if (Math.abs(a.hdrTop - b.hdrTop) > 1) reasons.push(`Header moved ${a.hdrTop}->${b.hdrTop}`);
  if (Math.abs(a.staticTop - b.staticTop) > 1 || Math.abs(a.staticBottom - b.staticBottom) > 1) reasons.push(`static block moved ${a.staticTop}->${b.staticTop}`);
  if (Math.abs(a.bodyTop - a.staticBottom) > 1) reasons.push(`body top ${a.bodyTop} != static bottom ${a.staticBottom}`);
  if (a.winScrollY || b.winScrollY || b.mainScrollTop) reasons.push(`outer scroll owns scrolling (win ${b.winScrollY}, main ${b.mainScrollTop})`);
  if (a.mainOverflows && a.bodyOverflow) reasons.push('double scroll (main + body both overflow)');
  if (a.hOverflow || b.hOverflow) reasons.push('horizontal overflow');
  if (a.bodyOverflow && !b.bodyScrollTop) reasons.push('body overflows but did not scroll');
  if (a.squashed) reasons.push(`${a.squashed} body children squashed by flex shrink`);
  if (compact(vp) && a.bodyOverflow && a.bottomClear !== null && a.bottomClear < 40) reasons.push(`body bottom under bottom-nav (${a.bottomClear}px)`);
  // Chat reachable after scroll
  let chat = false;
  try {
    await page.locator('.dash-header-ai-btn:visible').first().click({ timeout: 5000 });
    chat = await page.getByRole('dialog', { name: /AI Chat|צ’אט AI/ }).isVisible();
    await page.getByRole('dialog').getByRole('button', { name: /^סגור$/ }).first().click().catch(() => {});
  } catch { chat = false; }
  if (!chat) reasons.push('AI Chat not reachable after scroll');
  cells.push({ screen: name, viewport: vp, status: reasons.length ? 'FAIL' : 'PASS', reasons, gapHeaderToStatic: Math.round((a.staticTop - a.hdrBottom) * 10) / 10, bodyOverflow: a.bodyOverflow, before: a, after: { hdrTop: b.hdrTop, staticTop: b.staticTop, bodyScrollTop: b.bodyScrollTop, winScrollY: b.winScrollY } });
}

const nav = async (page, vp, labelRe, more) => {
  if (!compact(vp)) { await page.locator('.dash-sidebar').getByRole('button', { name: labelRe }).first().click(); return; }
  if (vp === '1024x768') { await page.locator('.dash-sidebar').getByRole('button', { name: labelRe }).first().click(); return; }
  if (more) { await page.getByRole('button', { name: /^עוד$/ }).click(); await page.getByRole('menuitem', { name: labelRe }).click(); }
  else await page.locator('.mobile-bottom-nav').getByRole('button', { name: labelRe }).first().click();
};

const browser = await chromium.launch();
try {
  for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
    // business screens (regular TEST user)
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await login(page, PERSONA_A);
      const screens = [['quote-history', /^הצעות מחיר$/, false], ['clients', /^לקוחות$/, false], ['finances', /פיננסים/, false], ['settings', /הגדרות/, true], ['catalog', /קטלוג/, true]];
      for (const [name, re, more] of screens) {
        try { await nav(page, vp, re, more); await checkScreen(page, name, vp); }
        catch (e) { cells.push({ screen: name, viewport: vp, status: 'FAIL', reasons: ['harness: ' + String(e.message).split(String.fromCharCode(10))[0].slice(0, 160)] }); }
      }
      // New Quote
      try {
      const cta = compact(vp) ? page.locator('.mobile-bottom-nav').getByRole('button', { name: /^חדש$/ }).first() : page.locator('.dash-sidebar-cta').first();
      await cta.click(); await page.waitForSelector('form', { timeout: 15000 });
      await checkScreen(page, 'new-quote', vp);
      } catch (e) { cells.push({ screen: 'new-quote', viewport: vp, status: 'FAIL', reasons: ['harness: ' + String(e.message).split(String.fromCharCode(10))[0].slice(0, 160)] }); }
      await ctx.close();
    }
    // Admin screens (TEST Super Admin)
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await login(page, PERSONA_SUPER_ADMIN);
      for (const [name, re] of [['admin-users', /^משתמשים$/], ['admin-ai-support', /^יומן AI Support$/]]) {
        if (compact(vp)) { await page.getByRole('button', { name: /^עוד$/ }).click(); await page.getByRole('menuitem', { name: re }).click(); }
        else await page.locator('.dash-sidebar').getByRole('button', { name: re }).first().click();
        await page.waitForSelector('.admin-screen', { timeout: 20000 });
        await checkScreen(page, name, vp);
      }
      await ctx.close();
    }
  }
} finally { await browser.close(); }

const dir = join(cwd(), 'release-evidence');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'responsive-sticky-block.json'), JSON.stringify({ at: new Date().toISOString(), runtime: BASE, cells }, null, 2));
for (const c of cells.filter((x) => x.status !== 'PASS')) console.log('FAIL', c.screen, c.viewport, JSON.stringify(c.reasons));
console.log(`sticky-block cells=${cells.length} pass=${cells.filter((c) => c.status === 'PASS').length} fail=${cells.filter((c) => c.status !== 'PASS').length}`);
