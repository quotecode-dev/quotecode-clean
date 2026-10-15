// Owner 2026-10-15 (a new account stuck on "Where is your business located?"; "this question itself breaks our Iron Laws"): the
// market of an account that signed up on the site is its signup market; a creation refused because the row already exists (a second
// tab of the same sign-in) loads that row; a failed creation retries by itself on a setup line in the signup-market language.
// Behaviour proven in a real browser on the 5186 working preview (hermetic Supabase): two tabs, transient failure x 2 markets x 4
// viewports, legacy region choice unchanged. These source guards keep the wiring true.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const d = readFileSync(join(cwd(), 'src/pages/Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');
const between = (from, to) => d.slice(d.indexOf(from), d.indexOf(to, d.indexOf(from)));

describe('new account setup', () => {
  it('an account with a signup market goes through the self-retrying setup, never the region choice', () => {
    const branch = between("const signupMarket = userMetadata?.signup_market;", 'const freshGeoCountry');
    expect(branch).toContain('await setupSignupAccount(userId, userEmail, userMetadata, signupMarket);');
    expect(branch).not.toContain('setNeedsRegionChoice');
    const setup = between('async function setupSignupAccount(', 'async function handleRegionChoiceSelect(');
    expect(setup).toContain("createNewBusinessSettings(userId, userEmail, market, userMetadata?.business_name, { fromSignup: true })");
    expect(setup).not.toContain('setNeedsRegionChoice');
    expect(setup).toContain('setAccountSetup({ market });');
    expect(setup).toContain('if (gen !== loadGenRef.current) return;');
    expect(setup).toContain('if (accountSetupRetryRef.current) return;');
  });
  it('a creation refused because the row exists (23505) loads that row instead of an error', () => {
    const once = between('async function createNewBusinessSettingsOnce(', 'setSettingId(newData.id);');
    expect(once).toContain("const rowExists = insertError?.code === '23505';");
    expect(once).toContain("return rowExists ? 'exists' : false;");
    const setup = between('async function setupSignupAccount(', 'async function handleRegionChoiceSelect(');
    expect(setup).toContain("if (outcome === 'exists') {");
    expect(setup).toContain('await fetchSettings(userId, userEmail, userMetadata); return;');
  });
  it('a second caller waits for the creation in flight (no empty dashboard while the first one runs)', () => {
    expect(d).toContain("if (isCreatingBusinessSettingsRef.current) return businessSettingsCreationRef.current ?? 'busy';");
  });
  it('the setup line speaks the signup market language, not the link / browser / cached language, and asks nothing', () => {
    const screen = between('const setupMode = !!(accountSetup && !settingId);', '<AIChatWidget isHebrew={screenHe}');
    expect(screen).toContain("const screenHe = setupMode ? accountSetup.market === 'Local' : isHebrew;");
    expect(screen).toContain("lang={setupMode ? (screenHe ? 'he' : 'en') : undefined}");
    const setupBranch = screen.slice(screen.indexOf('{setupMode ? ('), screen.indexOf(') : (<>'));
    expect(setupBranch).toContain("screenHe ? 'מסיימים להקים את החשבון שלך…' : 'Finishing setting up your account…'");
    expect(setupBranch).not.toMatch(/isHebrew|<button/);
  });
  it('sign-out clears the setup state', () => {
    expect(between("} else if (event === 'SIGNED_OUT') {", "} else if (event === 'PASSWORD_RECOVERY') {")).toContain('setAccountSetup(null);');
  });
});
