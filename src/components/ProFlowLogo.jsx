// TEKANGO Rebrand — Visible Local Implementation task: this component is the
// single centralized brand-mark renderer used by every screen in the app
// (Auth, Dashboard sidebar/header, Landing headers, Public Tools) - kept as
// the existing "ProFlowLogo" filename/import path deliberately, to update
// every call site's rendered brand mark from one place without touching any
// of them, exactly as this task's own instruction prefers.
//
// Dark Header Correction amendment: the first-round assets (brand pack V1)
// shipped only a dark-navy-wordmark transparent PNG plus a separate
// white-*backed* PNG (a solid white rectangle, not real transparency) - used
// as a stand-in for dark hosting contexts, which the Owner correctly
// rejected as an ugly boxed/framed logo on the app's dark chrome. The Owner
// then supplied two corrected v2 assets with genuine alpha transparency:
// one with a white wordmark (for dark hosts) and one with the original
// dark-navy wordmark (for light hosts) - no white backing plate in either.
// darkText therefore now selects between these two *real* transparent
// variants; no box/frame/pill/card/shadow is added around either, and no
// pixel of either supplied asset is redrawn, cropped, stretched, or
// recolored. The V1 assets (tekango-logo-horizontal-transparent.png,
// tekango-logo-horizontal-white.png) are left in place, unreferenced, per
// this task's "no deletion of legacy/orphaned assets" instruction.
//
// Below a certain rendered height the seven-letter horizontal lockup stops
// being legible (confirmed against the one real call site that used
// size=13 for a small sidebar "Powered by" credit) - the brand pack
// explicitly ships a standalone symbol (T/K/forward-arrow only) for exactly
// this compact case, so sizes under 20px render that instead of shrinking
// the full wordmark into illegibility. This is the documented, intended use
// of the supplied pack, not an improvised substitution.
//
// The `rtl` prop is accepted but ignored, preserved only for backward
// compatibility with existing call sites that still pass it (see git
// history - the platform brand mark has been a single unified LTR mark
// regardless of page direction for some time already).
const HORIZONTAL_ASPECT = 2029 / 428; // both supplied v2 horizontal variants share this exact pixel aspect ratio
const SYMBOL_ASPECT = 612 / 515; // supplied symbol-transparent asset's own pixel aspect ratio
const COMPACT_THRESHOLD = 20; // px - below this, the full wordmark is not reliably legible; use the symbol mark instead

export default function ProFlowLogo({ size = 48, darkText = false }) {
  if (size < COMPACT_THRESHOLD) {
    return (
      <img
        src="/tekango-symbol-transparent.png"
        alt="TEKANGO"
        style={{
          height: `${size}px`,
          width: `${size * SYMBOL_ASPECT}px`,
          display: 'inline-block',
          flexShrink: 0,
          objectFit: 'contain',
        }}
      />
    );
  }

  const src = darkText
    ? '/tekango-logo-horizontal-light-transparent.png'
    : '/tekango-logo-horizontal-dark-transparent.png';

  return (
    <img
      src={src}
      alt="TEKANGO"
      style={{
        height: `${size}px`,
        width: `${size * HORIZONTAL_ASPECT}px`,
        display: 'inline-block',
        flexShrink: 0,
        objectFit: 'contain',
      }}
    />
  );
}
