// נקודת אמת יחידה לקביעת אי-שינוי הצעה - כל מקום שצריך לבדוק אם הצעה
// מאושרת/שולמה/חתומה (UI, שער עריכה, שער מחיקה) חייב לקרוא לפונקציה הזו
// ולא לשכפל את התנאי בעצמו, כדי שהלוגיקה לא תסטה בין מקומות שונים.
export const isQuoteImmutable = (quote) => {
  if (!quote) return false;
  const status = (quote.status || '').toLowerCase();
  return status === 'approved' ||
         status === 'paid' ||
         !!quote.signature;
};
