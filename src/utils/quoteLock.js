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

// Owner 2026-10-25 ("הצעה שאושרה או נחתמה אפשר לסמן כשולמה (רק המצב)"): the one change a locked quote still allows -
// approved (by hand or by the customer's signature) -> paid. The same rule as guard_quote_immutability (20261025100000).
export const canMarkQuotePaid = (quote) => !!quote && (quote.status || '').toLowerCase() === 'approved';
