import { useLayoutEffect } from 'react';

// IRON-NUMERIC-001 (Owner console 2026-10-18: "חוק ברזל זה חוק ברזל!"): on screen every amount of the commercial table's Amount
// column and of the totals (subtotal, discount, VAT, grand total) shares ONE physical right edge and ONE decimal-point axis, in
// HE/RTL and EN/LTR, on every device. The phone table is content-aware (table-layout auto), so no fixed percentage can match it:
// the totals' amount column takes the table Amount column's REAL width, inner padding and digit size, measured here and kept in
// sync on every resize. Print and the Direct PDF keep their own output rules (quoteDocument.css) and never read these values.
const viewOf = (el) => (el && el.ownerDocument && el.ownerDocument.defaultView) || window;
const docOf = (el) => (el && el.ownerDocument) || document;
export function syncAmountAxis(card) {
  if (!card) return;
  const td = card.querySelector('.pq-commercial-table tbody tr:not(.pq-section-subtotal-row) td.pq-td-total');
  const box = card.querySelector('.pq-totals-box');
  if (!td || !box) return;
  const width = td.getBoundingClientRect().width;
  if (!(width > 0)) return;
  const cs = viewOf(td).getComputedStyle(td);
  const money = td.querySelector('.pf-money') || td;
  // physical paddings: the amounts are right-aligned in both directions, so the right padding sets the shared right edge
  box.style.setProperty('--pq-amount-col', `${width}px`);
  box.style.setProperty('--pq-amount-pad-l', cs.paddingLeft);
  box.style.setProperty('--pq-amount-pad-r', cs.paddingRight);
  box.style.setProperty('--pq-amount-font', viewOf(money).getComputedStyle(money).fontSize);
}

// Owner 2026-10-05 ("מרכוז כמות, מחיר יחידה וסכום, כולל כותרות ותאים") + 2026-10-06 ("אם אני מבקש יישור ספרות אני מתכוון באופן
// גורף ולא נקודתי!!!!", "שה 3.4 ה-3 יהיה ממורכז ל-2 מעליו ול-1 מתחתיו והנקודה העשרונית תהיה מימין להם"): inside a CENTRED item column
// every number gets the same box, centred, with its decimal point (or its last digit when it has none) on ONE vertical axis.
// Sizes are in em, so the same alignment holds in native Print and in the Direct PDF clone (same font, other size).
const COLUMN_NUMBERS = [
  '.pq-commercial-table tbody tr:not(.pq-section-subtotal-row) td.pq-td-qty .pq-num-slot',
  '.pq-commercial-table tbody tr:not(.pq-section-subtotal-row) td.pq-td-price .pf-money',
  '.pq-commercial-table tbody tr:not(.pq-section-subtotal-row) td.pq-td-total:not(.pq-td-summary) .pf-money',
];
const canMeasure = (el) => { const d = docOf(el); return !!d && typeof d.createRange === 'function' && typeof d.createRange().getBoundingClientRect === 'function'; };
const tailWidth = (el) => {
  const walker = docOf(el).createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let last = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes('.')) last = n;
  if (!last) return 0;
  const range = docOf(el).createRange();
  range.setStart(last, last.data.lastIndexOf('.'));
  range.setEndAfter(el.lastChild || last);
  return range.getBoundingClientRect().width;
};
export function syncDecimalColumns(card) {
  if (!card || !canMeasure(card)) return; // no layout engine (tests): nothing to align
  for (const sel of COLUMN_NUMBERS) {
    const els = [...card.querySelectorAll(sel)];
    for (const el of els) { el.style.minWidth = ''; el.style.paddingRight = ''; el.style.display = ''; el.style.textAlign = ''; el.style.boxSizing = ''; }
    if (els.length < 2) continue;
    const m = els.map((el) => { const w = el.getBoundingClientRect().width; const t = tailWidth(el); return { el, head: w - t, tail: t, fs: parseFloat(viewOf(el).getComputedStyle(el).fontSize) || 16 }; });
    const maxHead = Math.max(...m.map((x) => x.head));
    const maxTail = Math.max(...m.map((x) => x.tail));
    for (const x of m) {
      x.el.style.display = 'inline-block';
      x.el.style.boxSizing = 'border-box';
      x.el.style.textAlign = 'right';
      x.el.style.paddingRight = `${((maxTail - x.tail) / x.fs).toFixed(4)}em`;
      x.el.style.minWidth = `${((maxHead + maxTail) / x.fs + 0.02).toFixed(4)}em`;
    }
  }
}

