// Shared design tokens for the unified Vercel/Raycast-style dark neon theme.
// Used across the marketing pages (LandingLocal/LandingGlobal) and the
// authenticated app (Dashboard + all tab components) so the look stays
// consistent instead of drifting between hand-copied hex values per file.

export const NEON = {
  bg: '#050506',
  bgCard: '#0c0c10',
  bgCardAlt: '#131318',
  bgElevated: '#18181d',
  bgInput: '#131318',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  borderHover: 'rgba(167,139,250,0.5)',
  divider: '#27272a',

  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textOnAccent: '#ffffff',

  violet: '#8b5cf6',
  violetLight: '#a78bfa',
  violetLighter: '#c4b5fd',
  pink: '#ec4899',
  amber: '#fbbf24',
  sky: '#38bdf8',
  emerald: '#34d399',
  emeraldDark: '#10b981',
  red: '#f87171',
  redDark: '#ef4444',

  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  glow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 12px 30px -8px rgba(139,92,246,0.55), 0 0 45px -10px rgba(236,72,153,0.45)',
  glowSoft: '0 0 24px -6px rgba(139,92,246,0.4)',
  cardHoverShadow: '0 24px 40px -14px rgba(139, 92, 246, 0.35)',
};

export const FONT_HE = "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_EN = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// טוען את גופני Rubik (עברית חדה ומודרנית) ו-Inter (אנגלית) פעם אחת לכל העמוד,
// כדי שהטיפוגרפיה תיראה בפועל חדה ולא רק תיפול חזרה לגופן המערכת כברירת מחדל.
export function loadNeonFonts() {
  if (typeof document === 'undefined') return;
  const fonts = [
    { id: 'inter', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap' },
    { id: 'rubik', href: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&display=swap' },
  ];
  fonts.forEach(({ id, href }) => {
    if (!document.querySelector(`link[data-proflow-font='${id}']`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-proflow-font', id);
      document.head.appendChild(link);
    }
  });
}

// Shared reusable style helpers so buttons/cards look identical across files.
export const neonCardStyle = (extra = {}) => ({
  background: NEON.bgCard,
  border: `1px solid ${NEON.border}`,
  borderRadius: '14px',
  ...extra,
});

export const neonPrimaryButtonStyle = (extra = {}) => ({
  background: NEON.gradient,
  color: NEON.textOnAccent,
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  cursor: 'pointer',
  boxShadow: NEON.glow,
  ...extra,
});

export const neonGhostButtonStyle = (extra = {}) => ({
  background: 'rgba(255,255,255,0.04)',
  color: NEON.textPrimary,
  border: `1px solid ${NEON.borderStrong}`,
  borderRadius: '8px',
  fontWeight: '600',
  cursor: 'pointer',
  ...extra,
});
