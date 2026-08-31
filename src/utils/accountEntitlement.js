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
import { getPlanDefinition } from './planCatalog';

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

  const planDef = getPlanDefinition(tier);

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
    entitlement: {
      monthlyQuoteLimit: planDef.monthlyQuoteLimit,
      editDuplicate: isSuperAdmin || planDef.editDuplicate,
      whatsappDelete: isSuperAdmin || planDef.whatsappDelete,
      attachments: isSuperAdmin || planDef.attachments,
    },
  };
}
