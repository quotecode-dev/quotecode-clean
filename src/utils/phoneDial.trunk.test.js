// Owner 2026-10-25 (typed L-07, L-08, L-09; L-01, L-09): a phone is stored without the trunk 0; an International business chooses its code
import { describe, it, expect } from 'vitest';
import { joinPhone, businessDial, DIAL_CHOICES } from './phoneDial';

describe('joinPhone', () => {
  it('drops the trunk 0 after the country code, keeps the rest as typed', () => {
    expect(joinPhone('+972', '050-1234567')).toBe('+972 50-1234567');
    expect(joinPhone('+972', '04500510')).toBe('+972 4500510');
    expect(joinPhone('+44', '020 7946 0958')).toBe('+44 20 7946 0958');
    expect(joinPhone('+1', '212 555 0100')).toBe('+1 212 555 0100');
    expect(joinPhone('+972', '  0501234567 ')).toBe('+972 501234567');
    expect(joinPhone('+972', '')).toBe('+972 ');
    expect(joinPhone('+972', '0')).toBe('+972 0');
  });
});

describe('businessDial', () => {
  it('Israel = +972 always; International = the code of its saved phone, else by currency', () => {
    expect(businessDial({ isLocal: true, currency: 'ILS', businessPhone: '+44 20' }).dial).toBe('+972');
    expect(businessDial({ isLocal: false, currency: 'EUR', businessPhone: '+33 1 23 45 67 89' })).toEqual({ dial: '+33', label: 'FR (+33)' });
    expect(businessDial({ isLocal: false, currency: 'EUR' }).dial).toBe('+49');
    expect(businessDial({ isLocal: false, currency: 'USD', businessPhone: '' }).dial).toBe('+1');
    expect(DIAL_CHOICES.some((c) => c.dial === '+353')).toBe(true);
  });
});
