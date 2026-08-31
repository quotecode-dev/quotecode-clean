import { describe, it, expect } from 'vitest';
import { getMarketRoutingCorrection } from './regionConfig';

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
