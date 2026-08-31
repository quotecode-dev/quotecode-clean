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
export type TrialReminderCandidate = {
  email: string | null | undefined;
  role: string | null | undefined;
  plan: string | null | undefined;
  trial_ends_at: string | null | undefined;
  trial_reminder_3d_sent: boolean | null | undefined;
  trial_reminder_24h_sent: boolean | null | undefined;
};

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function resolveTrialReminderStage(
  biz: TrialReminderCandidate,
  nowMs: number,
): '3d' | '24h' | null {
  if (!biz.email || biz.role === 'super_admin') return null;
  if ((biz.plan || 'free').toLowerCase() !== 'pro') return null;
  if (!biz.trial_ends_at) return null;

  const trialEndsMs = new Date(biz.trial_ends_at).getTime();
  if (Number.isNaN(trialEndsMs)) return null;

  const daysLeft = (trialEndsMs - nowMs) / MS_PER_DAY;

  if (!biz.trial_reminder_3d_sent && daysLeft <= 3 && daysLeft > 1) return '3d';
  if (!biz.trial_reminder_24h_sent && daysLeft <= 1 && daysLeft > 0) return '24h';
  return null;
}
