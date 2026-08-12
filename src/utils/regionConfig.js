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
  // אם אין משתמש מחובר (מסך כניסה / התחברות / אורח), נציג תמיד באנגלית בינלאומית נקייה ויציבה
  if (!session || !session.user) {
    return false;
  }

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

  if (effectiveCountry === REGION_RULES.INTERNATIONAL.countryCode) {
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    if (currency === 'ILS') return REGION_RULES.LOCAL.currencySymbol;
    return REGION_RULES.INTERNATIONAL.defaultCurrencySymbol;
  }
  return REGION_RULES.LOCAL.currencySymbol;
};

export const getRegionTaxRate = (country) => {
  const cachedCountry = typeof window !== 'undefined' ? localStorage.getItem('proflow_cached_country') : null;
  const effectiveCountry = country || cachedCountry;
  
  return effectiveCountry !== REGION_RULES.INTERNATIONAL.countryCode ? REGION_RULES.LOCAL.vatRate : REGION_RULES.INTERNATIONAL.vatRate;
};