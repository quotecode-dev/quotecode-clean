import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'

// ייבוא שתי האפליקציות המבודדות שלנו
import AppLocal from './local/AppLocal.jsx'
import AppGlobal from './global/AppGlobal.jsx'

// עדיפות ההכרעה: ?lang=en / ?lang=he גובר תמיד (לבדיקה נוחה של שתי השפות) <-
// נתיב /en מפורש <- שפה שמורה מביקור קודם <- geo אנונימי (עוגיית
// proflow_geo_country שנכתבת ע"י middleware.ts מכותרת ה-geo האמיתית של
// Vercel - ר' שם) <- ובהיעדר כל אלה (ביקור ראשון בלי geo זמין, נתיב שורש
// נקי), זיהוי אוטומטי לפי navigator.language של הדפדפן במקום ברירת מחדל
// קשיחה לעברית שהתעלמה משפת הדפדפן של גולשים בינלאומיים.
//
// חוק ברזל: העוגייה הזו משמשת אך ורק לבחירת עמוד הנחיתה האנונימי (איזה
// באנדל/שפה מוצגים) - היא אף פעם לא מקור אמין לאזור המשפטי של חשבון.
// אזור משפטי לחשבון *חדש* נקבע אך ורק ע"י geo טרי מהשרת בזמן ההרשמה עצמה
// (ר' Dashboard.jsx -> fetchSettings -> /api/geo.js), לא מהעוגייה הזו.
const queryParams = new URLSearchParams(window.location.search);
const langParam = queryParams.get('lang');
const storedLang = localStorage.getItem('proflow_lang');
const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
const geoCountryCookie = (() => {
  try {
    const match = document.cookie.match(/(?:^|; )proflow_geo_country=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
})();

const isEnglishEnv = langParam === 'en' ? true
  : langParam === 'he' ? false
  : window.location.pathname.startsWith('/en') ? true
  : window.location.pathname.startsWith('/he') ? false
  : storedLang === 'en' ? true
  : storedLang === 'he' ? false
  : geoCountryCookie ? geoCountryCookie !== 'IL'
  : !browserLang.startsWith('he');

try {
  localStorage.setItem('proflow_lang', isEnglishEnv ? 'en' : 'he');
} catch { /* ignore (private browsing / storage disabled) */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isEnglishEnv ? <AppGlobal /> : <AppLocal />}
  </StrictMode>,
)