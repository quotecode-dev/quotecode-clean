// חוק ברזל (Admin V2 Foundation — Phase 1, Canonical Plan Catalog):
// נקודת-אמת יחידה למטא-דאטה של כל חבילה נתמכת (FREE/BASIC/PRO) - שם תצוגה
// HE/EN, זהות ויזואלית (badge icon/color), הגדרות זכאות/מגבלות. לפני הקובץ
// הזה, אותם ערכים (5/20/∞, isBasicOrAbove/isPro gates, אייקון+צבע לכל חבילה)
// היו כפולים בכמה מקומות בלתי-תלויים (Dashboard.jsx פעמיים - תצוגה+אכיפה,
// AdminUsersTab.jsx פעמיים - טבלה+מובייל, UserDetailsModal.jsx) - ר' תיעוד
// מלא ב-PROFLOW_PROJECT_CONTEXT.md §91/§92/§94.1. הוספת חבילה עתידית הופכת
// לרשומת-קטלוג אחת כאן, לא לשרשרת עריכות מפוזרת.
//
// TRIAL אינו חבילה נפרדת בקטלוג הזה בכוונה - הוא מצב/שלב-חיים זמני (ר'
// resolveAccountEntitlement.js) שמעניק את הזכאות של PRO באופן זמני, לא
// חבילה עצמאית בת-רכישה. אין כאן כללים מסחריים חדשים - כל הערך המספרי/
// בוליאני כאן כבר היה קיים ומאושר בקוד/בתיעוד לפני קובץ זה, רק רוכז למקום
// אחד.
//
// צבעים מיוצגים כמפתחות-טוקן (שמות שדה בתוך NEON/LIGHT ב-src/theme/neonTheme.js),
// לא כערכי-hex ישירים - כדי שהקובץ הזה יישאר עצמאי מבחירת-ה-theme הספציפית
// של כל צרכן (AdminUsersTab.jsx על LIGHT, Dashboard.jsx על NEON הרגיל וכו').

export const PLAN_IDS = ['free', 'basic', 'pro'];

export const PLAN_CATALOG = {
  free: {
    id: 'free',
    rank: 0,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'FREE', en: 'FREE' },
    badge: { icon: 'CircleUser', colorToken: 'textSecondary', bgTint: 'rgba(255,255,255,0.08)' },
    monthlyQuoteLimit: 5,
    editDuplicate: false,
    whatsappDelete: false,
    attachments: false,
  },
  basic: {
    id: 'basic',
    rank: 1,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'BASIC', en: 'BASIC' },
    badge: { icon: 'Layers', colorToken: 'sky', bgTint: 'rgba(56, 189, 248, 0.15)' },
    monthlyQuoteLimit: 20,
    editDuplicate: true,
    whatsappDelete: false,
    attachments: false,
  },
  pro: {
    id: 'pro',
    rank: 2,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'PRO', en: 'PRO' },
    badge: { icon: 'Gem', colorToken: 'violetLight', bgTint: 'rgba(139, 92, 246, 0.15)' },
    monthlyQuoteLimit: Infinity,
    editDuplicate: true,
    whatsappDelete: true,
    attachments: true,
  },
};

// TRIAL ו-LIFETIME אינם רשומות-קטלוג (אינם חבילות בנות-רכישה) - הם מצבי-
// תצוגה (badge overrides) שמונחים מעל ה-tier המחושב. ר' resolveAccountEntitlement.js.
export const BADGE_STATE_META = {
  TRIAL: { icon: 'Clock', colorToken: 'sky', bgTint: 'rgba(56, 189, 248, 0.15)' },
};

// נופל בבטחה ל-FREE עבור כל ערך לא-מוכר (הגנה, לא ניחוש) - תואם בדיוק את
// ה-fallback הקיים כבר ב-computeEffectivePlan() (planEntitlements.js) עבור
// plan גולמי לא-מוכר.
export function getPlanDefinition(planId) {
  const key = (planId || 'free').toLowerCase();
  return PLAN_CATALOG[key] || PLAN_CATALOG.free;
}
