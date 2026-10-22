// IRON-ICON-001 (law 45; Owner 2026-10-23: the reference "משהו בסגנון של זה", then "את הראש עם הסימן שאלה - להוריד את סימן השאלה ולשים
// במקום AI - זה ישמש לצאט AI"): the TEKANGO AI chat icon - an app tile with a light rim, a deep navy face and a glowing blue line-drawn
// head with "AI" inside. Pure inline SVG, no asset (the letters are drawn strokes, never a font); decorative (aria-hidden): the button keeps
// its own text and accessible name. Gradient / filter ids are per instance (useId).
import { useId } from 'react';

export default function TekangoAiIcon({ size = 20 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = `tkai-tile-${uid}`;
  const rim = `tkai-rim-${uid}`;
  const line = `tkai-line-${uid}`;
  const face = `tkai-face-${uid}`;
  const glow = `tkai-glow-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-tekango-ai-icon="ai" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1638" />
          <stop offset="1" stopColor="#040919" />
        </linearGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0ECFF" />
          <stop offset="0.55" stopColor="#93B8FF" />
          <stop offset="1" stopColor="#3B6FF0" />
        </linearGradient>
        <linearGradient id={line} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9CC4FF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id={face} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#14306E" />
          <stop offset="1" stopColor="#060D24" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* the tile: a light rim around a deep navy face */}
      <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill={`url(#${rim})`} />
      <rect x="4.2" y="4.2" width="39.6" height="39.6" rx="9.6" fill={`url(#${tile})`} />
      <g filter={`url(#${glow})`} fill="none" stroke={`url(#${line})`} strokeLinecap="round" strokeLinejoin="round">
        {/* shoulders / neck lines */}
        <path d="M12.5 43.6 C14.6 39.8 18.6 38.2 24 38.2 C29.4 38.2 33.4 39.8 35.5 43.6" strokeWidth="1.6" />
        <path d="M17.4 41.2 C19.3 40.4 21.5 40.1 24 40.1 C26.5 40.1 28.7 40.4 30.6 41.2" strokeWidth="1" opacity="0.7" />
        {/* ears */}
        <path d="M14.3 19.6 C12.3 19.8 12.2 24.9 14.6 25.2" strokeWidth="1.6" />
        <path d="M33.7 19.6 C35.7 19.8 35.8 24.9 33.4 25.2" strokeWidth="1.6" />
        {/* the head */}
        <path d="M24 8.6 C30.3 8.6 33.9 13.2 33.9 19.6 C33.9 26.8 30 33.6 24 35.8 C18 33.6 14.1 26.8 14.1 19.6 C14.1 13.2 17.7 8.6 24 8.6 Z" fill={`url(#${face})`} strokeWidth="2" />
      </g>
      {/* "AI" inside the head - drawn strokes */}
      <g filter={`url(#${glow})`} fill="none" stroke="#EAF2FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" data-mark="ai">
        <path d="M17.9 25.6 L21.3 14.6 L24.7 25.6" />
        <path d="M19.1 21.9 H23.5" />
        <path d="M29.1 14.6 V25.6" />
      </g>
      {/* lips + a few small stars */}
      <path d="M22.1 31 Q24 31.9 25.9 31" fill="none" stroke="#6FA4FF" strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
      <circle cx="30.8" cy="28.2" r="0.55" fill="#B9D3FF" />
      <circle cx="17.6" cy="28.4" r="0.45" fill="#B9D3FF" />
      <circle cx="20.2" cy="11.8" r="0.4" fill="#B9D3FF" />
    </svg>
  );
}
