// src/utils/regionConfig.js

// קובץ זה מכיל את חוקי הברזל של המערכת ומוקפא משינויים מקריים
export const REGION_RULES = Object.freeze({
  LOCAL: {
    countryCode: 'Local',
    currencySymbol: '₪',
    vatRate: 0.18 // 18% מע"מ לישראל לעולם לא ישתנה מכאן
  },
  INTERNATIONAL: {
    countryCode: 'International',
    defaultCurrencySymbol: '$',
    vatRate: 0.00 // 0% מע"מ לחו"ל לעולם לא ישתנה מכאן
  }
});

export const isHebrewEnv = (country, session) => {
  const email = session?.user?.email;
  
  if (email) {
    const userCached = localStorage.getItem('proflow_country_' + email);
    if (userCached) {
      return userCached !== REGION_RULES.INTERNATIONAL.countryCode;
    }
  }

  const cachedCountry = typeof window !== 'undefined' ? localStorage.getItem('proflow_cached_country') : null;
  if (cachedCountry) {
    return cachedCountry !== REGION_RULES.INTERNATIONAL.countryCode;
  }

  if (country === REGION_RULES.INTERNATIONAL.countryCode) return false;
  if (country === REGION_RULES.LOCAL.countryCode) return true;

  return localStorage.getItem('proflow_lang') === 'he';
};

export const getCurrencySym = (country, currency) => {
  const cachedCountry = typeof window !== 'undefined' ? localStorage.getItem('proflow_cached_country') : null;
  const effectiveCountry = country || cachedCountry;

  const currUpper = (currency || '').toUpperCase();

  if (effectiveCountry === REGION_RULES.INTERNATIONAL.countryCode) {
    if (currUpper === 'EUR') return '€';
    if (currUpper === 'GBP') return '£';
    if (currUpper === 'USD' || currUpper === '$') return '$';
    if (currUpper === 'ILS') return REGION_RULES.LOCAL.currencySymbol;
    return REGION_RULES.INTERNATIONAL.defaultCurrencySymbol;
  }
  return REGION_RULES.LOCAL.currencySymbol;
};

export const getRegionTaxRate = (country) => {
  const cachedCountry = typeof window !== 'undefined' ? localStorage.getItem('proflow_cached_country') : null;
  const effectiveCountry = country || cachedCountry;

  return effectiveCountry !== REGION_RULES.INTERNATIONAL.countryCode ? REGION_RULES.LOCAL.vatRate : REGION_RULES.INTERNATIONAL.vatRate;
};

// נקודת אמת אחת ומאוחדת לכל מה שצריך "פרופיל חיוב" מלא לפי אזור - מיועד
// לשימוש ע"י אינטגרציות עתידיות (Stripe billing, הפקת חשבוניות רגיונליות)
// כדי שלא ייווצרו כמה מקומות שונים בקוד שמחליטים כל אחד בנפרד איזה מטבע/
// מע"מ/שפה שייכים לאיזה אזור. לא מחליף את getRegionTaxRate/getCurrencySym
// הקיימים (עדיין בשימוש ברחבי הדשבורד) - רק עוטף אותם בצורה נוחה לצרכני
// Billing/Invoicing חדשים. ראו INVOICING_INFRASTRUCTURE.md לתיעוד המלא.
export const getRegionBillingProfile = (country) => {
  const cachedCountry = typeof window !== 'undefined' ? localStorage.getItem('proflow_cached_country') : null;
  const effectiveCountry = country || cachedCountry || REGION_RULES.LOCAL.countryCode;
  const isInternational = effectiveCountry === REGION_RULES.INTERNATIONAL.countryCode;

  return Object.freeze({
    countryCode: isInternational ? REGION_RULES.INTERNATIONAL.countryCode : REGION_RULES.LOCAL.countryCode,
    currencyCode: isInternational ? 'USD' : 'ILS',
    currencySymbol: isInternational ? REGION_RULES.INTERNATIONAL.defaultCurrencySymbol : REGION_RULES.LOCAL.currencySymbol,
    vatRate: isInternational ? REGION_RULES.INTERNATIONAL.vatRate : REGION_RULES.LOCAL.vatRate,
    vatPercentLabel: isInternational ? '0%' : '18%',
    language: isInternational ? 'en' : 'he',
    // ייצוא שירותים/תוכנה ללקוח מחוץ לישראל פטור ממע"מ ישראלי (מע"מ בשיעור
    // אפס) - זה בדיוק מה ש-vatRate=0 עבור International כבר מייצג; הדגל
    // הזה קיים בנפרד רק כדי שקוד צרכני (למשל הפקת חשבונית) יוכל לבדוק
    // במפורש "האם זו הצעת ייצוא פטורה" בלי לפרש מספר מע"מ בעצמו
    isExportVatExempt: isInternational,
  });
};

// פונקציות פירמוט מקומי (תאריכים ומספרים) לפי אזור/שפה
export const formatDateLocal = (dateString, isHebrew, currency = 'USD') => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    if (isHebrew) {
      return date.toLocaleDateString('he-IL');
    }

    if (currency === 'USD') {
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateString;
  }
};

export const formatNumberLocal = (val, isHebrew) => {
  const num = Number(val || 0);
  try {
    const locale = isHebrew ? 'he-IL' : 'en-US';
    return num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return num.toFixed(2);
  }
};