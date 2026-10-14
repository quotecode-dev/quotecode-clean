// חוק ברזל (LIVE Admin Email Failure root-cause task, 2026-09-08): לפני
// המשימה הזו, executeEmailSend (Dashboard.jsx) קלט כל כשל אפשרי מ-
// send-quote-email (session פגה, בעלות שגויה, כשל-תצורת-שולח/דומיין,
// דחייה מ-Resend, כשל-רשת) לתוך אותה הודעה גנרית אחת בדיוק - "שליחת
// האימייל נכשלה"/"Email sending failed" - מה שהפך את כל כשל עתידי (כולל
// זה שדווח ע"י הבעלים) לבלתי-ניתן-לאבחון מצד המשתמש/מהדוח שהוא מדווח.
// classifyQuoteEmailError ממפה את ה-message האמיתי שחזר מהפונקציה (דרך
// getFunctionErrorMessage, functionError.js) לקטגוריה בטוחה-להצגה + הודעת-
// משתמש מתאימה - לעולם לא חושפת פרטי-שרת רגישים (למשל שם-secret חסר),
// אבל כן מבדילה בין "אין לך הרשאה", "ההצעה/הלקוח לא נמצאו", "בעיית-תצורה
// אצלנו" ו"שגיאה לא-ידועה" - כל אחת דורשת פעולת-משתמש שונה.
const PATTERNS = [
  {
    category: 'unauthorized',
    test: (msg) => /forbidden.*only send your own quote/i.test(msg),
    userMessage: {
      he: '❌ אין לך הרשאה לשלוח הצעת מחיר זו.',
      en: '❌ You do not have permission to send this quote.',
    },
  },
  {
    category: 'session_expired',
    test: (msg) => /missing authorization header|invalid or expired session/i.test(msg),
    userMessage: {
      he: '❌ ההתחברות פגה. יש להתחבר מחדש ולנסות שוב.',
      en: '❌ Your session has expired. Please sign in again and retry.',
    },
  },
  {
    category: 'quote_not_found',
    test: (msg) => /quote not found/i.test(msg),
    userMessage: {
      he: '❌ הצעת המחיר לא נמצאה. ייתכן שנמחקה.',
      en: '❌ This quote could not be found. It may have been deleted.',
    },
  },
  {
    category: 'invalid_recipient',
    test: (msg) => /no client email on file/i.test(msg),
    userMessage: {
      he: '❌ ללקוח זה אין כתובת אימייל שמורה במערכת.',
      en: '❌ This client has no email address on file.',
    },
  },
  // Task 38 (Owner D1 = block, server side): send-quote-email refuses a quote with a missing price (stable code prefix,
  // supabase/functions/send-quote-email/priceGate.ts) - the same guidance as the D1 notice, never "the email service rejected it".
  {
    category: 'price_missing',
    test: (msg) => /^QUOTE_PRICE_MISSING:/.test(msg),
    userMessage: {
      he: '❌ המייל לא נשלח: בהצעה יש פריטים ללא מחיר. פתחו את ההצעה לעריכה ולחצו „ערוך מחיר” בכל פריט שמסומן „יש להזין מחיר”. מחיר 0 מכוון מותר.',
      en: '❌ The email was not sent: this quote has items without a price. Open the quote for editing and use "Edit price" on every item marked "Enter a price". An intentional 0 is allowed.',
    },
  },
  {
    category: 'price_unverified',
    test: (msg) => /^QUOTE_PRICE_UNVERIFIED:/.test(msg),
    userMessage: {
      he: '❌ המייל לא נשלח: לא ניתן היה לאמת את מחירי ההצעה כרגע. נסו שוב בעוד רגע.',
      en: '❌ The email was not sent: the quote prices could not be verified right now. Please try again in a moment.',
    },
  },
  {
    category: 'sender_configuration',
    test: (msg) => /RESEND_API_KEY|cannot verify quote region|cannot establish a trustworthy business region/i.test(msg),
    userMessage: {
      he: '❌ בעיית תצורה בשליחת אימייל. נא ליצור קשר עם התמיכה.',
      en: '❌ Email configuration problem on our side. Please contact support.',
    },
  },
];

// חוק ברזל: כל message אמיתי שחזר בהצלחה מהפונקציה (getFunctionErrorMessage
// הצליח לקרוא את ה-response body) אך לא תאם אף דפוס-ידוע למעלה - נחשב
// דחיית-Resend (למשל דומיין-שולח לא-מאומת) ולא "שגיאה לא-ידועה" סתמית,
// כי בפועל זו הקטגוריה הסבירה ביותר לכל מסר-שרת אמיתי ולא-מסווג. רק
// כשל-רשת אמיתי (getFunctionErrorMessage נפל חזרה ל-fallback הגנרי, כלומר
// error.context לא היה קריא בכלל) מסווג "unknown_server_error/network".
export function classifyQuoteEmailError(rawMessage, isHebrew, { hadReadableServerResponse = true } = {}) {
  const msg = String(rawMessage || '');
  for (const pattern of PATTERNS) {
    if (pattern.test(msg)) {
      return { category: pattern.category, userMessage: isHebrew ? pattern.userMessage.he : pattern.userMessage.en };
    }
  }
  if (!hadReadableServerResponse) {
    return {
      category: 'network_error',
      userMessage: isHebrew
        ? '❌ לא ניתן להתחבר לשירות השליחה. בדוק את החיבור לאינטרנט ונסה שוב.'
        : '❌ Could not reach the email service. Check your connection and try again.',
    };
  }
  return {
    category: 'resend_rejected',
    userMessage: isHebrew
      ? '❌ שירות האימייל דחה את השליחה. נא ליצור קשר עם התמיכה.'
      : '❌ The email service rejected this message. Please contact support.',
  };
}
