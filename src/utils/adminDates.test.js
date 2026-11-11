// IRON-DATE-001 admin amendment (Owner console 2026-10-22, typed; L-22 opened): every admin date is DD/MM/YYYY in Israel time, for
// every account and interface language; the user's own surfaces keep the account market (shortDate itself is unchanged).
import { describe, it, expect } from 'vitest';
import { accountDate, accountDateTime, accountDateMarket, ADMIN_DATE_MARKET } from './adminDates';
import { formatShortDate } from './shortDate';

describe('admin dates (IRON-DATE-001 admin amendment)', () => {
  const intl = { country: 'International', currency: 'USD' };
  const il = { country: 'Local', currency: 'ILS' };
  it('an International account is shown DD/MM/YYYY in the admin', () => {
    expect(ADMIN_DATE_MARKET).toBe('Local');
    expect(accountDateMarket(intl)).toBe('Local');
    expect(accountDate('2026-09-01T10:00:00Z', intl, 'International')).toBe('01/09/2026');
    expect(accountDate('2026-09-01T10:00:00Z', il)).toBe('01/09/2026');
  });
  it('the time is Israel time (late UTC evening is already the next day in Israel)', () => {
    expect(accountDate('2026-10-22T22:30:00Z', intl)).toBe('23/10/2026');
    expect(accountDateTime('2026-10-22T22:30:00Z', intl)).toMatch(/^23\/10\/2026 01:30$/);
  });
  it('a missing or invalid date is a dash, never a made-up date', () => {
    expect(accountDate(null, intl)).toBe('—');
    expect(accountDateTime('not a date', intl)).toBe('—');
  });
  it("the user's own International format is unchanged outside the admin", () => {
    expect(formatShortDate('2026-09-01T10:00:00Z', 'International')).toBe('09/01/2026');
  });
});
