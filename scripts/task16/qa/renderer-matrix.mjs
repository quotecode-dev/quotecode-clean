// Task 16 - RENDERER MATRIX gate (cloud, 2026-10-05; LOCAL-DEV). Screen-only checks of the two renderers that are NOT
// the public /quote route (that one, with Print and Direct PDF, is public-quote-outputs.mjs):
//   1. the landing illustration document (LandingQuoteDocument: hero + the Classic/Modern/Visual showcase tabs);
//   2. the shared quote document on /:lang/sample-quote (PublicQuote / PublicQuoteEn in previewMode; same document as
//      /creator's preview), Classic/Modern/Visual x short/long.
// For HE/EN x 320/360/390/412/768/1024/1280 it checks:
//   roles        client block first (label לכבוד / To + client name), independent contact block (לידי / Attn), no business
//                text in the parties area; parties area >= 480px wide: HE client right / contact left, EN mirrored; narrower:
//                contact below the client (or on the language side)
//   centring     Quantity / Unit price / Amount header + body cells: text-ink centre within 1px of the cell content centre
//                (Owner decision 2026-10-05, local exception to IRON-NUMERIC-001); description column keeps its direction
//   totals       sample-quote only: totals values share one right edge (spread <= 0.75px)
//   overflow     no page horizontal scroll, no item-table cell whose content is wider than the cell
// Exit 0 = all PASS, 1 = any FAIL, 2 = setup error. Static synthetic content only; no backend, no persona; not TEST.
// Usage: [PW_CHROMIUM=<path>] node scripts/task16/qa/renderer-matrix.mjs <buildUrl> <out.json>   (127.0.0.1, never 5186)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import process from 'node:process';

const [BUILD, OUT] = process.argv.slice(2);
if (!BUILD || !OUT) { console.error('usage: renderer-matrix.mjs <buildUrl> <out.json>'); process.exit(2); }
{ const u = new URL(BUILD); if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.port === '5186') { console.error(`refusing ${BUILD}`); process.exit(2); } }
const WIDTHS = (process.env.RM_WIDTHS || '320,360,390,412,768,1024,1280').split(',').map(Number);
const CENTRE_TOL = 1;
const TOTALS_SPREAD = 0.75;
const LANDING_BIZ = { he: ['סטודיו קו וחומר', 'נגרות בהתאמה אישית'], en: ['Line & Grain Studio', 'Bespoke joinery'] };
const LABELS = { he: { client: 'לכבוד', contact: 'לידי' }, en: { client: 'To', contact: 'Attn' } };

const cells = [];
const cell = (id, pass, detail) => cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail });

