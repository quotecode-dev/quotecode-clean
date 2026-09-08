import { formatQuoteNumber, formatQuoteFallback } from './quoteNumber';

// חוק ברזל (Quote History Search root-cause task, 2026-09-08): לפני התיקון,
// Dashboard.jsx חיפש "מס' הצעה" כנגד quote.id הגולמי (UUID פנימי) - בדיוק
// אותו class-of-bug שכבר תוקן פעם אחת עבור המיון (ר' getQuoteOrderSortKey,
// quoteNumber.js, "Order Number Sorting Fix") אבל מעולם לא הוחל על החיפוש
// עצמו. מספר-ההזמנה המוצג בפועל למשתמש (formatQuoteFallback, למשל "A57")
// לא הכיל בדרך-כלל אף תת-מחרוזת משמעותית מתוך ה-UUID, כך שחיפוש "A57"/"57"
// כמעט תמיד לא החזיר תוצאות - זה שורש-הבעיה שהבעלים דיווח עליו.
//
// מקור-אמת יחיד לחוזה-החיפוש (תואם בדיוק לטקסט ה-placeholder הקיים,
// t.searchQuote: "חיפוש שם לקוח או מס' הצעה..."/"Search client or quote
// #..." - לא הורחב לשדות נוספים כמו subject/project, כי החוזה הגלוי לא
// מבטיח אותם): שם לקוח (quote.clients.company_name) + מספר הצעה ידידותי
// (A57/a57/57, ר' formatQuoteNumber) + מזהה-נפילה-חזרה (#UUID-מקוצר,
// formatQuoteFallback) עבור הצעות legacy שעדיין אין להן quote_number אמיתי -
// זה בדיוק מה שמוצג בפועל בעמודת "מס' הצעה" כשאין מספר אמיתי, ר'
// QuotesTab.jsx. HE ו-EN חולקים אותה לוגיקה בדיוק - אין ענף-שפה כאן בכלל.
export function quoteMatchesSearch(quote, rawSearchTerm) {
  const term = String(rawSearchTerm ?? '').trim().toLowerCase();
  if (!term) return true;

  const clientName = (quote?.clients?.company_name || '').toLowerCase();
  if (clientName.includes(term)) return true;

  // "a57".includes("a57") / "a57".includes("57") שתיהן true - כך ש"A57",
  // "a57" ו-"57" כולם תואמים quote_number=57 באותה השוואת-תת-מחרוזת אחת,
  // בלי ענף מיוחד לכל צורת-הקלדה.
  const friendly = formatQuoteNumber(quote?.quote_number);
  if (friendly && friendly.toLowerCase().includes(term)) return true;

  const fallbackDisplay = formatQuoteFallback(quote).toLowerCase();
  if (fallbackDisplay.includes(term)) return true;

  return false;
}
