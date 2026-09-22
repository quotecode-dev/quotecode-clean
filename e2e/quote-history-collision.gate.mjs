// IRON-QH-LAYOUT-001 - QUOTE HISTORY SEMANTIC COLLISION GATE + HE/EN PARITY (canonical 5186, real Chromium, real DOM boxes).
// Why the old checks missed the EN collision: they asserted the TABLE stayed inside the viewport and read computed column widths;
// the amount (.pf-money-slot 8.4em ~121px) lived in an 86px column with 12px cell padding (~62px usable) and simply PAINTED over the
// status column. Nothing measured the rendered semantic boxes against each other.
// This gate, per market (HE/Local/RTL, EN/International/LTR) x width (1280/1440/1920 desktop, 320/360/390/412 mobile):
//   - waits for document.fonts.ready AND the product font (Rubik) actually loaded;
//   - filters to the IRONSTRESS stress fixtures and REQUIRES them all (7 amounts up to 9,999,999.99, long HE + EN client names,
//     the longest real quote number, every status incl. "Unfinished draft") - an empty/partial list is a FAIL, never a PASS;
//   - per row, reads the real bounding boxes of [data-qh] = action | client | number | amount | status | date and FAILS on any
//     intersection area > 0 or a rendered gap < QH_MIN_GAP (4px) for: amount<->status, status<->date, number<->amount,
//     client<->number, action<->adjacent field; protected fields (number/amount/status/date) must not be clipped;
//   - desktop: header <th> and body <td> of every column share the same x-range (one geometry source);
//   - HE/EN parity: same fields, safe gaps on both, equivalent client capacity, mirrored direction, market date + money format.
import process from 'node:process';
import { chromium, personas, baseFromArgs, openAuthed, servedIdentity, identityProblems, evidenceDir, shot, writeEvidence } from './lib/canonical.mjs';

const base = baseFromArgs();
const NEG = process.argv.includes('--negative-control');
const outName = NEG ? 'quote-history-collision.NEGATIVE-CONTROL.json' : (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'quote-history-collision.json');
// --negative-control re-imposes the PRE-FIX geometry (86px amount column + 12px cell padding + fixed 8.4em slot) to prove the gate FAILS it.
const { PERSONA_A, PERSONA_EN } = personas;
export const QH_MIN_GAP = 4;
const DESKTOP = [1280, 1440, 1920];
const MOBILE = [320, 360, 390, 412];
const EXPECT = {
  he: {
    amounts: ['₪10.00', '₪100.00', '₪1,000.00', '₪10,000.00', '₪100,000.00', '₪1,000,000.00', '₪10,000,000.00'],
    statuses: ['טיוטה', 'נשלח', 'אושר', 'שולם', 'טיוטה לא גמורה'], longName: 'לקוח סינתטי עם שם ארוך במיוחד', longNumber: 'A2147483600',
    dateClient: 'לקוח תאריך IRONSTRESS', date: '13/09/2026', dateRe: /^\d{2}\/\d{2}\/\d{4}$/, dir: 'rtl',
  },
  en: {
    amounts: ['$10.00', '$100.00', '$1,000.00', '$10,000.00', '$100,000.00', '$1,000,000.00', '$9,999,999.99'],
    statuses: ['Draft', 'Sent', 'Approved', 'Paid', 'Unfinished draft'], longName: 'Synthetic Extraordinarily Long Client Name', longNumber: 'A2147483601',
    dateClient: 'Date Fixture IRONSTRESS', date: '09/13/2026', dateRe: /^\d{2}\/\d{2}\/\d{4}$/, dir: 'ltr',
  },
};
const PAIRS = [['amount', 'status'], ['status', 'date'], ['number', 'amount'], ['client', 'number'], ['action', 'client'], ['action', 'number']];
const dir = evidenceDir('quote-history-collision');

