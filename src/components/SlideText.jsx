import { useLayoutEffect, useRef, useState } from 'react';

// 2026-11-15 (Owner: a long name is shown as a slide, not cut; law 50 amendment of the same day): a text longer than its box moves inside it
// (data-slide-text + a running animation - the cut-text scan does not count its own box); a short text stays still
export default function SlideText({ className, dir, title, children }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [slide, setSlide] = useState(null); // { x: px, s: seconds }
  useLayoutEffect(() => {
    const measure = () => {
      const b = box.current; const i = inner.current; if (!b || !i) return;
      const d = Math.ceil(i.scrollWidth - b.clientWidth);
      const rtl = getComputedStyle(b).direction === 'rtl';
      setSlide((prev) => { const next = d > 1 ? { x: rtl ? d : -d, s: Math.max(6, Math.round(d / 15) + 5) } : null; return prev && next && prev.x === next.x ? prev : next; });
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (ro && box.current) ro.observe(box.current);
    return () => { if (ro) ro.disconnect(); };
  }, [children]);
  return (
    <div ref={box} className={className} dir={dir} title={title}>
      <span ref={inner} className={slide ? 'pf-slide pf-slide--on' : 'pf-slide'} data-slide-text={slide ? '' : undefined}
        style={slide ? { '--pf-slide-x': `${slide.x}px`, animationDuration: `${slide.s}s` } : undefined}>{children}</span>
    </div>
  );
}
