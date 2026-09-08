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

// 🚨 חוק ברזל קבוע: הגופן 'Alef' (ובכלל, כל גופן חוץ מ-Rubik) אסור
// לשימוש בפרויקט הזה תחת כל תנאי - לא כ-import, לא כ-font-family, ולא
// כברירת מחדל. Rubik הוא התקן הגופני היחיד והגלובלי של האפליקציה -
// עברית ואנגלית כאחד (Rubik תומך בשני הסקריפטים באופן מלא). FONT_HE
// ו-FONT_EN נשארים כשני exports נפרדים כדי לא לשבור קריאות קיימות בכל
// הקבצים שכבר מייבאים את שניהם, אך שניהם מצביעים על אותו מחסנית
// גופנים בדיוק.
//
// Arial מופיע כאן במפורש *לפני* מילת המפתח הגנרית sans-serif בכוונה:
// sans-serif גנרי אינו אומר לדפדפן איזה גופן ספציפי להציג - הרזולוציה
// שלו תלויה לחלוטין במערכת ההפעלה/מכשיר, ובחלק ממכשירי Android/
// Chromebook ברירת המחדל הזו ל-Hebrew היא ממש גופן בשם "Alef". ברגע
// ש-Rubik לא נטען בזמן (רשת איטית/חסומה), הדפדפן מדלג על
// -apple-system/BlinkMacSystemFont/Segoe UI (כל אחד מהם no-op במערכת
// הפעלה אחרת) ומגיע ל-sans-serif הגנרי - וזו בדיוק הנקודה שבה גופן
// לא-רצוי יכול "להתגנב" בלי שום קוד באפליקציה קרא לו בשמו. הוספת
// Arial (זמין כמעט בכל מקום, עם כיסוי עברי סביר) לפני ה-sans-serif
// הגנרי סוגרת את הפער הזה.
export const FONT_HE = "'Rubik', Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_EN = "'Rubik', Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// loadNeonFonts() קיים היה כאן בעבר וטען את Rubik דרך <link> ל-Google
// Fonts שהוזרק בזמן ריצה מתוך useEffect - כלומר רק אחרי הציור הראשון
// של React, ורק לאחר סבב רשת אמיתי ל-fonts.googleapis.com/gstatic.com.
// זה בדיוק מה שהבטיח לפחות פריים אחד של גופן גיבוי בכל טעינת עמוד, לא
// משנה כמה מהירה הייתה הרשת. הוסר לגמרי: Rubik כעת "מתארח עצמאית"
// (self-hosted) דרך @fontsource/rubik, מיובא דרך src/fonts.css -
// (מיובא ישירות מ-main.jsx, בנפרד מ-index.css - ראה הערה שם) גיליון
// סגנונות חוסם שנטען מלכתחילה, לפני כל ציור, בלי תלות ברשת חיצונית
// כלשהי. אין יותר צורך בשום קריאת JS כדי "לטעון" את הגופן.
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

// אותה טכניקת "Flow" הזוהרת בדיוק מ-ProFlowLogo.jsx (גרדיאנט סגול חתוך
// לצורת הטקסט + drop-shadow שיוצר את הזוהר) - מיוצאת כאן פעם אחת כדי
// שכל כותרת ראשית בכל רכיב תוכל לייבא אותה ולהיראות זהה, במקום להעתיק
// את אותם ערכים שוב ושוב בכל קובץ. color הוא רק גיבוי לדפדפנים שלא
// תומכים ב-background-clip: text; ה-WebkitTextFillColor הוא שבפועל
// מסתיר אותו ומחשוף את הגרדיאנט מאחוריו.
export const neonGlowTextStyle = {
  background: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: '#c084fc',
  filter: 'drop-shadow(0 0 8px rgba(192, 132, 252, 0.55))',
};

