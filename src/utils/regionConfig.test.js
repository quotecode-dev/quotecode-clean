import { describe, it, expect } from 'vitest';
import { getMarketRoutingCorrection, getPostRecoveryLoginLang } from './regionConfig';

// Item 25 - automatic post-login market routing. These tests exercise the
// pure decision function directly (no React/Supabase/browser needed), since
// no real TEST Auth users exist yet to drive an end-to-end login. The
// scenario numbers below match PROFLOW's own Item 25 test-scenario list.

const base = {
  hasSession: true,
  isInitializing: false,
  isPasswordRecoveryMode: false,
  needsRegionChoice: false,
  settingId: 42,
};

describe('getMarketRoutingCorrection', () => {
  it('1. Local account on the Local (Hebrew) bundle: no correction, no loop', () => {
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: true })).toBeNull();
  });

  it('2. Local account on the International (English) bundle: corrects to he', () => {
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: true })).toBe('he');
  });

  it('3. International account on the International bundle: no correction, no loop', () => {
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: false })).toBeNull();
  });

  it('4. International account on the Local (Hebrew) bundle: corrects to en', () => {
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: false })).toBe('en');
  });

  it('5. Refresh after a corrected Local login (now on the Local bundle): stays corrected, no further redirect', () => {
    // Simulates the state immediately after case 2's redirect completes:
    // the browser is now on the Hebrew bundle, matching the account.
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: true })).toBeNull();
  });

  it('6. Refresh after a corrected International login (now on the International bundle): stays corrected, no further redirect', () => {
    // Simulates the state immediately after case 4's redirect completes.
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: false })).toBeNull();
  });

  it('7. Anonymous user (no session): never corrects, pre-auth selection is untouched', () => {
    expect(getMarketRoutingCorrection({ ...base, hasSession: false, bundleIsHebrew: true, isHebrew: false })).toBeNull();
    expect(getMarketRoutingCorrection({ ...base, hasSession: false, bundleIsHebrew: false, isHebrew: true })).toBeNull();
  });

  it('8a. Missing business_settings row (settingId still null): fails safely, no destructive guess', () => {
    expect(getMarketRoutingCorrection({ ...base, settingId: null, bundleIsHebrew: true, isHebrew: false })).toBeNull();
  });

  it('8b. Region not yet chosen for a brand-new account (needsRegionChoice true): fails safely', () => {
    expect(getMarketRoutingCorrection({ ...base, needsRegionChoice: true, bundleIsHebrew: true, isHebrew: false })).toBeNull();
  });

  it('8c. Still initializing (real bizCountry not loaded yet): fails safely, never acts on the initial guess', () => {
    expect(getMarketRoutingCorrection({ ...base, isInitializing: true, bundleIsHebrew: true, isHebrew: false })).toBeNull();
  });

  it('8d. Password-recovery flow in progress: never interferes with that separate flow', () => {
    expect(getMarketRoutingCorrection({ ...base, isPasswordRecoveryMode: true, bundleIsHebrew: true, isHebrew: false })).toBeNull();
  });

  it('8e. bundleIsHebrew not a real boolean (defensive, matches the codebase-wide fail-closed convention): never guesses', () => {
    expect(getMarketRoutingCorrection({ ...base, bundleIsHebrew: undefined, isHebrew: false })).toBeNull();
  });

  it('9. Idempotent by construction: applying the correction once and re-evaluating never yields a second redirect', () => {
    // Start mismatched (International account on the Hebrew bundle) ...
    const first = getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: false });
    expect(first).toBe('en');
    // ... after the one-time redirect, the bundle now matches the account,
    // so re-evaluating with the corrected bundleIsHebrew must return null.
    const second = getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: false });
    expect(second).toBeNull();
  });

  it('10. Never returns a currency/VAT-shaped value — this function only ever returns null, "he", or "en"', () => {
    const allPossibleOutcomes = [
      getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: true }),
      getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: true }),
      getMarketRoutingCorrection({ ...base, bundleIsHebrew: true, isHebrew: false }),
      getMarketRoutingCorrection({ ...base, bundleIsHebrew: false, isHebrew: false }),
    ];
    for (const outcome of allPossibleOutcomes) {
      expect([null, 'he', 'en']).toContain(outcome);
    }
  });
});

