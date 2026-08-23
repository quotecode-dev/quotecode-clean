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

// טוען את גופן Rubik (בכל המשקלים, כולל Bold/Extra Bold להדגשות בכותרות)
// פעם אחת לכל העמוד, כדי שהטיפוגרפיה תיראה בפועל חדה ולא רק תיפול חזרה
// לגופן המערכת כברירת מחדל. Inter הוסר לגמרי - Rubik הוא הגופן היחיד
// שנטען כעת.
//
// display=swap (ולא display=optional כפי שהיה כאן קודם): עם optional,
// אם Rubik לא היה מוכן כמעט מיידית (רשת איטית/חסומה), הדפדפן "נועל"
// את גופן הגיבוי לכל אורך הצפייה בעמוד ולעולם לא מחליף ל-Rubik גם אחרי
// שהוא סיים להיטען - כלומר בדיוק בתנאי הרשת שבהם "גופן לא רצוי" הכי
// סביר שיופיע, האפליקציה לא הייתה בכלל מנסה לתקן את עצמה. עם swap,
// ברגע ש-Rubik מוכן - גם אם זה קרה כמה שניות אחרי הציור הראשון - הוא
// תמיד מחליף את הגיבוי. המחיר (הבהוב קל בהחלפה) פחות חשוב מהבטחה
// שהגופן הנכון תמיד מנצח בסוף.
export function loadNeonFonts() {
  if (typeof document === 'undefined') return;
  const fonts = [
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
