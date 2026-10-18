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
    expect(msg).toMatch(/טלפון עסק/);
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
