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