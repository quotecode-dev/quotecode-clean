// Task 20 Continuation 2 (Owner correction 2026-10-10): the header AI-chat launcher icon - an ORIGINAL compact vector illustration of a
// friendly AI robot (rounded head with a restrained cyan -> teal -> blue gradient, soft top highlight, dark visor, glowing eyes and smile,
// side "ears" and an antenna with a lit tip). Pure inline SVG: no external asset, image or dependency. Decorative (aria-hidden): the
// button keeps its own text label and accessible name. Gradient ids are per instance (useId) so several icons never share defs.
import { useId } from 'react';

export default function AiRobotIcon({ size = 20 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const head = `airobot-head-${uid}`;
  const glow = `airobot-glow-${uid}`;
  const shine = `airobot-shine-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" data-ai-robot-icon="illustrated" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id={head} x1="6" y1="7" x2="26" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.45" stopColor="#22B8CF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ECFEFF" />
          <stop offset="0.55" stopColor="#67E8F9" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0.15" />
        </radialGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* antenna with a lit tip */}
      <rect x="15.1" y="3.6" width="1.8" height="4.6" rx="0.9" fill="#1E3A8A" />
      <circle cx="16" cy="3.4" r="2.5" fill={`url(#${glow})`} />
      <circle cx="16" cy="3.4" r="1.25" fill="#ECFEFF" />
      {/* ears */}
      <rect x="2.4" y="13.2" width="3.6" height="7.2" rx="1.8" fill="#1D4ED8" />
      <rect x="26" y="13.2" width="3.6" height="7.2" rx="1.8" fill="#1D4ED8" />
      {/* head: gradient body, soft shadow edge, top highlight */}
      <rect x="4.6" y="7.6" width="22.8" height="19.6" rx="8.2" fill="#1E40AF" opacity="0.35" transform="translate(0 0.9)" />
      <rect x="4.6" y="7.6" width="22.8" height="19.6" rx="8.2" fill={`url(#${head})`} />
      <rect x="7.2" y="8.8" width="17.6" height="6.4" rx="3.2" fill={`url(#${shine})`} />
      {/* visor */}
      <rect x="7.8" y="12.2" width="16.4" height="11.2" rx="5.2" fill="#0B1A36" />
      {/* glowing eyes + smile */}
      <ellipse cx="12.9" cy="17.1" rx="2.15" ry="2.5" fill={`url(#${glow})`} />
      <ellipse cx="19.1" cy="17.1" rx="2.15" ry="2.5" fill={`url(#${glow})`} />
      <ellipse cx="12.9" cy="16.6" rx="0.9" ry="1.05" fill="#FFFFFF" />
      <ellipse cx="19.1" cy="16.6" rx="0.9" ry="1.05" fill="#FFFFFF" />
      <path d="M13.6 20.6 Q16 22.2 18.4 20.6" fill="none" stroke="#67E8F9" strokeWidth="1.2" strokeLinecap="round" />
      {/* small sparkle accent (AI) */}
      <path d="M26.8 5.2 L27.5 6.9 L29.2 7.6 L27.5 8.3 L26.8 10 L26.1 8.3 L24.4 7.6 L26.1 6.9 Z" fill="#F0ABFC" />
    </svg>
  );
}
