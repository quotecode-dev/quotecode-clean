import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Owner console 2026-11-19, typed: "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות כמו בתמונות, וצמצום העמודות ברשימת ההצעות,
// כולל שינוי ב-L-17 ו-L-19, ושחרור עד הלייב" (+ law 50 change of the same night: "שם או טקסט ארוך שמסתיים בשלוש נקודות ומוצג במלואו בריחוף או
// בלחיצה אינו נחשב מילה חתוכה"). A long name / text stays on one line and ends with "…"; the whole text shows in the system's small dark
// bubble (the feature-lock tooltip style) - on a computer while the mouse is over it, on a touch screen when it is tapped (the tap does not
// open the card / row under it). A text that fits is plain text: no bubble, the tap goes to whatever is under it as before.
// The box carries its whole text twice - data-full-text (the bubble) and title - which is what the law-50 cut-text scan reads; the text sits
// in an inner span with an empty title, so the browser's own tooltip never doubles the bubble.
// `plain`: the caller's own CSS decides when the box is one line with "…" (e.g. only on a phone); otherwise the shared .pf-ell rule does.
// `bubble`: what the bubble shows when it is more than the box's own text (the hot banner shows its whole line - Owner console 2026-11-19,
// typed: "מאשר שינוי ב-L-25 וב-L-26: בטלפון ובטאבלט לאורך, שם או משימה ארוכים בפס ההודעה החמה מסתיימים בשלוש נקודות, ונגיעה בשורה פותחת בועה עם
// כל השורה"); `tapLine`: a tap anywhere on the box's own line (its parent) opens it; `onBubble(open)`: told when the bubble opens / closes.
// A number never shows in part: in a right-to-left line the "…" cuts from the left, so "הרצל 120" would read "הרצל 0…". Each number run is one
// unbreakable inline box (.pf-ell-num) - it shows whole or is hidden behind the "…". The text itself (textContent) does not change.
const NUM_RUN = /(\d[\d.,:/-]*\d|\d)/;
function ellipsisNumbers(value) {
  const parts = String(value ?? '').split(NUM_RUN);
  return parts.length === 1 ? parts[0] : parts.map((p, i) => (i % 2 === 1 ? <span key={i} className="pf-ell-num">{p}</span> : p));
}

export default function EllipsisText({ text, children, as: Box = 'span', className = '', plain = false, dir, style, bubble: bubbleContent, tapLine = false, onBubble, ...rest }) {
  const full = String(text ?? '');
  const box = useRef(null);
  const pointer = useRef('mouse');
  const [cut, setCut] = useState(false);
  const [bubble, setBubble] = useState(null); // { top, left|right, above }
  const tipId = useId();

  useLayoutEffect(() => {
    const measure = () => { const b = box.current; if (b) setCut(b.scrollWidth > b.clientWidth + 1); };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (ro && box.current) ro.observe(box.current);
    return () => { if (ro) ro.disconnect(); };
  }, [full, children]);

  const area = useCallback(() => (tapLine && box.current ? box.current.parentElement : box.current), [tapLine]);
  const place = useCallback(() => {
    const b = box.current; const a = area(); if (!b || !a) return null;
    const r = a.getBoundingClientRect();
    const rtl = getComputedStyle(b).direction === 'rtl';
    const below = r.bottom + 6; const above = typeof window !== 'undefined' && below + 40 > window.innerHeight;
    // the bubble starts where the text starts: the start content edge of the box (right in Hebrew, left in English)
    const ac = getComputedStyle(a);
    const edge = rtl ? r.right - (parseFloat(ac.paddingRight) || 0) - (parseFloat(ac.borderRightWidth) || 0) : r.left + (parseFloat(ac.paddingLeft) || 0) + (parseFloat(ac.borderLeftWidth) || 0);
    return { rtl, top: above ? r.top - 6 : below, above, edge };
  }, [area]);
  // placed after it is drawn (before the paint): its own width decides its left; then any offset of the fixed layer (a scroll bar or
  // a scroll-bar gutter) is measured and removed, so the bubble edge lands exactly on the text edge in both languages, inside the screen
  const tip = useRef(null);
  useLayoutEffect(() => {
    const el = tip.current; if (!bubble || !el) return;
    const w = el.offsetWidth; const vw = document.documentElement.clientWidth;
    const want = Math.max(8, Math.min(bubble.rtl ? bubble.edge - w : bubble.edge, vw - w - 8));
    el.style.left = `${want}px`;
    const got = el.getBoundingClientRect().left;
    if (Math.abs(got - want) > 0.5) el.style.left = `${want + (want - got)}px`;
  }, [bubble]);
  const show = useCallback(() => { const p = place(); if (p) setBubble(p); }, [place]);
  const hide = useCallback(() => setBubble(null), []);
  const toggle = useCallback(() => { const p = place(); setBubble((prev) => (prev ? null : p)); }, [place]);

  // the caller hears when the bubble opens / closes (not on the first render)
  const onBubbleRef = useRef(onBubble); onBubbleRef.current = onBubble;
  const wasOpen = useRef(false);
  useEffect(() => { const open = Boolean(bubble); if (open !== wasOpen.current) { wasOpen.current = open; if (onBubbleRef.current) onBubbleRef.current(open); } }, [bubble]);

  // tapLine: the whole line is the tap target (a tap on the count / days beside the name opens the same bubble)
  useEffect(() => {
    const a = tapLine && box.current ? box.current.parentElement : null; if (!a) return undefined;
    const down = (e) => { pointer.current = e.pointerType || 'mouse'; };
    const click = (e) => { if (!cut || pointer.current === 'mouse') return; e.preventDefault(); e.stopPropagation(); toggle(); };
    a.addEventListener('pointerdown', down); a.addEventListener('click', click);
    return () => { a.removeEventListener('pointerdown', down); a.removeEventListener('click', click); };
  }, [tapLine, cut, toggle]);

  // a tap bubble closes on the next tap anywhere, on scroll, on resize and on Escape
  useEffect(() => {
    if (!bubble) return undefined;
    const close = () => setBubble(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => { const a = area(); if (a && !a.contains(e.target)) close(); };
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close); document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [bubble, area]);

  const onPointerDown = (e) => { pointer.current = e.pointerType || 'mouse'; };
  const onPointerEnter = (e) => { if (e.pointerType === 'mouse' && cut) show(); };
  const onPointerLeave = (e) => { if (e.pointerType === 'mouse') hide(); };
  const onClick = (e) => {
    if (!cut || pointer.current === 'mouse') return; // a mouse click keeps its old meaning (open the row / card)
    if (tapLine) return; // the line's own listener above handles it
    e.preventDefault(); e.stopPropagation();
    toggle();
  };

  return (
    <>
      {/* PRODUCT_TRUTH_DECORATIVE: a shortened name shows its whole text in a small bubble (hover / tap); changes no data */}
      <Box ref={box} className={`${plain ? '' : 'pf-ell '}${className}`.trim()} dir={dir} style={style} title={full} data-full-text={full}
        aria-describedby={bubble ? tipId : undefined} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onClick={onClick} {...rest}>
        <span title="">{children ?? ellipsisNumbers(full)}</span>
      </Box>
      {bubble && typeof document !== 'undefined' && createPortal(
        <div ref={tip} id={tipId} role="tooltip" className="pf-ell-bubble" dir={bubble.rtl ? 'rtl' : 'ltr'} data-testid="ellipsis-bubble"
          style={{ position: 'fixed', top: bubble.top, left: 8, transform: bubble.above ? 'translateY(-100%)' : undefined }}>
          {bubbleContent ?? full}
        </div>,
        document.body,
      )}
    </>
  );
}
