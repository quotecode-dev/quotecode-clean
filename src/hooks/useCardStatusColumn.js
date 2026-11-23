import { useLayoutEffect } from 'react';

// L-19 (Owner console 2026-11-22, the simplify1122 sketch fitStatusCol): on the phone / tablet quote cards the status stands in the SAME
// column as the amount above it. --stw on the card list host = the widest status label of the current language with its dot and gap
// (the .qlist-st start padding), but never narrower than the widest rendered amount slot, so the amount keeps its one physical axis
// (IRON-NUMERIC-001 / IRON-MOBILE-WIDTH-001). Measured after render (declared after the money slot hook), again after the fonts load and
// when the list box changes width (e.g. shown after being hidden). Nothing measurable (jsdom, a hidden list) leaves the CSS fallback.
export function useCardStatusColumn(hostRef, labels, { enabled = true, renderKey = '' } = {}) {
  const key = labels.join('\u0001');
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host || typeof document === 'undefined') return undefined;
    const measure = () => {
      if (!host.isConnected) return;
      const probe = document.createElement('span');
      probe.className = 'qlist-st';
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;inline-size:max-content;max-inline-size:none';
      host.appendChild(probe);
      let max = 0;
      for (const t of key.split('\u0001')) { probe.textContent = t; max = Math.max(max, probe.getBoundingClientRect().width); }
      host.removeChild(probe);
      host.querySelectorAll('.qc-amt').forEach((a) => { max = Math.max(max, a.scrollWidth || 0, a.getBoundingClientRect().width); });
      if (max > 0) host.style.setProperty('--stw', `${Math.ceil(max)}px`);
      else host.style.removeProperty('--stw');
    };
    measure();
    let cancelled = false;
    const fonts = document.fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(() => { if (!cancelled) measure(); }).catch(() => {});
    let lastW = host.clientWidth;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { const w = host.clientWidth; if (w !== lastW) { lastW = w; measure(); } });
    if (ro) ro.observe(host);
    return () => { cancelled = true; if (ro) ro.disconnect(); };
  }, [hostRef, key, enabled, renderKey]);
}
