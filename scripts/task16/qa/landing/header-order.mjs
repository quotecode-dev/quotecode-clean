// Task 16 local fix 6 (R1) - LANDING HEADER PHYSICAL ORDER GATE (real Chromium, bounding boxes; QA tooling only).
// Authority: Owner instruction 2026-10-06 (NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT): HE logo far RIGHT -> section links
// immediately after it (right to left) -> sign-in / trial actions far LEFT. EN logo far LEFT -> links -> actions far RIGHT.
// No visible language switch; routes / auth links / canonical / hreflang stay.
// Per locale x viewport it measures the VISIBLE groups only (logo, links, actions) inside the .tl-nav content box and asserts:
//   order          physical order + edges (logo edge <= 4px, actions far edge <= 4px, links between: entirely inside the
//                  logo..actions span, HE links <= 24px from the logo), positive gaps, no overlap, no horizontal overflow;
//   completeness   every group expected at this width is visible; hidden nodes are never measured (collapsed widths judge
//                  logo + actions + toggle only, and the links must NOT be visible there);
//   targets        every visible header link/button >= 44px high;
//   focus          Tab order through the header = visual reading order (HE right-to-left, EN left-to-right);
//   drawer         collapsed widths: the toggle opens the drawer on the language side with the section links and sign-in;
//   no-switch      no visible header / drawer link to the other locale; canonical + hreflang present.
// Negative controls (env HO_MUTATE): he-old-order (restore logo/actions/links), en-swap (EN links/actions swapped),
// hide-links (a desktop group hidden), measure-hidden (the probe measures the hidden links at collapsed widths).
// Usage: node scripts/task16/qa/landing/header-order.mjs <baseUrl> <outDir>   (exit 1 on any FAIL, 2 on setup error)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const [BASE, OUT] = process.argv.slice(2);
if (!BASE || !OUT) { console.error('usage: header-order.mjs <baseUrl> <outDir>'); process.exit(2); }
if (/:5186\b/.test(BASE) && process.env.HO_MUTATE) { console.error('negative mutations never run against 5186'); process.exit(2); }
const MUT = process.env.HO_MUTATE || '';
mkdirSync(OUT, { recursive: true });
const VIEWPORTS = (process.env.HO_VIEWPORTS || '1440x900,1280x800,1180x820,390x844').split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { w, h }; });
const MUTATION_CSS = {
  'he-old-order': ".tl-landing[dir='rtl'] .tl-logo{order:0!important}.tl-landing[dir='rtl'] .tl-actions{order:1!important;margin-inline-start:0!important}.tl-landing[dir='rtl'] .tl-menu{order:2!important;margin-inline-start:auto!important}",
  'en-swap': ".tl-landing[dir='ltr'] .tl-actions{order:1!important;margin-inline-start:auto!important}.tl-landing[dir='ltr'] .tl-menu{order:2!important;margin-inline-start:12px!important}",
  'hide-links': '.tl-menu{visibility:hidden!important}',
};
const cells = [];
const cell = (id, pass, detail) => { cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail }); if (!pass) console.log(`FAIL ${id} ${JSON.stringify(detail).slice(0, 300)}`); };
const r1 = (n) => Math.round(n * 10) / 10;

