// IRON-ICON-001 (law 45; Owner choice 2026-10-23, "2 אנשים ועדשה לשים ב CUSTOMER TWIN כסמל ולתת לזה ביטוי כאייקון גדול בכותרת"): the
// Customer Twin mark - two heads back to back (the business owner and the customer) with a lens between them. Flat two-tone (indigo /
// blue); tone="light" draws it in white for a blue button. Pure inline SVG, no asset; decorative (aria-hidden) - the button keeps its own
// text and accessible name. Mask ids are per instance (useId).
import { useId } from 'react';

const HEAD = 'M24 6 H29.5 C36.8 6 40.6 11.6 40.6 18 C40.6 19.4 40.9 20.4 41.5 21.4 L44.3 26.1 C44.8 27 44.2 28 43.2 28 H41.2 V31.6 C41.2 33.9 39.4 35.6 37.2 35.6 H34.4 V38.6 L37.4 42.3 C38.1 43.1 37.5 44.2 36.5 44.2 H26 C24.9 44.2 24 43.3 24 42.2 Z';

export default function CustomerTwinIcon({ size = 20, tone = 'color' }) {
  const mask = `ctwin-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const light = tone === 'light';
  const start = light ? '#FFFFFF' : '#4338CA';
  const end = light ? '#DBE7FF' : '#2563EB';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-customer-twin-icon={light ? 'light' : 'color'} style={{ flex: 'none', display: 'block' }}>
      <defs>
        <mask id={mask}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="24" cy="19.2" r="7.7" fill="#000" />
          <rect x="23.05" y="0" width="1.9" height="48" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        <path d={HEAD} fill={end} />
        <path d={HEAD} fill={start} transform="translate(48 0) scale(-1 1)" />
      </g>
      <circle cx="24" cy="19.2" r="5.9" fill={end} />
    </svg>
  );
}
