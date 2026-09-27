// חוק ברזל (P0 Email Bug #1 fix): נקודת אמת יחידה להחלטה האם/איזו תזכורת
// תום-ניסיון לשלוח לחשבון נתון. אין תלות ב-Deno/Supabase/Resend בקובץ הזה
// בכוונה — כדי שאותו קוד בדיוק ירוץ גם ב-index.ts (בזמן ריצה אמיתי) וגם
// תחת Vitest (בדיקות אוטומטיות דטרמיניסטיות, ללא רשת/DB אמיתיים).
//
// שורש הבאג שתוקן כאן: הקוד הקודם דרש plan==='free' כדי לשקול חשבון
// למועמד לתזכורת - אך לפי planEntitlements.js (מקור האמת היחיד לזיהוי
// ניסיון פעיל), חשבון בניסיון פעיל תמיד plan==='pro' עם trial_ends_at
// אמיתי בעתיד. plan==='free' הוא בדיוק מה שקורה *אחרי* שהניסיון כבר
// הסתיים/בוטל - כלומר התנאי הישן פסל את כל קהל היעד האמיתי, פה אחד.
//
// חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner mandate:
// "Lifetime exclusion must use the new explicit Lifetime state rather than
// trial-null inference"): is_lifetime (business_settings.is_lifetime,
// migration 20260908000000) נבדק כאן במפורש עכשיו - לא עוד נסמך רק על כך
// ש-trial_ends_at ממילא ריק לחשבון Lifetime (וזה עדיין נכון, אבל זו הייתה
// הדרה-בעקיפין, לא הדרה-מפורשת). מרגע שהמודל המפורש קיים, is_lifetime=true
// הוא הסיבה האמיתית להדרה, גם אם trial_ends_at אי-פעם ישתנה בעתיד בלי
// לגעת ב-is_lifetime.
export type TrialReminderCandidate = {
  email: string | null | undefined;
  role: string | null | undefined;
  plan: string | null | undefined;
  trial_ends_at: string | null | undefined;
  is_lifetime: boolean | null | undefined;
  trial_reminder_3d_sent: boolean | null | undefined;
  trial_reminder_24h_sent: boolean | null | undefined;
};

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Codex Post-LIVE Wave 1 blocker 5 (2026-09-27): the reminder's market (language, direction, date locale, CTA, sender)
// comes ONLY from the exact canonical business_settings.country value. The previous code treated every value other than
// 'International' as Local, so the schema default 'Unknown', null, legacy and malformed values all got a Hebrew email from
// support@. Now: exact 'Local' -> Local, exact 'International' -> International, anything else -> null = do NOT send
// (fail closed: no claim, no email, no sent flag; the account is re-evaluated on the next run if its market is fixed).
// Note: 'LCL' is a documented legacy alias of Local in the UI / quote-validity code; this send path deliberately does not
// accept it (exact canonical values only), so an 'LCL' account is skipped and reported, never mis-routed.
export type ReminderMarket = 'Local' | 'International';

export function resolveReminderMarket(country: unknown): ReminderMarket | null {
  if (country === 'Local') return 'Local';
  if (country === 'International') return 'International';
  return null;
}

export function resolveTrialReminderStage(
  biz: TrialReminderCandidate,
  nowMs: number,
): '3d' | '24h' | null {
  if (!biz.email || biz.role === 'super_admin') return null;
  if (biz.is_lifetime === true) return null;
  if ((biz.plan || 'free').toLowerCase() !== 'pro') return null;
  if (!biz.trial_ends_at) return null;

  const trialEndsMs = new Date(biz.trial_ends_at).getTime();
  if (Number.isNaN(trialEndsMs)) return null;

  const daysLeft = (trialEndsMs - nowMs) / MS_PER_DAY;

  if (!biz.trial_reminder_3d_sent && daysLeft <= 3 && daysLeft > 1) return '3d';
  if (!biz.trial_reminder_24h_sent && daysLeft <= 1 && daysLeft > 0) return '24h';
  return null;
}
