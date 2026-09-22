import { useLayoutEffect } from 'react';

// IRON-MOBILE-WIDTH-001 x IRON-NUMERIC-001 (the tested exception to the fixed slot token): a list of money amounts must share ONE
// physical axis, but that axis must be exactly as wide as the WIDEST amount actually rendered - never a worst-case constant such as
// "₪9,999,999.99" (the fixed 8.4em slot left a visible dead gap beside every card amount and stole title width on mobile).
// Measures the widest real token once per render key (and again after fonts load) and sets --pf-money-slot-size on the list host.
// Text is produced by the caller from the canonical formatters; nothing here formats, rounds or converts money.
export function useMoneySlotSize(hostRef, texts, { enabled = true, fontSize = '0.95rem', fontWeight = '400' } = {}) {
  const key = texts.join('\u0001');
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host || typeof document === 'undefined') return undefined;
    const measure = () => {
      const probe = document.createElement('span');
      probe.className = 'pf-money';
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${fontSize};font-weight:${fontWeight}`;
      host.appendChild(probe);
      let max = 0;
      for (const t of key.split('\u0001')) { probe.textContent = t; max = Math.max(max, probe.getBoundingClientRect().width); }
      host.removeChild(probe);
      if (max > 0) host.style.setProperty('--pf-money-slot-size', `${Math.ceil(max) + 1}px`);
      else host.style.removeProperty('--pf-money-slot-size');
    };
    measure();
    let cancelled = false;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!cancelled) measure(); });
    return () => { cancelled = true; };
  }, [hostRef, key, enabled, fontSize, fontWeight]);
}
