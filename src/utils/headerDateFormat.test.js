import { describe, it, expect } from 'vitest';
import { formatHeaderDate } from './headerDateFormat';

const d = new Date(2026, 8, 19, 21, 5);
describe('formatHeaderDate', () => {
  it('Local/Israel -> DD.MM.YYYY', () => {
    expect(formatHeaderDate(d, 'Local')).toBe('19.09.2026');
    expect(formatHeaderDate(d, 'LCL')).toBe('19.09.2026');
  });
  it('US -> MM.DD.YYYY', () => {
    expect(formatHeaderDate(d, 'US')).toBe('09.19.2026');
    expect(formatHeaderDate(d, 'United States')).toBe('09.19.2026');
  });
  it('unknown/International stays DD.MM.YYYY', () => {
    expect(formatHeaderDate(d, 'International')).toBe('19.09.2026');
    expect(formatHeaderDate(d, undefined)).toBe('19.09.2026');
  });
});
