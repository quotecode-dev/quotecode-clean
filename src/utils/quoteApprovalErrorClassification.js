// חוק ברזל (Signature Product/Security Contract Correction, systemic
// remediation continuation task, 2026-09-09): the RPC's identity check was
// narrowed from "any authenticated business account" (20260831000000) to
// "this specific quote's own owner only" (20260909000000) - the broad rule
// blocked legitimate customers who also hold their own TEKANGO business
// account, a real product dead-end the Owner directly hit and reported.
// classifyQuoteApprovalError maps the RPC's real error message
// (error.message) to a safe-to-display category + matching user message -
// never exposing technical/database details, but distinguishing "you are
// this quote's own business, you cannot sign as your own customer" (the
// only case this RPC still blocks) from "already approved/unavailable" and
// "invalid signature" - each needs a different user action. The UI
// (PublicQuote.jsx/PublicQuoteEn.jsx) now only ever reaches this owner-
// blocked case for the quote's own logged-in owner (is_owner_viewing
// already hides the signing UI for them before this error could even
// fire) - this message is defense-in-depth for a stale/already-open
// client, not the primary path. Any OTHER authenticated business account
// is a legitimate potential customer and is never blocked.
const PATTERNS = [
  {
    category: 'owner_cannot_self_approve',
    // 20260831/20260909 wording ("business account cannot approve or sign") and the 2026-09-22 OD-9 wording
    // ("a member of the business that issued this quote cannot approve or sign").
    test: (msg) => /(business account|member of the business that issued this quote) cannot approve or sign/i.test(msg),
    userMessage: {
      he: '❌ אי אפשר לחתום על ההצעה מחשבון העסק ששלח אותה. כדי לחתום כלקוחות, יש להתחבר לחשבון שלכם או לפתוח חלון גלישה אנונימית.',
      en: '❌ This quote cannot be signed from the business account that sent it. If you are the customer, please sign in with your own account or use an anonymous/incognito window.',
    },
  },
  {
    // OD-1 (2026-09-22): an expired quote stays viewable but cannot be accepted.
    category: 'quote_expired',
    test: (msg) => /quote expired|validity date has passed/i.test(msg),
    userMessage: {
      he: '⏳ תוקף הצעת המחיר הסתיים, ולכן לא ניתן לאשר או לחתום עליה. לקבלת הצעה מעודכנת פנו לעסק ששלח אותה.',
      en: '⏳ This quote has expired, so it can no longer be approved or signed. Please contact the business that sent it for an updated quote.',
    },
  },
  {
    // Codex release 2b (Owner 2026-10-29, typed: "מאשר שחרור 2ב ... וחסימת חתימה על הצעה עם מחיר חסר (החלטה 3), כולל שינוי ב-L-17, L-24"): the signing core refuses a quote with a line without a price
    category: 'missing_price',
    test: (msg) => /missing prices/i.test(msg),
    userMessage: {
      he: '❌ עדיין חסרים מחירים בהצעה, ולכן אי אפשר לאשר ולחתום עליה. בקשו מהעסק הצעה מעודכנת.',
      en: '❌ Some prices are still missing, so this quote cannot be approved or signed. Ask the business for an updated quote.',
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
      he: '❌ החתימה אינה תקינה. ציירו אותה שוב ונסו לאשר.',
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
