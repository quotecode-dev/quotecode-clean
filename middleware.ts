// ==============================================================================
// 🚨 חוק ברזל: המידלוור הזה כותב רמז geo לצורך בחירת עמוד הנחיתה האנונימי
// בלבד (UI routing) - הוא לעולם אינו מקור אמין לאזור משפטי/עסקי. הוא רץ רק
// על השורש (/) ולעולם לא על נתיב אחר (matcher למטה).
//
// עדכון (Vercel Canonical Root Redirect Repair): המידלוור עכשיו כן מבצע
// redirect אמיתי אחד, ויחיד - אך ורק כש-host הבקשה הוא בדיוק דומיין ה-Vercel
// הידוע (quotecode.vercel.app), לפני לוגיקת ה-geo-cookie בכלל. זה תיקון-שורש
// ל-בעיה מוכחת: vercel.json's redirects[] מעולם לא הגיע להיבדק עבור השורש
// עצמו, כי המידלוור הזה כבר "תופס" כל בקשה ל-/ ומחזיר next() קודם. עבור כל
// host אחר (www.quotecodepro.com הקנוני, localhost, TEST, preview) - אין
// שינוי כלל, הלוגיקה הגיאוגרפית הבאה ממשיכה בדיוק כפי שהייתה.
//
// חשוב: העוגייה הזו נקראת ע"י main.jsx כטייר עדיפות נמוך יותר מ-
// localStorage['proflow_lang'] (העדפה שמורה של המבקר החוזר) - ר' main.jsx.
// אזור משפטי לחשבון *חדש* לגמרי נקבע במקום אחר לגמרי: /api/geo.js, שנקרא
// ע"י Dashboard.jsx רק ברגע יצירת business_settings, עם geo טרי מהבקשה
// הנוכחית - לא מהעוגייה הזו, שיכולה להיות ישנה (עד 24 שעות) אם המשתמש
// גלש/שינה VPN בינתיים.
// ==============================================================================

import { geolocation, next } from '@vercel/functions';

export const config = {
  matcher: ['/'],
};

const GEO_COOKIE_NAME = 'proflow_geo_country';
const GEO_COOKIE_MAX_AGE = 60 * 60 * 24; // 24h - מספיק לחוויית גלישה, לא רלוונטי לאזור משפטי (ר' הערה למעלה)

// חוק ברזל (Vercel Canonical Root Redirect Repair): vercel.json's redirects[]
// כבר מכיל את כלל ההפניה הקנוני הנכון (quotecode.vercel.app -> www.quotecodepro.com,
// permanent), אבל הוא אף פעם לא מגיע להיבדק עבור השורש (/) עצמו - כי ה-Middleware
// הזה כבר "תופס" כל בקשה ל-/ (matcher למעלה) ותמיד מחזיר next(), לפני ש-Vercel
// בכלל מגיע להערכת redirects. כל נתיב אחר (לא /) אף פעם לא עובר דרך ה-Middleware
// הזה בכלל, ולכן כבר מופנה נכון היום ללא שינוי. הפתרון היחיד האמין: לבדוק את
// ה-host כאן במפורש, לפני לוגיקת ה-geo-cookie, ולהחזיר הפניה אמיתית בעצמנו
// כש-host הוא בדיוק דומיין ה-Vercel הידוע - לא לסמוך על vercel.json להגיע לזה.
// כל host אחר (www.quotecodepro.com הקנוני, localhost, TEST, preview) ממשיך
// בדיוק כפי שהיה - שום שינוי בהתנהגות הגיאוגרפית/עוגיית ה-geo עבורם.
//
// מקור-האמת לכלל הדומיין הקנוני חי עכשיו בשני מקומות מסונכרנים בכוונה (לא קובץ
// שלישי משותף - זה over-engineering עבור שני מחרוזות קבועות): vercel.json's
// redirects[0] (כל נתיב חוץ מ-/) ו-VERCEL_APP_HOST/CANONICAL_ORIGIN כאן (רק /).
export const VERCEL_APP_HOST = 'quotecode.vercel.app';
export const CANONICAL_ORIGIN = 'https://www.quotecodepro.com';

// פונקציה טהורה, ניתנת-לבדיקה בנפרד מ-@vercel/functions/geolocation (שדורש
// runtime אמיתי של Vercel Edge) - מחזירה את יעד ההפניה המלא כש-host הוא
// בדיוק דומיין ה-Vercel הידוע, אחרת null (אין הפניה, ההתנהגות הקיימת ממשיכה
// ללא שינוי). host מושווה case-insensitive (כותרות HTTP אינן תלויות-רישיות).
export function resolveCanonicalRedirect(host: string, pathname: string, search: string): string | null {
  if (host.toLowerCase() !== VERCEL_APP_HOST) return null;
  return `${CANONICAL_ORIGIN}${pathname}${search}`;
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const redirectTo = resolveCanonicalRedirect(request.headers.get('host') || '', url.pathname, url.search);
  if (redirectTo) {
    return Response.redirect(redirectTo, 308);
  }

  const { country } = geolocation(request);

  if (!country) {
    // geo לא זמין (פיתוח מקומי, פרוקסי חוסם וכו') - ממשיכים רגיל בלי
    // לכתוב עוגייה; main.jsx כבר יודע ליפול חזרה ל-navigator.language.
    return next();
  }

  return next({
    headers: {
      'Set-Cookie': `${GEO_COOKIE_NAME}=${encodeURIComponent(country)}; Path=/; Max-Age=${GEO_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
    },
  });
}
