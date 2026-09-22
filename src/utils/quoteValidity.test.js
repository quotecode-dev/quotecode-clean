import { describe, it, expect } from 'vitest';
import { isQuoteAcceptanceExpired, marketCalendarDate, normalizeValidUntil, resolveQuoteExpired } from './quoteValidity';

// Same boundary cases as scripts/db-test/tests/010_public_signing_contract.sql (client/server parity). Unambiguous day 13.
describe('OD-1 quote acceptance expiry (client mirror of quote_acceptance_expired)', () => {
  it.each([
    ['2026-09-13', 'Local', '2026-09-13T23:59:59+03:00', false, 'Local: last second of the validity day'],
    ['2026-09-13', 'Local', '2026-09-14T00:00:00+03:00', true, 'Local: next day 00:00 Asia/Jerusalem'],
    ['2026-09-12', 'Local', '2026-09-12T20:30:00Z', false, 'Local: 23:30 local on the validity day'],
    ['2026-09-12', 'Local', '2026-09-12T21:30:00Z', true, 'Local: 00:30 local next day while UTC is still the validity day'],
    ['2026-09-13', 'International', '2026-09-14T11:59:59Z', false, 'International: still 09/13 somewhere on Earth'],
    ['2026-09-13', 'International', '2026-09-14T12:00:00Z', true, 'International: 09/13 has ended everywhere'],
    ['2026-12-31', 'Local', '2027-01-01T00:30:00+02:00', true, 'year boundary (winter time, UTC+2)'],
    ['2028-02-29', 'Local', '2028-02-29T23:00:00+02:00', false, 'leap day still valid'],
    ['2028-02-29', 'Local', '2028-03-01T00:00:01+02:00', true, 'leap day ended'],
  ])('%s %s at %s -> expired=%s (%s)', (validUntil, market, now, expected) => {
    expect(isQuoteAcceptanceExpired(validUntil, market, new Date(now))).toBe(expected);
  });

  it('no validity date never expires; malformed dates are not treated as expired', () => {
    expect(isQuoteAcceptanceExpired(null, 'Local', new Date('2100-01-01T00:00:00Z'))).toBe(false);
    expect(isQuoteAcceptanceExpired('', 'International', new Date())).toBe(false);
    expect(isQuoteAcceptanceExpired('13/09/2026', 'Local', new Date())).toBe(false);
  });

  it('the calendar date is taken in the market time zone, never the machine zone', () => {
    const instant = new Date('2026-09-13T22:30:00Z');
    expect(marketCalendarDate('Local', instant)).toBe('2026-09-14');
    expect(marketCalendarDate('International', instant)).toBe('2026-09-13');
  });

  it('accepts a Postgres date or timestamp string', () => {
    expect(normalizeValidUntil('2026-09-13')).toBe('2026-09-13');
    expect(normalizeValidUntil('2026-09-13T00:00:00+00:00')).toBe('2026-09-13');
  });

  it('server truth (is_expired) wins over the local computation', () => {
    expect(resolveQuoteExpired({ valid_until: '2020-01-13', is_expired: false }, 'Local')).toBe(false);
    expect(resolveQuoteExpired({ valid_until: '2099-01-13', is_expired: true }, 'Local')).toBe(true);
    expect(resolveQuoteExpired({ valid_until: '2020-01-13' }, 'Local')).toBe(true);
  });
});
