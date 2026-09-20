// Return-to-app diagnosis (TEST ONLY, canonical 5186, TEST persona A). Read-only.
// Emulates a phone (390x844, touch), waits for the app to settle, then simulates
// backgrounding/returning via real visibilitychange events (what supabase-js
// listens to) and via CDP page lifecycle freeze/resume, and records whether the
// return caused: an auth event, a session-object change, a data (REST) reload,
// a full page reload (navigation type / timeOrigin), a shell remount, or a
// market-routing redirect. Never logs tokens; the app diagnostics are privacy-safe.
import { chromium } from 'playwright';
import { PERSONA_A as P } from '../e2e/testPersonas.js';

const BASE = 'http://192.168.1.189:5186';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem('tkDiag', '1'); } catch { /* ignore */ } });
const page = await ctx.newPage();
const restCalls = [];
page.on('request', (r) => { if (/\/rest\/v1\//.test(r.url())) restCalls.push({ t: Date.now(), m: r.method(), path: new URL(r.url()).pathname.replace('/rest/v1/', '') }); });
const navs = [];
page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push({ t: Date.now(), url: f.url().replace(BASE, '') }); });

await page.goto(`${BASE}/dashboard?lang=he`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const email = page.getByPlaceholder('user@example.com');
await email.waitFor({ state: 'visible', timeout: 45000 });
await email.fill(P.email);
await page.locator('input[name="user_password_field"]').fill(P.password);
await page.getByRole('button', { name: /התחבר/ }).click();
await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
await page.waitForTimeout(13000); // past the ~10s greeting, data loaded, stable

await page.evaluate(() => {
  window.__mark = { hdr: document.querySelector('.dash-upper-section'), shell: document.querySelector('.dash-app-shell'), sb: document.querySelector('.dash-sidebar'), origin: performance.timeOrigin };
  window.__title = () => (document.querySelector('.dash-header-title')?.innerText || '').replace(/\n/g, ' / ');
  const body = document.querySelector('.pf-screen > .pf-screen-body'); if (body) body.scrollTop = 300; window.__scroll = body ? body.scrollTop : null;
  window.__hist0 = history.length;
  window.__tkDiag = []; // only observe what happens FROM HERE (the return)
});
const snap = () => page.evaluate(() => ({
  navType: performance.getEntriesByType('navigation')[0]?.type,
  sameTimeOrigin: performance.timeOrigin === window.__mark.origin,
  headerSameNode: document.querySelector('.dash-upper-section') === window.__mark.hdr && window.__mark.hdr.isConnected,
  shellSameNode: document.querySelector('.dash-app-shell') === window.__mark.shell,
  sidebarSameNode: document.querySelector('.dash-sidebar') === window.__mark.sb,
  bodyScrollKept: (() => { const b = document.querySelector('.pf-screen > .pf-screen-body'); return b ? b.scrollTop === window.__scroll : null; })(),
  historyGrewBy: history.length - window.__hist0,
  headerText: window.__title(),
  diag: window.__tkDiag.map((e) => ({ kind: e.kind, event: e.event, prevUser: e.prevUser, nextUser: e.nextUser, tokenChanged: e.tokenChanged, loadDataTriggered: e.loadDataTriggered, sameUser: e.sameUser, sameToken: e.sameToken, willRedirect: e.willRedirect })),
}));

const setVis = (state) => page.evaluate((st) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => st === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); // bubbles like the real event, so supabase-js's window listener fires
  window.dispatchEvent(new Event(st === 'hidden' ? 'blur' : 'focus'));
}, state);

const results = [];
for (const [label, seconds, viaCdp, expireToken] of [['short background (3s)', 3, false], ['longer background (25s)', 25, false], ['CDP freeze/resume (8s)', 8, true], ['1h+ background: stored access token aged (browser storage only)', 4, false, true]]) {
  const before = { rest: restCalls.length, navs: navs.length };
  await page.evaluate(() => { window.__tkDiag = []; });
  let client = null;
  if (viaCdp) { client = await ctx.newCDPSession(page); await client.send('Page.enable'); }
  if (expireToken) {
    // Age ONLY the browser-local copy so supabase-js must refresh on return (as after a long background). No value is printed.
    await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); const j = JSON.parse(localStorage.getItem(k)); j.expires_at = Math.floor(Date.now() / 1000) - 30; localStorage.setItem(k, JSON.stringify(j)); });
  }
  await setVis('hidden');
  if (viaCdp) await client.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => {});
  await page.waitForTimeout(seconds * 1000).catch(() => {});
  if (viaCdp) await client.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
  await setVis('visible');
  await page.waitForTimeout(5000);
  const s = await snap();
  const dataReload = restCalls.slice(before.rest).filter((c) => c.m === 'GET').length;
  results.push({ label, ...s, restGetsAfterReturn: dataReload, restPaths: [...new Set(restCalls.slice(before.rest).map((c) => c.path.split('?')[0]))].slice(0, 8), mainFrameNavigations: navs.length - before.navs });
}
console.log(JSON.stringify(results, null, 1));

// Contrast: what a genuine cold reload looks like in the same diagnostics.
await page.evaluate(() => { window.__tkDiag = []; });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.dash-upper-section', { timeout: 30000 });
console.log('COLD RELOAD CONTRAST', JSON.stringify(await page.evaluate(() => ({ navType: performance.getEntriesByType('navigation')[0]?.type, sameTimeOrigin: performance.timeOrigin === (window.__mark && window.__mark.origin), log: (JSON.parse(localStorage.getItem('tkDiagLog') || '[]')).slice(-4).map((e) => ({ kind: e.kind, navType: e.navType })) }))));
await browser.close();
