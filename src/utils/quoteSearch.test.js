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
