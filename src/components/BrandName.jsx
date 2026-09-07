// TEKANGO Rebrand - BiDi + Inline Brand Highlight Correction (v2, refined by
// v3's token-only correction): the brand is always literal Latin-uppercase
// text (never an image, never transliterated), but a bare "TEKANGO" sitting
// inside Hebrew/RTL prose needs two things a plain string can't give it on
// its own: (1) Unicode BiDi isolation, so the embedded LTR run doesn't drag
// surrounding Hebrew punctuation/numbers/parentheses out of their natural
// RTL order, and (2) a small, consistent visual accent so the brand token -
// and only the brand token, never the rest of the sentence - reads distinctly
// from the surrounding copy in both locales. `<bdi dir="ltr">` gives isolation
// natively (harmless, inert in pure-LTR English sentences); the accent reuses
// the already-approved violet tokens from theme/neonTheme.js (NEON.violetLight
// for dark hosts, LIGHT's own heading violet for light hosts) rather than the
// green success color, which stays reserved for status semantics.
//
// Call-site note (v3 fix): when a sentence using this component sits inside a
// `display:flex` row alongside a sibling icon element, wrap the whole
// sentence (text + <BrandName/>) in one <span> so it stays a single flex
// item - otherwise the token gets pulled out of the sentence's own line-wrap
// flow and can land on a visually separate line at narrow widths.
export default function BrandName({ onDark = true }) {
  return (
    <bdi
      dir="ltr"
      style={{
        fontWeight: 700,
        color: onDark ? '#a78bfa' : '#6d28d9',
        unicodeBidi: 'isolate',
      }}
    >
      TEKANGO
    </bdi>
  );
}
