// חוק ברזל (LIVE Admin Email Failure root-cause task, 2026-09-08): מקור-אמת
// יחיד לחילוץ ההודעה האמיתית מתגובת Edge Function שנכשלה. supabase-js
// מחזיר error.message גנרי ("non-2xx status code") לכל שגיאת HTTP - ההודעה
// האמיתית (שהפונקציה עצמה כתבה ל-response body, למשל "Forbidden: you may
// only send your own quote") נמצאת רק ב-error.context (אובייקט Response
// גולמי, צריך .json() כדי לקרוא אותו). הועתק מ-AdminUsersTab.jsx (המקור
// המקורי היחיד עד כה) - שני הצרכנים קוראים לאותה פונקציה עכשיו, לא שתי
// עותקים עצמאיים שעלולים לצאת מסונכרנים.
export async function getFunctionErrorMessage(error, fallback) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    // fall through to the generic message below
  }
  return error?.message || fallback;
}
