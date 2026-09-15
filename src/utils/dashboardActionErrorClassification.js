// חוק ברזל (B-04 fix, Codex Local-vs-International parity review,
// 2026-09-11): מנגנון-נירמול משותף אחד לכל 12 נקודות-הדליפה שאותרו
// ב-Dashboard.jsx (client/expense/quote/service CRUD + trial extension) -
// לא 12 תיקונים נקודתיים נפרדים. עוקב אחרי אותה מוסכמת עיצוב שכבר קיימת
// בפרויקט (classifyQuoteApprovalError/classifyQuoteEmailError,
// normalizeAuthError) - הודעה בטוחה ומתורגמת למשתמש, אף פעם לא
// error.message הגולמי מהשרת/ה-provider. אינו נוגע ואינו מחליש את שלושת
// המסווגים הייעודיים הקיימים (Auth/Quote-approval/Quote-email) - אלה
// נשארים בדיוק כפי שהם, למקרים הספציפיים שהם כבר מכסים.
//
// בניגוד למסווגי ה-Auth/Quote (שמזהים כמה תרחישים שונים הדורשים פעולת-
// משתמש שונה מאותה נקודת-כשל), כשל CRUD גנרי ב-Dashboard לא דורש בדרך-כלל
// בחנת-תרחיש - "נסו שוב" מתאים כמעט תמיד. חריג אחד מזוהה כאן: שגיאת
// רשת/חיבור (patterns נפוצים) מקבלת רמז ממוקד יותר, לא רק בגלל שזה אפשרי
// לזהות בבטחה, אלא כי זו הפעולה שהמשתמש יכול לתקן בעצמו (לבדוק חיבור).

const OPERATION_MESSAGES = Object.freeze({
  extend_trial: { he: 'לא הצלחנו להאריך את תקופת הניסיון. נסו שוב.', en: "We couldn't extend the trial. Please try again." },
  update_settings: { he: 'לא הצלחנו לעדכן את ההגדרות. נסו שוב.', en: "We couldn't update the settings. Please try again." },
  update_client: { he: 'לא הצלחנו לעדכן את הלקוח. נסו שוב.', en: "We couldn't update the client. Please try again." },
  create_client: { he: 'לא הצלחנו ליצור את הלקוח. נסו שוב.', en: "We couldn't create the client. Please try again." },
  update_expense: { he: 'לא הצלחנו לעדכן את ההוצאה. נסו שוב.', en: "We couldn't update the expense. Please try again." },
  add_expense: { he: 'לא הצלחנו להוסיף את ההוצאה. נסו שוב.', en: "We couldn't add the expense. Please try again." },
  delete_expense: { he: 'לא הצלחנו למחוק את ההוצאה. נסו שוב.', en: "We couldn't delete the expense. Please try again." },
  delete_quote: { he: 'לא הצלחנו למחוק את ההצעה. נסו שוב.', en: "We couldn't delete the quote. Please try again." },
  delete_client: { he: 'לא הצלחנו למחוק את הלקוח. נסו שוב.', en: "We couldn't delete the client. Please try again." },
  add_service: { he: 'לא הצלחנו להוסיף את השירות. נסו שוב.', en: "We couldn't add the service. Please try again." },
  update_service: { he: 'לא הצלחנו לעדכן את השירות. נסו שוב.', en: "We couldn't update the service. Please try again." },
  delete_service: { he: 'לא הצלחנו למחוק את השירות. נסו שוב.', en: "We couldn't delete the service. Please try again." },
});

export const DASHBOARD_ACTION_KEYS = Object.freeze(Object.keys(OPERATION_MESSAGES));

const NETWORK_PATTERN = /network|fetch|offline|timeout|timed out/i;

// rawMessage: the raw error.message from Supabase/the provider - used only
// for pattern-matching (network-shape detection), NEVER returned as-is.
// operationKey: one of DASHBOARD_ACTION_KEYS - selects the curated fallback.
// Caller is responsible for console.error-logging the raw error object
// separately for developer debugging - this function only ever returns
// safe, curated, bilingual text.
export function classifyDashboardActionError(rawMessage, isHebrew, operationKey) {
  if (typeof rawMessage === 'string' && NETWORK_PATTERN.test(rawMessage)) {
    return isHebrew
      ? 'נראה שיש בעיית תקשורת. בדקו את החיבור לאינטרנט ונסו שוב.'
      : "It looks like there's a connection issue. Please check your internet connection and try again.";
  }
  const entry = OPERATION_MESSAGES[operationKey];
  if (entry) return isHebrew ? entry.he : entry.en;
  return isHebrew ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.';
}
