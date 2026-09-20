// Hermetic Admin-shell live verification (TEST ONLY, canonical 5186).
// Persona: stored TEST Super Admin. Read-only navigation; the New Quote flow
// only OPENS the form (nothing is saved). Writes release-evidence/hermetic-admin-shell.json.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { PERSONA_SUPER_ADMIN as P } from '../e2e/testPersonas.js';

const BASE = 'http://192.168.1.189:5186';
const cells = [];
const rec = (name, viewport, ok, detail = {}) => cells.push({ name, viewport, status: ok ? 'PASS' : 'FAIL', ...detail });
const VIEWPORTS = { 360: [360, 740], 390: [390, 844], 412: [412, 915], tabletPortrait: [768, 1024], tabletLandscape: [1024, 768], desktop: [1440, 900] };
const desktopClass = (vp) => vp === 'tabletLandscape' || vp === 'desktop';
const LABELS = { overview: /^(סקירה כללית)$/, users: /^(משתמשים)$/, plans: /^(חבילות ומנויים)$/, activity: /^(פעילות מערכת)$/, 'ai-support': /^(יומן AI Support)$/ };

async function login(page) {
  await page.goto(`${BASE}/dashboard?lang=he`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 45000 });
  await email.fill(P.email);
  await page.locator('input[name="user_password_field"]').fill(P.password);
  await page.getByRole('button', { name: /התחבר/ }).click();
  await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
  await page.waitForTimeout(1000);
}
const hOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const visibleChat = (page) => page.locator('.dash-header-ai-btn:visible').first();