// LIGHT — owner-approved light SaaS design tokens for the Business Owner
// Dashboard visual redesign. Same key names as NEON on purpose: a component
// file can switch its entire visual theme by aliasing this at import time
// (`import { LIGHT as NEON } from '../theme/neonTheme'`) without touching any
// individual style reference. TEKANGO purple remains the primary/action
// color; green/red stay semantic only (success/approved vs. warning/attention)
// rather than being used decoratively.
export const LIGHT = {
  bg: '#f7f6fb',
  bgCard: '#ffffff',
  bgCardAlt: '#faf9fd',
  bgElevated: '#ffffff',
  bgInput: '#ffffff',

  border: '#e4e1ee',
  borderStrong: '#d5d0e6',
  borderHover: '#8b5cf6',
  divider: '#ece9f5',

  textPrimary: '#1f1b2e',
  textSecondary: '#6b6580',
  textMuted: '#9490a3',
  textOnAccent: '#ffffff',

  violet: '#7c3aed',
  violetLight: '#8b5cf6',
  violetLighter: '#ede9fe',
  pink: '#db2777',
  amber: '#b45309',
  sky: '#0284c7',
  emerald: '#059669',
  emeraldDark: '#047857',
  red: '#dc2626',
  redDark: '#b91c1c',

  gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
  glow: '0 1px 2px rgba(124,58,237,0.06), 0 8px 20px -8px rgba(124,58,237,0.35)',
  glowSoft: '0 1px 2px rgba(124,58,237,0.05), 0 4px 12px -6px rgba(124,58,237,0.25)',
  cardHoverShadow: '0 12px 28px -12px rgba(124,58,237,0.22)',
};

// Solid, no-glow heading style for the light theme — a gradient/drop-shadow
// glow (neonGlowTextStyle) reads as a rendering glitch on a white background.
// Same alias-at-import trick: `import { lightHeadingTextStyle as neonGlowTextStyle }`.
export const lightHeadingTextStyle = {
  background: 'none',
  WebkitBackgroundClip: 'initial',
  backgroundClip: 'initial',
  WebkitTextFillColor: 'initial',
  color: '#6d28d9',
  filter: 'none',
};

// TEKANGO V2 shared design-system tokens (Phase 1, Owner-approved visual
// reference — authenticated User Shell/Dashboard/Create Quote mockup). Purely
// additive: no existing NEON/LIGHT key was renamed or removed, so every
// pre-existing call site keeps working byte-identical. New surfaces should
// prefer these over hand-picked literals so spacing/radius/shadow stay
// consistent as V2 rolls out to more screens in later phases.

// SPACE — one shared spacing scale. Prefer a token over an arbitrary literal
// for new V2 layout code; existing pixel values elsewhere in the app are
// intentionally left untouched (preservation constraint, Phase 1).
export const SPACE = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
};

// RADIUS — consistent rounded corners across V2 surfaces (cards/inputs/pills).
export const RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  pill: '999px',
};

// SHADOW — subtle elevation levels for the light V2 surface language (no
// dark-theme glow here on purpose — those stay under NEON.glow/glowSoft).
export const SHADOW = {
  sm: '0 1px 2px rgba(15,23,42,0.05)',
  md: '0 4px 14px -4px rgba(15,23,42,0.10)',
  lg: '0 16px 32px -12px rgba(15,23,42,0.16)',
};

// SHELL — the authenticated app's own dark navy sidebar surface (Owner-
// approved V2 mockup), deliberately separate from LIGHT (the light content
// surface) and NEON (the unrelated dark neon marketing theme) — this is a
// third, small, purpose-specific palette for exactly one component family
// (sidebar navigation), not a general dark-mode theme.
export const SHELL = {
  sidebarBg: '#171830',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  sidebarItemHoverBg: 'rgba(255,255,255,0.06)',
  sidebarItemActiveBg: '#7c3aed',
  sidebarText: 'rgba(255,255,255,0.72)',
  sidebarTextActive: '#ffffff',
  sidebarTextMuted: 'rgba(255,255,255,0.42)',
  sidebarLogoBg: 'rgba(255,255,255,0.08)',
};
