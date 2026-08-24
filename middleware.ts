// ==============================================================================
// 🚨 חוק ברזל: המידלוור הזה כותב רמז geo לצורך בחירת עמוד הנחיתה האנונימי
// בלבד (UI routing) - הוא לעולם אינו מבצע redirect ולעולם אינו מקור אמין
// לאזור משפטי/עסקי. הוא רץ רק על השורש (/) ולעולם לא על נתיב אחר.
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

export default function middleware(request: Request) {
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
