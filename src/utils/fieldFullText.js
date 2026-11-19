// Owner console 2026-11-19 (typed: "מאשר, כולל L-09, עד הלייב" over the plan: nothing moves in a field; a long text shows its start and ends
// with "…" at the field edge; on a computer a mouse over the field shows the whole text in the system's small dark bubble; a click starts
// the normal editing - the "…" goes and the whole text scrolls; no sample text is longer than its field on a phone). This replaces the
// 16/11 moving text (placeholderSlide: a sample text slid once, a long value slid back and forth).
// The "…" itself is CSS (index.css, text-overflow on a field that is not being typed in); this module only draws the hover bubble.
const TYPES = new Set(['', 'text', 'search', 'email', 'tel', 'url']);

let canvas = null;
/** the drawn width of `text` in the field's own font */
export function textWidth(text, cs, doc) {
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

/** the whole text a field hides - its value, else its sample text - or null when it fits (or the field is not a text field) */
export function fieldHiddenText(el, win, measure = textWidth) {
  if (!el || el.tagName !== 'INPUT' || !TYPES.has(String(el.getAttribute('type') || '').toLowerCase())) return null;
  const text = String(el.value || el.placeholder || '');
  if (!text) return null;
  const cs = win.getComputedStyle(el);
  const avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  return avail > 0 && measure(text, cs, el.ownerDocument) > avail + 1 ? text : null;
}

/** a mouse over a field whose text is longer than the field: the whole text in the bubble under it, at its start edge; returns the uninstall */
export function installFieldBubble(root, win = typeof window !== 'undefined' ? window : null, measure = textWidth) {
  if (!root || !win || typeof win.getComputedStyle !== 'function') return () => {};
  const doc = root.ownerDocument || win.document;
  let tip = null; let owner = null;
  const hide = () => { if (tip) { tip.remove(); tip = null; } owner = null; };
  const show = (el) => {
    const text = doc.activeElement === el ? null : fieldHiddenText(el, win, measure);
    if (!text) { hide(); return; }
    if (owner === el && tip) return;
    hide(); owner = el;
    const r = el.getBoundingClientRect(); const cs = win.getComputedStyle(el); const rtl = cs.direction === 'rtl';
    tip = doc.createElement('div');
    tip.className = 'pf-ell-bubble'; tip.setAttribute('role', 'tooltip'); tip.setAttribute('data-testid', 'field-bubble'); tip.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    tip.textContent = text;
    const below = r.bottom + 6; const above = below + 40 > win.innerHeight;
    Object.assign(tip.style, { position: 'fixed', top: `${above ? r.top - 6 : below}px`, left: '8px', transform: above ? 'translateY(-100%)' : '' });
    doc.body.appendChild(tip);
    // the bubble edge on the text's start edge (right in Hebrew, left in English), inside the screen; any offset of the fixed layer removed
    const edge = rtl ? r.right - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderRightWidth) || 0) : r.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
    const w = tip.offsetWidth; const vw = doc.documentElement.clientWidth;
    const want = Math.max(8, Math.min(rtl ? edge - w : edge, vw - w - 8));
    tip.style.left = `${want}px`;
    const got = tip.getBoundingClientRect().left;
    if (Math.abs(got - want) > 0.5) tip.style.left = `${want + (want - got)}px`;
  };
  const onOver = (e) => { if (e.pointerType && e.pointerType !== 'mouse') return; const el = e.target; if (el && el.tagName === 'INPUT') show(el); };
  const onOut = (e) => { if (owner && e.target === owner) hide(); };
  const onKey = (e) => { if (e.key === 'Escape') hide(); };
  root.addEventListener('pointerover', onOver); root.addEventListener('pointerout', onOut);
  root.addEventListener('focusin', hide); root.addEventListener('input', hide); root.addEventListener('pointerdown', hide, true);
  win.addEventListener('scroll', hide, true); win.addEventListener('resize', hide); doc.addEventListener('keydown', onKey);
  return () => {
    hide();
    root.removeEventListener('pointerover', onOver); root.removeEventListener('pointerout', onOut);
    root.removeEventListener('focusin', hide); root.removeEventListener('input', hide); root.removeEventListener('pointerdown', hide, true);
    win.removeEventListener('scroll', hide, true); win.removeEventListener('resize', hide); doc.removeEventListener('keydown', onKey);
  };
}
