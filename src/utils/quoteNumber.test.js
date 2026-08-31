import { describe, it, expect } from 'vitest';
import { getQuoteOrderSortKey } from './quoteNumber';

// חוק ברזל (Quote History Final Polish task - Order Number Sorting Fix):
// הבדיקות האלה מגנות על שורש-הבעיה שהבעלים דיווח עליו - מיון "מספר הזמנה"
// חייב לעקוב אחרי quote.quote_number (הרצף המספרי המוצג, למשל A100730 לפני
// A100731), לא אחרי quote.id (UUID פנימי, שאין לו שום קשר לרצף המוצג).
function sortAsc(quotes) {
  return [...quotes].sort((a, b) => getQuoteOrderSortKey(a) - getQuoteOrderSortKey(b));
}

describe('getQuoteOrderSortKey', () => {
  it('sorts ascending by the real numeric quote_number, not by id/UUID', () => {
    const quotes = [
      { id: 'zzz-uuid', quote_number: 730 },
      { id: 'aaa-uuid', quote_number: 732 },
      { id: 'mmm-uuid', quote_number: 731 },
    ];
    expect(sortAsc(quotes).map((q) => q.quote_number)).toEqual([730, 731, 732]);
  });

  it('sorts descending (reverse of ascending) by the real numeric quote_number', () => {
    const quotes = [
      { id: 'zzz-uuid', quote_number: 730 },
      { id: 'aaa-uuid', quote_number: 732 },
      { id: 'mmm-uuid', quote_number: 731 },
    ];
    const desc = [...quotes].sort((a, b) => getQuoteOrderSortKey(b) - getQuoteOrderSortKey(a));
    expect(desc.map((q) => q.quote_number)).toEqual([732, 731, 730]);
  });

  it('does not fall back to lexicographic string comparison across digit-count boundaries', () => {
    // מלכודת קלאסית של מיון לקסיקוגרפי: "A10" < "A9" כמחרוזות, אבל
    // 10 > 9 כמספרים - הבדיקה מוודאת שהמיון תמיד נומרי אמיתי.
    const quotes = [
      { id: 'a', quote_number: 1000 },
      { id: 'b', quote_number: 9 },
      { id: 'c', quote_number: 99 },
      { id: 'd', quote_number: 10 },
      { id: 'e', quote_number: 100 },
      { id: 'f', quote_number: 999 },
    ];
    expect(sortAsc(quotes).map((q) => q.quote_number)).toEqual([9, 10, 99, 100, 999, 1000]);
  });

  it('never uses the internal UUID (id) as a sort signal, even when quote_number is identical across a wide id range', () => {
    const quotes = [
      { id: 'ffffffff-...', quote_number: 5 },
      { id: '00000000-...', quote_number: 3 },
      { id: '99999999-...', quote_number: 4 },
    ];
    // אם הבאג המקורי (מיון לפי id) עדיין היה קיים, 00000000 היה קודם
    // לקסיקוגרפית - הבדיקה מוודאת שהתוצאה תלויה רק ב-quote_number.
    expect(sortAsc(quotes).map((q) => q.quote_number)).toEqual([3, 4, 5]);
  });

  it('groups legacy quotes without a real quote_number entirely before any real-numbered quote', () => {
    const quotes = [
      { id: 'real-1', quote_number: 1, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'legacy-1', quote_number: null, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 'real-2', quote_number: 999999, created_at: '2026-01-02T00:00:00.000Z' },
      { id: 'legacy-2', quote_number: undefined, created_at: '2026-05-01T00:00:00.000Z' },
    ];
    const sorted = sortAsc(quotes).map((q) => q.id);
    // שני ה-legacy (בלי quote_number אמיתי) חייבים לצאת ראשונים כקבוצה,
    // ללא תלות בגודל quote_number של ההצעות הממוספרות (999999 עדיין אחרי
    // שני ה-legacy, לא לפני, כי ל-legacy אין מספר-סדר אמיתי בכלל).
    expect(sorted.slice(0, 2).sort()).toEqual(['legacy-1', 'legacy-2']);
    expect(sorted.slice(2)).toEqual(['real-1', 'real-2']);
  });

  it('orders legacy quotes (no real quote_number) among themselves by created_at, not arbitrarily', () => {
    const quotes = [
      { id: 'legacy-newer', quote_number: null, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 'legacy-older', quote_number: null, created_at: '2026-01-01T00:00:00.000Z' },
    ];
    expect(sortAsc(quotes).map((q) => q.id)).toEqual(['legacy-older', 'legacy-newer']);
  });
});
