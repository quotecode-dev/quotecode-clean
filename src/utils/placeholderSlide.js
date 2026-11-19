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

// Owner console 2026-11-16 ("למלל ארוך יש סלייד" + the typed release line "סלייד לטקסט ארוך בכל שדה במערכת"): a VALUE longer than its
// field (an e-mail, an address, a name) is never cut either - while the field is not being edited it slides inside it, back and forth
// with a pause at each end (as a long name in the sidebar). Focus / typing / a touch stops it at once and leaves the text at its start;
// leaving the field looks again. "Reduce motion" = it stands still.
/** how far (px) and how long (ms) a long value slides back and forth, or null when it fits */
export function planValueSlide(textWidth, avail) {
  const over = Math.ceil(Number(textWidth) - Number(avail));
  if (!(over > 1) || !(avail > 0)) return null;
  return { over, ms: Math.max(6, Math.round(over / 15) + 5) * 1000 };
}

export function installValueSlide(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win || typeof win.setTimeout !== 'function' || typeof win.getComputedStyle !== 'function') return () => {};
  const reduce = typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return () => {};
  const doc = root.ownerDocument || win.document;
  const moving = new Map(); // input -> { anim, value, width }
  const stopOne = (el) => { const m = moving.get(el); if (!m) return; try { m.anim.cancel(); } catch { /* none */ } el.style.textIndent = ''; moving.delete(el); };
  const look = (el) => {
    if (!el || el.tagName !== 'INPUT' || !TYPES.has(String(el.getAttribute('type') || '').toLowerCase())) return;
    const value = String(el.value || '');
    if (!value || el.offsetParent === null || doc.activeElement === el) { stopOne(el); return; }
    const cs = win.getComputedStyle(el);
    const avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const cur = moving.get(el);
    if (cur && cur.value === value && cur.width === el.clientWidth) return;
    stopOne(el);
    const plan = planValueSlide(measure(value, cs, doc), avail);
    if (!plan || typeof el.animate !== 'function') return;
    const end = `-${plan.over}px`;
    const anim = el.animate([{ textIndent: '0px', offset: 0 }, { textIndent: '0px', offset: 0.18 }, { textIndent: end, offset: 0.82 }, { textIndent: end, offset: 1 }],
      { duration: plan.ms, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', delay: START_DELAY_MS });
    moving.set(el, { anim, value, width: el.clientWidth });
  };
  const scan = () => { for (const el of root.querySelectorAll('input')) look(el); for (const el of [...moving.keys()]) if (!el.isConnected) moving.delete(el); };
  const onStop = (e) => stopOne(e.target);
  const onBlur = (e) => { if (e.target && e.target.tagName === 'INPUT') win.setTimeout(() => look(e.target), 50); };
  root.addEventListener('focusin', onStop); root.addEventListener('input', onStop); root.addEventListener('pointerdown', onStop, true);
  root.addEventListener('focusout', onBlur);
  // values arrive after the fields (loaded settings, a chosen client): a light look every 1.5s and on every change of the page
  const timer = win.setInterval(scan, 1500);
  let pending = 0;
  const schedule = () => { if (pending) return; pending = win.setTimeout(() => { pending = 0; scan(); }, 250); };
  const MO = win.MutationObserver;
  const mo = typeof MO === 'function' ? new MO(schedule) : null;
  if (mo) mo.observe(root, { childList: true, subtree: true });
  win.addEventListener('resize', schedule);
  schedule();
  return () => {
    win.clearInterval(timer); if (pending) win.clearTimeout(pending); if (mo) mo.disconnect(); win.removeEventListener('resize', schedule);
    root.removeEventListener('focusin', onStop); root.removeEventListener('input', onStop); root.removeEventListener('pointerdown', onStop, true); root.removeEventListener('focusout', onBlur);
    [...moving.keys()].forEach(stopOne);
  };
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
