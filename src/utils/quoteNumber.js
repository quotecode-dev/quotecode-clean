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
