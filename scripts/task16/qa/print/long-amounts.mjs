// Task 16 LONG-AMOUNT GATE (LOCAL-DEV, mocked functions, synthetic data only). cloud-fix3 (A6), readability criterion
// rewritten in cloud-fix4 (A12).
//
// Fixtures (fixtures.mjs longAmounts + a sectioned variant built here; every value invented):
//   flat      7- and 8-digit amounts (unit 1,250,000 / 12,500,000), decimal quantities (3.375 m2, 12.5 m2), a long
//             multi-word description, a 7.5% discount and VAT (HE). HE = ILS (whole-shekel .00 display, half-up); EN =
//             USD / EUR / GBP (cents kept). Flat rows (no sections).
//   sections  the same items plus one long-word item in two sections, measured twice on screen: every section collapsed
//             (summary rows: item count / "—" / section subtotal) and section 1 expanded (heading row colspan 4, item
//             rows with detail lines, subtotal row colspan 3 + amount) next to the collapsed section 2.
// Surfaces:
//   public   the real route /quote/:id of a production build (get-public-quote / quote-presentation mocked)
//   sample   /:lang/sample-quote of a Vite DEV server of the same tree, with a TEST-ONLY module route mock: the dev
//            server's src/quoteDocument/sampleQuotes.js is rewritten in flight so buildSampleQuote returns this
//            fixture's quoteData (nothing in the product changes; previewMode / standalone sample rendering)
//   creator  the REAL creator preview of the Dashboard (production build, mocked synthetic session = qh/fixtures.mjs
//            mockAccount): a draft quote carrying the fixture items is opened with Edit, the preview pane is switched
//            to the "mobile" device (the 390px pq-preview container) and measured inside .qp-device. Works with the split
//            pane and with the on-demand preview sheet (ledger C01, qp-open-preview). HE-ILS + EN-USD,
//            Classic (the creator style of a quote without a saved presentation), viewport 1440x900 (split preview).
//   print    the public route at 1280x900 under print media (document width 190mm = 718px) - flat fixture
//   direct   the public route with the Direct PDF capture state emulated exactly as generateQuotePdf's clone sets it
//            (.pq-pdf-capturing on .pq-page, card width 718px, window 1100px) + the real Direct PDF downloaded once per
//            locale/style (page count recorded) - flat fixture
// Cells (every one PASS/FAIL, exit 1 on any FAIL):
//   values-complete       every expected value string visible in that state (unit prices, line totals, quantities,
//                         section subtotals, grand total) is in the card text exactly (ILS whole shekels .00; foreign
//                         cents and quantity decimals kept, never rounded)
//   no-cell-overflow      no item-table th/td with content wider than the cell (scrollWidth > clientWidth + 1)
//   no-clipped-text       no element inside the card that clips its own content, no table-wrap / page horizontal scroll
//   money-contained       every visible .pf-money / grand-total ink box inside its .pq-totals-box (if any), the card
//                         and the viewport (0.5px tolerance) - catches a total sticking out of its panel (A17 F1)
//   numbers-one-line      no number (money or quantity) split across lines; every .pf-money of the table on ONE line
//   min-font-12           (screen surfaces) no visible text in the card below 12px RENDERED size (svg text: font-size x
//                         svg scale). Only the "PDF" glyph of the exact PdfFileIcon (print/pdfIconGlyph.mjs) is excluded
//                         and every excluded node is listed in the cell detail as svgIconGlyphsExcluded (cloud-fix4b H2)
//   numeric-centred       Quantity / Unit price / Amount th + td ink centre within 1px of the cell centre
//   values-under-header   every Quantity / Unit price / Amount value ink centre within 1px of the centre of ITS OWN
//                         header cell (the value sits under the label that names it, whatever the row geometry)
//   row-integrity         a row's values lie inside that row's band (not above its description, not below the next row)
//   totals-right-axis     .pq-totals-box .pf-money right edges spread <= 0.75px
//   description-no-midword  no word of a description is split across lines, unless that single word is wider than the
//                         full table row (measured per word with Range client rects; a break after a hyphen / maqaf /
//                         slash is a normal break opportunity, not a mid-word break)
//   header-no-midword     no column header label is split inside a word
//   description-fills-lines  greedy line fill: when a description word starts a new line, it could not have fitted at
//                         the end of the previous line (lines use the width they are given)
//   description-row-width the description box takes the whole row width except what the values on ITS OWN line take;
//                         on a phone-width document (<= 420px: the existing phone breakpoint of the document - viewport,
//                         or the pq-preview container for the creator) a pq-amounts-wide table must give the description
//                         the full row (no value on its line): this is the "use the available row width" rule of the
//                         readability criterion, not a pixel floor
//   direct/pages          the real Direct PDF has >= 1 page and the download succeeds
// Recorded per cell (results[]): description width / line count per row, mid-word break count, header lines, value
// centre offsets vs header, row width, table display.
// The cloud-fix3 rule "description >= 60px" is REMOVED: a width floor is arbitrary and 35-41px with mid-word breaks
// is not readable; the criterion above is per word and per line.
// Usage: node scripts/task16/qa/print/long-amounts.mjs <outDir> <buildUrl> [<devUrl>]
//   env LA_VIEWPORTS=320x780,360x780,390x844,412x915,480x900,1280x900  LA_STYLES=classic,modern,visual
//       LA_SURFACES=public,sample,creator,print,direct  LA_FIXTURES=flat,sections  LA_MARKETS=he-ILS,en-USD,en-EUR,en-GBP
//       LA_SHOTS=1 (table screenshots of the 320px cells into <outDir>/shots)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { longAmounts, presentationFor } from './fixtures.mjs';
import { assertLocal, newQuoteContext, openQuote } from './printLib.mjs';
import { account, mockAccount } from '../qh/fixtures.mjs';
import { isPdfIconGlyph, renderedFontPx } from './pdfIconGlyph.mjs';

