// Task 17: truthful quote statistics (calculations, filters, ordering, unsupported metrics, currency isolation).
import { describe, it, expect } from 'vitest';
import { QUOTE_STATUSES, STAT_PERIODS, UNSUPPORTED_METRICS, computeQuoteStatistics, filterQuotesForStatistics, isHotQuote, isWonQuote } from './quoteStatistics';
import { formatMoneyForCurrency } from './money';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();
const q = (id, status, views, ageDays, total = 100, currency = 'ILS') => ({ id, status, view_count: views, created_at: daysAgo(ageDays), total, currency });
const FIXTURE = Object.freeze([
  q('d1', 'draft', 0, 1), q('d2', 'draft', 5, 2), // a draft viewed 5x is hot (not approved/paid) but never in the conversion denominator
  q('s1', 'sent', 0, 3), q('s2', 'sent', 3, 4), q('s3', 'sent', 7, 20), q('s4', 'sent', 3, 1),
  q('a1', 'approved', 9, 5), q('p1', 'paid', 4, 40), q('p2', 'paid', 0, 100),
]);

describe('Task 17 statistics: KPI definitions', () => {
  it('all time: created / awaiting(sent) / viewed(>0) / won(approved+paid) / hot(>=3 views, not won) / conversion', () => {
    const s = computeQuoteStatistics(FIXTURE, { period: 'all', now: NOW });
    expect(s.created).toBe(9);
    expect(s.awaiting).toBe(4);
    expect(s.viewed).toBe(6); // d2 s2 s3 s4 a1 p1
    expect(s.won).toBe(3);
    expect(s.hot).toBe(4); // d2 s2 s3 s4 - a1 (approved) and p1 (paid) are never hot
    expect(s.conversion).toEqual({ numerator: 3, denominator: 7, percent: 43 }); // 3 / (4 sent + 3 won); drafts excluded
  });
  it('period windows: 7 / 30 / 90 days by created_at, never by updated_at', () => {
    expect(computeQuoteStatistics(FIXTURE, { period: '7d', now: NOW }).created).toBe(6);
    expect(computeQuoteStatistics(FIXTURE, { period: '30d', now: NOW }).created).toBe(7);
    expect(computeQuoteStatistics(FIXTURE, { period: '90d', now: NOW }).created).toBe(8);
    const moved = [{ ...FIXTURE[0], created_at: daysAgo(400), updated_at: daysAgo(0) }];
    expect(computeQuoteStatistics(moved, { period: '7d', now: NOW }).created).toBe(0);
    expect(filterQuotesForStatistics([{ id: 'x', status: 'sent', created_at: 'not a date' }], { period: '30d', now: NOW })).toEqual([]);
  });
  it('status filter uses only the canonical enum; the KPIs follow the filtered population', () => {
    expect(QUOTE_STATUSES).toEqual(['draft', 'sent', 'approved', 'paid']);
    const sent = computeQuoteStatistics(FIXTURE, { period: 'all', status: 'sent', now: NOW });
    expect(sent.created).toBe(4); expect(sent.won).toBe(0); expect(sent.conversion.percent).toBe(0);
    expect(() => computeQuoteStatistics(FIXTURE, { status: 'rejected', now: NOW })).toThrow(/unknown quote status/);
    expect(() => computeQuoteStatistics(FIXTURE, { period: '365d', now: NOW })).toThrow(/unknown statistics period/);
    expect(Object.keys(STAT_PERIODS)).toEqual(['7d', '30d', '90d', 'all']);
  });
  it('conversion with a zero denominator is an explicit 0% (drafts only)', () => {
    expect(computeQuoteStatistics(FIXTURE, { period: 'all', status: 'draft', now: NOW }).conversion).toEqual({ numerator: 0, denominator: 0, percent: 0 });
    expect(computeQuoteStatistics([], { period: 'all', now: NOW }).conversion).toEqual({ numerator: 0, denominator: 0, percent: 0 });
  });
  it('hot list: views descending, then newest first (deterministic)', () => {
    const s = computeQuoteStatistics(FIXTURE, { period: 'all', now: NOW });
    expect(s.hotQuotes.map((x) => x.id)).toEqual(['s3', 'd2', 's4', 's2']); // 7, 5, then 3/3 -> s4 (1 day) before s2 (4 days)
    expect(s.hotQuotes.every(isHotQuote)).toBe(true);
    expect(isHotQuote({ status: 'approved', view_count: 99 })).toBe(false);
    expect(isWonQuote({ status: 'PAID' })).toBe(true);
  });
  it('truthful omission: no rejected metric and no lifecycle timing are computed', () => {
    const s = computeQuoteStatistics(FIXTURE, { period: 'all', now: NOW });
    expect(UNSUPPORTED_METRICS).toEqual(['rejected', 'time_to_first_view', 'time_to_approval']);
    expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['rejected', 'timeToView', 'timeToApproval', 'avgDaysToApprove']));
    expect(s.unsupported).toBe(UNSUPPORTED_METRICS);
  });
});

describe('Task 17 statistics: currency isolation (IRON-MARKET-004 / IRON-ILS-001)', () => {
  const shown = (t) => t.groups.map((g) => `${g.symbol}${formatMoneyForCurrency(g.total, g.currency)}`);
  it('International EUR account: USD/EUR/GBP value totals stay separate - never one mixed total', () => {
    const quotes = [q('u1', 'sent', 0, 1, 100.25, 'USD'), q('u2', 'sent', 0, 1, 50.75, 'USD'), q('e1', 'sent', 0, 1, 200.4, 'EUR'), q('g1', 'sent', 0, 1, 80.1, 'GBP')];
    const s = computeQuoteStatistics(quotes, { period: 'all', now: NOW, accountCurrency: 'EUR' });
    expect(shown(s.valueTotals)).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(shown(s.valueTotals)).not.toContain('€431.50');
  });
  it('Local ILS totals render as whole shekels; the stored totals are untouched', () => {
    const quotes = [q('i1', 'sent', 0, 1, 1227.5, 'ILS'), q('i2', 'paid', 0, 1, 100, 'ILS')];
    const before = JSON.stringify(quotes);
    const s = computeQuoteStatistics(quotes, { period: 'all', now: NOW, accountCurrency: 'ILS' });
    expect(shown(s.valueTotals)).toEqual(['₪1,328.00']);
    expect(JSON.stringify(quotes)).toBe(before);
  });
  it('a quote with a missing currency is never counted under the account currency', () => {
    const s = computeQuoteStatistics([q('x', 'sent', 0, 1, 999, null), q('e', 'sent', 0, 1, 10, 'EUR')], { period: 'all', now: NOW, accountCurrency: 'EUR' });
    expect(shown(s.valueTotals)).toEqual(['€10.00']);
    expect(s.valueTotals.unknownCount).toBe(1);
  });
});
