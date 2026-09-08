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

// חוק ברזל (LIFETIME Full-PRO Inheritance, PROFLOW_PROJECT_CONTEXT.md §151):
// שדות-הזכאות (monthlyQuoteLimit/editDuplicate/whatsappDelete/attachments
// ואילך) מקוננים תחת entitlements כקבוצה אחת, נפרדים מהמטא-דאטה (id/rank/
// sellable/hidden/displayLabel/badge) - לא במקרה. זה מה שהופך את
// getEntitlementSet('pro') למטה לפעולת-עותק גנרית אחת (spread), לא רשימת-
// שדות מתוחזקת ביד: יכולת עתידית שתתווסף כאן תחת pro.entitlements תזרום
// אוטומטית לכל צרכן שקורא ל-getEntitlementSet('pro') - כולל LIFETIME
// (accountEntitlement.js) - בלי לגעת בקובץ הזה שוב ובלי תיקון-פיזור-נוסף.
export const PLAN_CATALOG = {
  free: {
    id: 'free',
    rank: 0,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'FREE', en: 'FREE' },
    badge: { icon: 'CircleUser', colorToken: 'textSecondary', bgTint: 'rgba(255,255,255,0.08)' },
    entitlements: {
      monthlyQuoteLimit: 5,
      editDuplicate: false,
      whatsappDelete: false,
      attachments: false,
      professionalQuotes: false,
      professionalQuoteReuse: false,
    },
  },
  basic: {
    id: 'basic',
    rank: 1,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'BASIC', en: 'BASIC' },
    badge: { icon: 'Layers', colorToken: 'sky', bgTint: 'rgba(56, 189, 248, 0.15)' },
    entitlements: {
      monthlyQuoteLimit: 20,
      editDuplicate: true,
      whatsappDelete: false,
      attachments: false,
      // חוק ברזל (Professional Quotes Stage B, PROFLOW_PROJECT_CONTEXT.md
      // §156, Owner-approved canonical matrix §155.1.9): BASIC מקבל את ליבת
      // Professional Quotes במלואה - החלטת-מוצר מפורשת, לא PRO-בלבד.
      // professionalQuoteReuse (יכולת מתקדמת) נשאר false ל-BASIC בכוונה -
      // זה בדיוק ההבחנה המאשרת בין PRO ל-BASIC בתחום הזה.
      professionalQuotes: true,
      professionalQuoteReuse: false,
    },
  },
  pro: {
    id: 'pro',
    rank: 2,
    sellable: true,
    hidden: false,
    displayLabel: { he: 'PRO', en: 'PRO' },
    badge: { icon: 'Gem', colorToken: 'violetLight', bgTint: 'rgba(139, 92, 246, 0.15)' },
    entitlements: {
      monthlyQuoteLimit: Infinity,
      editDuplicate: true,
      whatsappDelete: true,
      attachments: true,
      professionalQuotes: true,
      professionalQuoteReuse: true,
    },
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

// חוק ברזל (LIFETIME Full-PRO Inheritance, §151): נקודת-הקריאה היחידה
// לקבוצת-זכאות שלמה של תוכנית. עותק גנרי (spread) של planId.entitlements -
// לא רשימת-שדות מפורשת, כדי שלא יידרש עדכון כאן כשמתווספת יכולת חדשה.
// resolveAccountEntitlement() (accountEntitlement.js) קורא לפונקציה הזו
// פעם אחת עם 'pro' גם עבור PRO-בתוקף וגם עבור LIFETIME - אותה קריאה
// בדיוק, לא שני מסלולי-קוד נפרדים - זה מה שהופך את "LIFETIME = קבוצת-
// הזכאות המלאה של PRO" לעובדה ארכיטקטונית, לא לתנאי מפוזר-נוסף.
export function getEntitlementSet(planId) {
  return { ...getPlanDefinition(planId).entitlements };
}

// חוק ברזל (Stage 1 - Plan Identity / Trial / Lifetime Centralization,
// PROFLOW_PROJECT_CONTEXT.md §148): נקודת-אמת יחידה לחמש הזהויות המוצגות
// למשתמש/Admin - FREE / FREE (TRIAL) / BASIC / PRO / LIFETIME. זהות-תצוגה,
// מצב-ניסיון, וזכאות-בפועל הם שלושה מושגים נפרדים (לא ניתן לערבב) - הטבלה
// הזו היא מטא-דאטה של תווית בלבד, לעולם לא לוגיקת-זכאות/יכולות. המפתח
// displayIdentity מחושב ב-resolveAccountEntitlement() (accountEntitlement.js).
export const DISPLAY_IDENTITY_LABELS = {
  FREE: { he: 'FREE', en: 'FREE' },
  FREE_TRIAL: { he: 'FREE (ניסיון)', en: 'FREE (TRIAL)' },
  BASIC: { he: 'BASIC', en: 'BASIC' },
  PRO: { he: 'PRO', en: 'PRO' },
  LIFETIME: { he: 'LIFETIME', en: 'LIFETIME' },
};

// נופל בבטחה ל-FREE עבור displayIdentity לא-מוכר, מאותה סיבה כמו
// getPlanDefinition למעלה - הגנה, לא ניחוש.
export function getDisplayIdentityLabel(displayIdentity, isHebrew) {
  const entry = DISPLAY_IDENTITY_LABELS[displayIdentity] || DISPLAY_IDENTITY_LABELS.FREE;
  return isHebrew ? entry.he : entry.en;
}

// חוק ברזל (Plan Identity Header Badge, Owner Night Run task; החלף/הורחב
// ל-Professional Plan-Identity Icon System, Owner-required 2026-09-03):
// נקודת-אמת יחידה לזהות ויזואלית (אייקון+צבע) של כל אחת מחמש displayIdentity -
// כדי שרכיב-badge אחד (PlanIdentityBadge.jsx) ישרת כל מסך, וזהות עתידית
// תתווסף כאן בלבד. **בכוונה נפרד מ-PLAN_CATALOG.{basic,pro}.badge**
// (המשמש רק את AdminUsersTab.jsx, שפה חזותית משלו, קומפקטית-לטבלה,
// כבר-מוכחת - לא נגעו בה כאן כדי לא לסכן רגרסיה במקום שלא אושר במפורש
// השבוע) - שני צרכנים לגיטימיים עם מטרות תצוגה שונות (טבלה צפופה מול
// badge-זהות מרכזי), לא כפילות-לוגיקה מקרית. הצבעים/אייקונים כאן תואמים
// את השפה החזותית שאושרה: FREE=ירוק+עלה, BASIC=כחול+יהלום, PRO=סגול+כתר,
// FREE_TRIAL=ירוק/טיל+עלה עם רמז-שעון, LIFETIME=סגול-פרימיום+כתר עם רמז-
// אינסוף. accentIcon (כשקיים) הוא אייקון-משני קטן שמסמן הבדל-מ-המשפחה-
// הבסיסית (FREE_TRIAL≠FREE הרגיל, LIFETIME≠PRO הרגיל) - זהות לעולם לא
// מסתמכת על צבע בלבד (צורת-אייקון תמיד שונה גם היא).
export const DISPLAY_IDENTITY_VISUAL = {
  FREE: { icon: 'Leaf', accentIcon: null, colorToken: 'emerald', gradientFrom: '#34d399', gradientTo: '#059669' },
  FREE_TRIAL: { icon: 'Leaf', accentIcon: 'Clock', colorToken: 'emerald', gradientFrom: '#5eead4', gradientTo: '#0d9488' },
  BASIC: { icon: 'Gem', accentIcon: null, colorToken: 'sky', gradientFrom: '#38bdf8', gradientTo: '#0369a1' },
  PRO: { icon: 'Crown', accentIcon: null, colorToken: 'violetLight', gradientFrom: '#a78bfa', gradientTo: '#6d28d9' },
  LIFETIME: { icon: 'Crown', accentIcon: 'Infinity', colorToken: 'violetLight', gradientFrom: '#c4b5fd', gradientTo: '#5b21b6' },
};

// נופל בבטחה ל-FREE עבור displayIdentity לא-מוכר, מאותה סיבה כמו למעלה.
export function getDisplayIdentityVisual(displayIdentity) {
  return DISPLAY_IDENTITY_VISUAL[displayIdentity] || DISPLAY_IDENTITY_VISUAL.FREE;
}

// חוק ברזל (שם ישן, נשמר כ-alias לתאימות-לאחור בלבד): קוד/בדיקות שכבר
// קוראים ל-DISPLAY_IDENTITY_BADGE_META/getDisplayIdentityBadgeMeta ממשיכים
// לעבוד ללא שינוי - אין צורך לעדכן כל צרכן קיים בו-זמנית עם השדרוג החזותי.
export const DISPLAY_IDENTITY_BADGE_META = DISPLAY_IDENTITY_VISUAL;
export function getDisplayIdentityBadgeMeta(displayIdentity) {
  return getDisplayIdentityVisual(displayIdentity);
}

// חוק ברזל (Stage 1, אותה משימה): כלל-ראייה יחיד לכפתור "שדרג חבילה" -
// התחליף לשני הכללים הבלתי-תלויים/סותרים שהיו קיימים בפועל (Dashboard.jsx
// היה מסתיר נכון עבור Lifetime/ניסיון-פעיל דרך isPro, אבל SettingsTab.jsx
// הציג את הכפתור ללא תנאי בכלל - ר' §147.1/§148 לתיעוד המלא). Lifetime
// ו-super_admin לעולם לא רואים את הכפתור; FREE/BASIC בלבד כן (ניסיון פעיל
// כבר "PRO" מבחינת tier, כך שנופל אוטומטית לענף המוסתר, בדיוק כמו
// שהתנהגות Dashboard.jsx הקיימת כבר הייתה - לא שינוי התנהגות שם).
export function shouldShowUpgradeCta({ tier, isLifetime, isSuperAdmin }) {
  if (isSuperAdmin || isLifetime) return false;
  return tier === 'free' || tier === 'basic';
}
