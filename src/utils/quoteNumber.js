// נקודת אמת יחידה לעיצוב מספר ההצעה הלקוחי (item 17) - כל מקום שמציג את
// המספר ללקוח/לבעל העסק חייב לקרוא לפונקציה הזו ולא לשכפל את התבנית "A" +
// המספר בעצמו, כדי שהפורמט לא יסטה בין מקומות שונים. quote_number עצמו
// מאוחסן כמספר שלם גולמי (לא כמחרוזת מפורמטת) - הפורמט הוא רק שכבת תצוגה.
// עדכון 2026-08-28 (Quote Number Transition audit): ההנחה הקודמת כאן
// ש-quote.quote_number "יהיה תמיד undefined/null עד שה-migration של המאגר
// יופעל" התבררה כשגויה - quote_number כבר קיים בסביבה החיה כעמודה integer
// NOT NULL (מנגנון global-sequence קיים-מראש, לא ה-migration שמתוכנן כאן -
// ר' PROFLOW_TODO.md item 17) ועשוי כבר להכיל ערך אמיתי היום עבור הצעות
// מסוימות (למשל "A90"), עוד לפני שה-migration של המאגר הזה יופעל אי-פעם.
// ההתנהגות של הפונקציה עצמה לא צריכה שינוי בגלל זה: היא כבר מתמודדת נכון
// עם שני המצבים (ערך אמיתי / null) - היא פשוט מחזירה null במפורש כשאין
// ערך, כדי שכל קורא יוכל ליפול חזרה בבטחה לתצוגה הישנה (UUID מקוצר) בלי
// צורך לבדוק isNaN/undefined בעצמו בכל מקום קריאה.
export const formatQuoteNumber = (quoteNumber) => {
  if (quoteNumber === null || quoteNumber === undefined || Number.isNaN(Number(quoteNumber))) {
    return null;
  }
  return `A${quoteNumber}`;
};

// חוק ברזל (Global Surface Audit finding I-5, תוקן בסבב הזה - Part 13 של
// המשימה): לפני התיקון, כל צרכן שכפל בעצמו את נפילת-החזרה `#${quote.id.
// slice(0,N)}` עם N שונה בין מקומות שונים - QuotesTab.jsx השתמש ב-6
// (slice(0,6)), PublicQuoteHeader.jsx השתמש ב-8 (slice(0,8)) - חוסר עקביות
// אמיתי בין המשטחים, גם אם לא-מזיק (שניהם רק תצוגה). מעכשיו כל צרכן קורא
// לפונקציה האחת הזו במקום לשכפל את הדפוס בעצמו, כדי שמדיניות נפילת-החזרה
// אחת (8 תווים, הערך הארוך יותר משני הקיימים) תחול בכל מקום עד שה-migration
// יופעל בסביבה החיה ו-formatQuoteNumber יתחיל להחזיר ערך אמיתי במקום null
// בכל מקום בבת אחת.
export const formatQuoteFallback = (quote) => {
  return formatQuoteNumber(quote?.quote_number) || `#${(quote?.id || '').slice(0, 8)}`;
};

// חוק ברזל (Quote History Final Polish task - Order Number Sorting Fix):
// מספר-ההזמנה המוצג ללקוח (formatQuoteFallback, למשל "A100713") נגזר תמיד
// מ-quote.quote_number (מספר שלם) - מפתח-מיון עבור עמודת "מספר הזמנה" חייב
// להשוות את אותו שדה בדיוק, לא את quote.id (UUID פנימי, ללא שום קשר לרצף
// המוצג - זה היה הבאג המקורי שהבעלים דיווח עליו ב-Dashboard.jsx). מוחזר
// כמפתח-מיון נומרי בודד (לא פונקציית-השוואה זוגית) כדי להישאר תואם לחלוטין
// לתבנית ה-aVal/bVal + עלייה/ירידה הגנרית הקיימת כבר ב-Dashboard.jsx - לא
// נדרש לשכתב את מנגנון-המיון הכללי בשביל התיקון הזה.
// הצעות legacy בלי quote_number אמיתי עדיין (fallback ל-#UUID-מקוצר בתצוגה,
// ר' formatQuoteFallback למעלה) אין להן מיקום-סדר מספרי משמעותי משלהן - הן
// ממוינות כקבוצה אחת שלמה שנופלת תמיד *לפני* כל הצעה עם מספר-הזמנה אמיתי
// (LEGACY_ORDER_CEILING גבוה בהרבה מכל timestamp אמיתי של created_at וגם
// מכל quote_number מציאותי), ובתוך הקבוצה הזו עצמה ממוינות לפי created_at
// כך שהסדר היחסי ביניהן עדיין משמעותי ולא שרירותי-UUID.
const LEGACY_ORDER_CEILING = 1e15; // מעל epoch ms נוכחי (~1.7e12) בהרבה, ומעל כל quote_number מציאותי
export const getQuoteOrderSortKey = (quote) => {
  const num = quote?.quote_number;
  const hasRealNumber = num !== null && num !== undefined && !Number.isNaN(Number(num));
  if (hasRealNumber) {
    return LEGACY_ORDER_CEILING + Number(num);
  }
  const created = quote?.created_at ? new Date(quote.created_at).getTime() : 0;
  return Number.isFinite(created) ? created : 0;
};