const browser = await chromium.launch();
let identity = null;
try { identity = await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json(); } catch { /* reported below */ }
for (const loc of ['he', 'en']) for (const vp of VIEWPORTS) {
  const id = `${loc}/${vp.w}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${loc}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('.tl-header .tl-logo', { timeout: 60000 });
  if (MUTATION_CSS[MUT]) await page.addStyleTag({ content: MUTATION_CSS[MUT] });
  await page.waitForTimeout(300);
  const m = await page.evaluate((measureHidden) => {
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); const c = getComputedStyle(e); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const box = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
    const nav = document.querySelector('.tl-nav'); const nb = nav.getBoundingClientRect(); const nc = getComputedStyle(nav);
    const inner = { left: nb.left + parseFloat(nc.paddingLeft), right: nb.right - parseFloat(nc.paddingRight) };
    const g = (sel) => { const e = document.querySelector(sel); return { visible: vis(e), box: (vis(e) || measureHidden) && e ? box(e) : null }; };
    const logo = g('.tl-header .tl-logo'); const links = g('.tl-header .tl-menu'); const actions = g('.tl-header .tl-actions'); const toggle = g('.tl-header .tl-menu-toggle');
    const focusables = [...document.querySelectorAll('.tl-header a, .tl-header button')].filter(vis);
    const small = focusables.filter((e) => e.getBoundingClientRect().height < 44).map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24));
    const other = location.pathname.startsWith('/he') ? '/en' : '/he';
    const cross = focusables.filter((a) => a.getAttribute('href') === other).length;
    return { inner, logo, links, actions, toggle, focusCount: focusables.length, small, cross, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, dir: document.querySelector('.tl-landing')?.getAttribute('dir'), canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '', hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length, meta: document.querySelector('meta[name="tekango-build-sha"]')?.content || null };
  }, MUT === 'measure-hidden');
  const collapsed = vp.w <= 1180; // the approved landing breakpoint (@media max-width: 1180px) hides the desktop links
  const he = loc === 'he';
  // completeness / visibility
  const comp = [];
  if (!m.logo.visible) comp.push('logo not visible');
  if (!m.actions.visible) comp.push('action group not visible');
  if (!collapsed && !m.links.visible) comp.push('desktop section links not visible');
  if (collapsed && m.links.visible) comp.push('section links visible at a collapsed width');
  if (collapsed && !m.toggle.visible) comp.push('menu toggle not visible at a collapsed width');
  if (m.links.box && !m.links.visible) comp.push('a hidden group was measured (hidden-node coordinates are never evidence)');
  cell(`${id}/completeness`, comp.length === 0, { problems: comp });
  // order / edges
  const o = []; const L = m.logo.box; const A = m.actions.box; const N = m.links.visible ? m.links.box : (MUT === 'measure-hidden' ? m.links.box : null);
  if (L && A) {
    if (he) {
      if (Math.abs(L.right - m.inner.right) > 4) o.push(`HE logo not at the far right (${r1(L.right)} vs ${r1(m.inner.right)})`);
      if (Math.abs(A.left - m.inner.left) > 4) o.push(`HE actions not at the far left (${r1(A.left)} vs ${r1(m.inner.left)})`);
      if (N) {
        if (N.right > L.left) o.push(`HE links overlap / right of the logo (${r1(N.right)} > ${r1(L.left)})`);
        if (L.left - N.right > 24) o.push(`HE links not immediately after the logo (gap ${r1(L.left - N.right)}px > 24)`);
        if (N.left < A.right) o.push(`HE links overlap / left of the actions (${r1(N.left)} < ${r1(A.right)})`);
      } else if (A.right > L.left) o.push('HE actions overlap the logo');
    } else {
      if (Math.abs(L.left - m.inner.left) > 4) o.push(`EN logo not at the far left (${r1(L.left)} vs ${r1(m.inner.left)})`);
      if (Math.abs(A.right - m.inner.right) > 4) o.push(`EN actions not at the far right (${r1(A.right)} vs ${r1(m.inner.right)})`);
      if (N) {
        if (N.left < L.right) o.push(`EN links overlap / left of the logo (${r1(N.left)} < ${r1(L.right)})`);
        if (N.right > A.left) o.push(`EN links overlap / right of the actions (${r1(N.right)} > ${r1(A.left)})`);
      } else if (A.left < L.right) o.push('EN actions overlap the logo');
    }
  } else o.push('logo or actions not measurable');
  if (m.overflow > 0) o.push(`horizontal overflow ${m.overflow}px`);
  const coords = { inner: { left: r1(m.inner.left), right: r1(m.inner.right) }, logo: L && { left: r1(L.left), right: r1(L.right) }, links: N && { left: r1(N.left), right: r1(N.right) }, actions: A && { left: r1(A.left), right: r1(A.right) } };
  cell(`${id}/order`, o.length === 0, { problems: o, coords });
  cell(`${id}/targets-44px`, m.small.length === 0, { small: m.small });
  cell(`${id}/no-language-switch`, m.cross === 0 && m.canonical.endsWith(`/${loc}`) && m.hreflang >= 3, { crossLinks: m.cross, canonical: m.canonical, hreflang: m.hreflang });
  // focus order = visual reading order (Tab through the header focusables)
  {
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.focus('body').catch(() => {});
    const xs = [];
    for (let k = 0; k < m.focusCount; k += 1) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => { const e = document.activeElement; if (!e || !e.closest('.tl-header')) return null; const b = e.getBoundingClientRect(); return { cx: b.left + b.width / 2, label: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20) }; });
      if (f) xs.push(f);
    }
    const mono = xs.every((p, k) => k === 0 || (he ? p.cx < xs[k - 1].cx + 1 : p.cx > xs[k - 1].cx - 1));
    cell(`${id}/focus-order-visual`, xs.length > 1 && mono, { sequence: xs.map((p) => `${p.label}@${Math.round(p.cx)}`) });
  }
  // drawer at collapsed widths
  if (collapsed && m.toggle.visible) {
    await page.click('.tl-header .tl-menu-toggle');
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => { const dr = document.querySelector('#tl-menu-drawer'); if (!dr) return null; const b = dr.getBoundingClientRect(); const bd = (dr.closest('.tl-drawer-backdrop') || document.documentElement).getBoundingClientRect(); /* the drawer sits in a fixed inset:0 backdrop = the visible viewport (the stable scrollbar gutter is outside it) */ const links = [...dr.querySelectorAll('a, button')].map((a) => a.getAttribute('href') || ''); return { left: b.left - bd.left, right: b.right, vw: bd.right, sections: links.filter((h) => h.startsWith('#')).length, login: links.some((h) => h.startsWith('/dashboard')) }; });
    const sideOk = d && (he ? Math.abs(d.right - d.vw) <= 2 : Math.abs(d.left) <= 2);
    cell(`${id}/drawer`, !!d && sideOk && d.sections >= 4 && d.login, { drawer: d });
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.screenshot({ path: join(OUT, `header-${loc}-${vp.w}${MUT ? `-${MUT}` : ''}.png`), clip: { x: 0, y: 0, width: vp.w, height: 90 } });
  await ctx.close();
}
await browser.close();
const fail = cells.filter((c) => c.result === 'FAIL');
writeFileSync(join(OUT, `header-order${MUT ? `-${MUT}` : ''}.json`), JSON.stringify({ gate: 'task16 landing header physical order (Owner 2026-10-06)', base: BASE, mutation: MUT || null, servedIdentity: identity && { buildSha: identity.buildSha, buildInputDigest: identity.buildInputDigest, dirty: identity.dirty, mode: identity.mode }, pass: cells.length - fail.length, fail: fail.length, cells }, null, 1));
console.log(`HEADER ORDER GATE${MUT ? ` [negative: ${MUT}]` : ''}: ${cells.length - fail.length} PASS / ${fail.length} FAIL (${identity ? identity.buildSha.slice(0, 12) : 'identity unknown'})`);
process.exit(fail.length ? 1 : 0);
