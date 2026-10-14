import { useId } from 'react';

// Owner update 2026-10-09: an ORIGINAL illustrated eye for the "client viewed the quote" signal (no Lucide/generic/pixel icon).
// Organic winged liner, elegant lashes sweeping to the outer corner, a TEKANGO-teal iris with soft depth and a catch-light.
// Drawn on a 24px grid so it stays legible at 24px. Only the eyelid (.tk-eye-lid) animates, INSIDE the SVG: it slides down over
// the clipped eye opening and back up (7s cycle, a short natural blink), so the icon box never scales, resizes or moves. The
// animation is removed entirely under prefers-reduced-motion.
const INK = '#172129';
const TEAL = '#0F6672';
const TEAL_DEEP = '#0B3F46';
const UPPER = 'C6.2 7.6 15.4 6.4 20.2 11.6';
const OPENING = `M3.2 13.2 ${UPPER} C16 17.4 7.4 17.6 3.2 13.2Z`;
const TK_EYE_BLINK_CSS = `
.tk-eye-lid { transform: translateY(0); animation: tk-eye-blink 7s ease-in-out infinite; }
@keyframes tk-eye-blink {
  0%, 93%, 100% { transform: translateY(0); }
  95.5% { transform: translateY(8.4px); }
}
@media (prefers-reduced-motion: reduce) {
  .tk-eye-lid { animation: none; }
}
`;

export default function TekangoEyeIcon({ size = 24, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `tk-eye-open-${uid}`;
  const iris = `tk-eye-iris-${uid}`;
  const lid = `tk-eye-lidfill-${uid}`;
  return (
    <svg
      className={`tk-eye ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-icon="tekango-eye"
    >
      <style>{TK_EYE_BLINK_CSS}</style>
      <defs>
        <clipPath id={clip}><path d={OPENING} /></clipPath>
        <radialGradient id={iris} cx="0.42" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#6CC0C8" />
          <stop offset="0.55" stopColor={TEAL} />
          <stop offset="1" stopColor={TEAL_DEEP} />
        </radialGradient>
        <linearGradient id={lid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9D6D9" />
          <stop offset="1" stopColor="#DCEAEB" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path d={OPENING} fill="#FFFFFF" />
        <circle cx="11.8" cy="12.3" r="3.9" fill={`url(#${iris})`} stroke={TEAL_DEEP} strokeWidth="0.5" />
        <circle cx="11.8" cy="12.3" r="1.7" fill="#0D1B20" />
        <circle cx="13.2" cy="10.8" r="0.85" fill="#FFFFFF" />
        <circle cx="10.5" cy="13.7" r="0.4" fill="#FFFFFF" opacity="0.75" />
        {/* the eyelid: rests exactly above the opening (fully clipped), its lower edge follows the upper lid line */}
        <g className="tk-eye-lid" data-part="eyelid">
          <path d={`M0 -2H24V11.6H20.2C15.4 6.4 6.2 7.6 3.2 13.2H0Z`} fill={`url(#${lid})`} />
          <path d={`M20.2 11.6C15.4 6.4 6.2 7.6 3.2 13.2`} stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      {/* lower lid line and a few fine lower lashes */}
      <path d="M3.2 13.2C7.4 17.6 16 17.4 20.2 11.6" stroke={INK} strokeWidth="0.75" strokeLinecap="round" />
      <path d="M11.2 16.7l-0.25 1.05M14.1 16.4l0.05 1.15M16.9 15.3l0.5 0.95" stroke={TEAL_DEEP} strokeWidth="0.7" strokeLinecap="round" />
      {/* winged upper liner (tapered, organic) */}
      <path d={`M2.7 13.5C5.6 6.6 15.8 5.2 20.9 10.4L23.3 8.6L20.2 11.6C15.4 6.4 6.2 7.6 3.2 13.2Z`} fill={INK} />
      {/* upper lashes: longer and more swept toward the outer corner */}
      <path
        d="M7.9 8.3Q8.1 6.5 9.3 5.5M10.9 7.3Q11.4 5.3 12.9 4.4M13.9 7.1Q14.9 5.2 16.6 4.7M16.7 7.9Q18.2 6.3 20.1 6.1"
        stroke={INK}
        strokeWidth="0.95"
        strokeLinecap="round"
      />
    </svg>
  );
}