const [OUT, BUILD, DEV] = process.argv.slice(2);
if (!OUT || !BUILD) { console.error('usage: long-amounts.mjs <outDir> <buildUrl> [<devUrl>]'); process.exit(2); }
try { [BUILD, DEV].filter(Boolean).forEach(assertLocal); } catch (e) { console.error(e.message); process.exit(2); }
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const VIEWPORTS = list(process.env.LA_VIEWPORTS, ['320x780', '360x780', '390x844', '412x915', '480x900', '1280x900']).map((v) => { const [width, height] = v.split('x').map(Number); return { width, height, tag: v }; });
const STYLES = list(process.env.LA_STYLES, ['classic', 'modern', 'visual']);
const SURFACES = list(process.env.LA_SURFACES, ['public', 'sample', 'creator', 'print', 'direct']);
const FIXTURES = list(process.env.LA_FIXTURES, ['flat', 'sections']);
const MARKETS = list(process.env.LA_MARKETS, ['he-ILS', 'en-USD', 'en-EUR', 'en-GBP']).map((k) => { const [locale, currency] = k.split('-'); return { locale, currency }; });
const SHOTS = process.env.LA_SHOTS === '1';
const PHONE_DOC_PX = 420; // the document's existing phone breakpoint (quoteDocument.css / narrowItems.css @media + @container)
mkdirSync(join(OUT, 'pdf'), { recursive: true });
if (SHOTS) mkdirSync(join(OUT, 'shots'), { recursive: true });

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const halfUp = (n) => Math.floor(Math.abs(n) + 0.5) * Math.sign(n || 1);
const fmt2 = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyOf = (currency) => (n) => (currency === 'ILS' ? fmt2(halfUp(n)) : fmt2(round2(n)));
const qtyOf = (it) => (it.calculated_quantity != null ? (String(it.calculated_quantity).includes('.') ? Number(it.calculated_quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : String(it.calculated_quantity)) : null);

// Sectioned variant of the long-amount fixture: the three long-amount items + one item with long words, in two
// sections. Section subtotals are the sums of the stored line totals (as the renderer's presentation model sums them).
const SECTION_COPY = {
  he: { a: 'מעטפת הבניין ומערכות', b: 'גמר ופיתוח', long: { d: 'התקנת מערכות אלקטרומכניות ואינסטלציה תת-קרקעית במרתפי החניה', p: 2345678 } },
  en: { a: 'Building envelope and plant', b: 'Finishing and site works', long: { d: 'Electromechanical counterbalanced weatherproofing and underground installation in the parking basements', p: 2345678.25 } },
};
function sectioned(locale, currency) {
  const fx = longAmounts(locale, currency);
  const L = locale === 'en' ? 'en' : 'he';
  const c = SECTION_COPY[L];
  const q = fx.quoteData;
  const p = currency === 'ILS' ? Math.round(c.long.p) : c.long.p;
  const extra = { ...q.items[2], description: c.long.d, quantity: 1, unit_price: p, price: p, pricing_unit: null, calculated_quantity: null, quantity_source: null, calculation_method: null, specification: [], total_price: round2(p) };
  const items = [{ ...q.items[0], section_id: 'sec-a' }, { ...q.items[1], section_id: 'sec-a' }, { ...q.items[2], section_id: 'sec-b' }, { ...extra, section_id: 'sec-b' }];
  const subtotal = round2(items.reduce((a, i) => a + i.total_price, 0));
  const net = round2(subtotal - round2(subtotal * (Number(q.quote.discount || 0) / 100)));
  const total = round2(net * (1 + Number(q.quote.tax_rate || 0)));
  const sections = [{ id: 'sec-a', name: c.a, sort_order: 0 }, { id: 'sec-b', name: c.b, sort_order: 1 }];
  return { ...fx, name: `${fx.name}-sections`, quoteData: { ...q, quote: { ...q.quote, subtotal, total }, items, sections }, rowDescriptions: items.map((i) => i.description) };
}
const fixtureFor = (kind, m) => (kind === 'sections' ? sectioned(m.locale, m.currency) : longAmounts(m.locale, m.currency));

// Expected display strings computed from the fixture (independently of the renderer), for one display state.
//   state 'flat' = every item row; 'collapsed' = section subtotals only; 'expanded' = section 1 items + both subtotals
function expectedStrings(fx, currency, state) {
  const money = moneyOf(currency);
  const q = fx.quoteData;
  const out = [];
  const itemStrings = (it) => { out.push(money(it.unit_price), money(it.total_price)); const s = qtyOf(it); if (s) out.push(s); };
  if (state === 'flat') q.items.forEach(itemStrings);
  else {
    for (const s of q.sections) out.push(money(q.items.filter((i) => i.section_id === s.id).reduce((a, i) => a + i.total_price, 0)));
    if (state === 'expanded') q.items.filter((i) => i.section_id === q.sections[0].id).forEach(itemStrings);
  }
  out.push(money(q.quote.total));
  return [...new Set(out)];
}

function probe({ checkFont, expected, phoneDocPx }) {
  const card = document.querySelector('.pq-card');
  const cs = (e) => getComputedStyle(e);
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = cs(e); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const short = (e) => `${e.tagName.toLowerCase()}.${(typeof e.className === 'string' ? e.className : '').split(' ')[0]}`;
  const r2 = (n) => Math.round(n * 100) / 100;
  const text = card.innerText.replace(/\s+/g, ' ');
  const missing = expected.filter((s) => !text.includes(s));
  const cellOverflow = [];
  for (const td of card.querySelectorAll('table th, table td')) if (vis(td) && td.scrollWidth > td.clientWidth + 1) cellOverflow.push({ text: td.innerText.trim().slice(0, 30), scroll: td.scrollWidth, client: td.clientWidth });
  const clipped = [];
  for (const e of card.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const s = cs(e);
    if (/(hidden|clip|auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1) clipped.push({ el: short(e), text: (e.innerText || '').trim().slice(0, 30), scroll: e.scrollWidth, client: e.clientWidth, overflowX: s.overflowX });
  }
  const pageScroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  // ---- line geometry helpers (Range client rects) ----
  const lineCount = (rects) => {
    const mids = rects.filter((b) => b.width > 0 && b.height > 0).map((b) => (b.top + b.bottom) / 2).sort((a, b) => a - b);
    let n = 0; let last = -1e9;
    for (const m of mids) { if (m - last > 2) n += 1; last = m; }
    return n;
  };
  const textNodes = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim() && n.parentElement && vis(n.parentElement)) out.push(n); return out; };
  const rangeRects = (node, a, b) => { const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b); return [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0); };
  const contentBox = (el) => { const b = el.getBoundingClientRect(); const s = cs(el); return { left: b.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), right: b.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth) }; };
  const ink = (el) => {
    const rects = textNodes(el).flatMap((n) => rangeRects(n, 0, n.textContent.length));
    return rects.length ? { left: Math.min(...rects.map((b) => b.left)), right: Math.max(...rects.map((b) => b.right)), lines: lineCount(rects) } : null;
  };
  // numbers split across lines: every numeric token of every text node in the table / totals
  const split = [];
  const numRe = /\d[\d,]*(?:\.\d+)?/g;
  for (const root of card.querySelectorAll('.pq-commercial-table, .pq-totals-box')) {
    for (const n of textNodes(root)) {
      for (const m of n.textContent.matchAll(numRe)) {
        if (m[0].length < 4) continue;
        const l = lineCount(rangeRects(n, m.index, m.index + m[0].length));
        if (l > 1) split.push({ token: m[0], lines: l });
      }
    }
    if (root.matches('.pq-commercial-table')) for (const pm of root.querySelectorAll('.pf-money')) { const k = vis(pm) && ink(pm); if (k && k.lines > 1) split.push({ money: pm.innerText.trim(), lines: k.lines }); }
  }
  const small = [];
  // cloud-fix4b (A18, A17 H2): ONLY the "PDF" glyph of the exact PDF tile icon (src/components/PdfFileIcon.jsx) is excluded
  // from the 12px rule - identified structurally by print/pdfIconGlyph.mjs isPdfIconGlyph (installed in the page as
  // window.__t16IsPdfIconGlyph; if it is missing nothing is excluded). It is a graphic that scales with the 24px icon
  // next to a >= 12px label. Every other svg text is judged by its RENDERED size (font-size x svg screen scale) and an
  // 11px svg label FAILS. Every excluded node is listed (svgGlyphs), all of them.
  const svgGlyphs = [];
  const isPdfGlyph = typeof window.__t16IsPdfIconGlyph === 'function' ? window.__t16IsPdfIconGlyph : () => false;
  const fontPx = typeof window.__t16RenderedFontPx === 'function' ? window.__t16RenderedFontPx : (e, f) => f;
  if (checkFont) {
    for (const e of card.querySelectorAll('*')) {
      if (!vis(e) || ![...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) continue;
      const css = parseFloat(cs(e).fontSize);
      const fs = fontPx(e, css);
      const text = (e.textContent || '').trim().slice(0, 24);
      if (isPdfGlyph(e)) { svgGlyphs.push({ el: short(e), fs, cssFontPx: css, text, icon: 'PdfFileIcon', label: (e.closest('a,button')?.innerText || '').trim().slice(0, 30) }); continue; }
      if (fs < 12) small.push({ el: short(e), fs, ...(e.closest('svg') ? { svg: true, cssFontPx: css } : {}), text });
    }
  }
  const centre = [];
  for (const table of card.querySelectorAll('table')) {
    const cols = [...table.querySelectorAll('colgroup col')].map((c) => c.className);
    const want = ['pq-col-qty', 'pq-col-price', 'pq-col-total'].map((k) => cols.findIndex((c) => c.includes(k))).filter((i) => i >= 0);
    for (const tr of table.querySelectorAll('tr')) {
      let col = 0;
      for (const td of tr.children) {
        const span = td.colSpan || 1; const at = col; col += span;
        if (span !== 1 || !want.includes(at) || !vis(td) || tr.classList.contains('pq-section-subtotal-row') || td.classList.contains('pq-td-summary')) continue; // summary amounts: protected right axis (glyph-axis.mjs), not the item centring exception
        const k = ink(td); if (!k) continue;
        const b = td.getBoundingClientRect();
        centre.push({ text: td.innerText.trim().slice(0, 20), off: +(((k.left + k.right) / 2) - ((b.left + b.right) / 2)).toFixed(2) });
      }
    }
  }
  const rights = [...card.querySelectorAll('.pq-totals-box .pf-money')].filter(vis).map((e) => (ink(e) || e.getBoundingClientRect()).right);
  const wrap = [...card.querySelectorAll('.pq-table-wrap')].map((w) => w.scrollWidth - w.clientWidth);
  // money containment (cloud-fix4, A17 F1b): every visible money ink box lies inside its own totals box (when it has
  // one), inside the card and inside the viewport. no-clipped-text cannot see a total that sticks out of its panel or is
  // cut at the screen edge when the page itself clips horizontal overflow (pageScroll then reads 0).
  const vw = document.documentElement.clientWidth;
  const cardBox = card.getBoundingClientRect();
  const escaped = [];
  for (const e of card.querySelectorAll('.pf-money, .pq-total-final-amount')) {
    if (!vis(e)) continue;
    const k = ink(e) || e.getBoundingClientRect();
    const host = e.closest('.pq-totals-box');
    const boxes = [['viewport', { left: 0, right: vw }], ['card', cardBox]];
    if (host) boxes.push(['totals-box', host.getBoundingClientRect()]);
    for (const [name, b] of boxes) {
      const out = Math.max(b.left - k.left, k.right - b.right);
      if (out > 0.5) escaped.push({ text: (e.innerText || '').trim().slice(0, 24), outside: name, px: +out.toFixed(2) });
    }
  }

  // ---- readability of the item table (cloud-fix4 criterion) ----
  const table = card.querySelector('table.pq-commercial-table');
  const tb = contentBox(table);
  const rowWidth = tb.right - tb.left;
  const frame = card.closest('.qp-device');
  const docWidth = frame ? frame.offsetWidth : window.innerWidth;
  const phoneDoc = docWidth <= phoneDocPx;
  // word = whitespace token split after a hyphen / maqaf / slash (a normal line-break opportunity)
  const WORD = /[^\s\-‐־–—/]+[-‐־–—/]*|[-‐־–—/]+/g;
  const wordsOf = (el, re) => {
    const out = [];
    for (const n of textNodes(el)) for (const m of n.textContent.matchAll(re)) {
      const rects = rangeRects(n, m.index, m.index + m[0].length);
      if (rects.length) out.push({ word: m[0], node: n, start: m.index, end: m.index + m[0].length, rects, lines: lineCount(rects), width: rects.reduce((a, b) => a + b.width, 0) });
    }
    return out;
  };
  // mid-word breaks: a word on > 1 line, unless that single word is wider than the full row
  const breaks = (el) => wordsOf(el, WORD).filter((w) => w.lines > 1 && w.width <= rowWidth + 0.5).map((w) => ({ word: w.word, lines: w.lines, widthPx: r2(w.width) }));
  const measureCtx = document.createElement('canvas').getContext('2d');
  const spaceWidth = (el) => { const s = cs(el); measureCtx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; return measureCtx.measureText(' ').width + (parseFloat(s.wordSpacing) || 0) + (parseFloat(s.letterSpacing) || 0); };
  // greedy fill over whole words ("שתים-עשרה" is one unbreakable unit in Hebrew, UAX #14 LB21a)
  const underfilled = (el) => {
    const ws = wordsOf(el, /\S+/g); const out = [];
    for (let i = 1; i < ws.length; i += 1) {
      const a = ws[i - 1]; const b = ws[i];
      if (a.node !== b.node || a.lines > 1 || b.lines > 1) continue;
      const ta = a.rects[0].top;
      if (b.rects[0].top - ta < 2) continue;
      const block = a.node.parentElement.closest('td, th, div') || el;
      const box = contentBox(block);
      // the whole line: every rect on a's line, including the fragment of a word broken at a hyphen
      const lineRects = ws.filter((w) => w.node === a.node).flatMap((w) => w.rects).filter((x) => Math.abs(x.top - ta) < 2);
      const lineW = Math.max(...lineRects.map((x) => x.right)) - Math.min(...lineRects.map((x) => x.left));
      // the separating space at a line end hangs (its Range rect is 0 wide): measure it in the element's own font
      const gap = b.start > a.end ? spaceWidth(a.node.parentElement) * (b.start - a.end) : 0;
      if (lineW + gap + b.width <= (box.right - box.left) - 0.5) out.push({ after: a.word, next: b.word, lineW: r2(lineW), nextW: r2(b.width), avail: r2(box.right - box.left) });
    }
    return out;
  };
  const KEYS = ['qty', 'price', 'total'];
  const head = Object.fromEntries(KEYS.map((k) => [k, table.querySelector(`thead th.pq-th-${k}`)]));
  const R = { rowWidth: r2(rowWidth), docWidth, phoneDoc, tableClass: table.className, tableDisplay: cs(table).display, header: [], rows: [], midWord: [], headerBreaks: [], underfilled: [], misaligned: [], rowIntegrity: [], descNotFull: [] };
  for (const th of table.querySelectorAll('thead th')) {
    if (!vis(th)) continue;
    const k = ink(th); const br = breaks(th);
    R.header.push({ cls: th.className, text: th.innerText.trim(), lines: k ? k.lines : 0, width: r2(th.getBoundingClientRect().width) });
    if (br.length) R.headerBreaks.push({ th: th.className, breaks: br });
  }
  // a row of a grid table is display:contents (no box of its own): a row is visible when one of its cells is
  const trs = [...table.querySelectorAll('tbody tr')].filter((tr) => [...tr.children].some(vis));
  trs.forEach((tr, i) => {
    const first = tr.children[0];
    const desc = tr.querySelector('td.pq-td-desc') || first;
    const kind = tr.classList.contains('pq-section-subtotal-row') ? 'subtotal' : (!tr.querySelector('td.pq-td-desc') ? 'full-width' : (desc.querySelector('.pq-section-toggle') ? 'section-summary' : 'item'));
    const nums = KEYS.map((k) => tr.querySelector(`td.pq-td-${k}`)).filter((x) => x && vis(x));
    const row = { kind, text: desc.innerText.trim().replace(/\s+/g, ' ').slice(0, 48) };
    if (vis(desc)) {
      const db = desc.getBoundingClientRect(); const dbox = contentBox(desc); const k = ink(desc);
      row.descWidth = r2(dbox.right - dbox.left); row.descLines = k ? k.lines : 0;
      const br = kind === 'subtotal' ? [] : breaks(desc); row.midWord = br.length;
      if (br.length) R.midWord.push({ row: i, text: row.text, breaks: br.slice(0, 6) });
      const uf = kind === 'subtotal' ? [] : underfilled(desc); if (uf.length) R.underfilled.push({ row: i, text: row.text, at: uf.slice(0, 4) });
      const sameLine = nums.filter((n) => { const nb = n.getBoundingClientRect(); return nb.top < db.bottom - 1 && nb.bottom > db.top + 1; });
      const avail = rowWidth - sameLine.reduce((s, n) => s + n.getBoundingClientRect().width, 0);
      row.descBox = r2(db.width); row.descAvail = r2(avail); row.valuesOnDescLine = sameLine.length;
      if (kind === 'item' || kind === 'section-summary') {
        if (db.width < avail - 1) R.descNotFull.push({ row: i, text: row.text, descBox: r2(db.width), avail: r2(avail), rule: 'all the row width not taken by values on its line' });
        else if (phoneDoc && /pq-amounts-wide/.test(table.className) && sameLine.length > 0) R.descNotFull.push({ row: i, text: row.text, descBox: r2(db.width), rowWidth: r2(rowWidth), valuesOnDescLine: sameLine.length, rule: 'phone-width document, long amounts: the description takes the full row' });
      }
      const next = trs[i + 1];
      const nextTop = next ? Math.min(...[...next.children].filter(vis).map((c) => c.getBoundingClientRect().top)) : Infinity;
      for (const n of nums) { const nb = n.getBoundingClientRect(); if (nb.top < db.top - 1 || nb.bottom > nextTop + 1) R.rowIntegrity.push({ row: i, cell: n.className, top: r2(nb.top), bottom: r2(nb.bottom), descTop: r2(db.top), nextTop: r2(nextTop) }); }
    }
    for (const n of nums) {
      const key = KEYS.find((k) => n.classList.contains(`pq-td-${k}`));
      if (kind === 'subtotal' || n.colSpan > 1) continue; // the section subtotal is right-aligned (outside the centring exception)
      const h = head[key]; const kk = ink(n); if (!h || !kk) continue;
      const hb = h.getBoundingClientRect();
      const off = (kk.left + kk.right) / 2 - (hb.left + hb.right) / 2;
      row[`${key}OffVsHeader`] = r2(off);
      if (Math.abs(off) > 1) R.misaligned.push({ row: i, cell: key, text: n.innerText.trim(), offPx: r2(off) });
    }
    R.rows.push(row);
  });
  const itemRows = R.rows.filter((r) => r.kind === 'item' && r.descWidth != null);
  R.descWidthMin = itemRows.length ? Math.min(...itemRows.map((r) => r.descWidth)) : null;
  R.descLinesMax = itemRows.length ? Math.max(...itemRows.map((r) => r.descLines)) : null;
  R.midWordTotal = R.midWord.reduce((s, x) => s + x.breaks.length, 0);
  R.midWordMaxPerDesc = itemRows.length ? Math.max(...itemRows.map((r) => r.midWord)) : null;
  R.headerLinesMax = R.header.length ? Math.max(...R.header.map((h) => h.lines)) : null;
  R.headerBreakTotal = R.headerBreaks.reduce((s, h) => s + h.breaks.length, 0);
  const offs = R.rows.flatMap((r) => KEYS.map((k) => r[`${k}OffVsHeader`]).filter((v) => v != null));
  R.maxOffVsHeader = offs.length ? r2(Math.max(...offs.map(Math.abs))) : null;
  const totalsText = [...card.querySelectorAll('.pq-totals-box')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()).join(' | ');
  return { missing, totalsText, cellOverflow, clipped, escaped, pageScroll, tableWrapScroll: wrap, split, small: small.slice(0, 10), smallCount: small.length, svgGlyphs, centreMax: centre.length ? Math.max(...centre.map((c) => Math.abs(c.off))) : null, centreOff: centre.filter((c) => Math.abs(c.off) > 1).slice(0, 6), centreN: centre.length, totalsSpread: rights.length ? +(Math.max(...rights) - Math.min(...rights)).toFixed(2) : null, totalsN: rights.length, cardWidth: card.getBoundingClientRect().width, read: R };
}

