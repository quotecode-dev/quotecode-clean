// חוק ברזל (Admin V2 Foundation — Phase 1, Canonical Resolver):
// עוטף (composes) את computeEffectivePlan() הקיים (planEntitlements.js,
// לא נגוע - הנוסחה הפנימית שלו כבר נכונה ומשמשת ל-isTrialExpired/
// isExpiringSoon ב-Dashboard.jsx) יחד עם planCatalog.js כדי להחזיר מצב
// זכאות מובנה אחד, שכל צרכן (Dashboard/Settings/Admin, ובעתיד Billing/Badge)
// אמור לקרוא ממנו - במקום לגזור לוגיקת plan/trial/lifetime משלו בנפרד.
//
// חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner mandate:
// "No more inference-based Lifetime model. No more patches."): Lifetime
// הוא כעת עובדה מפורשת ומאוחסנת (business_settings.is_lifetime, ר'
// migration 20260908000000), לא נגזרת יותר מ-trial_ends_at===null.
// הגרסה הקודמת כאן תיקנה חלקית ("Lifetime רק כש-trial_ends_at===null *וגם*
// plan!=='free'") אך ה-INFERENCE עצמו נשאר עמום מבנית: הענקת-Lifetime
// שבוצעה בזמן ש-plan כבר היה 'free' (handleToggleLifetime הישן נגע רק
// ב-trial_ends_at, לעולם לא ב-plan) הפיקה בדיוק את חתימת-ביטול-העצמי -
// חשבון עם Lifetime-מכוון-אך-לא-מוחל היה מוצג כ-FREE רגיל, לצמיתות,
// בשקט. isLifetime עכשיו הוא קלט מפורש (isLifetime param, מגיע ישירות
// מ-business_settings.is_lifetime) - לא נגזר משום שילוב של plan/
// trial_ends_at. plan ו-trial_ends_at חוזרים למשמעות הטהורה שלהם בלבד:
// plan = זהות-מסלול מסחרית (free/basic/pro), trial_ends_at = תזמון ניסיון
// בלבד. ר' PROFLOW_PROJECT_CONTEXT.md §205-אזור (Explicit Lifetime Model
// task) לתיעוד המלא, כולל כלל ה-backfill הבטוח וכלל "REQUIRES OWNER
// REVIEW" לשורות עמומות שלא הומרו אוטומטית.

import { computeEffectivePlan } from './planEntitlements';
import { getEntitlementSet } from './planCatalog';

const TRIAL_EXPIRING_SOON_DAYS = 5;

/**
 * @param {{plan: string|null|undefined, trialEndsAt: string|null|undefined, role?: string|null, isLifetime?: boolean|null, now?: Date}} params
 */
export function resolveAccountEntitlement({ plan, trialEndsAt, role, isLifetime: rawIsLifetime, now = new Date() }) {
  const rawPlan = (plan || 'free').toLowerCase();
  const isKnownPlan = rawPlan === 'free' || rawPlan === 'basic' || rawPlan === 'pro';
  const isSuperAdmin = role === 'super_admin';

  const { effectivePlan, isTrialExpired, trialDaysLeft } = computeEffectivePlan({ plan, trialEndsAt, now });

  // חוק ברזל (Explicit Lifetime Entitlement Model, למעלה): isLifetime הוא
  // עכשיו קריאה ישירה של business_settings.is_lifetime - לא הסקה. super_admin
  // לעולם לא "Lifetime" (אף אם is_lifetime=true הוגדר בטעות על שורת אדמין -
  // הגנה מכוונת, זהות Admin ו-Lifetime הן שני מושגים נפרדים לחלוטין, ר'
  // הכלל המפורש של הבעלים "Do not conflate full entitlement with Admin
  // authority"). קלט לא-בוליאני (undefined/null, למשל שורה ישנה שנקראה
  // לפני שה-migration רץ) נופל בבטחה ל-false, לא ל-true.
  const isLifetime = !isSuperAdmin && rawIsLifetime === true;

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