// in-page: generic measurement of one document root
function measure({ root, numSel, descSel, partiesSel, nameSel, biz, totalsSel }) {
  const doc = document.querySelector(root);
  if (!doc) return { error: `no ${root}` };
  const prevT = doc.style.transform; doc.style.transform = 'none'; // landing hero tilt: off only while measuring
  const ink = (el) => {
    const rects = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.width > 0 && b.height > 0) rects.push(b);
    }
    return rects.length ? { left: Math.min(...rects.map((b) => b.left)), right: Math.max(...rects.map((b) => b.right)) } : null;
  };
  const num = [...doc.querySelectorAll(numSel)].filter((c) => c.getBoundingClientRect().width > 0);
  let worst = 0; const off = []; const over = [];
  for (const c of num) {
    const cs = getComputedStyle(c); const b = c.getBoundingClientRect();
    const L = b.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const R = b.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const k = ink(c); if (!k) continue;
    const d = Math.abs((k.left + k.right) / 2 - (L + R) / 2);
    worst = Math.max(worst, d);
    if (d > 1) off.push({ text: c.innerText.trim().slice(0, 20), d: +d.toFixed(2) });
  }
  for (const c of doc.querySelectorAll('table td, table th')) if (c.getBoundingClientRect().width > 0 && c.scrollWidth > c.clientWidth + 1) over.push({ text: c.innerText.trim().slice(0, 20), scroll: c.scrollWidth, client: c.clientWidth });
  const desc = doc.querySelector(descSel);
  const parties = doc.querySelector(partiesSel);
  const client = doc.querySelector('[data-role="client"]');
  const contact = doc.querySelector('[data-role="contact"]');
  let side = null;
  if (client && contact) {
    const a = client.getBoundingClientRect(); const k = contact.getBoundingClientRect();
    side = k.top >= a.bottom - 0.5 ? 'contact-below' : (a.left > k.left ? 'client-right' : 'client-left');
  }
  const totals = totalsSel ? [...doc.querySelectorAll(totalsSel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (ink(e) || e.getBoundingClientRect()).right) : [];
  const nameEl = client && client.querySelector(nameSel);
  const out = {
    numericCells: num.length, worstCentre: +worst.toFixed(3), offCentre: off.slice(0, 6), cellOverflow: over.slice(0, 6),
    descAlign: desc ? getComputedStyle(desc).textAlign : null,
    clientText: client ? client.innerText.replace(/\s+/g, ' ').trim() : null,
    contactText: contact ? contact.innerText.replace(/\s+/g, ' ').trim() : null,
    clientFirst: !!(client && contact && (client.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING)),
    side,
    partiesWidth: parties ? Math.round(parties.getBoundingClientRect().width) : null,
    bizInParties: parties ? biz.filter((b) => parties.textContent.includes(b)) : ['no parties area'],
    clientName: nameEl ? `${getComputedStyle(nameEl).fontSize}/${getComputedStyle(nameEl).fontWeight}/${getComputedStyle(nameEl).color}` : null,
    totalsSpread: totals.length >= 2 ? +(Math.max(...totals) - Math.min(...totals)).toFixed(2) : null,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
  doc.style.transform = prevT;
  return out;
}

function judge(id, m, lang, width, { totals, dirOk }) {
  if (m.error) { cell(`${id}/rendered`, false, m); return; }
  const L = LABELS[lang];
  const startsWith = (t, l) => new RegExp(`^\\s*${l}\\s*:?(\\s|$)`, 'i').test(t || '');
  // side-by-side is required when the parties area is wide enough for two blocks (>= 480px); narrower: contact below
  const wantSide = m.partiesWidth >= 480 ? (lang === 'he' ? 'client-right' : 'client-left') : null;
  cell(`${id}/roles`, startsWith(m.clientText, L.client) && startsWith(m.contactText, L.contact) && m.clientFirst && m.bizInParties.length === 0
    && (wantSide ? m.side === wantSide : ['contact-below', lang === 'he' ? 'client-right' : 'client-left'].includes(m.side)),
  { client: m.clientText, contact: m.contactText, clientFirst: m.clientFirst, side: m.side, partiesWidth: m.partiesWidth, wantSide: wantSide || 'contact-below or language side', bizInParties: m.bizInParties, clientName: m.clientName });
  cell(`${id}/centring`, m.numericCells > 0 && m.offCentre.length === 0 && dirOk(m.descAlign), { numericCells: m.numericCells, worstPx: m.worstCentre, offCentre: m.offCentre, descAlign: m.descAlign, tolerancePx: CENTRE_TOL });
  if (totals) cell(`${id}/totals-axis`, m.totalsSpread !== null && m.totalsSpread <= TOTALS_SPREAD, { spreadPx: m.totalsSpread, tolerancePx: TOTALS_SPREAD });
  cell(`${id}/overflow`, m.pageOverflow <= 0 && m.cellOverflow.length === 0, { pageOverflow: m.pageOverflow, cellOverflow: m.cellOverflow });
}

let browser;
try { browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); } catch (e) { console.error(e.message); process.exit(2); }
const rows = [];
for (const lang of ['he', 'en']) {
  const dirOk = (a) => (lang === 'he' ? ['right', 'start'].includes(a) : ['left', 'start'].includes(a));
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    // 1) landing illustration
    try {
      await page.goto(`${BUILD}/${lang}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.tl-hero-paper [data-landing-doc]', { timeout: 20000 });
      const args = (root) => ({ root, numSel: 'table.tl-items .tl-num-c', descSel: 'table.tl-items thead th', partiesSel: '[data-landing-parties]', nameSel: '.tl-party-name', biz: LANDING_BIZ[lang], totalsSel: null });
      const hero = await page.evaluate(measure, args('.tl-hero-paper [data-landing-doc]'));
      rows.push({ id: `landing/${lang}/${width}/hero`, ...hero });
      judge(`landing/${lang}/${width}/hero`, hero, lang, width, { totals: false, dirOk });
      for (const style of ['classic', 'modern', 'visual']) {
        await page.click(`#tl-tab-${style}`);
        await page.waitForTimeout(250);
        const root = `#tl-style-panel [data-landing-doc="${style}"]`;
        const m = await page.evaluate(measure, args(root));
        rows.push({ id: `landing/${lang}/${width}/${style}`, ...m });
        judge(`landing/${lang}/${width}/${style}`, m, lang, width, { totals: false, dirOk });
      }
    } catch (e) { cell(`landing/${lang}/${width}/rendered`, false, { error: String(e.message).slice(0, 300) }); }
    // 2) shared quote document on /:lang/sample-quote
    for (const style of ['classic', 'modern', 'visual']) for (const length of ['short', 'long']) {
      const id = `sample/${lang}/${width}/${style}/${length}`;
      try {
        await page.goto(`${BUILD}/${lang}/sample-quote?style=${style}&length=${length}&images=0`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.pq-card table.pq-commercial-table', { timeout: 20000 });
        await page.waitForTimeout(200);
        const m = await page.evaluate(measure, { root: '.pq-card', numSel: 'table.pq-commercial-table [class*="pq-th-qty"], table.pq-commercial-table [class*="pq-th-price"], table.pq-commercial-table [class*="pq-th-total"], table.pq-commercial-table td.pq-td-qty, table.pq-commercial-table td.pq-td-price, table.pq-commercial-table tr:not(.pq-section-subtotal-row) > td.pq-td-total', descSel: 'table.pq-commercial-table thead th.pq-th-desc', partiesSel: '.pq-parties', nameSel: '.pq-recipient-name', biz: [await page.evaluate(() => document.querySelector('.pq-lh-name')?.innerText.trim() || '__none__')], totalsSel: '.pq-totals-box .pf-money' });
        rows.push({ id, ...m });
        judge(id, m, lang, width, { totals: true, dirOk });
      } catch (e) { cell(`${id}/rendered`, false, { error: String(e.message).slice(0, 300) }); }
    }
    await ctx.close();
  }
}
await browser.close();
const fail = cells.filter((c) => c.result !== 'PASS');
writeFileSync(OUT, JSON.stringify({ gate: 'task16-renderer-matrix (LOCAL-DEV, static synthetic content; not TEST, not Owner acceptance)', build: BUILD, widths: WIDTHS, generatedAt: new Date().toISOString(), pass: cells.length - fail.length, fail: fail.length, cells, rows }, null, 1));
const by = {};
for (const c of cells) { const k = `${c.id.split('/')[0]}/${c.id.split('/').pop()}`; by[k] = by[k] || [0, 0]; by[k][c.result === 'PASS' ? 0 : 1] += 1; }
console.log(`RENDERER MATRIX (LOCAL-DEV): ${cells.length - fail.length} PASS / ${fail.length} FAIL`);
for (const [k, [p, f]] of Object.entries(by)) console.log(`  ${f ? 'FAIL' : 'PASS'} ${k.padEnd(28)} ${p} pass / ${f} fail`);
for (const f of fail) console.log(`  FAIL ${f.id} ${JSON.stringify(f.detail).slice(0, 400)}`);
process.exit(fail.length ? 1 : 0);
