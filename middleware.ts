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

import { geolocation } from '@vercel/functions';

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

// ==============================================================================
// ROOT LOCALE RESOLUTION (Google indexing root-canonical remediation, 2026-09-28; locked policy TEKANGO_AI_ARCHITECTURE.md
// §55.11: /he = Local canonical, /en = International canonical, "/" resolves to one of them via geo/IP BEFORE any landing
// content paints - no wrong-locale first paint). "/" used to render a landing in the visitor's locale under canonical "/", so
// Google saw the root and /en as duplicates and chose "/" for /en (Search Console, 2026-09-28). "/" is now never a page on a
// Vercel host: it is a 302 to exactly /he or /en, with the query string kept (e.g. an Auth callback's ?code= / ?error=); a URL
// fragment (an implicit-flow Auth callback) is carried over by the browser and handled on /he and /en exactly as on "/"
// (AppLocal.jsx / AppGlobal.jsx).
//
// Precedence - the same order main.jsx uses on the client, so server and client never disagree:
//   1. explicit ?lang=he|en;
//   2. the visitor's saved PUBLIC UI language preference (cookie LOCALE_PREF_COOKIE, mirrored by main.jsx from its existing
//      localStorage 'proflow_lang' value);
//   3. geo/IP country (IL -> he, any other -> en) - the same signal the geo cookie below already carries;
//   4. geo unavailable: the browser's primary Accept-Language (he / iw -> he);
//   5. otherwise en (deterministic).
// IRON RULE: this is anonymous PUBLIC UI routing only. It never reads or writes business_settings.country, signup_market, currency,
// billing / legal region or any authenticated market identity, and nothing downstream may treat it as one.
// Not cached: 302 + Cache-Control private,no-store + Vary, so one visitor's resolution can never be served to another.
// ==============================================================================
export const LOCALE_PREF_COOKIE = 'proflow_lang';
export type PublicLocale = 'he' | 'en';

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  for (const part of String(cookieHeader || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

const asLocale = (v: string | null | undefined): PublicLocale | null => (v === 'he' || v === 'en' ? v : null);

export function resolveRootLocale({ search, cookieHeader, country, acceptLanguage }: {
  search: string; cookieHeader?: string | null; country?: string | null; acceptLanguage?: string | null;
}): PublicLocale {
  const explicit = asLocale(new URLSearchParams(search || '').get('lang'));
  if (explicit) return explicit;
  const saved = asLocale(readCookie(cookieHeader, LOCALE_PREF_COOKIE));
  if (saved) return saved;
  if (country) return country.trim().toUpperCase() === 'IL' ? 'he' : 'en';
  const primary = String(acceptLanguage || '').split(',')[0].trim().toLowerCase();
  if (primary.startsWith('he') || primary.startsWith('iw')) return 'he';
  return 'en';
}

// Absolute target on the SAME origin (canonical host or a Vercel preview): always /he or /en - never "/" - so no loop is possible
// (the matcher only covers "/"). The query string is kept verbatim.
export function rootLocaleRedirectTarget(origin: string, locale: PublicLocale, search: string): string {
  return `${origin}/${locale}${search || ''}`;
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const redirectTo = resolveCanonicalRedirect(request.headers.get('host') || '', url.pathname, url.search);
  if (redirectTo) {
    return Response.redirect(redirectTo, 308);
  }

  const { country } = geolocation(request);
  const locale = resolveRootLocale({
    search: url.search,
    cookieHeader: request.headers.get('cookie'),
    country,
    acceptLanguage: request.headers.get('accept-language'),
  });
  const headers = new Headers({
    Location: rootLocaleRedirectTarget(url.origin, locale, url.search),
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie, Accept-Language',
  });
  if (country) {
    // Unchanged geo hint for main.jsx (see the header of this file); still written on the redirect response.
    headers.append('Set-Cookie', `${GEO_COOKIE_NAME}=${encodeURIComponent(country)}; Path=/; Max-Age=${GEO_COOKIE_MAX_AGE}; SameSite=Lax; Secure`);
  }
  return new Response(null, { status: 302, headers });
}
