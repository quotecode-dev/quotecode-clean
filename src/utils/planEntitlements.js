// חוק ברזל (Item: Trial Expiration -> FREE, Full Entitlement Audit + Fix;
// UPDATED 2026-09-08, Explicit Lifetime Entitlement Model): נקודת אמת יחידה
// לחישוב ה-effective plan מתוך business_settings.plan + trial_ends_at
// בלבד - כל מקום שצריך לדעת "האם החשבון הזה זכאי בפועל ל-FREE/BASIC/PRO
// לפי המסלול/ניסיון הגולמיים שלו" חייב לקרוא לפונקציה הזו, לא לשכפל את
// הנוסחה בעצמו (בדיוק אותו עיקרון כמו isQuoteImmutable ב-quoteLock.js).
//
// חוק ברזל (Explicit Lifetime Entitlement Model, Owner mandate: "No more
// inference-based Lifetime model."): הפונקציה הזו במתכוון **אינה יודעת
// כלום** על Lifetime - זהו כעת עמודה מפורשת ונפרדת (business_settings.
// is_lifetime, ר' src/utils/accountEntitlement.js/migration
// 20260908000000), לא מוסקת יותר מ-trial_ends_at===null. plan ו-
// trial_ends_at חזרו למשמעות הטהורה שלהם בלבד: plan = זהות-מסלול מסחרית
// (free/basic/pro), trial_ends_at = תזמון ניסיון בלבד. `rawPlan==='pro' &&
// trialEndsAt===null` כאן פשוט אומר "חשבון pro פעיל בלי תאריך-סיום-ניסיון
// כרוך" (מנוי-PRO רגיל שאינו כרגע בניסיון) - **לא** עוד סימן ל-Lifetime;
// אם החשבון הזה גם Lifetime, זה תלוי אך ורק ב-is_lifetime הנפרד, שנבדק
// שכבה אחת למעלה (accountEntitlement.js), לעולם לא כאן. ההיסטוריה המלאה
// של הבאג שהמודל המפורש הזה מחליף (הענקת-Lifetime שכתבה רק trial_ends_at,
// לעולם לא plan, והפיקה בשקט מצב שנקרא כ-FREE רגיל) מתועדת ב-
// PROFLOW_PROJECT_CONTEXT.md §204/§205-אזור.
//
// שורש-הבעיה ההיסטורי שהתיקון הזה (2026-08-30, לפני מודל ה-Lifetime
// המפורש) עדיין פותר: ההרשמה כותבת plan:'pro' פעם אחת בזמן ה-signup
// (Dashboard.jsx handleSignUp), יחד עם trial_ends_at אמיתי (+14 יום).
// עצם ה-null אינו עוד "הוכחה ל-Lifetime" - זה תפקידו הבלעדי של is_lifetime
// (למעלה) - אבל plan==='pro' + trial_ends_at שהוא תאריך אמיתי *בעבר* עדיין
// זוהי בהכרח תוצאה של ניסיון שפג ולא אופס, וזה עדיין הופך נכון ל-'free'
// כאן, ללא קשר ל-Lifetime.
export function computeEffectivePlan({ plan, trialEndsAt, now = new Date() }) {
  const rawPlan = (plan || 'free').toLowerCase();

  let trialDaysLeft = null;
  let isTrialExpired = false;
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    if (!Number.isNaN(end.getTime())) {
      const diffTime = end - now;
      trialDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isTrialExpired = trialDaysLeft <= 0;
    }
  }

  let effectivePlan;
  if (rawPlan === 'basic') {
    effectivePlan = 'basic';
  } else if (rawPlan === 'pro') {
    if (trialEndsAt === null || trialEndsAt === undefined) {
      // מנוי-PRO פעיל בלי ניסיון כרוך כלל (לא נגזר Lifetime כאן - ר' חוק-
      // הברזל למעלה; Lifetime הוא is_lifetime נפרד, נבדק ב-accountEntitlement.js).
      effectivePlan = 'pro';
    } else if (!isTrialExpired) {
      // ניסיון פעיל (או תאריך trial_ends_at תקין שעדיין לא הגיע).
      effectivePlan = 'pro';
    } else {
      // *** התיקון עצמו: plan='pro' + trial_ends_at אמיתי שכבר עבר = ניסיון
      // שפג ולא אופס - זכאות בפועל היא FREE, לא PRO.
      effectivePlan = 'free';
    }
  } else {
    effectivePlan = (trialEndsAt && !isTrialExpired) ? 'pro' : 'free';
  }

  return { effectivePlan, isTrialExpired, trialDaysLeft };
}
