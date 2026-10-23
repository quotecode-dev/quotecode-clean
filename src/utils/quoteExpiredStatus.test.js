import { describe, it, expect } from 'vitest';
import { isOpenQuoteExpired, quoteValidityMarket } from './quoteValidity';
import { isHotQuote } from './quoteStatistics';
import { getQuoteStatusKey, isQuoteHot, getQuoteActionKind } from './quoteListSort';
import { quoteDisplayStatus, quoteDisplayLabel, quoteDisplayChipRole, quoteDisplayTone, matchesQuoteFilter } from './quoteStatusDisplay';

// Owner 2026-10-23 (typed L-13, L-14, L-17, L-25, L-26): an open quote whose validity has passed.
const past = '2020-01-01';
const future = '2999-12-31';
const hot = (over) => ({ status: 'sent', view_count: 5, currency: 'ILS', tax_rate: 0.18, total: 100, ...over });

describe('the expired quote state', () => {
  it('the market follows the quote (ILS / VAT -> Local)', () => {
    expect(quoteValidityMarket({ currency: 'ILS' })).toBe('Local');
    expect(quoteValidityMarket({ currency: 'USD', tax_rate: 0 })).toBe('International');
  });

  it('a hot quote whose validity passed is no longer hot and shows "expired"', () => {
    const q = hot({ valid_until: past });
    expect(isOpenQuoteExpired(q)).toBe(true);
    expect(isHotQuote(q)).toBe(false);
    expect(isQuoteHot(q)).toBe(false);
    expect(quoteDisplayStatus(q)).toBe('expired');
    expect(getQuoteStatusKey(q)).toBe('expired');
    expect(getQuoteActionKind(q)).toBe('open');
    expect(quoteDisplayLabel('expired', true)).toBe('פג תוקף');
    expect(quoteDisplayLabel('expired', false)).toBe('Expired');
    expect(quoteDisplayChipRole('expired')).toBe('expired');
    expect(quoteDisplayTone('expired')).toBe('expired');
    expect(matchesQuoteFilter(q, 'expired')).toBe(true);
    expect(matchesQuoteFilter(q, 'hot')).toBe(false);
    // the older saved filter value 'draft' (not yet with the customer) no longer lists an expired complete draft
    expect(matchesQuoteFilter({ status: 'draft', view_count: 0, currency: 'USD', valid_until: past, total: 50, quote_items: [{ unit_price: 50, quantity: 1 }] }, 'draft')).toBe(false);
  });

  it('a valid or undated quote is unchanged', () => {
    expect(quoteDisplayStatus(hot({ valid_until: future }))).toBe('hot');
    expect(quoteDisplayStatus(hot({ valid_until: null }))).toBe('hot');
    expect(isHotQuote(hot({ valid_until: future }))).toBe(true);
  });

  it('approved and paid quotes are never "expired"', () => {
    expect(quoteDisplayStatus(hot({ status: 'approved', valid_until: past }))).toBe('approved');
    expect(quoteDisplayStatus(hot({ status: 'paid', valid_until: past }))).toBe('paid');
    expect(isOpenQuoteExpired(hot({ status: 'approved', valid_until: past }))).toBe(false);
  });

  it('a draft with a passed date is expired too (the warning before sending)', () => {
    expect(quoteDisplayStatus({ status: 'draft', view_count: 0, currency: 'USD', valid_until: past, total: 50, quote_items: [{ unit_price: 50, quantity: 1 }] })).toBe('expired');
  });
});

describe('an unfinished draft with a passed date', () => {
  it('stays "Draft" so editing comes first', () => {
    const q = { status: 'draft', view_count: 0, currency: 'ILS', valid_until: '2020-01-01', total: 0, quote_items: [] };
    expect(quoteDisplayStatus(q)).toBe('unfinished');
    expect(getQuoteStatusKey(q)).toBe('unfinished');
  });
});
