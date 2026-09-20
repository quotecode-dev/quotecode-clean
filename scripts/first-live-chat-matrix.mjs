// First-LIVE AI Chat terminal matrix (context, history, guided menus, public chat).
// TEST ONLY, against http://192.168.1.189:5186/. Appends its cells to
// release-evidence/first-live-responsive-matrix.json (replacing earlier cells
// with the same surface names). Sends at most two chat questions per
// language/viewport; never mutates account data.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { PERSONA_A, PERSONA_EN } from '../e2e/testPersonas.js';
import { listBuildInputs, computeTreeDigest } from './release-verify.js';

const BASE = 'http://192.168.1.189:5186';
const VIEWPORTS = { desktop: [1440, 900], mobile: [390, 844], tabletPortrait: [768, 1024], tabletLandscape: [1024, 768] };
const SURFACES = ['ai-chat-public', 'ai-chat-guided-menu', 'ai-chat-previous-and-new', 'ai-chat-new-quote', 'ai-chat-edit-quote', 'ai-chat-quote-fact', 'ai-chat-safe-navigation'];
const ONLY = process.env.CHAT_ONLY || '';
const cells = [];
const want = (surface) => !ONLY || ONLY === surface;
const record = (lang, surface, viewport, ok, detail = {}) => cells.push({ lang, surface, viewport, status: ok ? 'PASS' : 'FAIL', ...detail });
const T = (lang) => ({
  back: lang === 'he' ? /חזרה/ : /Back/,
  prev: lang === 'he' ? /שיחות קודמות/ : /Previous chats/,
  fresh: lang === 'he' ? /שיחה חדשה/ : /New Chat/,
  close: lang === 'he' ? /^סגור$/ : /^Close$/,
  send: lang === 'he' ? /^שלח$/ : /^Send$/,
  ask: lang === 'he' ? /שאל משהו/ : /Ask something/,
  chatName: /AI Chat|צ’אט AI/,
  skip: /^(שיחות קודמות|שיחה חדשה|סגור|שלח|חזרה|Previous chats|New Chat|Close|Send|Back)$/,
  newQuote: lang === 'he' ? /הצעת מחיר חדשה|^חדש$/ : /New Quote|^New$/,
});
const errText = /something went wrong|try again later|אירעה שגיאה|שגיאה זמנית/i;
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
const openChat = async (page, lang) => {
  await page.locator('.dash-header-ai-btn:visible').first().click();
  const d = page.getByRole('dialog', { name: T(lang).chatName });
  await d.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  return d;
};
const menuLabels = async (d, lang) => (await d.locator('button').evaluateAll((bs) => bs.map((x) => (x.getAttribute('aria-label') || x.innerText || '').trim()))).filter((t) => t && !T(lang).skip.test(t));
const closeChat = async (d, lang) => { await d.getByRole('button', { name: T(lang).close }).first().click().catch(() => {}); };
const ask = async (page, d, lang, q) => {
  await d.getByPlaceholder(T(lang).ask).fill(q);
  await d.getByRole('button', { name: T(lang).send }).click();
  await page.waitForTimeout(9000);
  return d.innerText();
};