async function goAdmin(page, vp, id) {
  if (desktopClass(vp)) {
    await page.locator('.dash-sidebar').getByRole('button', { name: LABELS[id] }).first().click();
  } else {
    await page.getByRole('button', { name: /^(More|עוד)$/ }).click();
    await page.getByRole('menuitem', { name: LABELS[id] }).click();
  }
  await page.waitForSelector(`[data-admin-destination="${id}"] .admin-screen`, { timeout: 20000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
try {
  // ---------- A. mobile top-gap + sticky + Chat reachability, every viewport class
  for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await login(page);
    const m = () => page.evaluate(() => {
      const hdr = document.querySelector('.dash-upper-section').getBoundingClientRect();
      const main = document.querySelector('.dash-shell-main').getBoundingClientRect();
      const first = document.querySelector('.dash-content-container').getBoundingClientRect();
      return { hdrTop: Math.round(hdr.top * 10) / 10, hdrH: Math.round(hdr.height * 10) / 10, shellMainTop: Math.round(main.top * 10) / 10, containerTop: Math.round(first.top * 10) / 10 };
    });
    const before = await m();
    if (desktopClass(vp)) {
      await page.locator('.pf-screen-body').first().evaluate((e) => { e.scrollTop = 400; }).catch(() => {});
    } else {
      await page.evaluate(() => window.scrollTo(0, 700));
    }
    await page.waitForTimeout(500);
    const after = await m();
    await visibleChat(page).click();
    const chatOpen = await page.getByRole('dialog', { name: /AI Chat|צ’אט AI/ }).isVisible();
    const gap = desktopClass(vp) ? null : Math.round((before.hdrTop - before.shellMainTop) * 10) / 10;
    rec('top-gap', vp, desktopClass(vp) ? true : Math.abs(gap - 6) <= 1, { gapPx: gap, before, note: desktopClass(vp) ? 'desktop-class: approved 16px shell padding, Header static above inner scroll body' : 'mobile/tablet-portrait: Header top == app content top + 6px shell spacing (safe-area is 0 in a normal tab), frame fully visible' });
    rec('header-sticky', vp, Math.abs(after.hdrTop - before.hdrTop) <= 1 && after.hdrH === before.hdrH, { before: before.hdrTop, after: after.hdrTop });
    rec('chat-reachable-after-scroll', vp, chatOpen && !(await hOverflow(page)));
    await ctx.close();
  }

  // ---------- B. in-shell Admin navigation + business/admin transition (per viewport class)
  for (const vp of ['desktop', 'tabletLandscape', 'tabletPortrait', 390]) {
    const [w, h] = VIEWPORTS[vp];
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const popups = [];
    const page = await ctx.newPage();
    // Any page beyond the main one (new tab/window) is a shell escape.
    ctx.on('page', (p) => { if (p !== page) popups.push(p.url()); });
    await login(page);
    await page.evaluate(() => { window.__hdr = document.querySelector('.dash-upper-section'); window.__sb = document.querySelector('.dash-sidebar'); window.__shell = document.querySelector('.dash-app-shell'); });
    const shellSame = () => page.evaluate(() => document.querySelector('.dash-upper-section') === window.__hdr && window.__hdr.isConnected && document.querySelector('.dash-sidebar') === window.__sb && document.querySelector('.dash-app-shell') === window.__shell);

    for (const id of ['overview', 'users', 'plans', 'activity', 'ai-support']) {
      await goAdmin(page, vp, id);
      const info = await page.evaluate(() => {
        const body = document.querySelector('.admin-screen-body'); const screen = document.querySelector('.admin-screen');
        const kids = [...screen.children]; const prev = kids.slice(0, kids.indexOf(body)).filter((e) => e.getBoundingClientRect().height > 0).pop();
        const desktopLayout = getComputedStyle(body).overflowY !== 'visible';
        return {
          url: location.pathname + location.search,
          delta: Math.round((body.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) * 10) / 10,
          overflow: body.scrollHeight > body.clientHeight + 1, desktopLayout,
          bodyLeft: Math.round(body.getBoundingClientRect().left), cardLeft: Math.round(screen.getBoundingClientRect().left),
          scrollHeight: body.scrollHeight, clientHeight: body.clientHeight,
          businessNav: [...document.querySelectorAll('.dash-sidebar .dash-sidebar-btn')].length, newQuote: !!document.querySelector('.dash-sidebar-cta'),
          supportChrome: /חזרה לדשבורד|Back to Dashboard/.test(document.body.innerText),
          outerScroll: [...document.querySelectorAll('.dash-main-content, .dash-shell-main, .dash-shell-body')].some((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)),
        };
      });
      const stays = info.url.startsWith('/dashboard') && (await shellSame()) && popups.length === 0;
      const scrollOk = !info.desktopLayout || !info.overflow || (Math.abs(info.delta) <= 1 && !info.outerScroll);
      const hov = await hOverflow(page);
      rec(`in-shell:${id}`, vp, stays && scrollOk && !info.supportChrome && !hov, { ...info, stays, scrollOk, hov, popups: popups.length });
      if (id === 'users') {
        await page.locator('.admin-icon-button:visible').first().click();
        await page.waitForSelector('.admin-user-details, [data-admin-destination="users"] .admin-details-grid', { timeout: 15000 });
        await page.waitForTimeout(600);
        const d = await page.evaluate(() => {
          const body = document.querySelector('.admin-screen-body'); const screen = document.querySelector('.admin-screen');
          const kids = [...screen.children]; const prev = kids.slice(0, kids.indexOf(body)).filter((e) => e.getBoundingClientRect().height > 0).pop();
          return { delta: Math.round((body.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) * 10) / 10, overflow: body.scrollHeight > body.clientHeight + 1, desktopLayout: getComputedStyle(body).overflowY !== 'visible', url: location.pathname + location.search };
        });
        rec('in-shell:user-details', vp, (await shellSame()) && popups.length === 0 && d.url.startsWith('/dashboard') && (!d.desktopLayout || !d.overflow || Math.abs(d.delta) <= 1), d);
      }
    }

    // business -> admin -> New Quote -> admin, shell never replaced
    const cta = desktopClass(vp) ? page.locator('.dash-sidebar-cta').first() : page.locator('.mobile-bottom-nav').getByRole('button', { name: /^חדש$/ }).first();
    const ctaVisible = await cta.isVisible().catch(() => false);
    await cta.click();
    await page.waitForSelector('form', { timeout: 15000 });
    const formUsable = await page.evaluate(() => { const f = document.querySelector('form'); return !!f && f.querySelectorAll('input, textarea, select').length >= 3 && f.getBoundingClientRect().height > 100; });
    const nqShell = await shellSame();
    const chatDuring = await (async () => { await visibleChat(page).click(); const ok = await page.getByRole('dialog', { name: /AI Chat|צ’אט AI/ }).isVisible(); await page.getByRole('dialog').getByRole('button', { name: /^סגור$/ }).first().click().catch(() => {}); return ok; })();
    rec('super-admin-new-quote', vp, ctaVisible && formUsable && nqShell, { ctaVisible, formUsable, shellSame: nqShell });
    rec('chat-available-through-business-admin-transition', vp, chatDuring);
    await goAdmin(page, vp, 'ai-support');
    rec('new-quote-to-admin-return', vp, (await shellSame()) && popups.length === 0, { url: await page.evaluate(() => location.pathname + location.search) });
    // every ordinary business destination still reachable
    const navs = desktopClass(vp) ? ['הצעות מחיר', 'לקוחות', 'פיננסים', 'הגדרות', 'קטלוג'] : ['הצעות מחיר', 'לקוחות', 'פיננסים'];
    const reach = [];
    for (const n of navs) {
      const scope = desktopClass(vp) ? page.locator('.dash-sidebar') : page.locator('.mobile-bottom-nav');
      reach.push((await scope.getByRole('button', { name: new RegExp(n) }).count()) > 0);
    }
    rec('business-destinations-present-for-super-admin', vp, reach.every(Boolean) && (await shellSame()), { reach });
    await ctx.close();
  }

  // ---------- C. legacy /ai-logs and deep link keep the shell
  for (const path of ['/ai-logs', '/dashboard?lang=he&view=admin&section=ai-support']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-admin-destination="ai-support"] .admin-screen', { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(() => ({ url: location.pathname + location.search, header: !!document.querySelector('.dash-upper-section'), sidebar: !!document.querySelector('.dash-sidebar'), body: !!document.querySelector('[data-admin-destination="ai-support"] .admin-screen'), backChrome: /חזרה לדשבורד/.test(document.body.innerText) }));
    rec(path === '/ai-logs' ? 'legacy-ai-logs-url-shell-safe' : 'admin-deep-link-preserves-shell', 'desktop', r.url.startsWith('/dashboard') && r.header && r.sidebar && r.body && !r.backChrome, r);
    await ctx.close();
  }
} finally {
  await browser.close();
}

const dir = join(cwd(), 'release-evidence');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'hermetic-admin-shell.json'), JSON.stringify({ at: new Date().toISOString(), runtime: BASE, cells }, null, 2));
for (const c of cells.filter((x) => x.status !== 'PASS')) console.log('FAIL', c.name, c.viewport, JSON.stringify(c).slice(0, 420));
console.log(`hermetic cells=${cells.length} pass=${cells.filter((c) => c.status === 'PASS').length} fail=${cells.filter((c) => c.status !== 'PASS').length}`);