const cells = [];
const cell = (id, pass, detail) => cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail });
function judge(id, r, { checkFont }) {
  const R = r.read;
  cell(`${id}/values-complete`, r.missing.length === 0, { missing: r.missing });
  cell(`${id}/no-cell-overflow`, r.cellOverflow.length === 0, { cells: r.cellOverflow.slice(0, 6) });
  cell(`${id}/no-clipped-text`, r.clipped.length === 0 && r.pageScroll <= 0 && r.tableWrapScroll.every((d) => d <= 1), { clipped: r.clipped.slice(0, 6), pageScroll: r.pageScroll, tableWrapScroll: r.tableWrapScroll });
  cell(`${id}/money-contained`, r.escaped.length === 0, { escaped: r.escaped.slice(0, 6) });
  cell(`${id}/numbers-one-line`, r.split.length === 0, { split: r.split.slice(0, 6) });
  if (checkFont) cell(`${id}/min-font-12`, r.smallCount === 0, { below12: r.small, svgIconGlyphsExcluded: r.svgGlyphs });
  cell(`${id}/numeric-centred`, r.centreN > 0 && r.centreOff.length === 0, { maxOffPx: r.centreMax, off: r.centreOff });
  cell(`${id}/values-under-header`, R.maxOffVsHeader !== null && R.misaligned.length === 0, { maxOffPx: R.maxOffVsHeader, off: R.misaligned.slice(0, 6) });
  cell(`${id}/row-integrity`, R.rowIntegrity.length === 0, { outside: R.rowIntegrity.slice(0, 6) });
  cell(`${id}/totals-right-axis`, r.totalsN >= 2 && r.totalsSpread <= 0.75, { spreadPx: r.totalsSpread, n: r.totalsN });
  cell(`${id}/description-no-midword`, R.midWord.length === 0, { breaks: R.midWord.slice(0, 4), descWidthMinPx: R.descWidthMin, descLinesMax: R.descLinesMax, rowWidthPx: R.rowWidth });
  cell(`${id}/header-no-midword`, R.headerBreaks.length === 0, { breaks: R.headerBreaks, headerLinesMax: R.headerLinesMax });
  cell(`${id}/description-fills-lines`, R.underfilled.length === 0, { underfilled: R.underfilled.slice(0, 4) });
  cell(`${id}/description-row-width`, R.descNotFull.length === 0, { notFull: R.descNotFull.slice(0, 4), phoneDoc: R.phoneDoc, docWidth: R.docWidth, table: R.tableClass, display: R.tableDisplay });
}
const summary = (r) => ({ rowWidth: r.read.rowWidth, display: r.read.tableDisplay, descWidthMin: r.read.descWidthMin, descLinesMax: r.read.descLinesMax, midWordTotal: r.read.midWordTotal, midWordMaxPerDesc: r.read.midWordMaxPerDesc, headerLinesMax: r.read.headerLinesMax, headerBreakTotal: r.read.headerBreakTotal, valueWraps: r.split.length, maxOffVsHeader: r.read.maxOffVsHeader, centreMax: r.centreMax, totalsSpread: r.totalsSpread });

