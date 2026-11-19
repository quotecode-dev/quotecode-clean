import { useEffect, useRef, useState } from 'react';
import { HERO_FILM } from './heroFilm';

// Owner console 2026-11-20, typed: "מאשר את הטלפון החי בכרטיס הפתיחה כמו בסקיצה, כולל שינוי ב-L-02, ושחרור עד הלייב" (over the sketch: the card,
// the photo, the copy and the ORIGINAL phone picture stay exactly as they are - same angle, size and place; only the phone SCREEN shows a
// real recording of the product, the camera following the action; the card and the phone keep today's size - Owner choice of 20/11).
// The original picture (the <img> passed as phoneRef) is never touched: this layer sits on its screen only once the film really plays.
// It starts after the page has loaded and the phone's own entrance animation is over; it pauses while the card is out of view.
// "Reduce motion", a browser that cannot play the film, or no JavaScript: the original picture stays exactly as today.
export default function HeroPhoneFilm({ lang, phoneRef }) {
  const g = HERO_FILM[lang] || HERO_FILM.en;
  const [W, H] = g.size; const [TW, TH] = g.texture;
  const boxRef = useRef(null); const natRef = useRef(null); const videoRef = useRef(null);
  const [ready, setReady] = useState(false);   // allowed to run here (client, motion, codec)
  const [on, setOn] = useState(false);         // the film is playing - the layer is shown

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const probe = document.createElement('video');
    const can = typeof probe.canPlayType === 'function' && probe.canPlayType('video/webm; codecs="vp8"') !== '';
    if (!reduce && can) setReady(true);
    return undefined;
  }, []);

  // the layer covers exactly the picture's drawn box (object-fit: contain) - layout sizes, not the animated transform
  useEffect(() => {
    if (!ready) return undefined;
    const img = phoneRef.current; const box = boxRef.current; const nat = natRef.current;
    if (!img || !box || !nat) return undefined;
    const place = () => {
      const bw = img.offsetWidth; const bh = img.offsetHeight; if (!bw || !bh) return;
      const k = Math.min(bw / W, bh / H); const w = W * k; const h = H * k;
      box.style.left = `${img.offsetLeft + (bw - w) / 2}px`; box.style.top = `${img.offsetTop + (bh - h) / 2}px`;
      box.style.width = `${w}px`; box.style.height = `${h}px`; nat.style.transform = `scale(${k})`;
    };
    place();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    if (ro) ro.observe(img);
    window.addEventListener('resize', place);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', place); };
  }, [ready, phoneRef, W, H]);

  // start: the page is loaded and the phone has landed; pause while out of view
  useEffect(() => {
    if (!ready) return undefined;
    const img = phoneRef.current; const v = videoRef.current;
    if (!img || !v) return undefined;
    let alive = true; let io = null;
    const landed = () => {
      const anims = typeof img.getAnimations === 'function' ? img.getAnimations() : [];
      return Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => null))), new Promise((r) => setTimeout(r, 8000))]);
    };
    const loaded = () => (document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })));
    const onPlaying = () => { if (alive) setOn(true); };
    v.addEventListener('playing', onPlaying);
    Promise.all([loaded(), landed()]).then(() => {
      if (!alive) return;
      v.src = g.film; v.load();
      v.play().catch(() => {});
      if (typeof IntersectionObserver === 'function') {
        io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); });
        io.observe(img);
      }
    });
    return () => { alive = false; v.removeEventListener('playing', onPlaying); if (io) io.disconnect(); v.pause(); };
  }, [ready, phoneRef, g.film]);

  if (!ready) return null;
  return (
    <div ref={boxRef} className={`tl-hero-film${on ? ' is-on' : ''}`} aria-hidden="true" data-testid="hero-phone-film">
      <div ref={natRef} className="tl-hero-film-nat" style={{ width: `${W}px`, height: `${H}px` }}>
        <div className="tl-hero-film-screen" style={{ clipPath: `polygon(${g.clip.map(([x, y]) => `${x}px ${y}px`).join(',')})` }}>
          <video ref={videoRef} className="tl-hero-film-video" muted loop playsInline preload="none" tabIndex={-1}
            style={{ width: `${TW}px`, height: `${TH}px`, transform: g.matrix3d }} />
        </div>
        <img className="tl-hero-film-island" src={g.island} alt="" decoding="async"
          style={{ left: `${g.islandBox.x}px`, top: `${g.islandBox.y}px`, width: `${g.islandBox.w}px`, height: `${g.islandBox.h}px` }} />
      </div>
    </div>
  );
}
