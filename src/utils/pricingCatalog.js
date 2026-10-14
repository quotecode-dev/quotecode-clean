// חוק ברזל (Unified Landing/Tools/Billing-Readiness task, §B): מקור-אמת
// יחיד למחירי התצוגה (monthly/annual) לשני השווקים - לפני קובץ זה, אותם
// מספרים היו כפולים/מחושבים בנפרד ב-LandingLocal.jsx (מחרוזות קבועות,
// ללא חישוב כלל) וב-LandingGlobal.jsx (חישוב מקומי, לא-משותף). אין כאן
// שינוי מחיר - כל ערך כאן זהה למה שכבר הוצג בפועל בשני הדפים לפני הקובץ
// הזה (מאומת ב-pricingCatalog.test.js).
//
// חשוב: זהו מודול-תצוגה בלבד (presentation), נפרד לחלוטין מ-
// accountEntitlement.js/planCatalog.js (זכאות/ניסיון/LIFETIME בפועל).
// אין כאן, ולעולם לא צריך להיות כאן, קריאה לספק תשלום אמיתי - אין עדיין
// גישה ל-Stripe/סליקה (ר' billing-checkout-stub, שמתעד את עצמו כ-scaffold
// בלבד). כל "מחיר" כאן הוא הצגה בלבד, לא חיוב/מנוי פעיל.
export const VAT_RATE_IL = 0.18;

export const PRICING_CATALOG = {
  il: {
    currency: 'ILS',
    currencySymbol: '₪',
    free: { monthly: 0, annualMonthly: 0 },
    basic: { monthly: 49, annualMonthly: 39 },
    pro: { monthly: 99, annualMonthly: 79 },
  },
  global: {
    usd: {
      currency: 'USD',
      currencySymbol: '$',
      free: { monthly: 0, annualMonthly: 0 },
      basic: { monthly: 15, annualMonthly: 12 },
      pro: { monthly: 29, annualMonthly: 23 },
    },
    gbp: {
      currency: 'GBP',
      currencySymbol: '£',
      free: { monthly: 0, annualMonthly: 0 },
      basic: { monthly: 12, annualMonthly: 10 },
      pro: { monthly: 24, annualMonthly: 19 },
    },
    eur: {
      currency: 'EUR',
      currencySymbol: '€',
      free: { monthly: 0, annualMonthly: 0 },
      basic: { monthly: 14, annualMonthly: 11 },
      pro: { monthly: 27, annualMonthly: 22 },
    },
  },
};

// עוזרים טהורים (pure) - שום גישה ל-DOM/רשת/state. כל התוצאות המוצגות
// (סה"כ שנתי, % חיסכון, פירוט מע"מ) נגזרות מהערכים הקנוניים למעלה, לא
// ממוצאות/מוקלדות בנפרד בכל דף.
export function getAnnualTotal(annualMonthlyRate) {
  return Math.round(annualMonthlyRate * 12 * 100) / 100;
}

export function getMonthlyCycleAnnualTotal(monthlyRate) {
  return Math.round(monthlyRate * 12 * 100) / 100;
}

// מעוגל למספר שלם קרוב (הצגה בלבד, "כ-20%") - הערכים בפועל נעים בין
// כ-17% ל-21% בין המטבעות/החבילות בגלל עיגול למטבע שלם, לא בדיוק 20.0%
// בכל מקרה - מתועד כאן ולא מוצג כדיוק כוזב.
export function getSavingsPercent(monthlyRate, annualMonthlyRate) {
  if (!monthlyRate) return 0;
  return Math.round(((monthlyRate - annualMonthlyRate) / monthlyRate) * 100);
}

export function getVatBreakdown(totalIncludingVat, vatRate = VAT_RATE_IL) {
  const beforeVat = Math.round((totalIncludingVat / (1 + vatRate)) * 100) / 100;
  return { beforeVat, vatRate, totalIncludingVat };
}

// שומר על מוסכמת-שמות שכבר הייתה קיימת (לא בשימוש בפועל, לפני חיבור
// Stripe אמיתי) בשני הדפים בנפרד - price_<plan>_<market>_<monthly|yearly> -
// כדי שאינטגרציה עתידית אמיתית תוכל לאמץ סכימה זו בלי שינוי-שם שובר.
export function getStripePriceId(planId, market, cycle) {
  const cycleSuffix = cycle === 'annual' ? 'yearly' : 'monthly';
  return `price_${planId}_${market}_${cycleSuffix}`;
}

// גזירת הצגת מחיר מלאה לכרטיס-חבילה אחד, לשוק/מטבע/מחזור נתונים - נקודת-
// הכניסה היחידה שדף-נחיתה אמור לקרוא לה (לא לגזור ערכים בעצמו).
export function getPlanPricingDisplay(market, planId, cycle) {
  const marketCatalog = market === 'il' ? PRICING_CATALOG.il : PRICING_CATALOG.global[market];
  if (!marketCatalog) return null;
  const plan = marketCatalog[planId];
  if (!plan) return null;

  const monthlyRate = cycle === 'annual' ? plan.annualMonthly : plan.monthly;
  const annualTotal = cycle === 'annual' ? getAnnualTotal(plan.annualMonthly) : getMonthlyCycleAnnualTotal(plan.monthly);
  const savingsPercent = getSavingsPercent(plan.monthly, plan.annualMonthly);

  return {
    currency: marketCatalog.currency,
    currencySymbol: marketCatalog.currencySymbol,
    monthlyRate,
    annualTotal,
    savingsPercent,
    isAnnualCycle: cycle === 'annual',
  };
}
