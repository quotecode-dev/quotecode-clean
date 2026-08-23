import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// ייבוא שתי האפליקציות המבודדות שלנו
import AppLocal from './local/AppLocal.jsx'
import AppGlobal from './global/AppGlobal.jsx'

// עדיפות ההכרעה: ?lang=en / ?lang=he גובר תמיד (לבדיקה נוחה של שתי השפות) <-
// נתיב /en מפורש <- שפה שמורה מביקור קודם <- ובהיעדר כל אלה (ביקור ראשון,
// נתיב שורש נקי), זיהוי אוטומטי לפי navigator.language של הדפדפן במקום
// ברירת מחדל קשיחה לעברית שהתעלמה משפת הדפדפן של גולשים בינלאומיים.
const queryParams = new URLSearchParams(window.location.search);
const langParam = queryParams.get('lang');
const storedLang = localStorage.getItem('proflow_lang');
const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();

const isEnglishEnv = langParam === 'en' ? true
  : langParam === 'he' ? false
  : window.location.pathname.startsWith('/en') ? true
  : window.location.pathname.startsWith('/he') ? false
  : storedLang === 'en' ? true
  : storedLang === 'he' ? false
  : !browserLang.startsWith('he');

try {
  localStorage.setItem('proflow_lang', isEnglishEnv ? 'en' : 'he');
} catch { /* ignore (private browsing / storage disabled) */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isEnglishEnv ? <AppGlobal /> : <AppLocal />}
  </StrictMode>,
)