function collect() {
  const rows = [...document.querySelectorAll('tbody tr, .quote-card')].filter((r) => r.querySelector('[data-qh]'));
  const clipped = (el) => { const r = el.getBoundingClientRect(); for (let a = el.parentElement; a && !a.classList.contains('dash-main-content'); a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible' || cs.overflow === 'hidden') { const ar = a.getBoundingClientRect(); if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) return true; } } return false; };
  const layout = document.querySelector('[data-qh-layout]')?.dataset.qhLayout;
  const out = rows.map((row) => {
    const f = {};
    for (const el of row.querySelectorAll('[data-qh]')) {
      const k = el.dataset.qh; if (f[k]) continue;
      const r = el.getBoundingClientRect();
      f[k] = { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, text: (el.innerText || '').trim(), clipped: clipped(el), scrollOverflow: el.scrollWidth > el.clientWidth + 1 };
    }
    return { fields: f, title: row.querySelector('[title]')?.getAttribute('title') || '' };
  });
  let columns = null;
  const heads = [...document.querySelectorAll('.pf-head-gutter thead th')];
  const body = document.querySelector('.pf-screen-body tbody tr');
  if (heads.length && body) columns = heads.map((th, i) => { const a = th.getBoundingClientRect(); const b = body.children[i]?.getBoundingClientRect(); return { i, head: [a.left, a.right], body: b ? [b.left, b.right] : null }; });
  return { layout, htmlDir: document.documentElement.dir, rows: out, columns, vw: document.documentElement.clientWidth };
}

const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
const gap = (a, b) => Math.max(Math.max(b.x - a.r, a.x - b.r, 0), Math.max(b.y - a.b, a.y - b.b, 0));

export function judgeCell(m, lang, desktop) {
  const e = EXPECT[lang]; const fails = []; const pairStats = {};
  if (!m.rows.length) fails.push('no rows rendered (empty list never passes)');
  if (m.htmlDir !== e.dir) fails.push(`document dir ${m.htmlDir} != ${e.dir}`);
  if ((desktop && m.layout !== 'table') || (!desktop && m.layout !== 'cards')) fails.push(`layout ${m.layout} unexpected for ${desktop ? 'desktop' : 'mobile'}`);
  const texts = (k) => m.rows.map((r) => r.fields[k]?.text).filter(Boolean);
  for (const a of e.amounts) if (!texts('amount').includes(a)) fails.push(`stress amount ${a} missing`);
  for (const s of e.statuses) if (!texts('status').includes(s)) fails.push(`status "${s}" missing`);
  if (!m.rows.some((r) => (r.title || r.fields.client?.text || '').includes(e.longName))) fails.push('long client name fixture missing');
  if (!texts('number').includes(e.longNumber)) fails.push(`long quote number ${e.longNumber} missing`);
  const dateRow = m.rows.find((r) => (r.fields.client?.text || '').includes(e.dateClient.split(' ')[0]) && (r.title || r.fields.client?.text || '').includes('IRONSTRESS') && r.fields.date?.text === e.date);
  if (!dateRow) fails.push(`date fixture ${e.date} not rendered`);
  for (const d of texts('date')) if (!e.dateRe.test(d)) { fails.push(`date "${d}" violates the market format`); break; }
  for (const [ri, row] of m.rows.entries()) {
    const f = row.fields;
    for (const k of ['number', 'amount', 'status', 'date']) { if (!f[k]) fails.push(`row ${ri}: field ${k} missing`); else if (f[k].clipped || f[k].scrollOverflow) fails.push(`row ${ri}: protected field ${k} "${f[k].text}" is clipped`); }
    if (!f.client || !f.action) fails.push(`row ${ri}: client/action missing`);
    for (const [a, b] of PAIRS) {
      if (!f[a] || !f[b]) continue;
      const ia = inter(f[a], f[b]); const g = gap(f[a], f[b]);
      const key = `${a}<->${b}`; pairStats[key] = pairStats[key] ? { minGap: Math.min(pairStats[key].minGap, g), maxIntersection: Math.max(pairStats[key].maxIntersection, ia) } : { minGap: g, maxIntersection: ia };
      if (ia > 0) fails.push(`row ${ri}: ${key} INTERSECT ${ia.toFixed(1)}px² ("${f[a].text}" / "${f[b].text}")`);
      else if (g < QH_MIN_GAP) fails.push(`row ${ri}: ${key} gap ${g.toFixed(2)}px < ${QH_MIN_GAP}px`);
    }
  }
  if (desktop) {
    if (!m.columns) fails.push('desktop header/body columns not measurable');
    else for (const c of m.columns) if (!c.body || Math.abs(c.head[0] - c.body[0]) > 0.5 || Math.abs(c.head[1] - c.body[1]) > 0.5) fails.push(`column ${c.i}: header x ${c.head.map((v) => v.toFixed(1))} != body x ${c.body ? c.body.map((v) => v.toFixed(1)) : 'none'}`);
  }
  return { fails, pairStats };
}

const identity = { before: await servedIdentity(base) };
const cells = []; const shots = []; const largeRow = {};
for (const [lang, persona] of [['he', PERSONA_A], ['en', PERSONA_EN]]) {
  for (const w of [...DESKTOP, ...MOBILE]) {
    const desktop = w >= 1000; const browser = await chromium.launch();
    const id = `${lang.toUpperCase()}/${w}px`;
    try {
      const { ctx, page, loaded } = await openAuthed(browser, { persona, lang, base, viewport: { width: w, height: desktop ? 1000 : 900 }, mobile: !desktop });
      const s = page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first();
      await s.fill('IRONSTRESS'); await page.waitForTimeout(1500);
      if (NEG) await page.addStyleTag({ content: '[data-qh-layout]{--qh-col-amount:86px!important;--pf-money-slot-size:8.4em!important} td:has(> [data-qh="amount"]){padding-inline:12px!important}' });
      await page.evaluate(() => document.fonts.ready);
      // make every fixture row paint (the list scrolls inside .pf-screen-body)
      if (!desktop) await page.setViewportSize({ width: w, height: 2600 });
      else await page.setViewportSize({ width: w, height: 2000 });
      await page.waitForTimeout(700);
      const m = await page.evaluate(collect);
      const { fails, pairStats } = judgeCell(m, lang, desktop);
      const idp = identityProblems({ served: identity.before, loaded });
      const cell = { id, lang, width: w, layout: m.layout, rows: m.rows.length, pairStats, fails: [...fails, ...idp.map((p) => `identity: ${p}`)], loadedIdentity: loaded.build, font: loaded.font };
      const big = m.rows.find((r) => r.fields.amount?.text === EXPECT[lang].amounts[6]);
      if (big) largeRow[id] = { amount: big.fields.amount, status: big.fields.status, measuredGap: +gap(big.fields.amount, big.fields.status).toFixed(2), intersection: inter(big.fields.amount, big.fields.status) };
      cell.status = cell.fails.length ? 'FAIL' : 'PASS';
      if (cell.fails.length) console.log('FAIL', id, cell.fails.slice(0, 4).join(' | '));
      await page.setViewportSize({ width: w, height: desktop ? 1000 : 900 }); await page.waitForTimeout(400);
      if ([1280, 1440, 1920, 390, 412].includes(w)) shots.push({ cell: id, ...(await shot(page, dir, `${lang}-${w}.png`)) });
      if (w === 1440 && big) {
        const rowSel = desktop ? 'tbody tr' : '.quote-card';
        const rowLoc = page.locator(rowSel).filter({ hasText: EXPECT[lang].amounts[6] }).first();
        await rowLoc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
        const bb = await rowLoc.boundingBox();
        if (bb) shots.push({ cell: `${id}/large-amount-row`, ...(await shot(page, dir, `${lang}-1440-large-amount-row.png`, { clip: { x: 0, y: Math.max(0, bb.y - 50), width: w, height: bb.height + 100 } })) });
        largeRow[id].afterScroll = await rowLoc.evaluate((row) => { const g = (k) => { const r = row.querySelector(`[data-qh="${k}"]`).getBoundingClientRect(); return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2), w: +r.width.toFixed(2), text: row.querySelector(`[data-qh="${k}"]`).innerText.trim() }; }; return { amount: g('amount'), status: g('status') }; });
      }
      cells.push(cell);
      await ctx.close();
    } catch (e) { cells.push({ id, lang, width: w, status: 'FAIL', fails: [`not reachable: ${String(e.message).split('\n')[0].slice(0, 140)}`] }); console.log('FAIL', id, e.message.split('\n')[0]); }
    await browser.close();
  }
}