// the unit label beside a quantity gets ONE width per column too, so the centred number never shifts by the label's length
export function syncUnitSlots(card) {
  if (!card) return;
  const els = [...card.querySelectorAll('.pq-commercial-table tbody td.pq-td-qty .pq-unit-slot')];
  for (const el of els) { el.style.minWidth = ''; el.style.display = ''; el.style.textAlign = ''; }
  const m = els.map((el) => ({ el, w: el.getBoundingClientRect().width, fs: parseFloat(viewOf(el).getComputedStyle(el).fontSize) || 16 }));
  const max = Math.max(0, ...m.map((x) => x.w));
  if (!(max > 0)) return;
  for (const x of m) { x.el.style.display = 'inline-block'; x.el.style.textAlign = 'start'; x.el.style.minWidth = `${(max / x.fs + 0.02).toFixed(4)}em`; }
  // a narrow column wraps a label under its number: then EVERY label sits on its own line (an empty one takes no room), so every
  // number line holds only its equal-width number box and stays on the column's axis
  const wrapped = m.some((x) => { const num = x.el.previousElementSibling; return num && x.el.textContent.trim() && x.el.getBoundingClientRect().top > num.getBoundingClientRect().top + 2; });
  if (wrapped) for (const x of m) { x.el.style.minWidth = ''; x.el.style.display = x.el.textContent.trim() ? 'block' : 'none'; x.el.style.textAlign = ''; }
}

// the whole axis, in order (also run by generateQuotePdf on the Direct PDF clone, laid out at the A4 width)
// Owner console 2026-11-10 (finding 1 "א"): the Hebrew document mirrors the English one - the amount column sits against the table's
// OUTER edge (left in RTL). Every amount of that column (item rows, collapsed-unit summaries, unit subtotals) and of the totals gets ONE
// box width, in em of its own digits (so screen, native Print and the Direct PDF clone share it), with right-aligned digits inside:
// the shared right edge / decimal axis of IRON-NUMERIC-001 stays, now at one box from the outer edge (quoteDocument.css, [dir='rtl']).
const AMOUNT_COLUMN_MONEY = '.pq-commercial-table tbody td.pq-td-total .pf-money';
export function syncMoneyBox(card) {
  if (!card) return;
  card.style.setProperty('--pq-money-box-n', '0'); // natural widths first (an earlier, larger box must not hold the size)
  const els = [...card.querySelectorAll(AMOUNT_COLUMN_MONEY)];
  const fsOf = (el) => parseFloat(viewOf(el).getComputedStyle(el).fontSize) || 16;

  // the totals and the grand total (a larger size) must fit the same box, in units of the table digits; their text width (a range -
  // the elements themselves are full-width grid cells)
  const textWidth = (el) => {
    const d = docOf(el);
    if (!d || typeof d.createRange !== 'function') return 0;
    const r = d.createRange(); r.selectNodeContents(el);
    const w = r.getBoundingClientRect ? r.getBoundingClientRect().width : 0;
    return Number.isFinite(w) ? w : 0;
  };
  const totals = [...card.querySelectorAll('.pq-totals-box .pq-total-value, .pq-totals-box .pq-total-final-amount')];
  // the unit of the box: the table digits; a quote without item rows uses its totals' own digits
  const plainTotal = totals.find((el) => el.classList.contains('pq-total-value')) || totals[0];
  const tableFs = els.length ? fsOf(els[0]) : (plainTotal ? fsOf(plainTotal) : 16);
  const n = Math.max(0,
    ...els.map((el) => el.getBoundingClientRect().width / fsOf(el)),
    ...totals.map((el) => textWidth(el) / tableFs));
  const boxN = Math.ceil(n * 1000) / 1000 + 0.02;
  card.style.setProperty('--pq-money-box-n', boxN.toFixed(3));

  // Owner console 2026-11-10 (the 13 items, L-27): in Hebrew the "סה״כ" header ends on the amounts' right edge, as "Total" does in English
  // (the box starts at the outer edge, so the header gets the box's width minus its own text as its outer padding; em of its own size)
  const th = card.querySelector('.pq-commercial-table thead th.pq-th-total');
  const td = card.querySelector('.pq-commercial-table tbody td.pq-td-total');
  if (th) th.style.removeProperty('padding-left');
  if (th && viewOf(th).getComputedStyle(th).direction === 'rtl') {
    const thFs = fsOf(th);
    const headW = textWidth(th);
    const padL = td ? (parseFloat(viewOf(td).getComputedStyle(td).paddingLeft) || 0) : (parseFloat(viewOf(th).getComputedStyle(th).paddingLeft) || 0);
    const want = padL + boxN * tableFs - headW;
    const base = parseFloat(viewOf(th).getComputedStyle(th).paddingLeft) || 0;
    if (headW > 0 && want > base) th.style.setProperty('padding-left', `${(want / thFs).toFixed(4)}em`, 'important'); // the phone rule pins 3px !important
  }
}

