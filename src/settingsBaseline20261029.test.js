// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-06, L-09, L-11, L-12, L-15, L-17, L-22, L-23, L-24, L-25 לפי התוכנית לתיקון 22
// ממצאי קודקס מ-28/10"): Codex F17 / F18 - the Settings leave guard sees every field the form saves, and the Settings currency is the
// business's own (never the open quote's).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { settingsFormDirty } from './utils/settingsBaseline';

const saved = { name: 'Biz', taxId: '1', phone: '2', address: 'x', logo: '', email: 'a@b.co', terms: 'Default terms', warranty: '', currency: 'USD', domain: '' };
const form = { ...saved };

describe('the Settings leave guard (Codex F17)', () => {
  it('an unchanged form is not dirty - including the shown default terms of an account with none stored', () => {
    expect(settingsFormDirty(form, saved)).toBe(false);
    expect(settingsFormDirty(form, null)).toBe(false);
  });
  it.each([['terms', 'My terms'], ['warranty', '12 months'], ['currency', 'GBP'], ['domain', 'construction']])('a change of %s alone is dirty', (k, v) => {
    expect(settingsFormDirty({ ...form, [k]: v }, saved)).toBe(true);
  });
  it('an Israeli business: the currency is always ILS, never "changed"', () => {
    expect(settingsFormDirty({ ...form, currency: 'ILS' }, { ...saved, currency: 'ILS' }, { isLocalIsraeliBusiness: true })).toBe(false);
    expect(settingsFormDirty({ ...form, currency: 'USD' }, { ...saved, currency: 'ILS' }, { isLocalIsraeliBusiness: true })).toBe(false);
  });
  it('the existing fields still count', () => {
    expect(settingsFormDirty({ ...form, name: 'Other' }, saved)).toBe(true);
    expect(settingsFormDirty({ ...form, email: 'x@y.co' }, saved)).toBe(true);
  });
  it('Codex N17: clearing the email is a change too', () => {
    expect(settingsFormDirty({ ...form, email: '' }, { ...saved, email: 'a@b.co' })).toBe(true);
  });
});

describe('the Dashboard wiring (Codex F17 / F18)', () => {
  const d = readFileSync('src/pages/Dashboard.jsx', 'utf8').replace(/\r\n/g, '\n');
  it('the baseline holds what the form shows, and leaving without saving restores every field', () => {
    expect(d).toContain("Object.assign(savedSettingsRef.current, { terms: defTerms, warranty: defWarranty, currency: userCurr, domain: data.professional_domain || '',\n        email: data.email || userEmail || '' });");
    // Codex N17: leaving without saving restores the stored email (no "or the old value" fallback)
    expect(d).toContain("setBizEmail(s.email ?? '');");
    expect(d).toContain("setDefaultTerms(s.terms || ''); setDefaultWarranty(s.warranty || ''); setProfessionalDomain(s.domain || '');");
    expect(d).toContain('if (s.currency) setSettingsCurrency(s.currency);');
  });
  it('the Settings currency is its own state; a save updates the account currency at once; new quotes start from it', () => {
    expect(d).toContain('currency={settingsCurrency}\n              setCurrency={setSettingsCurrency}');
    expect(d).toContain("const enforcedCurrency = isLocalIsraeliBusiness ? 'ILS' : settingsCurrency;");
    expect(d).toContain('setBusinessCurrency(enforcedCurrency);');
    // Codex N16: a new quote right after a save reads the ref, never a stale render's currency
    expect(d).toContain('getPristineQuoteFormState({ defaultTerms, defaultWarranty, isLocalIsraeliBusiness, currency: businessCurrencyRef.current || businessCurrency || currency })');
    expect(d).toContain('const setBusinessCurrency = (c) => { businessCurrencyRef.current = c; setBusinessCurrencyState(c); };');
    expect(d).not.toContain("const enforcedCurrency = isLocalIsraeliBusiness ? 'ILS' : currency;");
  });
});
