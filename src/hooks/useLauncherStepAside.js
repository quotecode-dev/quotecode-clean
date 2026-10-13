// The floating public AI launcher steps aside (its root gets `asideClass`; CSS hides the launcher) while it would sit on top of a protected
// surface, and is back as soon as nothing protected is under it. Client-only; rAF-throttled; re-checked on scroll / resize / DOM changes.
// Extracted unchanged from LandingPage.jsx (Task 16 / Task 26) and reused by the contact page (Task 36, L6). Task 36 fix: while aside the
// CSS moves the launcher 16px down (translateY), so its RESTING position is measured (no flip-flop at a protected edge).
// Task 38 (Owner: the launcher covered FAQ answer text on mobile): (1) text blocks (p / li / dd / FAQ answers) are protected by their DRAWN
// text lines (a block box is wider than its glyphs - protecting the box would hide the launcher almost everywhere on a phone), controls and
// headings by their box as before; (2) opening / closing a FAQ answer re-checks at once (the `open` attribute and the toggle event);
// (3) hysteresis: it steps aside at once, and returns only after the spot has stayed free for LAUNCHER_RETURN_DELAY_MS - no flicker in the
// short gaps between paragraphs while scrolling; at rest in a free spot it is back.
import { useEffect } from 'react';

export const LAUNCHER_ASIDE_SHIFT_PX = 16;
export const LAUNCHER_RETURN_DELAY_MS = 300;
const PAD = 8;
// text blocks measured by their drawn lines; every other protected surface (controls, headings, the approved document / hero visuals) by its box
const TEXT_BLOCK = /^(P|LI|DD|DT|BLOCKQUOTE|FIGCAPTION)$/;
const TEXT_SURFACE = '.tl-faq-a, [data-protect-text]';

const hit = (b, d) => b.left - PAD < d.right && b.right + PAD > d.left && b.top - PAD < d.bottom && b.bottom + PAD > d.top;

// Is the launcher box `b` over the protected element `el`? Controls / headings: their box. Text blocks: the rects of the drawn lines.
export function coversProtected(b, el, doc = document) {
  const d = el.getBoundingClientRect();
  if (d.width < 1 || d.height < 1 || !hit(b, d)) return false;
  if (!TEXT_BLOCK.test(el.tagName) && !(el.matches && el.matches(TEXT_SURFACE))) return true;
  const range = doc.createRange();
  range.selectNodeContents(el);
  const lines = [...range.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1);
  return lines.length === 0 ? false : lines.some((r) => hit(b, r));
}

export function useLauncherStepAside(rootRef, protectedSelector, asideClass) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    let returnTimer = 0;
    const isCovered = () => {
      const btn = root.querySelector('.ai-support-btn');
      if (!btn) return false;
      const r = btn.getBoundingClientRect();
      const shift = root.classList.contains(asideClass) ? LAUNCHER_ASIDE_SHIFT_PX : 0;
      const b = { left: r.left, right: r.right, top: r.top - shift, bottom: r.bottom - shift };
      for (const protectedSurface of root.querySelectorAll(protectedSelector)) {
        if (protectedSurface.closest('.ai-chat-container')) continue;
        if (coversProtected(b, protectedSurface)) return true;
      }
      return false;
    };
    const check = () => {
      frame = 0;
      if (isCovered()) {
        if (returnTimer) { window.clearTimeout(returnTimer); returnTimer = 0; }
        root.classList.add(asideClass);
      } else if (root.classList.contains(asideClass) && !returnTimer) {
        returnTimer = window.setTimeout(() => {
          returnTimer = 0;
          if (!isCovered()) root.classList.remove(asideClass); // still free after the delay -> back
        }, LAUNCHER_RETURN_DELAY_MS);
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    root.addEventListener('toggle', schedule, true); // <details> open / close (does not bubble -> capture)
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;
    if (mo) mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root.removeEventListener('toggle', schedule, true);
      if (mo) mo.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (returnTimer) window.clearTimeout(returnTimer);
    };
  }, [rootRef, protectedSelector, asideClass]);
}
