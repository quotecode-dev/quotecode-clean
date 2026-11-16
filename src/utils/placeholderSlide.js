// Night task 2026-11-16 (Owner typed the night-task line incl. L-09; the rule, Owner 14/11): a sample text (placeholder) longer than its
// typing field is never cut - it SLIDES inside the field: it starts at its first word (Hebrew from the right, English from the left), slides
// slowly to its end, comes back and stops (once, never a loop). "Reduce motion" = it stands still. Only typing fields on the screen - the
// customer page, Print and the PDF wrap long text to a second line (no inputs there). Typing / focusing stops it at once (the typed text
// is never moved). The slide is the field's own text-indent (inherited by the browser's placeholder), negative = towards its end in both
// directions.
const TYPES = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'number']);
const PX_PER_SECOND = 40;
const START_DELAY_MS = 900;
const HOLD_AT_END_MS = 1200;
const BACK_SECONDS = 1;

/** how far (px) and how long (s) a sample text slides in a field of `avail` px, or null when it fits */
export function planSlide(textWidth, avail) {
  const over = Math.ceil(Number(textWidth) - Number(avail));
  if (!(over > 1) || !(avail > 0)) return null;
  return { over, seconds: Math.min(8, Math.max(1.5, over / PX_PER_SECOND)) };
}

let canvas = null;
function measure(text, cs, doc) {
  try {
    canvas = canvas || doc.createElement('canvas');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = ctx.measureText(String(text)).width;
    const ls = parseFloat(cs.letterSpacing);
    return w + (Number.isFinite(ls) ? ls * String(text).length : 0);
  } catch { return 0; }
}

export function installPlaceholderSlide(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win || typeof win.setTimeout !== 'function' || typeof win.getComputedStyle !== 'function') return () => {};
  const reduce = typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return () => {}; // "reduce motion": the sample text stands still
  const doc = root.ownerDocument || win.document;
  const seen = new WeakSet();
  const live = new Set();
  const run = (el, plan) => {
    const timers = [];
    let done = false;
    const reset = () => { el.style.transition = ''; el.style.textIndent = ''; };
    const stop = () => {
      if (done) return; done = true;
      timers.forEach((t) => win.clearTimeout(t)); reset();
      el.removeEventListener('focus', stop); el.removeEventListener('input', stop); el.removeEventListener('pointerdown', stop);
      live.delete(stop);
    };
    el.addEventListener('focus', stop); el.addEventListener('input', stop); el.addEventListener('pointerdown', stop);
    live.add(stop);
    const still = () => !done && !el.value && doc.activeElement !== el;
    timers.push(win.setTimeout(() => {
      if (!still()) { stop(); return; }
      el.style.transition = `text-indent ${plan.seconds}s linear`;
      el.style.textIndent = `-${plan.over}px`;
      timers.push(win.setTimeout(() => {
        if (!still()) { stop(); return; }
        el.style.transition = `text-indent ${BACK_SECONDS}s ease-out`;
        el.style.textIndent = '0px';
        timers.push(win.setTimeout(stop, BACK_SECONDS * 1000 + 50));
      }, plan.seconds * 1000 + HOLD_AT_END_MS));
    }, START_DELAY_MS));
  };
  const scan = () => {
    for (const el of root.querySelectorAll('input[placeholder]')) {
      if (seen.has(el)) continue;
      if (!TYPES.has(String(el.getAttribute('type') || '').toLowerCase())) { seen.add(el); continue; }
      if (el.value || el.offsetParent === null || doc.activeElement === el) continue; // not shown / filled now: look again later
      const cs = win.getComputedStyle(el);
      const avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const plan = planSlide(measure(el.placeholder, cs, doc), avail);
      seen.add(el);
      if (plan) run(el, plan);
    }
  };
  let pending = 0;
  const schedule = () => { if (pending) return; pending = win.setTimeout(() => { pending = 0; scan(); }, 250); };
  const MO = win.MutationObserver;
  const mo = typeof MO === 'function' ? new MO(schedule) : null;
  if (mo) mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'class', 'hidden'] });
  win.addEventListener('resize', schedule);
  schedule();
  return () => {
    if (mo) mo.disconnect();
    win.removeEventListener('resize', schedule);
    if (pending) win.clearTimeout(pending);
    [...live].forEach((s) => s());
  };
}
