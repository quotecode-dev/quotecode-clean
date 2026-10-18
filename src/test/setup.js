import '@testing-library/jest-dom';

// חוק ברזל (Smart Quote Structure-First UX Correction task, נתגלה תוך-כדי
// כתיבת בדיקות): ב-Node 22+/vitest jsdom בקומבינציה הזו, window.localStorage
// אינו זמין כלל (typeof window !=='undefined' אך window.localStorage===
// undefined - Node עצמו חושף localStorage גלובלי-ניסיוני משלו, חסום מאחורי
// --localstorage-file, ש-jsdom לא תמיד דורס). זהו פער-סביבת-בדיקה אמיתי,
// לא באג-ייצור (דפדפן אמיתי תמיד חושף window.localStorage) - נחשף כשלראשונה
// קוד קיים-מזמן (regionConfig.js getRegionTaxRate, שכל היום קורא ל-
// localStorage.getItem בלי window. prefix) נקרא מנתיב-רינדור-קומפוננטה
// (QuoteForm.jsx computeUnitSubtotal) ולא רק ישירות מבדיקת-unit שכבר
// מספקת תמיד taxRateOverride מפורש (המסלול היחיד שמדלג על הקריאה הזו).
// פוליפיל in-memory מינימלי כאן - נקודה אחת, לא בכל קובץ-בדיקה בנפרד.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map();
  const memoryLocalStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(window, 'localStorage', { value: memoryLocalStorage, writable: true, configurable: true });
  if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
    globalThis.localStorage = memoryLocalStorage;
  }
}
