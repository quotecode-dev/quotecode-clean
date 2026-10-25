// IRON-ICON-001 (law 45; Owner 2026-10-25 rejected the stock banknote: "תשים אייקון מודרני"): the TEKANGO "paid" mark - a payment
// card in the paid greens with a round check badge on its corner. Flat two-tone with a soft gradient, the same family as
// CustomerTwinIcon; currency-neutral (no ₪ / $). Pure inline SVG, no asset; decorative (aria-hidden) - the button keeps its own text.
// Gradient ids are per instance (useId).
import { useId } from 'react';

export default function PaidMarkIcon({ size = 18 }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const card = `tk-paid-card-${uid}`;
  const badge = `tk-paid-badge-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-icon="tekango-paid" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id={card} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2F8F62" />
          <stop offset="1" stopColor="#1F5E42" />
        </linearGradient>
        <linearGradient id={badge} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34C17F" />
          <stop offset="1" stopColor="#15803D" />
        </linearGradient>
      </defs>
      <rect x="3" y="9" width="36" height="25" rx="6" fill={`url(#${card})`} />
      <rect x="3" y="15.5" width="36" height="4.5" fill="#123B29" opacity="0.55" />
      <rect x="8.5" y="25" width="11" height="3.4" rx="1.7" fill="#FFFFFF" opacity="0.8" />
      <circle cx="35.5" cy="33.5" r="11" fill="#FFFFFF" />
      <circle cx="35.5" cy="33.5" r="8.8" fill={`url(#${badge})`} />
      <path d="M31.2 33.7 L34.3 36.8 L40 30.9" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
