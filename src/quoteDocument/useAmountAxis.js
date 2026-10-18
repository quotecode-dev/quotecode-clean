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
export function syncAllAmountAxes(card) { syncUnitSlots(card); syncDecimalColumns(card); syncAmountAxis(card); }

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
