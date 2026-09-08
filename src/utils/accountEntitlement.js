// חוק ברזל (Admin V2 Foundation — Phase 1, Canonical Resolver):
// עוטף (composes) את computeEffectivePlan() הקיים (planEntitlements.js,
// לא נגוע - הנוסחה הפנימית שלו כבר נכונה ומשמשת ל-isTrialExpired/
// isExpiringSoon ב-Dashboard.jsx) יחד עם planCatalog.js כדי להחזיר מצב
// זכאות מובנה אחד, שכל צרכן (Dashboard/Settings/Admin, ובעתיד Billing/Badge)
// אמור לקרוא ממנו - במקום לגזור לוגיקת plan/trial/lifetime משלו בנפרד.
//
// מתקן במפורש את הבאג המאושר (PROFLOW_PROJECT_CONTEXT.md §91/§92/§94.1):
// UserDetailsModal.jsx ו-AdminUsersTab.jsx גזרו "Lifetime" מ-trial_ends_at
// === null בלבד - אבל זה בדיוק גם החתימה של ביטול-עצמי (PricingModal.jsx
// כותב plan:'free' + trial_ends_at:null יחד, תמיד) - כך שחשבון FREE
// שביטל את עצמו הוצג כ"PRO (Lifetime)". התיקון: Lifetime נגזר רק כש-
// trial_ends_at===null *וגם* ה-plan הגולמי אינו 'free' - כי אף כותב לגיטימי
// אחר לא מייצר plan:'pro'/'basic' יחד עם trial_ends_at:null מלבד הענקת-
// Lifetime מכוונת של super_admin (handleToggleLifetime) או הרשמה+ניסיון
// (שתמיד מזווגת trial_ends_at לתאריך אמיתי, לעולם לא null). זהו התיקון
// המלא, לא רק למקרה ה-Lifetime הספציפי: `tier` (השדה שה-UI אמור להציג)
// כבר נגזר תמיד מ-computeEffectivePlan() בעצמו, ששוגה נכון לחלוטין גם
// עבור ניסיון-שפג-בלי-ביטול-מפורש (plan:'pro' + trial_ends_at אמיתי בעבר
// → effectivePlan:'free' כבר קיים ונכון) - הבאג היה רק בכך ש-Admin השתמש
// ב-rawPlan/isLifetime-שגוי במקום ב-tier המחושב-נכון הזה.

import { computeEffectivePlan } from './planEntitlements';
import { getEntitlementSet } from './planCatalog';

const TRIAL_EXPIRING_SOON_DAYS = 5;

/**
 * @param {{plan: string|null|undefined, trialEndsAt: string|null|undefined, role?: string|null, now?: Date}} params
 */
