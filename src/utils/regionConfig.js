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
  // כמו ב-getCurrencySym/getRegionTaxRate למטה: country (האזור המשפטי
  // האמיתי, שמגיע מ-business_settings.country) הוא מקור האמת ומנצח תמיד
  // כשהוא ידוע - המטמון ב-localStorage משמש רק כברירת מחדל לפני שהאזור
  // האמיתי נטען (או לצופה אנונימי בכלל). סדר הפוך (מטמון לפני country) היה
  // גורם לחשבון שמתחבר על דפדפן משותף לרשת עם מטמון ישן/שגוי מחשבון קודם.
  if (country === REGION_RULES.INTERNATIONAL.countryCode) return false;
  if (country === REGION_RULES.LOCAL.countryCode || country === 'LCL') return true;

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

  return localStorage.getItem('proflow_lang') === 'he';
};

// Item 25 - החלטה טהורה (pure, ניתנת לבדיקה בלי React/Supabase) האם יש
// לתקן פעם אחת את הבאנדל (AppLocal/AppGlobal) כדי שיתאים לאזור האמיתי של
// חשבון מחובר. bundleIsHebrew הוא זהות הבאנדל הנוכחי (קבוע פר-באנדל, מגיע
// כ-prop מ-AppLocal/AppGlobal); isHebrew הוא כבר isHebrewEnv(bizCountry,
// session) האמיתי מהחשבון (ר' למעלה) - הפונקציה הזו לא מחליטה שום דבר
// לגבי מטבע/מע"מ, רק משווה בין השניים. מחזירה null כשאין מה לתקן (או
// כשעדיין אין מספיק מידע אמיתי כדי להחליט בבטחון - לעולם לא ניחוש), אחרת
// 'he'/'en' - ערך ה-?lang= הקנוני הקיים כבר ב-main.jsx לתיקון החד-פעמי.
export function getMarketRoutingCorrection({
  hasSession,
  isInitializing,
  isPasswordRecoveryMode,
  needsRegionChoice,
  settingId,
  bundleIsHebrew,
  isHebrew,
}) {
  if (!hasSession) return null;
  if (isInitializing || isPasswordRecoveryMode || needsRegionChoice) return null;
  if (settingId === null || settingId === undefined) return null;
  if (typeof bundleIsHebrew !== 'boolean') return null;
  if (isHebrew === bundleIsHebrew) return null;

  return isHebrew ? 'he' : 'en';
}

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

