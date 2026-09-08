// חוק ברזל (Signature Contract Fix, systemic remediation task): לפני התיקון
// הזה, handleApprove (PublicQuote.jsx/PublicQuoteEn.jsx) קלט כל כשל אפשרי
// מ-public_approve_quote (session פגה, חשבון עסקי חסום, הצעה כבר-חתומה,
// חתימה לא-תקינה) לתוך אותה הודעה גנרית אחת בדיוק - "לא הצלחנו לאשר את
// ההצעה. נסו שוב בעוד רגע" - בדיוק אותו דפוס-כשל שכבר תוקן פעם אחת עבור
// שליחת אימייל (ר' quoteEmailErrorClassification.js, אותו מבנה בדיוק).
// classifyQuoteApprovalError ממפה את הודעת ה-RPC האמיתית (error.message)
// לקטגוריה בטוחה-להצגה + הודעת-משתמש מתאימה - לעולם לא חושפת פרטים
// טכניים/מבנה-מסד-נתונים, אבל כן מבדילה בין "חשבון עסקי לא יכול לחתום
// כלקוח" (החסימה מ-20260831000000, ה-RPC נשאר בלתי-נגוע), "ההצעה כבר
// אושרה/לא זמינה יותר" ו"חתימה לא תקינה" - כל אחת דורשת פעולת-משתמש שונה.
// ה-UI (PublicQuote.jsx/PublicQuoteEn.jsx) כבר מונע את המקרה העסקי-חסום
// מראש (caller_is_business_account מ-get-public-quote), כך שההודעה כאן
// היא הגנת-עומק לקליינט ישן/מיושן, לא הנתיב הראשי.
const PATTERNS = [
  {
    category: 'business_account_blocked',
    test: (msg) => /business account cannot approve or sign/i.test(msg),
    userMessage: {
      he: '❌ לא ניתן לחתום על הצעה זו מחשבון עסקי מחובר. יש לפתוח את הקישור בדפדפן פרטי (גלישה בסתר) או להתנתק תחילה, ולחתום כלקוח בלבד.',
      en: '❌ A business account cannot sign this quote as the customer. Please open this link in a private/incognito window, or sign out first, and sign in as the customer only.',
    },
  },
  {
    category: 'already_approved_or_unavailable',
    test: (msg) => /quote not found or cannot be approved/i.test(msg),
    userMessage: {
      he: '❌ לא ניתן לאשר הצעה זו כעת - ייתכן שכבר אושרה בעבר או שאינה זמינה יותר לחתימה.',
      en: '❌ This quote can no longer be approved - it may already be signed, or is no longer available for signature.',
    },
  },
  {
    category: 'invalid_signature',
    test: (msg) => /invalid signature format|missing signature|signature payload too large/i.test(msg),
    userMessage: {
      he: '❌ החתימה שצוירה אינה תקינה. נסו לצייר את החתימה שוב ולנסות פעם נוספת.',
      en: '❌ The drawn signature is invalid. Please redraw your signature and try again.',
    },
  },
];

export function classifyQuoteApprovalError(rawMessage, isHebrew) {
  const msg = String(rawMessage || '');
  for (const pattern of PATTERNS) {
    if (pattern.test(msg)) {
      return { category: pattern.category, userMessage: isHebrew ? pattern.userMessage.he : pattern.userMessage.en };
    }
  }
  return {
    category: 'unknown_error',
    userMessage: isHebrew
      ? '❌ לא הצלחנו לאשר את ההצעה. נסו שוב בעוד רגע.'
      : '❌ We could not approve this quote. Please try again in a moment.',
  };
}