const browser = await chromium.launch();
try {
  for (const lang of ['he', 'en']) {
    const persona = lang === 'he' ? PERSONA_A : PERSONA_EN;
    const t = T(lang);
    for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
      // ---------- public chat (unauthenticated landing)
      if (want('ai-chat-public')) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        try {
          await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await page.waitForTimeout(2000);
          await page.locator('.ai-support-btn:visible').first().click();
          const d = page.getByRole('dialog', { name: t.chatName });
          await d.waitFor({ state: 'visible', timeout: 10000 });
          const text = await ask(page, d, lang, lang === 'he' ? 'מה זה TEKANGO?' : 'What is TEKANGO?');
          const heb = /[֐-׿]/.test(text);
          record(lang, 'ai-chat-public', vp, !errText.test(text) && (lang === 'he' ? heb : !heb && !/₪/.test(text)) && !(await hOverflow(page)), { chars: text.length });
        } catch (e) { record(lang, 'ai-chat-public', vp, false, { error: String(e.message).slice(0, 200) }); }
        await ctx.close();
      }
      // ---------- authenticated
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await login(page, persona, lang);
      // guided menu: every group opens, has Back, never shows an error or an empty dead end
      if (want('ai-chat-guided-menu')) try {
        const d = await openChat(page, lang);
        const groups = await menuLabels(d, lang);
        const problems = [];
        for (const g of groups) {
          await d.getByRole('button', { name: g, exact: true }).first().click();
          await page.waitForTimeout(600);
          const subs = await menuLabels(d, lang);
          const back = await d.getByRole('button', { name: t.back }).count();
          const txt = await d.innerText();
          if (errText.test(txt)) problems.push(`${g}: error`);
          if (!back) problems.push(`${g}: no Back`);
          if (subs.length) {
            await d.getByRole('button', { name: subs[0], exact: true }).first().click();
            await page.waitForTimeout(900);
            const t2 = await d.innerText();
            if (errText.test(t2)) problems.push(`${g}>${subs[0]}: error`);
            if (!(await d.getByRole('button', { name: t.back }).count())) problems.push(`${g}>${subs[0]}: no Back`);
            await d.getByRole('button', { name: t.back }).first().click().catch(() => {});
            await page.waitForTimeout(300);
          }
          await d.getByRole('button', { name: t.back }).first().click().catch(() => {});
          await page.waitForTimeout(300);
        }
        record(lang, 'ai-chat-guided-menu', vp, groups.length >= 5 && problems.length === 0, { groups: groups.length, problems });
        // previous chats / new chat
        await d.getByRole('button', { name: t.prev }).first().click();
        await page.waitForTimeout(700);
        const prevOpen = (await d.innerText()).length > 0 && !errText.test(await d.innerText());
        await d.getByRole('button', { name: t.fresh }).first().click();
        await page.waitForTimeout(700);
        const freshOk = (await menuLabels(d, lang)).length >= 5;
        record(lang, 'ai-chat-previous-and-new', vp, prevOpen && freshOk, { prevOpen, freshOk });
        // one quote-fact question + one safe navigation path (guided: Quotes group opens a quote list)
        const fact = await ask(page, d, lang, lang === 'he' ? 'כמה הצעות מחיר יש לי?' : 'How many quotes do I have?');
        const hasNumber = /\d/.test(fact);
        record(lang, 'ai-chat-quote-fact', vp, !errText.test(fact) && hasNumber, { chars: fact.length, hasNumber });
        await d.getByRole('button', { name: t.fresh }).first().click().catch(() => {});
        await page.waitForTimeout(500);
        await d.getByRole('button', { name: (await menuLabels(d, lang))[0], exact: true }).first().click();
        await page.waitForTimeout(700);
        const navOk = (await menuLabels(d, lang)).length > 0 && (await d.getByRole('button', { name: t.back }).count()) > 0;
        record(lang, 'ai-chat-safe-navigation', vp, navOk, {});
        await closeChat(d, lang);
      } catch (e) {
        for (const s of ['ai-chat-guided-menu', 'ai-chat-previous-and-new', 'ai-chat-quote-fact', 'ai-chat-safe-navigation']) if (!cells.some((c) => c.lang === lang && c.viewport === vp && c.surface === s)) record(lang, s, vp, false, { error: String(e.message).slice(0, 200) });
      }
      // Edit Quote context: open the first quote for editing, then chat from inside the form
      try {
        // Signed quotes are locked (disabled) by design - use the first editable one.
        const editBtn = page.locator('button:not([disabled])').filter({ hasText: /^(Edit|ערוך)$/ }).first();
        if (vp === 'desktop' || vp === 'tabletLandscape') await page.locator('.dash-sidebar').getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().click();
        else await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().click();
        await page.waitForTimeout(800);
        // The row actions (View/Edit/...) live inside the row's expandable details.
        await page.getByRole('button', { name: /פרטים נוספים|more details/i }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);
        await editBtn.click({ timeout: 8000 });
        await page.waitForSelector('form', { timeout: 10000 });
        const d = await openChat(page, lang);
        const ok = (await d.getByRole('button', { name: t.fresh }).count()) > 0 && !(await hOverflow(page));
        record(lang, 'ai-chat-edit-quote', vp, ok, { headerPresent: await page.evaluate(() => !!document.querySelector('.dash-upper-section')) });
        await closeChat(d, lang);
      } catch (e) { record(lang, 'ai-chat-edit-quote', vp, false, { error: String(e.message).slice(0, 200) }); }
      // New Quote context
      if (want('ai-chat-new-quote')) try {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
        const cta = (vp === 'desktop' || vp === 'tabletLandscape') ? page.locator('.dash-sidebar-cta').first() : page.locator('.mobile-bottom-nav').getByRole('button', { name: t.newQuote }).first();
        await cta.click({ timeout: 10000 });
        await page.waitForSelector('form', { timeout: 10000 });
        const d = await openChat(page, lang);
        const ok = (await d.getByRole('button', { name: t.fresh }).count()) > 0 && !(await hOverflow(page));
        record(lang, 'ai-chat-new-quote', vp, ok, { headerPresent: await page.evaluate(() => !!document.querySelector('.dash-upper-section')) });
        await closeChat(d, lang);
      } catch (e) { record(lang, 'ai-chat-new-quote', vp, false, { error: String(e.message).slice(0, 200) }); }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

const file = join(cwd(), 'release-evidence', 'first-live-responsive-matrix.json');
const matrix = JSON.parse(readFileSync(file, 'utf8'));
const replaced = new Set(cells.map((c) => c.surface));
matrix.cells = matrix.cells.filter((c) => !(SURFACES.includes(c.surface) && (replaced.has(c.surface)))).concat(cells);
matrix.treeDigest = computeTreeDigest(listBuildInputs());
matrix.at = new Date().toISOString();
writeFileSync(file, JSON.stringify(matrix, null, 2));
for (const c of cells.filter((x) => x.status !== 'PASS')) console.log('FAIL', c.lang, c.surface, c.viewport, JSON.stringify(c).slice(0, 360));
console.log(`chat cells=${cells.length} pass=${cells.filter((c) => c.status === 'PASS').length} fail=${cells.filter((c) => c.status !== 'PASS').length}`);
