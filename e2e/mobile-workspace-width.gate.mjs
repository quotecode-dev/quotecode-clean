// IRON-MOBILE-WIDTH-001 - MOBILE GEOMETRY GATE (canonical 5186, real Chromium, mobile emulation). Rewritten after the Codex review:
// the old gate compared each layer with its OWN token (self-referential), measured the first child of the scroll body (a list
// wrapper, not the card or its text) and ran on a temporary port - so a card at 14px with text at ~25px from the viewport passed.
// This gate measures the FINAL visible geometry:
//   viewport | shell | workspace (.dash-main-content) | work-screen (.pf-screen) | screen body | primary list/card outer bounds |
//   first visible semantic content | every nested horizontal padding/margin/border contribution (outer gutter vs card-internal)
// Usage: IRON_SYNTHETIC_ALLOWLIST=... IRON_CANDIDATE_SHA=... IRON_CANDIDATE_DIGEST=... IRON_DIST_DIR=... node e2e/mobile-workspace-width.gate.mjs [base] [outJson]
// FAILS when (per protected screen x locale x width): primary card outer inset > 8px on a side | visible content inset > 18px |
// left/right asymmetry > 2px | primary card width < 95% of the viewport | horizontal overflow > 1px (page or screen body) |
// no primary card rendered | canonical identity/font check fails before or after the suite.
import process from 'node:process';
import { chromium, personas, baseFromArgs, openAuthed, servedIdentity, identityProblems, evidenceDir, shot, writeEvidence } from './lib/canonical.mjs';

const base = baseFromArgs();
const NEG = process.argv.includes('--negative-control');
const outName = NEG ? 'mobile-geometry.NEGATIVE-CONTROL.json' : (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'mobile-geometry.json');
// --negative-control re-imposes the PRE-FIX nested screen-card gutter (8px) to prove the gate FAILS it.
const { PERSONA_A, PERSONA_EN } = personas;
export const LIMITS = { outerInsetMax: 8, contentInsetMax: 18, cardInnerInsetMax: 12, asymmetryMax: 2, widthPctMin: 95, overflowMax: 1 };
const WIDTHS = [320, 360, 390, 412];
const MARKETS = [['he', 'HE/Local/RTL', PERSONA_A, 'לקוח תאריך IRONSTRESS'], ['en', 'EN/International/LTR', PERSONA_EN, 'Date Fixture IRONSTRESS']];
const dir = evidenceDir('mobile-geometry');

const nav = (p, name) => p.locator('.mobile-bottom-nav').getByRole('button', { name }).click();
const goQuotes = (p) => nav(p, /^(Quotes|הצעות מחיר)$/);
const more = async (p, name) => { await nav(p, /^(More|עוד)$/); await p.getByRole('menuitem', { name }).click(); };
const search = async (p, text) => { const s = p.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first(); await s.fill(text); await p.waitForTimeout(900); };
const SCREENS = [
  { id: 'dashboard', primary: '.dash-upper-section', open: async (p) => { await goQuotes(p); await search(p, 'IRONSTRESS'); } },
  { id: 'quote-history', primary: '.quote-card', open: async (p) => { await goQuotes(p); await search(p, 'IRONSTRESS'); } },
  { id: 'new-quote', primary: '.pf-screen .pf-m-surface', open: async (p) => { await nav(p, /^(New|חדש)$/); await p.getByTestId('sq-step-1').waitFor({ timeout: 20000 }); } },
  { id: 'edit-quote', primary: '.pf-screen .pf-m-surface', open: async (p, m) => {
    await goQuotes(p); await search(p, m.dateClient);
    await p.locator('.quote-card').filter({ hasText: m.dateClient }).first().locator('button').first().click();
    await p.getByRole('button', { name: /^(Edit|ערוך)$/ }).first().click(); await p.getByTestId('sq-step-1').waitFor({ timeout: 20000 });
  } },
  { id: 'clients', primary: '.client-card', open: async (p) => nav(p, /^(Clients|לקוחות)$/) },
  { id: 'finances', primary: '.pf-screen .pf-m-grid, .pf-screen .pf-m-surface:not(.pf-m-grid .pf-m-surface)', cards: '.pf-screen .pf-m-surface', open: async (p) => nav(p, /^(Finances|פיננסים)$/) },
  { id: 'catalog', primary: '.pf-screen-body table', open: async (p) => more(p, /^(Catalog|קטלוג)$/) },
  { id: 'settings', primary: '.pf-screen .pf-m-surface', open: async (p) => more(p, /^(Settings|הגדרות)$/) },
];