export function resolveAccountEntitlement({ plan, trialEndsAt, role, now = new Date() }) {
  const rawPlan = (plan || 'free').toLowerCase();
  const isKnownPlan = rawPlan === 'free' || rawPlan === 'basic' || rawPlan === 'pro';
  const isSuperAdmin = role === 'super_admin';

  const { effectivePlan, isTrialExpired, trialDaysLeft } = computeEffectivePlan({ plan, trialEndsAt, now });

  // ר' חוק-הברזל למעלה - זהו התיקון עצמו. trial_ends_at===null לבדו לעולם
  // אינו הוכחה ל-Lifetime; rawPlan!=='free' הוא מה שבפועל מבדיל בין הענקת-
  // Lifetime אמיתית לבין חתימת-ביטול-עצמי.
  const hasNullTrial = trialEndsAt === null || trialEndsAt === undefined;
  const isLifetime = !isSuperAdmin && hasNullTrial && rawPlan !== 'free';

  // tier הוא המקור-האמת היחיד שכל UI אמור להציג - כבר נכון במלואו עבור כל
  // מקרה (כולל Lifetime, כולל ניסיון-שפג, כולל super_admin) בזכות
  // computeEffectivePlan() הקיים + הענף הבא עבור super_admin.
  const tier = isSuperAdmin ? 'pro' : effectivePlan;

  // trialStatus משמעותי רק כשה-tier בפועל נגזר ע"י מנגנון-הניסיון - לא
  // כש-plan הגולמי הוא 'basic' (זכאות BASIC אינה תלויה בניסיון כלל, ר'
  // הענף העצמאי ב-computeEffectivePlan), ולא עבור Lifetime/super_admin.
  let trialStatus = 'none';
  if (!isSuperAdmin && !isLifetime && rawPlan !== 'basic' && trialEndsAt) {
    if (isTrialExpired) trialStatus = 'expired';
    else if (trialDaysLeft !== null && trialDaysLeft <= TRIAL_EXPIRING_SOON_DAYS) trialStatus = 'expiringSoon';
    else trialStatus = 'active';
  }

  const badgeState = (trialStatus === 'active' || trialStatus === 'expiringSoon')
    ? 'TRIAL'
    : tier.toUpperCase();

  // Stage 1 (PROFLOW_PROJECT_CONTEXT.md §148): the five canonical user/Admin-
  // facing display identities - FREE / FREE_TRIAL / BASIC / PRO / LIFETIME.
  // Deliberately a NEW field, not a change to badgeState above - badgeState's
  // own PRO-for-Lifetime behavior is already regression-locked by an existing
  // test (accountEntitlement.test.js, "badgeState is PRO (not TRIAL) for a
  // genuine Lifetime grant") and must not change. displayIdentity is what
  // Stage 1's new consumers (Dashboard.jsx/SettingsTab.jsx) read instead.
  const displayIdentity = isLifetime
    ? 'LIFETIME'
    : (trialStatus === 'active' || trialStatus === 'expiringSoon')
      ? 'FREE_TRIAL'
      : tier.toUpperCase();

  // חוק ברזל (LIFETIME Full-PRO Inheritance, PROFLOW_PROJECT_CONTEXT.md §151,
  // Owner-defined canonical rule): LIFETIME = הקבוצה המלאה של זכאות-PRO,
  // כולל כל יכולת עתידית, ללא תלות בחבילה הגולמית הבסיסית - עד שהבעלים
  // עצמו מבטל במפורש את מעמד-Lifetime. זה מוחלף במכוון על פני התיקון
  // הקודם (§150, שרק monthlyQuoteLimit היה Lifetime-מודע בנפרד - בדיוק
  // התבנית המפוזרת שנאסרה עכשיו במפורש): entitlementPlanId קובע *איזו*
  // תוכנית-בסיס לרשת ממנה - 'pro' עבור LIFETIME, tier (הרגיל) עבור כל
  // מקרה אחר - ואז getEntitlementSet (planCatalog.js) הוא נקודת-הקריאה
  // *היחידה* שמעתיקה קבוצת-זכאות שלמה, לא שדה-שדה. יכולת עתידית שתתווסף
  // ל-PLAN_CATALOG.pro.entitlements (למשל professionalQuotes) תזרום
  // אוטומטית ל-LIFETIME בלי לגעת בקובץ הזה שוב, כי שני המקרים קוראים
  // לאותה פונקציה עם אותו 'pro' - לא שני מסלולי-קוד נפרדים. isLifetime
  // עצמו (מחושב למעלה) הוא הקובע היחיד - זהה לכל חשבון, לא תנאי ספציפי-
  // ללקוח. super_admin כבר מקבל tier==='pro' תמיד (הענף למעלה) - אין צורך
  // בטיפול נפרד עבורו כאן.
  const entitlementPlanId = isLifetime ? 'pro' : tier;
  const entitlement = getEntitlementSet(entitlementPlanId);

  return {
    tier,
    rawPlan,
    isKnownPlan,
    isSuperAdmin,
    isLifetime,
    trialStatus,
    trialDaysLeft,
    isTrialExpired,
    badgeState,
    displayIdentity,
    entitlement,
  };
}