// HE/EN parity per width (mirrored layout, same fields, safe gaps, equivalent client capacity)
const parity = [];
for (const w of [...DESKTOP, ...MOBILE]) {
  const he = cells.find((c) => c.id === `HE/${w}px`); const en = cells.find((c) => c.id === `EN/${w}px`);
  const p = { width: w, fails: [] };
  if (!he?.pairStats || !en?.pairStats) p.fails.push('a side is missing');
  else {
    const hk = Object.keys(he.pairStats).sort().join(','); const ek = Object.keys(en.pairStats).sort().join(',');
    if (hk !== ek) p.fails.push(`semantic pair sets differ HE[${hk}] EN[${ek}]`);
    for (const k of Object.keys(he.pairStats)) { if (he.pairStats[k].minGap < QH_MIN_GAP || en.pairStats[k]?.minGap < QH_MIN_GAP) p.fails.push(`${k} unsafe gap HE ${he.pairStats[k].minGap.toFixed(1)} / EN ${en.pairStats[k]?.minGap?.toFixed(1)}`); }
    if (he.layout !== en.layout) p.fails.push(`layout differs HE ${he.layout} / EN ${en.layout}`);
  }
  p.status = p.fails.length ? 'FAIL' : 'PASS'; parity.push(p);
}

const b2 = await chromium.launch(); const post = await openAuthed(b2, { persona: PERSONA_EN, lang: 'en', base, viewport: { width: 1440, height: 900 } });
identity.after = await servedIdentity(base); identity.afterLoaded = post.loaded; await b2.close();
identity.problems = [...identityProblems({ served: identity.before }), ...identityProblems({ served: identity.after, loaded: identity.afterLoaded })];
const failed = cells.filter((c) => c.status !== 'PASS'); const pfailed = parity.filter((p) => p.status !== 'PASS');
const verdict = !failed.length && !pfailed.length && !identity.problems.length ? 'PASS' : 'FAIL';
const ev = writeEvidence(dir, outName, { gate: 'QUOTE HISTORY SEMANTIC COLLISION GATE + HE/EN PARITY (IRON-QH-LAYOUT-001)', base, minGap: QH_MIN_GAP, pairs: PAIRS, at: new Date().toISOString(), identity, verdict, cells, parity, largeAmountStatusEvidence: largeRow, screenshots: shots });
console.log(`QUOTE HISTORY COLLISION GATE: ${verdict} (${cells.length - failed.length}/${cells.length} cells, parity ${parity.length - pfailed.length}/${parity.length}, identity problems ${identity.problems.length}) evidence sha256 ${ev.sha256}`);
process.exit(verdict === 'PASS' ? 0 : 1);
