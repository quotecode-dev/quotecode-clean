// IRON-ICON-001 (law 45; Owner 2026-10-23, the reference "משהו בסגנון של זה"): the TEKANGO AI icon family - an app tile with a light
// rim, a deep navy face and a glowing blue line-drawn head. One drawing, two marks inside the head: `customer` (a question mark - the
// customer's eyes, "בדיקת הלקוח") and `chat` (a star of light - the AI chat). Pure inline SVG, no asset; decorative (aria-hidden): the
// button keeps its own text and accessible name. Gradient / filter ids are per instance (useId).
import { useId } from 'react';

export default function TekangoAiIcon({ size = 20, variant = 'customer' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = `tkai-tile-${uid}`;
  const rim = `tkai-rim-${uid}`;
  const line = `tkai-line-${uid}`;
  const face = `tkai-face-${uid}`;
  const glow = `tkai-glow-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-tekango-ai-icon={variant} style={{ flex: 'none', display: 'block' }}>
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
      {/* lips */}
      <path d="M22.1 31 Q24 31.9 25.9 31" fill="none" stroke="#6FA4FF" strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
      {variant === 'chat' ? (
        <g filter={`url(#${glow})`}>
          {/* a star of light inside the head */}
          <path d="M24 13.6 L25.5 19.1 L31 20.6 L25.5 22.1 L24 27.6 L22.5 22.1 L17 20.6 L22.5 19.1 Z" fill="#EAF2FF" />
          <path d="M29.2 12.8 L29.8 14.5 L31.5 15.1 L29.8 15.7 L29.2 17.4 L28.6 15.7 L26.9 15.1 L28.6 14.5 Z" fill="#B9D3FF" />
        </g>
      ) : (
        <g filter={`url(#${glow})`}>
          {/* a question mark inside the head */}
          <path d="M20.7 17.4 C20.7 15 22.3 13.6 24.3 13.6 C26.4 13.6 27.9 15 27.9 16.9 C27.9 19.7 24.5 20 24.5 23.1" fill="none" stroke="#EAF2FF" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24.5" cy="26.6" r="1.45" fill="#EAF2FF" />
          <path d="M18.6 21.4 L19 22.5 L20.1 22.9 L19 23.3 L18.6 24.4 L18.2 23.3 L17.1 22.9 L18.2 22.5 Z" fill="#B9D3FF" />
        </g>
      )}
      {/* a few small stars */}
      <circle cx="29.6" cy="24.6" r="0.55" fill="#B9D3FF" />
      <circle cx="20.2" cy="27.4" r="0.45" fill="#B9D3FF" />
      <circle cx="28.4" cy="28.4" r="0.4" fill="#B9D3FF" />
    </svg>
  );
}