// Runs in the page: final geometry of the primary cards + their visible semantic content.
function measure({ primary, cards: cardSel, isRtl }) {
  const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
  const R = (r) => (r ? { l: +r.left.toFixed(2), r: +(vw - r.right).toFixed(2), w: +r.width.toFixed(2), top: +r.top.toFixed(2) } : null);
  const box = (sel) => { const el = document.querySelector(sel); return el ? R(el.getBoundingClientRect()) : null; };
  const visible = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const clipRect = (node, base) => { // intersect with every overflow-clipping ancestor (ellipsis text never counts outside its clip)
    let r = { left: base.left, right: base.right };
    for (let a = node.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); r = { left: Math.max(r.left, ar.left), right: Math.min(r.right, ar.right) }; }
      if (a.classList && a.classList.contains('dash-main-content')) break;
    }
    return r.right - r.left >= 1 ? r : null;
  };
  const contentRects = (el) => {
    const out = []; const pr = el.getBoundingClientRect();
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim() || !visible(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) { if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh) continue; const c = clipRect(n, r); if (c) out.push({ ...c, kind: 'text' }); }
    }
    const painted = (e) => { const cs = getComputedStyle(e); const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(',').map((x) => parseFloat(x)); return p.length === 4 ? p[3] : 1; }; return alpha(cs.backgroundColor) > 0 || ['Left', 'Right', 'Top', 'Bottom'].some((sd) => parseFloat(cs[`border${sd}Width`]) > 0 && alpha(cs[`border${sd}Color`]) > 0); };
    el.querySelectorAll('*').forEach((e) => {
      const tag = e.tagName.toLowerCase();
      const isControl = ['svg', 'img', 'canvas', 'input', 'select', 'textarea', 'button'].includes(tag);
      if (tag !== 'svg' && e.closest('svg')) return;
      if (!isControl && !painted(e)) return;
      if (!visible(e)) return;
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      // a wrapper flush with the card's own edges (e.g. a full-card toggle button) IS the card, not content inside it
      if (Math.abs(r.left - pr.left) <= 2 && Math.abs(r.right - pr.right) <= 2) return;
      const c = clipRect(e, r); if (c) out.push({ ...c, kind: isControl ? tag : 'painted' });
    });
    return out;
  };
  const chainOf = (el) => {
    const chain = [];
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a); const f = (v) => +parseFloat(v || 0).toFixed(2);
      const c = { el: `${a.tagName.toLowerCase()}${typeof a.className === 'string' && a.className.trim() ? `.${a.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`, padL: f(cs.paddingLeft), padR: f(cs.paddingRight), marL: f(cs.marginLeft), marR: f(cs.marginRight), bL: f(cs.borderLeftWidth), bR: f(cs.borderRightWidth) };
      if (c.padL || c.padR || c.marL || c.marR || c.bL || c.bR) chain.push(c);
    }
    return chain;
  };
  const els = [...document.querySelectorAll(primary)].filter(visible).filter((e) => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0; }).slice(0, 8);
  const cardEls = cardSel ? [...document.querySelectorAll(cardSel)].filter(visible).filter((e) => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0; }).slice(0, 8) : els;
  const lists = els.map((e) => R(e.getBoundingClientRect()));
  const cards = cardEls.map((e) => {
    const rects = contentRects(e);
    const cl = rects.length ? Math.min(...rects.map((r) => r.left)) : null;
    const cr = rects.length ? Math.min(...rects.map((r) => vw - r.right)) : null;
    const cs = getComputedStyle(e); const f = (v) => +parseFloat(v || 0).toFixed(2); const er = e.getBoundingClientRect();
    const paintsOutside = rects.filter((r) => r.left < er.left - 0.5 || r.right > er.right + 0.5).length;
    return { outer: R(er), paintsOutside, inner: rects.length ? { left: +(Math.min(...rects.map((r) => r.left)) - er.left).toFixed(2), right: +(er.right - Math.max(...rects.map((r) => r.right))).toFixed(2) } : null, content: { left: cl === null ? null : +cl.toFixed(2), right: cr === null ? null : +cr.toFixed(2), boxes: rects.length }, internal: { padL: f(cs.paddingLeft), padR: f(cs.paddingRight), bL: f(cs.borderLeftWidth), bR: f(cs.borderRightWidth) } };
  });
  const body = document.querySelector('.dash-main-content .pf-screen-body');
  return {
    vw, isRtl, dir: document.documentElement.dir,
    shell: box('.dash-app-shell'), workspace: box('.dash-main-content'), workScreen: box('.dash-main-content .pf-screen'), screenBody: box('.dash-main-content .pf-screen-body'),
    lists, cards, chainOfFirstCard: cardEls[0] ? chainOf(cardEls[0]) : [],
    overflow: { page: document.documentElement.scrollWidth - vw, screenBody: body ? body.scrollWidth - body.clientWidth : 0 },
  };
}

export function judge(m) {
  const fails = [];
  if (!m.lists.length || !m.cards.length) fails.push('no primary list/card rendered (an empty screen never passes)');
  for (const [i, o] of m.lists.entries()) {
    const tag = `list[${i}]`;
    if (o.l > LIMITS.outerInsetMax + 0.01 || o.r > LIMITS.outerInsetMax + 0.01) fails.push(`${tag} outer inset ${o.l}/${o.r} > ${LIMITS.outerInsetMax}px`);
    if (Math.abs(o.l - o.r) > LIMITS.asymmetryMax) fails.push(`${tag} asymmetry ${Math.abs(o.l - o.r).toFixed(2)} > ${LIMITS.asymmetryMax}px`);
    const pct = (o.w / m.vw) * 100; if (pct < LIMITS.widthPctMin) fails.push(`${tag} width ${pct.toFixed(1)}% < ${LIMITS.widthPctMin}%`);
  }
  const atEdge = (c, side) => c.outer[side] <= LIMITS.outerInsetMax + 0.01; // this card side sits on the viewport edge (not a grid-interior side)
  for (const [i, c] of m.cards.entries()) {
    const tag = `card[${i}]`;
    if (c.paintsOutside) fails.push(`${tag} ${c.paintsOutside} content box(es) paint OUTSIDE the card (collision/overflow)`);
    const leadSide = m.isRtl ? 'r' : 'l';
    const lead = m.isRtl ? c.content.right : c.content.left;
    if (lead === null) { fails.push(`${tag} has no visible semantic content`); continue; }
    if (atEdge(c, leadSide)) { if (lead > LIMITS.contentInsetMax + 0.01) fails.push(`${tag} visible content starts ${lead}px from the ${m.isRtl ? 'right' : 'left'} viewport edge > ${LIMITS.contentInsetMax}px`); }
    else { const inner = m.isRtl ? c.inner.right : c.inner.left; if (inner > LIMITS.cardInnerInsetMax + 0.01) fails.push(`${tag} (grid-interior) content starts ${inner}px inside the card > ${LIMITS.cardInnerInsetMax}px`); }
  }
  const trailSide = m.isRtl ? 'l' : 'r';
  const trailing = m.cards.filter((c) => atEdge(c, trailSide)).map((c) => (m.isRtl ? c.content.left : c.content.right)).filter((v) => v !== null);
  if (trailing.length && Math.min(...trailing) > LIMITS.contentInsetMax + 0.01) fails.push(`trailing visible content inset ${Math.min(...trailing)}px > ${LIMITS.contentInsetMax}px on every card`);
  if (m.overflow.page > LIMITS.overflowMax) fails.push(`page horizontal overflow ${m.overflow.page}px`);
  if (m.overflow.screenBody > LIMITS.overflowMax) fails.push(`screen body horizontal overflow ${m.overflow.screenBody}px`);
  return fails;
}

async function closeEditor(page) {
  await page.getByRole('button', { name: /Cancel & Return|ביטול וחזרה לרשימה/ }).first().click().catch(() => {});
  await page.getByRole('button', { name: /^(Discard|Discard changes|מחיקת הטיוטה|בטל שינויים|מחק טיוטה)/ }).first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(600);
}

const identity = { before: await servedIdentity(base) };
const results = []; const shots = [];
for (const [lang, market, persona, dateClient] of MARKETS) {
  for (const w of WIDTHS) {
    const browser = await chromium.launch();
    let session;
    try { session = await openAuthed(browser, { persona, lang, base, viewport: { width: w, height: 820 }, mobile: true }); } catch (e) {
      results.push({ id: `${market}/${w}px/login`, status: 'FAIL', fails: [`login: ${String(e.message).slice(0, 120)}`] }); await browser.close(); continue;
    }
    const { page, loaded } = session;
    const idProblems = identityProblems({ served: identity.before, loaded });
    for (const s of SCREENS) {
      const cell = { id: `${market}/${w}px/${s.id}`, lang, market, width: w, screen: s.id, loadedIdentity: loaded.build, loadedIdentityProblems: idProblems };
      try {
        await s.open(page, { dateClient }); await page.waitForTimeout(1300);
        if (NEG) await page.addStyleTag({ content: '@media (max-width:768px){.pf-work-screen{padding-inline:8px!important}}' });
        await page.evaluate(() => document.fonts.ready);
        cell.measured = await page.evaluate(measure, { primary: s.primary, cards: s.cards || null, isRtl: lang === 'he' });
        cell.fails = [...judge(cell.measured), ...idProblems.map((p) => `identity: ${p}`)];
        if (w === 390 || w === 412) shots.push({ cell: cell.id, ...(await shot(page, dir, `${lang}-${w}-${s.id}.png`)) });
      } catch (e) { cell.fails = [`screen not reachable: ${String(e.message).split('\n')[0].slice(0, 140)}`]; }
      cell.status = cell.fails.length ? 'FAIL' : 'PASS';
      if (cell.fails.length) console.log('FAIL', cell.id, cell.fails.join(' | '));
      results.push(cell);
      if (s.id === 'new-quote' || s.id === 'edit-quote') await closeEditor(page);
    }
    await session.ctx.close(); await browser.close();
  }
}
const b2 = await chromium.launch();
const post = await openAuthed(b2, { persona: PERSONA_EN, lang: 'en', base, viewport: { width: 390, height: 820 }, mobile: true });
identity.after = await servedIdentity(base); identity.afterLoaded = post.loaded; await b2.close();
identity.problems = [...identityProblems({ served: identity.before }), ...identityProblems({ served: identity.after, loaded: identity.afterLoaded })];
const failed = results.filter((r) => r.status !== 'PASS');
const verdict = failed.length === 0 && identity.problems.length === 0 ? 'PASS' : 'FAIL';
const ev = writeEvidence(dir, outName, { gate: 'MOBILE GEOMETRY GATE (IRON-MOBILE-WIDTH-001, final card/text bounds)', base, limits: LIMITS, at: new Date().toISOString(), identity, cells: results.length, failed: failed.length, verdict, screenshots: shots, results });
console.log(`MOBILE GEOMETRY GATE: ${verdict} (${results.length - failed.length}/${results.length} cells PASS; identity problems: ${identity.problems.length}) evidence sha256 ${ev.sha256}`);
process.exit(verdict === 'PASS' ? 0 : 1);