// Post-Recovery Login Routing Fix - the post-recovery terminal redirect's
// own decision logic, exercised directly as a pure function (same rationale
// as getMarketRoutingCorrection above: no real TEST Auth users/live browser
// needed to prove the decision itself).
describe('getPostRecoveryLoginLang', () => {
  it('A. International account recovering via a Hebrew-bundled link: known market (isHebrew=false) wins, routes to en, not the Hebrew bundle the link happened to carry', () => {
    expect(getPostRecoveryLoginLang({ settingId: 42, isHebrew: false, bundleIsHebrew: true })).toBe('en');
  });

  it('B. International account, known market unaffected by whatever local IP/geolocation selected the recovery link bundle (bundleIsHebrew true from geo fallback): still en', () => {
    expect(getPostRecoveryLoginLang({ settingId: 42, isHebrew: false, bundleIsHebrew: true })).toBe('en');
  });

  it('C. Local/Hebrew account recovering via an English-bundled link: known market (isHebrew=true) wins, routes to he', () => {
    expect(getPostRecoveryLoginLang({ settingId: 42, isHebrew: true, bundleIsHebrew: false })).toBe('he');
  });

  it('D. Local/Hebrew account, link bundle already matched (bundleIsHebrew true): still he, no spurious flip', () => {
    expect(getPostRecoveryLoginLang({ settingId: 42, isHebrew: true, bundleIsHebrew: true })).toBe('he');
  });

  it('known market and link bundle already agree (International): still en, unaffected', () => {
    expect(getPostRecoveryLoginLang({ settingId: 42, isHebrew: false, bundleIsHebrew: false })).toBe('en');
  });

  it('business_settings never finished loading (settingId still null): falls back to the recovery link bundle, never a geo/browser-language guess', () => {
    expect(getPostRecoveryLoginLang({ settingId: null, isHebrew: false, bundleIsHebrew: true })).toBe('he');
    expect(getPostRecoveryLoginLang({ settingId: undefined, isHebrew: true, bundleIsHebrew: false })).toBe('en');
  });

  it('never returns anything but "he" or "en"', () => {
    const allPossibleOutcomes = [
      getPostRecoveryLoginLang({ settingId: 42, isHebrew: true, bundleIsHebrew: true }),
      getPostRecoveryLoginLang({ settingId: 42, isHebrew: true, bundleIsHebrew: false }),
      getPostRecoveryLoginLang({ settingId: 42, isHebrew: false, bundleIsHebrew: true }),
      getPostRecoveryLoginLang({ settingId: 42, isHebrew: false, bundleIsHebrew: false }),
      getPostRecoveryLoginLang({ settingId: null, isHebrew: false, bundleIsHebrew: true }),
    ];
    for (const outcome of allPossibleOutcomes) {
      expect(['he', 'en']).toContain(outcome);
    }
  });
});

// Owner console 2026-10-17, typed: "מאשר תיקון זיהוי השוק בממשק המשתמש לפי אותו כלל של האדמין" - a stored country is read with the
// admin's ONE rule for the language, the currency and the VAT; unknown values keep the previous behaviour.
describe('canonicalMarket - one market rule for the language, the currency and the VAT', () => {
  it('Israel in any stored form is Local: Hebrew, ₪, 18%', async () => {
    const { canonicalMarket, isHebrewEnv, getCurrencySym, getRegionTaxRate, getRegionBillingProfile } = await import('./regionConfig');
    for (const v of ['Local', 'LCL', 'Israel', 'israel', ' Israel ', 'IL']) {
      expect(canonicalMarket(v)).toBe('Local');
      localStorage.setItem('proflow_cached_country', 'International'); // a previous English account on this device
      expect(isHebrewEnv(v, null)).toBe(true);
      expect(getCurrencySym(v, 'ILS')).toBe('₪');
      expect(getRegionTaxRate(v)).toBe(0.18);
      expect(getRegionBillingProfile(v).language).toBe('he');
    }
    localStorage.removeItem('proflow_cached_country');
  });
  it('another known country is International: English, the account currency, 0%', async () => {
    const { canonicalMarket, isHebrewEnv, getCurrencySym, getRegionTaxRate, getRegionBillingProfile } = await import('./regionConfig');
    for (const v of ['International', 'Germany', 'DE', 'United States', 'uk']) {
      expect(canonicalMarket(v)).toBe('International');
      localStorage.setItem('proflow_cached_country', 'Local'); // a previous Hebrew account on this device
      expect(isHebrewEnv(v, null)).toBe(false);
      expect(getCurrencySym(v, 'EUR')).toBe('€');
      expect(getRegionTaxRate(v)).toBe(0);
      expect(getRegionBillingProfile(v).language).toBe('en');
    }
    localStorage.removeItem('proflow_cached_country');
  });
  it('an unknown or empty value keeps the previous behaviour (the device cache, then the stored language)', async () => {
    const { canonicalMarket, isHebrewEnv, getRegionTaxRate } = await import('./regionConfig');
    expect(canonicalMarket('Mars')).toBeNull();
    expect(canonicalMarket('')).toBeNull();
    expect(canonicalMarket(null)).toBeNull();
    localStorage.setItem('proflow_cached_country', 'International');
    expect(isHebrewEnv('Mars', null)).toBe(false);
    expect(isHebrewEnv(null, null)).toBe(false);
    localStorage.setItem('proflow_cached_country', 'Local');
    expect(isHebrewEnv(null, null)).toBe(true);
    localStorage.removeItem('proflow_cached_country');
    expect(getRegionTaxRate('Mars')).toBe(0.18); // unchanged: anything not International is the Local VAT, as before
  });
  it('the dashboard keeps the canonical market of the stored country', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { cwd } = await import('node:process');
    const dash = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8');
    expect(dash).toContain("const countryVal = canonicalMarket(data.country) || data.country || 'International';");
    // a save never rewrites the stored country while its market is unchanged (a stored 'Germany' stays 'Germany')
    expect(dash).toContain('country: storedCountryRef.current && canonicalMarket(storedCountryRef.current) === bizCountry ? storedCountryRef.current : bizCountry,');
  });
});
