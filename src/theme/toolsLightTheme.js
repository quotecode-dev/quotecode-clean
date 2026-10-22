// The public tools page (/he/tools, /en/tools) in the light landing system (Owner 2026-10-21: "להפוך את דף הכלים שיתאים לצבעים
// ולסגנון החדש"). The same values as the landing tokens (src/components/landing/landing.css, .tl-landing --tl-*), under the key names the
// tools page used with the dark NEON theme, so only the look changes - never a calculation, a label or a test id.
// Contrast on white: ink #172129 15.9:1, muted #4f5d64 6.6:1, accent #315f6f 7.0:1, warn #7a4f0a 7.4:1, no #8f3434 8.0:1.
export const TOOLS = Object.freeze({
  bg: '#f7f8f6',
  bgCard: '#ffffff',
  bgInput: '#ffffff',
  alt: '#eef2f0',
  border: '#d6dee1',
  borderStrong: '#aebbc0',
  textPrimary: '#172129',
  textSecondary: '#4f5d64',
  textMuted: '#4f5d64',
  // the former violet accents -> the landing teal
  violet: '#315f6f',
  violetLight: '#315f6f',
  violetLighter: '#264b58',
  accent: '#315f6f',
  accentStrong: '#264b58',
  accentSoft: '#dfe9ec',
  // warnings (stale / unavailable data) and the metals values
  amber: '#7a4f0a',
  red: '#8f3434',
  cardShadow: '0 1px 2px rgba(23, 33, 41, 0.05)',
});