// נקודת אמת אחת ומאוחדת לחישוב הפיננסי המלא של הצעת מחיר - עסק מקומי
// (מחיר מוזן = נטו, מע"מ מתווסף מעליו) לעומת פרטי מקומי (מחיר מוזן = ברוטו
// כולל מע"מ, המע"מ מחולץ ולא מתווסף). International לא מושפע כלל מ-clientType
// (VAT rate = 0 תמיד שם, ללא קשר לסיווג הלקוח) - כך שחוק הברזל הבינלאומי
// (§3 ב-PROFLOW_HANDOFF.md) לא יכול "לדלוף" לתוך הלוגיקה הזו.
//
// פונקציה טהורה (pure): אין קריאות Supabase, אין תלות ב-state של React, אין
// side effects, אין תלות בסביבת הרצה (window/localStorage) מעבר למה שכבר
// קיים ב-getRegionTaxRate למעלה. כל הקלטים מגיעים מפורשות מהקורא.
//
// בטיחות client_type: עבור Local, אם clientType אינו בדיוק 'business' או
// 'private' (חסר/ריק/legacy/לא מזוהה), הפונקציה **לא מנחשת** ולא מתייחסת
// לזה כברירת מחדל כ-Business או כ-Private - היא מחזירה clientTypeAmbiguous:
// true עם netAmount/taxAmount/total = null, כדי שהקורא יזהה זאת במפורש
// ויחליט (לפי כללי ה-fail-closed שסוכמו בתוכנית ה-P0) מה לעשות - ולא כדי
// שהפונקציה עצמה תכריע בשקט. עבור International, הדגל הזה תמיד false,
// ללא קשר לערך clientType, כי הסיווג הזה כלל לא רלוונטי לחשבון בינלאומי.
//
// taxRateOverride (אופציונלי): להצעה חדשה משאירים את זה לא-מוגדר ומקבלים
// את שיעור המע"מ מהאזור הנוכחי (getRegionTaxRate) כרגיל. לעריכה פיננסית
// מכוונת של הצעה קיימת, הקורא (Dashboard.jsx) חייב להעביר כאן את ה-tax_rate
// ההיסטורי שכבר שמור על ההצעה עצמה - לעולם לא לתת לפונקציה הזו לגזור מחדש
// שיעור מע"מ מאזור החשבון הנוכחי עבור הצעה שכבר קיימת. אם סופק override
// מפורש שאינו מספר סופי ואי-שלילי תקין, הפונקציה **לא נופלת בשקט** לשיעור
// לפי אזור - היא מחזירה taxRateOverrideInvalid: true עם כל הערכים התלויים
// בשיעור המע"מ כ-null, כדי שהקורא יזהה זאת במפורש ולא יקבל מספר מומצא.
export function calculateQuoteFinancials({ country, clientType, items, discount, taxRateOverride }) {
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  const safeItems = Array.isArray(items) ? items : [];
  const enteredSubtotal = round2(
    safeItems.reduce((sum, item) => sum + Number(item?.quantity || 0) * Number(item?.unit_price || 0), 0)
  );
  const discountAmount = round2(enteredSubtotal * (Number(discount || 0) / 100));
  const discountedAmount = round2(enteredSubtotal - discountAmount);

  const hasOverride = taxRateOverride !== undefined && taxRateOverride !== null;
  const overrideIsValid = typeof taxRateOverride === 'number' && Number.isFinite(taxRateOverride) && taxRateOverride >= 0;
  const taxRateOverrideInvalid = hasOverride && !overrideIsValid;

  if (taxRateOverrideInvalid) {
    return {
      enteredSubtotal,
      discountAmount,
      netAmount: null,
      taxRate: null,
      taxAmount: null,
      total: null,
      clientTypeAmbiguous: false,
      taxRateOverrideInvalid: true,
    };
  }

  const taxRate = hasOverride ? taxRateOverride : getRegionTaxRate(country);

  const isLocal = country === REGION_RULES.LOCAL.countryCode || country === 'LCL';
  const isRecognizedClientType = clientType === 'business' || clientType === 'private';
  const clientTypeAmbiguous = isLocal && !isRecognizedClientType;

  if (clientTypeAmbiguous) {
    return {
      enteredSubtotal,
      discountAmount,
      netAmount: null,
      taxRate,
      taxAmount: null,
      total: null,
      clientTypeAmbiguous: true,
      taxRateOverrideInvalid: false,
    };
  }

  const isPrivate = isLocal && clientType === 'private';

  if (isPrivate) {
    // מחיר מוזן = ברוטו כולל מע"מ. לעולם לא מוסיפים מע"מ מעליו - total
    // נשאר בדיוק ה-ברוטו שהוזן (אחרי הנחה אם יש), לא סכום net+VAT מחדש,
    // כדי שלא ייווצר פער עיגול בין total לבין net+VAT המוצגים.
    const netAmount = round2(discountedAmount / (1 + taxRate));
    const taxAmount = round2(discountedAmount - netAmount);
    return {
      enteredSubtotal,
      discountAmount,
      netAmount,
      taxRate,
      taxAmount,
      total: discountedAmount,
      clientTypeAmbiguous: false,
      taxRateOverrideInvalid: false,
    };
  }

  // Business (מקומי) ו-International כאחד: מחיר מוזן = נטו, מע"מ מתווסף
  // מעליו (עבור International, taxRate=0 הופך את זה בפועל לפעולת זהות).
  const taxAmount = round2(discountedAmount * taxRate);
  const total = round2(discountedAmount + taxAmount);
  return {
    enteredSubtotal,
    discountAmount,
    netAmount: discountedAmount,
    taxRate,
    taxAmount,
    total,
    clientTypeAmbiguous: false,
    taxRateOverrideInvalid: false,
  };
}

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