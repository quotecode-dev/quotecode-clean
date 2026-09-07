// ==============================================================================
// 🚨 חוק ברזל: המידלוור הזה כותב רמז geo לצורך בחירת עמוד הנחיתה האנונימי
// בלבד (UI routing) - הוא לעולם אינו מקור אמין לאזור משפטי/עסקי. הוא רץ רק
// על השורש (/) ולעולם לא על נתיב אחר (matcher למטה).
//
// עדכון (Vercel Canonical Root Redirect Repair): המידלוור עכשיו כן מבצע
// redirect אמיתי - אך ורק כש-host הבקשה הוא אחד מהדומיינים הישנים הידועים
// (ר' LEGACY_REDIRECT_HOSTS למטה), לפני לוגיקת ה-geo-cookie בכלל. זה תיקון-שורש
// ל-בעיה מוכחת: vercel.json's redirects[] מעולם לא הגיע להיבדק עבור השורש
// עצמו, כי המידלוור הזה כבר "תופס" כל בקשה ל-/ ומחזיר next() קודם. עבור כל
// host אחר (www.tekango.com הקנוני, localhost, TEST, preview) - אין שינוי
// כלל, הלוגיקה הגיאוגרפית הבאה ממשיכה בדיוק כפי שהייתה.
//
// עדכון (TEKANGO Email Migration + Visible Rebrand Sweep task, 2026-09-07):
// הדומיין הקנוני עודכן מ-www.quotecodepro.com ל-www.tekango.com בהתאם
// להחלטת הבעלים (DNS/SSL כבר מוגדרים חיצונית לפי הצהרת הבעלים - שינוי זה
// נשאר קוד מקומי בלבד, לא נפרס).
//
// עדכון (TEKANGO Public-Migration RC, Worker 3, 2026-09-07): הדומיינים
// הישנים quotecodepro.com ו-www.quotecodepro.com הפכו עכשיו למקורות-הפניה
// לגיטימיים בדיוק כמו quotecode.vercel.app - כל שלושתם 308-מפנים לנתיב+query
// המקביל ב-CANONICAL_ORIGIN. זה משנה כוונה במפורש לעומת ההערה הקודמת (וה-test
// הישן) שאמרו במפורש "no forced redirect" עבור www.quotecodepro.com - הדרישה
// העסקית השתנתה: קישורים/סימניות ישנים ל-quotecodepro.com (bare) ול-
// www.quotecodepro.com צריכים כעת להמשיך לעבוד ע"י הפניה ל-www.tekango.com,
// ולא ע"י המשך שרתם באתר הישן. vercel.json's redirects[] מקבל שתי כניסות
// מקבילות עבור נתיבים לא-שורש; המידלוור הזה נשאר האחראי היחיד על נתיב
// השורש (/) מהסיבה שמוסברת למעלה.
//
// חשוב (RC, Worker 3): רשימת ה-hosts הישנים למטה (LEGACY_REDIRECT_HOSTS)
// היא היחידה ש-resolveCanonicalRedirect בודק מולה עבור נתיב השורש - היא
// אינה קובעת התנהגות geo/cookie כלשהי, רק אם מתבצע 308 redirect לפני
// שהלוגיקה הגיאוגרפית הבאה מגיעה בכלל להרצה.
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
// כבר מכיל את כללי ההפניה הקנוניים הנכונים (כל אחד מהדומיינים הישנים ->
// www.tekango.com, permanent), אבל הוא אף פעם לא מגיע להיבדק עבור השורש (/)
// עצמו - כי ה-Middleware הזה כבר "תופס" כל בקשה ל-/ (matcher למעלה) ותמיד
// מחזיר next(), לפני ש-Vercel בכלל מגיע להערכת redirects. כל נתיב אחר (לא /)
// אף פעם לא עובר דרך ה-Middleware הזה בכלל, ולכן כבר מופנה נכון היום ללא
// שינוי. הפתרון היחיד האמין: לבדוק את ה-host כאן במפורש, לפני לוגיקת
// ה-geo-cookie, ולהחזיר הפניה אמיתית בעצמנו כש-host הוא אחד מהדומיינים
// הישנים הידועים - לא לסמוך על vercel.json להגיע לזה. host קנוני
// (www.tekango.com) או לא-מוכר (localhost, TEST, preview) ממשיך בדיוק כפי
// שהיה - שום שינוי בהתנהגות הגיאוגרפית/עוגיית ה-geo עבורם.
//
// מקור-האמת לכלל הדומיין הקנוני חי עכשיו בשני מקומות מסונכרנים בכוונה (לא קובץ
// שלישי משותף - זה over-engineering עבור שלוש מחרוזות קבועות): vercel.json's
// redirects[] (כל נתיב חוץ מ-/, שלוש כניסות מקבילות) ו-LEGACY_REDIRECT_HOSTS/
// CANONICAL_ORIGIN כאן (רק /). כל שינוי ברשימת ה-hosts הישנים חייב להתעדכן
// בשני המקומות יחד.
export const VERCEL_APP_HOST = 'quotecode.vercel.app';
export const CANONICAL_ORIGIN = 'https://www.tekango.com';

// כל host ישן שצריך 308-redirect קבוע לנתיב+query המקביל תחת CANONICAL_ORIGIN.
// www.tekango.com (הקנוני עצמו) לעולם לא כלול כאן - זה השומר-על-לולאה: אין שום
// דרך שהוא ייכנס לרשימה הזו ויגרום ל-redirect לעצמו.
const LEGACY_REDIRECT_HOSTS = new Set<string>([
  VERCEL_APP_HOST,
  'quotecodepro.com',
  'www.quotecodepro.com',
]);

// פונקציה טהורה, ניתנת-לבדיקה בנפרד מ-@vercel/functions/geolocation (שדורש
// runtime אמיתי של Vercel Edge) - מחזירה את יעד ההפניה המלא כש-host הוא אחד
// מהדומיינים הישנים הידועים (LEGACY_REDIRECT_HOSTS), אחרת null (אין הפניה,
// ההתנהגות הקיימת ממשיכה ללא שינוי - כולל עבור www.tekango.com הקנוני עצמו,
// שלעולם אינו ברשימה ולכן לעולם אינו מפנה לעצמו). host מושווה
// case-insensitive (כותרות HTTP אינן תלויות-רישיות).
export function resolveCanonicalRedirect(host: string, pathname: string, search: string): string | null {
  if (!LEGACY_REDIRECT_HOSTS.has(host.toLowerCase())) return null;
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
