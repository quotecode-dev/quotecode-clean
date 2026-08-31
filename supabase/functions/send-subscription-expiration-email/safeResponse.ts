// חוק ברזל (P0 Email Bug #2, fail-safe guard): מקור אמת יחיד לצורת התשובה
// הבטוחה שמוחזרת מ-batch mode כל עוד subscription_ends_at /
// subscription_reminder_3d_sent / subscription_reminder_24h_sent לא קיימות
// בסכימה (ר' ההסבר המלא ב-index.ts, ליד נקודת הקריאה). קובץ נפרד, ללא
// תלות ב-Deno, כדי שהחוזה הזה יהיה ניתן לבדיקה דטרמיניסטית תחת Vitest.
export function buildSubscriptionEmailSafeResponse() {
  return {
    success: true,
    sent3d: 0,
    sent24h: 0,
    errors: [] as string[],
    skipped: true,
    reason: 'subscription-status schema not yet implemented; awaiting future billing phase (cancel-at-period-end axis)',
  };
}