// Owner console 2026-11-10 (the 13 items, L-27): the unit label sits after the number (right in English, left in Hebrew), so the
// centred number+unit pair put the English numbers left of the "Qty" header. The number box itself is centred under the header, in both
// languages: an empty space of the unit's width on the number's other side - only where the cell has room for it (never a wrap).
export function syncQtyCentre(card) {
  if (!card) return;
  const tds = [...card.querySelectorAll('.pq-commercial-table tbody td.pq-td-qty')];
  const pairs = tds.map((td) => ({ td, num: td.querySelector('.pq-num-slot'), unit: td.querySelector('.pq-unit-slot') })).filter((x) => x.num && x.unit);
  for (const x of pairs) { x.num.style.marginLeft = ''; x.num.style.marginRight = ''; }
  const inline = pairs.filter((x) => viewOf(x.unit).getComputedStyle(x.unit).display.startsWith('inline'));
  if (!inline.length || inline.length !== pairs.length) return; // a wrapped column (labels on their own line) is already centred
  const unitW = Math.max(0, ...inline.map((x) => x.unit.getBoundingClientRect().width));
  if (!(unitW > 0)) return;
  const fits = inline.every((x) => {
    const cs = viewOf(x.td).getComputedStyle(x.td);
    const room = x.td.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return room >= x.num.getBoundingClientRect().width + 2 * unitW + 1;
  });
  if (!fits) return;
  for (const x of inline) {
    const fs = parseFloat(viewOf(x.num).getComputedStyle(x.num).fontSize) || 16;
    const rtl = viewOf(x.td).getComputedStyle(x.td).direction === 'rtl';
    x.num.style[rtl ? 'marginRight' : 'marginLeft'] = `${(unitW / fs).toFixed(4)}em`;
  }
}

export function syncAllAmountAxes(card) { syncUnitSlots(card); syncDecimalColumns(card); syncQtyCentre(card); syncMoneyBox(card); syncAmountAxis(card); }

export function useAmountAxis(cardRef) {
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const sync = () => syncAllAmountAxes(card);
    sync();
    // the web font may arrive after the first layout: the equal-width boxes keep their size, so no resize fires - re-measure then
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    if (fonts && fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(sync).catch(() => {});
    if (fonts && typeof fonts.addEventListener === 'function') fonts.addEventListener('loadingdone', sync);
    const offFonts = () => { if (fonts && typeof fonts.removeEventListener === 'function') fonts.removeEventListener('loadingdone', sync); };
    if (typeof ResizeObserver === 'undefined') return offFonts;
    const ro = new ResizeObserver(sync);
    ro.observe(card);
    const table = card.querySelector('.pq-commercial-table');
    if (table) ro.observe(table);
    return () => { ro.disconnect(); offFonts(); };
  });
}