// Measure one screen state (+ the expanded-section state for the sections fixture). `toggle` clicks section 1.
async function measureStates(page, id, fx, currency, { checkFont, shotTag }) {
  const states = fx.quoteData.sections && fx.quoteData.sections.length ? ['collapsed', 'expanded'] : ['flat'];
  for (const state of states) {
    if (state === 'expanded') {
      await page.locator('.pq-card .pq-section-toggle').first().click();
      await page.waitForTimeout(250);
    }
    const sid = states.length > 1 ? `${id}/${state}` : id;
    if (checkFont) await page.evaluate(`window.__t16IsPdfIconGlyph = ${isPdfIconGlyph.toString()}; window.__t16RenderedFontPx = ${renderedFontPx.toString()};`);
    const r = await page.evaluate(probe, { checkFont, expected: expectedStrings(fx, currency, state), phoneDocPx: PHONE_DOC_PX });
    results.push({ id: sid, summary: summary(r), ...r });
    judge(sid, r, { checkFont });
    if (SHOTS && shotTag) await page.locator('.pq-card .pq-table-wrap').first().screenshot({ path: join(OUT, 'shots', `${shotTag}-${state}.png`) }).catch(() => {});
  }
}

// creator preview: a synthetic draft quote whose items are the fixture's, opened with Edit in the mocked Dashboard
function creatorAccount(fx, m) {
  const acc = account(m.locale === 'he' ? 'Local' : 'International', 'std');
  const q = fx.quoteData;
  const draft = {
    ...acc.quotes[0], id: '00000000-0000-4000-9000-0000000000c1', quote_number: 2207, status: 'draft', created_at: new Date().toISOString(),
    currency: m.currency, tax_rate: q.quote.tax_rate, discount: q.quote.discount, subject: q.quote.subject, project_name: q.quote.project_name, attn_name: q.quote.attn_name, attn_role: q.quote.attn_role,
    clients: { id: 'c-la', company_name: q.client.company_name, email: q.client.email, phone: q.client.phone, address: q.client.address, client_type: 'business' }, client_type: 'business',
    terms: q.quote.terms, notes: q.quote.notes, subtotal: q.quote.subtotal, total: q.quote.total,
    quote_items: q.items.map((it, i) => ({ id: `00000000-0000-4000-9000-0000000001${String(i).padStart(2, '0')}`, quote_id: '00000000-0000-4000-9000-0000000000c1', description: it.description, quantity: it.quantity, unit_price: it.unit_price, total_price: it.total_price, pricing_unit: it.pricing_unit, calculated_quantity: it.calculated_quantity, quantity_source: it.quantity_source, calculation_method: it.calculation_method, specification: it.specification, section_id: it.section_id || null, sort_order: i, quote_item_measurements: [] })),
    quote_sections: (q.sections || []).map((s) => ({ id: s.id, name: s.name, sort_order: s.sort_order })),
  };
  acc.settings = { ...acc.settings, currency: m.currency };
  acc.quotes = [draft, ...acc.quotes.slice(1)];
  return acc;
}
async function runCreator(browser, fx, m, key, kind) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await mockAccount(ctx, creatorAccount(fx, m), m.locale);
  const page = await ctx.newPage();
  const id = `creator/mobile390/${key}/${kind}`;
  try {
    await page.goto(`${BUILD}/dashboard?lang=${m.locale}`, { waitUntil: 'networkidle' });
    // Quote History row of the synthetic draft (A2207) -> its actions -> Edit
    await page.locator('tr', { hasText: 'A2207' }).first().locator('button[aria-expanded]').first().click();
    await page.getByRole('button', { name: m.locale === 'he' ? 'ערוך' : 'Edit', exact: true }).first().click();
    // split layout: the preview pane is already open; sheet layout (ledger C01: form-only, preview on demand): open it
    await page.waitForSelector('[data-testid="qp-device-mobile"], [data-testid="qp-open-preview"]', { timeout: 20000 });
    if (!(await page.locator('[data-testid="qp-device-mobile"]').count())) await page.locator('[data-testid="qp-open-preview"]').first().click();
    await page.waitForSelector('[data-testid="qp-device-mobile"]', { timeout: 20000 });
    await page.click('[data-testid="qp-device-mobile"]');
    await page.waitForSelector('.qp-device--mobile .pq-page.pq-preview .pq-card table.pq-commercial-table', { timeout: 20000 });
    await page.waitForTimeout(600);
    const inFrame = await page.evaluate((n) => (document.querySelector('.qp-device--mobile .pq-card')?.innerText || '').includes(n), fx.quoteData.client.company_name);
    if (!inFrame) throw new Error('creator preview did not render the fixture items');
    // the probe reads the first .pq-card of the document: the preview's
    await measureStates(page, id, fx, m.currency, { checkFont: true, shotTag: SHOTS ? `creator-${key.replace(/\//g, '-')}-${kind}` : null });
  } catch (e) { cell(`${id}/rendered`, false, { error: String(e.message || e).slice(0, 300) }); }
  await ctx.close();
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [];
for (const m of MARKETS) for (const kind of FIXTURES) for (const style of STYLES) {
  const fx = fixtureFor(kind, m);
  const dto = fx.quoteData;
  const key = `${m.locale}-${m.currency}/${style}`;
  const pres = presentationFor(style);
  for (const vp of VIEWPORTS) {
    const shot = SHOTS && vp.width === 320 ? `${vp.width}-${m.locale}-${m.currency}-${style}-${kind}` : null;
    if (SURFACES.includes('public')) {
      const ctx = await newQuoteContext(browser, { viewport: { width: vp.width, height: vp.height }, dto, presentation: pres });
      const page = await ctx.newPage();
      try {
        await openQuote(page, BUILD, dto);
        if (vp.width === 1280 && SURFACES.includes('print') && kind === 'flat') {
          await page.emulateMedia({ media: 'print' });
          const p = await page.evaluate(probe, { checkFont: false, expected: expectedStrings(fx, m.currency, 'flat'), phoneDocPx: PHONE_DOC_PX });
          results.push({ id: `print/${key}`, summary: summary(p), ...p });
          judge(`print/${key}`, p, { checkFont: false });
          const pdf = join(OUT, 'pdf', `${key.replace(/\//g, '-')}-print.pdf`);
          writeFileSync(pdf, await page.pdf({ format: 'A4', printBackground: true }));
          const txt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString().replace(/[‎‏‪-‮⁦-⁩]/g, '');
          const miss = expectedStrings(fx, m.currency, 'flat').filter((s) => !txt.includes(s));
          cell(`print/${key}/pdf-text-values`, miss.length === 0, { missing: miss });
          await page.emulateMedia({ media: 'screen' });
        }
        await measureStates(page, `public/${vp.tag}/${key}/${kind}`, fx, m.currency, { checkFont: true, shotTag: shot && `public-${shot}` });
      } catch (e) { cell(`public/${vp.tag}/${key}/${kind}/rendered`, false, { error: String(e.message || e).slice(0, 200) }); }
      await ctx.close();
    }
    if (SURFACES.includes('sample') && DEV) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addInitScript((d) => { window.__A6_SAMPLE_FIXTURE = d; }, dto);
      // TEST-ONLY module mock: buildSampleQuote returns this fixture's quoteData (presentation = the style, no media)
      await ctx.route(/\/src\/quoteDocument\/sampleQuotes\.js(\?.*)?$/, async (route) => {
        const res = await route.fetch();
        let body = await res.text();
        body = body.replace('export function buildSampleQuote(', 'function __a6OrigBuildSampleQuote(');
        body += '\nexport function buildSampleQuote(o) { const s = __a6OrigBuildSampleQuote(o); if (typeof window !== "undefined" && window.__A6_SAMPLE_FIXTURE) { s.quoteData = JSON.parse(JSON.stringify(window.__A6_SAMPLE_FIXTURE)); s.presentation = { ...s.presentation, media: [] }; } return s; }\n';
        return route.fulfill({ response: res, body });
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`${DEV}/${m.locale}/sample-quote?style=${style}&length=short&detail=compact&images=0`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.pq-card', { timeout: 30000 });
        await page.waitForTimeout(300);
        const injected = await page.evaluate((n) => document.querySelector('.pq-card').innerText.includes(n), dto.client.company_name);
        if (!injected) throw new Error('sample module mock did not apply (fixture client not rendered)');
        await measureStates(page, `sample/${vp.tag}/${key}/${kind}`, fx, m.currency, { checkFont: true, shotTag: shot && `sample-${shot}` });
      } catch (e) { cell(`sample/${vp.tag}/${key}/${kind}/rendered`, false, { error: String(e.message || e).slice(0, 200) }); }
      await ctx.close();
    }
  }
  if (SURFACES.includes('creator') && style === 'classic' && ['he-ILS', 'en-USD'].includes(`${m.locale}-${m.currency}`)) await runCreator(browser, fx, m, key, kind);
  if (SURFACES.includes('direct') && kind === 'flat') {
    // capture state exactly as generateQuotePdf's clone: window 1100px, .pq-pdf-capturing, card 718px
    const ctx = await newQuoteContext(browser, { viewport: { width: 1100, height: 900 }, dto, presentation: pres });
    const page = await ctx.newPage();
    try {
      await openQuote(page, BUILD, dto);
      await page.evaluate(() => { document.querySelector('.pq-page').classList.add('pq-pdf-capturing'); const c = document.querySelector('.pq-card'); c.style.width = '718px'; c.style.maxWidth = 'none'; c.style.boxSizing = 'border-box'; });
      await page.waitForTimeout(150);
      const r = await page.evaluate(probe, { checkFont: false, expected: expectedStrings(fx, m.currency, 'flat'), phoneDocPx: PHONE_DOC_PX });
      results.push({ id: `direct/${key}`, summary: summary(r), ...r });
      judge(`direct/${key}`, r, { checkFont: false });
      await page.evaluate(() => { document.querySelector('.pq-page').classList.remove('pq-pdf-capturing'); const c = document.querySelector('.pq-card'); c.style.width = '100%'; c.style.maxWidth = ''; });
      const tile = page.locator('.pq-action-tile').first();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        (async () => { await tile.click(); await page.locator('[role="dialog"] button').nth(1).click(); })(),
      ]);
      const pdf = join(OUT, 'pdf', `${key.replace(/\//g, '-')}-direct.pdf`);
      await download.saveAs(pdf);
      const pages = Number((execFileSync('pdfinfo', [pdf]).toString().match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
      cell(`direct/${key}/pages`, pages >= 1, { pages });
    } catch (e) { cell(`direct/${key}/rendered`, false, { error: String(e.message || e).slice(0, 200) }); }
    await ctx.close();
  }
}
await browser.close();
const fail = cells.filter((c) => c.result !== 'PASS');
writeFileSync(join(OUT, 'long-amounts.json'), JSON.stringify({ gate: 'task16 long amounts (LOCAL-DEV, mocked, synthetic)', build: BUILD, dev: DEV || null, viewports: VIEWPORTS.map((v) => v.tag), styles: STYLES, surfaces: SURFACES, fixtures: FIXTURES, markets: MARKETS.map((m) => `${m.locale}-${m.currency}`), phoneDocPx: PHONE_DOC_PX, creatorPreview: SURFACES.includes('creator') ? 'real Dashboard creator preview, mocked synthetic session (qh/fixtures.mjs mockAccount), Edit of a synthetic draft quote, device "mobile" (390px pq-preview container), viewport 1440x900, Classic, HE-ILS + EN-USD' : 'not requested', generatedAt: new Date().toISOString(), node: process.version, pass: cells.length - fail.length, fail: fail.length, cells, results }, null, 1));
const byCheck = {};
for (const x of cells) { const k = x.id.split('/').pop(); byCheck[k] = byCheck[k] || { pass: 0, fail: 0 }; byCheck[k][x.result === 'PASS' ? 'pass' : 'fail'] += 1; }
console.log(`LONG AMOUNTS GATE: ${cells.length - fail.length} PASS / ${fail.length} FAIL`);
for (const [k, v] of Object.entries(byCheck)) console.log(`  ${v.fail ? 'FAIL' : 'PASS'} ${k.padEnd(24)} ${v.pass} pass / ${v.fail} fail`);
for (const f of fail) console.log(`  FAIL ${f.id} ${JSON.stringify(f.detail).slice(0, 300)}`);
process.exit(fail.length ? 1 : 0);
