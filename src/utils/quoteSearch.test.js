import { describe, it, expect } from 'vitest';
import { quoteMatchesSearch } from './quoteSearch';

// Quote History Search root-cause task (2026-09-08): before the fix, the
// "quote number" half of the search predicate compared against the raw
// internal quote.id (UUID), not the friendly displayed number (formatQuoteFallback,
// e.g. "A57") - the exact root cause the Owner reported ("A57"/"57" never
// matched anything). These tests lock the fixed contract directly against
// the pure helper, matching the search placeholder's own promise: client
// name or quote #, nothing broader.

const heQuote = { quote_number: 57, clients: { company_name: 'משפחת כהן' }, status: 'draft' };
const heQuotePartial = { quote_number: 44, clients: { company_name: 'שיפוצי אלון' }, status: 'sent' };
const enQuote = { quote_number: 100, clients: { company_name: 'Cohen Residence' }, status: 'approved' };
const legacyQuote = { quote_number: null, id: '1a2b3c4d-5678-90ab-cdef-1234567890ab', clients: { company_name: 'Legacy Client' }, status: 'draft' };

describe('quoteMatchesSearch - client name (Hebrew and English)', () => {
  it('matches an exact Hebrew client name', () => {
    expect(quoteMatchesSearch(heQuote, 'משפחת כהן')).toBe(true);
  });
  it('matches a partial Hebrew client name', () => {
    expect(quoteMatchesSearch(heQuotePartial, 'אלון')).toBe(true);
  });
  it('matches an exact English client name', () => {
    expect(quoteMatchesSearch(enQuote, 'Cohen Residence')).toBe(true);
  });
  it('matches a partial English client name, case-insensitively', () => {
    expect(quoteMatchesSearch(enQuote, 'cohen')).toBe(true);
  });
  it('does not match an unrelated name', () => {
    expect(quoteMatchesSearch(heQuote, 'לוי')).toBe(false);
  });
});

describe('quoteMatchesSearch - friendly quote number (the reported root cause)', () => {
  it('matches "A57" for quote_number 57', () => {
    expect(quoteMatchesSearch(heQuote, 'A57')).toBe(true);
  });
  it('matches "a57" (lowercase) for quote_number 57', () => {
    expect(quoteMatchesSearch(heQuote, 'a57')).toBe(true);
  });
  it('matches bare "57" (no A prefix) for quote_number 57', () => {
    expect(quoteMatchesSearch(heQuote, '57')).toBe(true);
  });
  it('does not match a different quote number', () => {
    expect(quoteMatchesSearch(heQuote, 'A44')).toBe(false);
    expect(quoteMatchesSearch(heQuote, '44')).toBe(false);
  });
  it('the previous behavior (matching quote.id, the UUID) is gone - a UUID-shaped term does not spuriously match a numbered quote', () => {
    expect(quoteMatchesSearch(heQuote, '1a2b3c4d')).toBe(false);
  });
});

describe('quoteMatchesSearch - legacy quotes without a real quote_number', () => {
  it('matches the displayed fallback identifier (#UUID prefix) - what QuotesTab.jsx actually renders', () => {
    expect(quoteMatchesSearch(legacyQuote, '1a2b3c4d')).toBe(true);
    expect(quoteMatchesSearch(legacyQuote, '#1a2b3c4d')).toBe(true);
  });
  it('still matches by client name', () => {
    expect(quoteMatchesSearch(legacyQuote, 'Legacy')).toBe(true);
  });
});

describe('quoteMatchesSearch - Owner-reported LIVE false-positive, exact reproduction (2026-09-09 corrective task)', () => {
  // חוק ברזל (Quote Search corrective task, 2026-09-09): הבעלים דיווח שחיפוש
  // "95" ב-LIVE החזיר גם A93/A45/A34/A31 (לא רק A95). הבדיקה הקודמת בדקה
  // הצעה בודדת מול כמה מונחים, לעולם לא מערך מלא עם *כל* המספרים-השכנים
  // האלה יחד - זו בדיוק הבדיקה שהייתה תופסת רגרסיה מהצורה הזו, גם אם
  // לא הייתה קיימת בפועל (אומת חי ב-Production טרי - ר' §216: הבאג לא
  // שוחזר בשום טעינה טרייה, כנראה טאב/session ישן שרץ קוד מלפני הפריסה).
  const ownerReportedQuotes = [
    { quote_number: 95, clients: { company_name: '[TEST] Release Cert EN Client v2' }, status: 'draft' },
    { quote_number: 93, clients: { company_name: '[TEST] Release Cert EN Client' }, status: 'draft' },
    { quote_number: 45, clients: { company_name: 'Shlomo Sinai' }, status: 'draft' },
    { quote_number: 34, clients: { company_name: 'Shlomo Sinai' }, status: 'draft' },
    { quote_number: 31, clients: { company_name: 'Shlomo Sinai' }, status: 'draft' },
    { quote_number: 94, clients: { company_name: 'David Cohen' }, status: 'draft' },
  ];

  it('searching "95" against the full Owner-reported list matches ONLY quote_number 95', () => {
    const results = ownerReportedQuotes.filter((q) => quoteMatchesSearch(q, '95'));
    expect(results).toHaveLength(1);
    expect(results[0].quote_number).toBe(95);
  });

  it('"95" does not match A93, A45, A34, A31, or A94 individually', () => {
    expect(quoteMatchesSearch(ownerReportedQuotes[1], '95')).toBe(false); // A93
    expect(quoteMatchesSearch(ownerReportedQuotes[2], '95')).toBe(false); // A45
    expect(quoteMatchesSearch(ownerReportedQuotes[3], '95')).toBe(false); // A34
    expect(quoteMatchesSearch(ownerReportedQuotes[4], '95')).toBe(false); // A31
    expect(quoteMatchesSearch(ownerReportedQuotes[5], '95')).toBe(false); // A94
  });

  it('"A95" and "a95" against the full list also match only quote_number 95', () => {
    expect(ownerReportedQuotes.filter((q) => quoteMatchesSearch(q, 'A95'))).toHaveLength(1);
    expect(ownerReportedQuotes.filter((q) => quoteMatchesSearch(q, 'a95'))).toHaveLength(1);
  });
});

describe('quoteMatchesSearch - normalization and edge cases', () => {
  it('trims surrounding whitespace', () => {
    expect(quoteMatchesSearch(heQuote, '  a57  ')).toBe(true);
  });
  it('an empty search term matches everything (no filter applied)', () => {
    expect(quoteMatchesSearch(heQuote, '')).toBe(true);
    expect(quoteMatchesSearch(heQuote, '   ')).toBe(true);
  });
  it('a non-matching term returns false', () => {
    expect(quoteMatchesSearch(heQuote, 'zzz-no-match')).toBe(false);
  });
  it('handles a quote with no clients join gracefully (no throw)', () => {
    expect(() => quoteMatchesSearch({ quote_number: 5 }, 'anything')).not.toThrow();
  });
});
