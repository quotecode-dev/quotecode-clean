import { useLayoutEffect, useRef, useState } from 'react';

// IRON-QH-LAYOUT-001 - Quote History SEMANTIC SLOT CONTRACT (one geometry source for the desktop header table AND body table).
// Codex root cause (EN collision): both tables used hard-coded <col> widths (Amount 86px with 12px cell padding => ~62px usable)
// while the amount lived in a .pf-money-slot of 8.4em (~121px) that cannot shrink, and the status badge could also exceed its
// 78px slot - so content PAINTED into the neighbouring columns while the table itself stayed inside the viewport.
// Contract:
//   - every protected slot (quote number, amount, status, date) is sized from its widest REAL rendered content (same class/style
//     as the cell) or its header label (+ sort arrow), whichever is wider, plus QH_CELL_PAD on each side - it can never be
//     narrower than what it renders; the status slot is sized for EVERY status label so filtering never moves the columns;
//   - the client slot takes the remainder and intentionally ellipsizes;
//   - the amount slot's inner money axis (--pf-money-slot-size) is exactly the widest rendered amount (shared right edge);
//   - when the fixed slots leave the client less than QH_CLIENT_MIN, the list switches to the card layout (deliberate transition,
//     never overflow painting).
// Both <colgroup>s read the same CSS variables from the screen host, so header and body cannot diverge.
export const QH_CELL_PAD = 6; // inline padding of every semantic cell => >= 12px rendered gap between adjacent fields
export const QH_MIN_GAP = 4; // the Owner contract minimum the gate enforces
export const QH_ACTION_COL = 36;
export const QH_CLIENT_MIN = 140;
const SCROLLBAR_RESERVE = 16; // body scroll owner keeps scrollbar-gutter: stable

export const QH_CELL_STYLE = {
  number: { fontWeight: '600', fontSize: '0.82rem' },
  amount: { fontWeight: '400', fontSize: '0.9rem' },
  status: { padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', display: 'inline-block', whiteSpace: 'nowrap' },
  date: { fontSize: '0.75rem' },
  head: { fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
};

const measureGroup = (probe, items, className, style) => {
  const spans = [...new Set(items)].map((text) => {
    const s = document.createElement('span');
    if (className) s.className = className;
    Object.assign(s.style, style, { display: 'inline-block', whiteSpace: 'nowrap' });
    s.textContent = text;
    probe.appendChild(s);
    return s;
  });
  return () => spans.reduce((max, s) => Math.max(max, s.getBoundingClientRect().width), 0);
};

export function useQuoteHistoryGeometry(hostRef, { enabled, numbers, amounts, statuses, dates, headers }) {
  const [compact, setCompact] = useState(false);
  const widthsRef = useRef(null);
  const key = [numbers, amounts, statuses, dates, Object.values(headers)].map((g) => g.join('')).join('');

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host || typeof document === 'undefined') { setCompact(false); return undefined; }
    const px = (n) => `${Math.ceil(n) + 1}px`;
    const updateCompact = () => {
      const w = widthsRef.current;
      const cs = getComputedStyle(host);
      const content = host.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      if (!w || content <= 0) { setCompact(false); return; } // not laid out (e.g. jsdom) -> never force the card layout
      setCompact(content - SCROLLBAR_RESERVE - w.fixed < QH_CLIENT_MIN);
    };
    const measure = () => {
      const probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;white-space:nowrap';
      const g = {
        number: measureGroup(probe, numbers, '', QH_CELL_STYLE.number),
        amount: measureGroup(probe, amounts, 'pf-money', QH_CELL_STYLE.amount),
        status: measureGroup(probe, statuses, '', QH_CELL_STYLE.status),
        date: measureGroup(probe, dates, '', QH_CELL_STYLE.date),
      };
      const h = Object.fromEntries(Object.entries(headers).map(([k, label]) => [k, measureGroup(probe, [`${label} ▲`], '', QH_CELL_STYLE.head)]));
      host.appendChild(probe);
      const content = { number: g.number(), amount: g.amount(), status: g.status(), date: g.date() };
      const head = Object.fromEntries(Object.entries(h).map(([k, f]) => [k, f()]));
      host.removeChild(probe);
      const col = Object.fromEntries(Object.keys(content).map((k) => [k, Math.ceil(Math.max(content[k], head[k] || 0)) + 1 + 2 * QH_CELL_PAD]));
      for (const [k, v] of Object.entries(col)) host.style.setProperty(`--qh-col-${k}`, `${v}px`);
      if (content.amount > 0) host.style.setProperty('--pf-money-slot-size', px(content.amount));
      widthsRef.current = { ...col, fixed: QH_ACTION_COL + col.number + col.amount + col.status + col.date };
      updateCompact();
    };
    measure();
    let cancelled = false;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!cancelled) measure(); });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateCompact()) : null;
    if (ro) ro.observe(host);
    return () => { cancelled = true; if (ro) ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRef, enabled, key]);

  return { compact };
}
