// חוק ברזל (Item: Trial Expiration -> FREE, Full Entitlement Audit + Fix):
// נקודת אמת יחידה לחישוב ה-effective plan מתוך business_settings.plan +
// trial_ends_at - כל מקום שצריך לדעת "האם החשבון הזה זכאי בפועל ל-FREE/
// BASIC/PRO" חייב לקרוא לפונקציה הזו, לא לשכפל את הנוסחה בעצמו (בדיוק אותו
// עיקרון כמו isQuoteImmutable ב-quoteLock.js). לפני התיקון הזה, Dashboard.jsx
// חישב effectivePlan באופן מקומי, ו-SettingsTab.jsx בדק ישירות את ה-plan
// הגולמי (bizPlan !== 'pro') - שתי נוסחאות שונות, לא-מסונכרנות, שתיהן היו
// "תקועות" ב-PRO לצמיתות לכל חשבון שנרשם (ר' התיעוד למטה).
//
// שורש הבעיה (מאומת מחדש מקוד חי, לא מונח): ההרשמה כותבת plan:'pro' פעם
// אחת בזמן ה-signup (Dashboard.jsx handleSignUp), יחד עם trial_ends_at
// אמיתי (+14 יום). שום קוד אחר בכל הריפו לא כותב חזרה ל-plan מלבד ביטול-
// עצמי מפורש (PricingModal.jsx, שקובע plan:'free' + trial_ends_at:null
// יחד, תמיד). "Toggle Lifetime" של האדמין (handleToggleLifetime) נוגע רק
// ב-trial_ends_at (null=lifetime / +14 ימים), אף פעם לא ב-plan. משמעות
// הדבר: plan==='basic' לא ניתן להיווצר כלל דרך הרשמה (ר' ה-RLS RESTRICTIVE
// INSERT policy על business_settings) - הוא בהכרח נקבע דרך פעולת super_admin
// מכוונת, ולכן הוא אמין ללא תנאי. plan==='pro' יחד עם trial_ends_at===null
// הוא בהכרח Lifetime-grant מכוון (או פעולת super_admin מפורשת אחרת) -
// גם הוא אמין ל-PRO ללא תנאי, בדיוק כמו שכבר היה נהוג (UserDetailsModal.jsx
// מתייחס ל-trial_ends_at===null כ-Lifetime==PRO ללא תלות ב-plan הגולמי).
// plan==='pro' יחד עם trial_ends_at שהוא תאריך אמיתי בעבר הוא בהכרח ניסיון
// שפג ולא אופס - התרחיש שהתיקון הזה מטפל בו: הופך ל-FREE בפועל.
//
// עמימות ידועה, לא נפתרת כאן (מחוץ לתחום המשימה הזו, מדווחת בנפרד):
// plan==='free' + trial_ends_at===null יכול להיות גם ביטול-עצמי אמיתי (הכוונה:
// FREE) וגם - תיאורטית, נדיר - Lifetime-grant שהוענק לחשבון שכבר היה 'free'
// בלי לשחזר את ה-plan בחזרה ל-'pro' (הכוונה במקרה הזה: PRO). הסכימה
// הקיימת לא יכולה להבדיל בין השניים במקרה הצר הזה - לא מטופל כאן כי
// (א) זה לא התרחיש שהמשימה הזו נועדה לתקן, (ב) התיקון כאן לא יוצר ולא
// מחמיר את העמימות הזו כלל (ההתנהגות עבור plan==='free' נשארת זהה לגמרי
// לפני ואחרי השינוי).
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
      // Lifetime-grant / explicit super_admin PRO assignment - לא ניסיון.
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
