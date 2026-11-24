// IRON-ICON-001 (law 45). The TEKANGO AI chat icon: a friendly robot with a headset (ear cups and a microphone boom) on the blue-teal tile.
// Owner console 2026-11-20 night, typed: "מאשר להחליף את אייקון הצ׳אט לרובוט עם האוזניות מהסקיצה בכל מקום, כולל דפי הנחיתה" and
// 2026-11-21, typed (L-02, L-11): "מאשר שינוי גם ב-L-02, L-03, L-04, L-09, L-11, L-14, L-15 ו-L-23 רק במה שנדרש כדי שהמוצר יהיה כמו הסקיצה; ...".
// The drawing is the one of the approved sketch (C:/tekango-ops/demos/simple1120/src.html, BOT): a 24px tile, radius 7, gradient
// 135deg #1e3a8a -> #0e7490, the robot drawn at 18/24 inside it. Pure inline SVG, decorative (aria-hidden): the button keeps its own text
// and accessible name. The gradient id is per instance (useId).
// Owner console 2026-11-24, typed: "מאשר שינוי ב-L-02 וב-L-11: אייקון הרובוט בכותרת חלון הצ׳אט ובכפתורי הצ׳אט בלי ריבוע בגוון כחול נוסף, ובכותרת
// גם מוגדל": `plain` draws the same robot without the tile - `ink` is the robot (white on the navy header / launcher, navy on the white
// header button), `face` the eyes and the smile. Every other use keeps the tile.
import { useId } from 'react';

export default function TekangoBotIcon({ size = 20, plain = false, ink = '#fff', face = '#0f4c75', style = null }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = `tkbot-tile-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-tekango-ai-icon="bot" style={{ flex: 'none', display: 'block', ...style }} data-plain={plain ? 'true' : undefined}>
      {!plain && (<><defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="7" fill={`url(#${tile})`} /></>)}
      <g transform="translate(3 3) scale(0.75)" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-mark="bot">
        {/* the headband */}
        <path d="M4.2 12.8a7.8 7.8 0 0 1 15.6 0" />
        {/* the head, the eyes and the smile */}
        <rect x="6.6" y="7.6" width="10.8" height="10" rx="4" fill={ink} stroke="none" />
        <circle cx="10.2" cy="12.2" r="1.25" fill={face} stroke="none" />
        <circle cx="13.8" cy="12.2" r="1.25" fill={face} stroke="none" />
        <path d="M10.3 14.9c1 .8 2.4.8 3.4 0" stroke={face} strokeWidth="1.4" />
        {/* the ear cups and the microphone boom */}
        <rect x="2.6" y="11.6" width="2.8" height="5" rx="1.3" fill={ink} stroke="none" />
        <rect x="18.6" y="11.6" width="2.8" height="5" rx="1.3" fill={ink} stroke="none" />
        <path d="M20 16.4c0 2.3-1.9 3.8-4.4 3.8H14.4" strokeWidth="1.7" />
      </g>
    </svg>
  );
}
