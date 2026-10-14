// First-LIVE responsive + AI Chat + Admin acceptance matrix, driven against the
// canonical Owner TEST runtime (http://192.168.1.189:5186/). TEST ONLY.
//
// Read-only except: it signs in as the stored TEST personas and sends ONE
// question in AI Chat per language/viewport. It never mutates account data,
// never touches Production, never prints credentials.
//
// Usage: node scripts/first-live-matrix.mjs   (run from the worktree root)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { PERSONA_A, PERSONA_EN, PERSONA_SUPER_ADMIN } from '../e2e/testPersonas.js';
import { listBuildInputs, computeTreeDigest } from './release-verify.js';

const BASE = 'http://192.168.1.189:5186';
const PUBLIC_QUOTE_ID = '3fec3ba7-859d-4208-8253-015b98c5ce37'; // seeded TEST public quote (e2e/critical-journeys.spec.js)
const VIEWPORTS = { desktop: [1440, 900], mobile: [390, 844], tabletPortrait: [768, 1024], tabletLandscape: [1024, 768] };
const cells = [];
const record = (lang, surface, viewport, ok, detail = {}) => cells.push({ lang, surface, viewport, status: ok ? 'PASS' : 'FAIL', ...detail });

const hOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function login(page, persona, lang) {
  await page.goto(`${BASE}/dashboard?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const email = page.getByPlaceholder('user@example.com');
  await email.waitFor({ state: 'visible', timeout: 45000 });
  await email.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
  await page.waitForTimeout(800);
}

// Scroll contract on a screen: when the body overflows, its top must equal the
// static block's bottom (<=1px) and the body must be the single vertical scroller.
const scrollContract = (page) => page.evaluate(() => {
  const body = document.querySelector('.pf-screen-body');
  const screen = document.querySelector('.pf-screen');
  if (!screen) return { present: false };
  // Empty-state screens (e.g. an empty Catalog) render the card without a list body: nothing overflows.
  if (!body) return { present: true, noBody: true, overflow: false, desktopLayout: false };
  const kids = [...screen.children];
  const prev = kids.slice(0, kids.indexOf(body)).filter((e) => e.getBoundingClientRect().height > 0).pop();
  const overflow = body.scrollHeight > body.clientHeight + 1;
  const desktopLayout = getComputedStyle(body).overflowY !== 'visible';
  const delta = prev ? Math.round((body.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) * 10) / 10 : null;
  const cardLeft = screen.getBoundingClientRect().left;
  const outerScroll = [...document.querySelectorAll('.dash-main-content, .dash-shell-main, .dash-shell-body')].some((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY));
  return { present: true, overflow, desktopLayout, delta, bodyLeft: Math.round(body.getBoundingClientRect().left), cardLeft: Math.round(cardLeft), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, outerScroll };
});

const headerHeight = (page) => page.evaluate(() => Math.round(document.querySelector('.dash-upper-section')?.getBoundingClientRect().height || 0));

async function chatSmoke(page, lang, question) {
  const detail = {};
  await page.locator('.dash-header-ai-btn:visible').first().click();
  const dialog = page.getByRole('dialog', { name: /AI Chat|צ’אט AI/ });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  detail.controls = {
    previous: await dialog.getByRole('button', { name: /Previous chats|שיחות קודמות/ }).count() > 0,
    newChat: await dialog.getByRole('button', { name: /New Chat|שיחה חדשה/ }).count() > 0,
    close: await dialog.getByRole('button', { name: /^(Close|סגור)$/ }).count() > 0,
  };
  const menuButtons = await dialog.locator('button').count();
  detail.menuButtons = menuButtons;
  const input = dialog.getByPlaceholder(/Ask something|שאל משהו/);
  await input.fill(question);
  await dialog.getByRole('button', { name: /^(Send|שלח)$/ }).click();
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.innerText.length > 0 && !/\.\.\.$|…$/.test(d.innerText.trim().slice(-3));
  }, null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const text = await dialog.innerText();
  detail.replyChars = text.length;
  detail.noErrorBanner = !/something went wrong|try again later|אירעה שגיאה|שגיאה זמנית/i.test(text);
  const hasHebrew = /[֐-׿]/.test(text);
  detail.languageClean = lang === 'he' ? hasHebrew : !hasHebrew && !/₪/.test(text);
  detail.foreground = await page.evaluate(() => !!document.querySelector('.dash-upper-section'));
  await dialog.getByRole('button', { name: /^(Close|סגור)$/ }).first().click();
  return detail;
}

const browser = await chromium.launch();
try {
  for (const lang of ['he', 'en']) {
    for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
      // ---- landing + public chat entry (unauthenticated)
      {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(1500);
        const body = await page.evaluate(() => document.body.innerText);
        const truth = lang === 'he' ? body.includes('עוזר AI בתוך העבודה') : body.includes('AI Assistant Inside Your Workflow');
        const noCheckout = lang === 'he' ? body.includes('אינם זמינים כרגע') : body.includes('not currently available');
        const publicChat = await page.locator('.ai-support-btn:visible, [aria-label="AI Chat"]:visible, [aria-label="צאט AI"]:visible').count() > 0;
        record(lang, 'landing', vp, !(await hOverflow(page)) && truth && noCheckout, { overflowX: await hOverflow(page), aiFeatureCopy: truth, paidUnavailableCopy: noCheckout });
        record(lang, 'public-chat-entry', vp, publicChat, { launcherVisible: publicChat });
        // ---- auth screen
        await page.goto(`${BASE}/dashboard?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.getByPlaceholder('user@example.com').waitFor({ state: 'visible', timeout: 45000 });
        record(lang, 'auth', vp, !(await hOverflow(page)), { overflowX: await hOverflow(page) });
        // ---- public quote
        await page.goto(`${BASE}/public-quote/${PUBLIC_QUOTE_ID}?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(2500);
        const pqText = await page.evaluate(() => document.body.innerText.length);
        record(lang, 'public-quote', vp, !(await hOverflow(page)) && pqText > 200, { overflowX: await hOverflow(page), textChars: pqText });
        await ctx.close();
      }
      // ---- authenticated business surfaces + AI Chat
      {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        await login(page, lang === 'he' ? PERSONA_A : PERSONA_EN, lang);
        const detail = { header: await headerHeight(page), overflowX: await hOverflow(page) };
        const screens = [['Quotes', /^(Quotes|הצעות מחיר)$/], ['Clients', /^(Clients|לקוחות)$/], ['Finances', /Finances|כספים|פיננסים/], ['Settings', /Settings|הגדרות/], ['Catalog', /Catalog|קטלוג/]];
        let allScreens = true;
        for (const [name, re] of screens) {
          if (vp !== 'desktop' && vp !== 'tabletLandscape' && (name === 'Settings' || name === 'Catalog')) {
            await page.getByRole('button', { name: /^(More|עוד)$/ }).click();
            await page.getByRole('menuitem', { name: re }).click();
          } else {
            const nav = (vp === 'desktop' || vp === 'tabletLandscape') ? page.locator('.dash-sidebar') : page.locator('.mobile-bottom-nav');
            await nav.getByRole('button', { name: re }).first().click();
          }
          await page.waitForSelector('.pf-screen', { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(500);
          const c = await scrollContract(page);
          // The shared inner-scroll primitive is desktop-class only by design
          // (mobile/tablet-portrait keep natural page scroll), so presence is
          // required only where the desktop layout applies.
          const desktopClass = vp === 'desktop' || vp === 'tabletLandscape';
          const ok = !(await hOverflow(page)) && (!desktopClass || c.present) && (!c.present || !c.desktopLayout || !c.overflow || (Math.abs(c.delta) <= 1 && !c.outerScroll));
          allScreens = allScreens && ok;
          detail[name] = c;
        }
        record(lang, 'business-screens', vp, allScreens && !detail.overflowX, detail);
        // AI Chat (authenticated), foreground-workflow: open from the Quotes screen
        try {
          const chat = await chatSmoke(page, lang, lang === 'he' ? 'כמה הצעות מחיר יש לי?' : 'How many quotes do I have?');
          record(lang, 'ai-chat-authenticated', vp, chat.controls.previous && chat.controls.newChat && chat.controls.close && chat.noErrorBanner && chat.languageClean && chat.foreground, chat);
        } catch (e) {
          record(lang, 'ai-chat-authenticated', vp, false, { error: String(e.message).slice(0, 200) });
        }
        await ctx.close();
      }
    }
  }
  // ---- Admin, HE only (no International Admin persona is required)
  for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await login(page, PERSONA_SUPER_ADMIN, 'he');
    const userHeader = await headerHeight(page);
    for (const section of ['overview', 'users', 'user-details', 'plans', 'activity', 'ai-support']) {
      const target = section === 'user-details' ? 'users' : section;
      await page.goto(`${BASE}/dashboard?lang=he&view=admin&section=${target}`);
      await page.waitForSelector('.admin-screen', { timeout: 30000 });
      await page.waitForTimeout(1000);
      if (section === 'user-details') {
        await page.locator('.admin-icon-button:visible').first().click();
        await page.waitForTimeout(800);
      }
      const m = await page.evaluate(() => {
        const body = document.querySelector('.admin-screen-body');
        const screen = document.querySelector('.admin-screen');
        const kids = [...screen.children];
        const prev = kids.slice(0, kids.indexOf(body)).filter((e) => e.getBoundingClientRect().height > 0).pop();
        const hdr = document.querySelector('.dash-upper-section');
        const sb = body.getBoundingClientRect();
        const overflow = body.scrollHeight > body.clientHeight + 1;
        const desktopLayout = getComputedStyle(body).overflowY !== 'visible';
        return {
          staticBottom: Math.round(prev.getBoundingClientRect().bottom * 10) / 10, bodyTop: Math.round(sb.top * 10) / 10,
          bodyLeft: Math.round(sb.left), cardLeft: Math.round(screen.getBoundingClientRect().left), bodyHeight: Math.round(sb.height),
          scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, overflow, desktopLayout,
          headerHeight: Math.round(hdr.getBoundingClientRect().height), adminTopbar: !!document.querySelector('[data-shell-context="admin"]'),
          outerScroll: [...document.querySelectorAll('.dash-main-content, .dash-shell-main, .dash-shell-body')].some((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)),
          sensitiveControls: /Lifetime grant|Extend trial|Delete user|Reset quote|backend deployment|הארכת ניסיון|מחיקת משתמש|איפוס נתוני/.test(document.body.innerText),
        };
      });
      const delta = Math.round((m.bodyTop - m.staticBottom) * 10) / 10;
      const headerConstant = m.headerHeight === userHeader;
      const contractOk = !m.desktopLayout || !m.overflow || (Math.abs(delta) <= 1 && !m.outerScroll);
      record('he', `admin-${section}`, vp, contractOk && !(await hOverflow(page)) && !m.adminTopbar && !m.sensitiveControls && headerConstant, { ...m, delta, userHeader, headerConstant, overflowX: await hOverflow(page) });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

const dir = join(cwd(), 'release-evidence');
mkdirSync(dir, { recursive: true });
const treeDigest = computeTreeDigest(listBuildInputs());
writeFileSync(join(dir, 'first-live-responsive-matrix.json'), JSON.stringify({ at: new Date().toISOString(), runtime: BASE, treeDigest, cells }, null, 2));
for (const c of cells.filter((x) => x.status !== 'PASS')) console.log('FAIL', c.lang, c.surface, c.viewport, JSON.stringify(c).slice(0, 400));
console.log(`cells=${cells.length} pass=${cells.filter((c) => c.status === 'PASS').length} fail=${cells.filter((c) => c.status !== 'PASS').length}`);
