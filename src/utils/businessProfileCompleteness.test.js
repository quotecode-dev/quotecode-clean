import { describe, it, expect } from 'vitest';
import { getMissingBusinessProfileFields, getBusinessProfileGateMessage } from './businessProfileCompleteness';

describe('getMissingBusinessProfileFields', () => {
  it('HE: blocks when phone is missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '', taxId: '123456789', isLocalIsraeliBusiness: true })).toEqual(['phone']);
  });

  it('HE: blocks when tax ID is missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '+972 501234567', taxId: '', isLocalIsraeliBusiness: true })).toEqual(['taxId']);
  });

  it('HE: blocks on both missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '', taxId: '', isLocalIsraeliBusiness: true })).toEqual(['phone', 'taxId']);
  });

  it('HE: allows when both present', () => {
    expect(getMissingBusinessProfileFields({ phone: '+972 501234567', taxId: '516000000', isLocalIsraeliBusiness: true })).toEqual([]);
  });

  it('EN: blocks when phone is missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '', taxId: '', isLocalIsraeliBusiness: false })).toEqual(['phone']);
  });

  it('EN: allows a valid International profile without a tax ID (deliberately not required)', () => {
    expect(getMissingBusinessProfileFields({ phone: '+1 5551234567', taxId: '', isLocalIsraeliBusiness: false })).toEqual([]);
  });

  it('EN: allows when phone and tax ID are both present (no Israeli-format check applied)', () => {
    expect(getMissingBusinessProfileFields({ phone: '+1 5551234567', taxId: 'EIN-12-3456789', isLocalIsraeliBusiness: false })).toEqual([]);
  });

  it('treats whitespace-only values as missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '   ', taxId: '  ', isLocalIsraeliBusiness: true })).toEqual(['phone', 'taxId']);
  });

  it('treats a dial-code-only phone value (SettingsTab.jsx "+1 " pattern with no local number) as missing', () => {
    expect(getMissingBusinessProfileFields({ phone: '+1 ', taxId: '', isLocalIsraeliBusiness: false })).toEqual(['phone']);
    expect(getMissingBusinessProfileFields({ phone: '+972', taxId: '123', isLocalIsraeliBusiness: true })).toEqual(['phone']);
  });

  it('treats a dial code with a real local number as present', () => {
    expect(getMissingBusinessProfileFields({ phone: '+1 5551234567', taxId: '', isLocalIsraeliBusiness: false })).toEqual([]);
  });
});

describe('getBusinessProfileGateMessage', () => {
  it('HE: returns a Hebrew, RTL-appropriate message with no English leakage', () => {
    const msg = getBusinessProfileGateMessage({ phone: '', taxId: '', isLocalIsraeliBusiness: true, isHebrew: true });
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/טלפון העסק/);
    expect(msg).toMatch(/ח\.פ/);
    expect(/[A-Za-z]/.test(msg)).toBe(false);
  });

  it('EN: returns an English message with no Hebrew leakage', () => {
    const msg = getBusinessProfileGateMessage({ phone: '', taxId: '', isLocalIsraeliBusiness: false, isHebrew: false });
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/Business Phone/);
    expect(/[֐-׿]/.test(msg)).toBe(false);
  });

  it('EN: message never mentions Tax ID when only phone is missing', () => {
    const msg = getBusinessProfileGateMessage({ phone: '', taxId: 'anything-or-empty', isLocalIsraeliBusiness: false, isHebrew: false });
    expect(msg).toMatch(/Business Phone/);
    expect(msg).not.toMatch(/Tax ID/);
  });

  it('returns null when the profile is complete (HE)', () => {
    expect(getBusinessProfileGateMessage({ phone: '050-1234567', taxId: '516000000', isLocalIsraeliBusiness: true, isHebrew: true })).toBeNull();
  });

  it('returns null when the profile is complete (EN, no tax ID needed)', () => {
    expect(getBusinessProfileGateMessage({ phone: '+1 5551234567', taxId: '', isLocalIsraeliBusiness: false, isHebrew: false })).toBeNull();
  });
});

// Owner 2026-10-18: Settings showed the phone but the first quote was blocked - the number was stored without a space after
// the dial code. Every real number passes, with or without the space; only an empty value or a dial code alone is missing.
describe('phone stored with or without a space after the dial code', () => {
  const missing = (phone, isLocalIsraeliBusiness = true) => getMissingBusinessProfileFields({ phone, taxId: '516000000', isLocalIsraeliBusiness }).includes('phone');
  it('a real number is never missing', () => {
    for (const p of ['+972 501234567', '+972501234567', '0501234567', '+1 2025550123', '+12025550123', '+44 7700900123', '+447700900123', '050-1234567']) {
      expect(missing(p), p).toBe(false);
      expect(missing(p, false), p).toBe(false);
    }
  });
  it('empty or a dial code alone is missing', () => {
    for (const p of ['', '   ', null, undefined, '+972', '+972 ', '+1', '+1 ', ' +44  ']) expect(missing(p), String(p)).toBe(true);
  });
});

// Owner 2026-10-25 (typed L-15): the business name and e-mail are required too (when the caller passes them)
describe('name and e-mail required', () => {
  const base = { phone: '+972 501234567', taxId: '516000000', isLocalIsraeliBusiness: true };
  it('the sign-up default name and an empty / invalid e-mail are missing', () => {
    expect(getMissingBusinessProfileFields({ ...base, name: 'עסק חדש', email: '' })).toEqual(['name', 'email']);
    expect(getMissingBusinessProfileFields({ ...base, name: 'New Business', email: 'not-an-email' })).toEqual(['name', 'email']);
    expect(getMissingBusinessProfileFields({ ...base, name: 'דנדי מזגנים', email: 'doron@012.net.il' })).toEqual([]);
  });
  it('the message names them and says to save', () => {
    const he = getBusinessProfileGateMessage({ ...base, phone: '', name: '', email: '', isHebrew: true });
    expect(he).toContain('טלפון העסק, שם העסק ומייל העסק');
    expect(he).toContain('„שמירת הגדרות העסק”');
    const en = getBusinessProfileGateMessage({ ...base, isLocalIsraeliBusiness: false, name: 'Shop', email: '', isHebrew: false });
    expect(en).toContain('Business Email');
  });
  it('callers that pass neither keep the former rule', () => {
    expect(getMissingBusinessProfileFields(base)).toEqual([]);
  });
});
