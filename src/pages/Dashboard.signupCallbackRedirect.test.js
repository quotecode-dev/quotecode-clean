import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Signup Callback Fix (2026-09-16, TEST-only task): EN AUTH SIGNUP EMAIL
// root cause was `emailRedirectTo` hardcoded to the Production canonical
// domain (https://www.tekango.com/dashboard) unconditionally, in code that
// also runs unchanged in TEST - that URL is not on the TEST project's own
// Supabase redirect allowlist, so Supabase silently fell back to the TEST
// site_url's bare root, and root-route handling (see
// AppShellRoutes.test.jsx's own "Signup Callback Fix" describe block) had
// no fallback for type=signup either, landing a successfully-confirmed
// signup on the public marketing page instead of the authenticated app.
//
// The fix branches on isLocalTestMode (src/shared/supabase.js, the same
// live/TEST discriminator that module's own fail-closed guard already
// uses): in TEST it mirrors handleResetSubmit's own already-proven-correct
// dynamic-origin + explicit ?lang=he|en pattern (preserves market/language
// across the redirect, not just the origin); in Production it preserves
// the EXACT original hardcoded string unchanged.
//
// This is a source-level regression guard (same pattern as this file's own
// sibling Dashboard.recoverySessionOrdering.test.js) rather than a full
// render-through-signUp() test, since driving the real handleAuth submit
// path requires mocking the existingBiz business_settings table lookup and
// the full supabase.auth.signUp() call - the actual defect (and its fix)
// is precisely which STRING is computed and passed as emailRedirectTo, not
// any UI/rendering behavior, which a direct source read proves exactly and
// unambiguously.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

describe('Signup emailRedirectTo - TEST vs Production branching', () => {
  it('imports isLocalTestMode and consumeRootSignupIntent from the shared supabase module', () => {
    expect(dashboardSource).toMatch(
      /import \{ supabase, rootRecoveryIntent, consumeRootRecoveryIntent, consumeRootSignupIntent, isLocalTestMode \} from '\.\.\/shared\/supabase';/
    );
  });

  it('computes emailRedirectTo via an isLocalTestMode ternary, not an unconditional hardcoded string', () => {
    expect(dashboardSource).toMatch(
      /const emailRedirectTo = isLocalTestMode\s*\n\s*\? window\.location\.origin \+ '\/dashboard\?lang=' \+ \(bundleIsHebrew \? 'he' : 'en'\)\s*\n\s*: 'https:\/\/www\.tekango\.com\/dashboard';/
    );
  });

  it('the TEST branch is byte-identical to handleResetSubmit\'s own already-proven-correct recovery redirect pattern (same market/language preservation reasoning, deliberately reused, not reinvented)', () => {
    const signupBranch = "window.location.origin + '/dashboard?lang=' + (bundleIsHebrew ? 'he' : 'en')";
    const recoveryBranch = "window.location.origin + '/dashboard?lang=' + (bundleIsHebrew ? 'he' : 'en')";
    expect(dashboardSource).toContain(signupBranch);
    expect(dashboardSource).toContain(recoveryBranch);
    // Both call sites use the identical expression string.
    expect(dashboardSource.split(signupBranch).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('the Production branch preserves the exact original canonical-domain string, byte-for-byte, unchanged', () => {
    expect(dashboardSource).toContain("'https://www.tekango.com/dashboard'");
  });

  it('the computed emailRedirectTo variable (not a literal) is what supabase.auth.signUp() actually receives', () => {
    const signUpCallStart = dashboardSource.indexOf('const { data, error } = await supabase.auth.signUp({');
    expect(signUpCallStart).toBeGreaterThan(-1);
    const signUpCallEnd = dashboardSource.indexOf('});', signUpCallStart);
    const signUpCallBody = dashboardSource.slice(signUpCallStart, signUpCallEnd);
    expect(signUpCallBody).toMatch(/emailRedirectTo,/);
    // Not the old hardcoded literal directly inside the call anymore.
    expect(signUpCallBody).not.toContain("emailRedirectTo: 'https://www.tekango.com/dashboard'");
  });

  it('signup_market metadata (HE=Local / EN=International) is still set from bundleIsHebrew, unchanged by this fix - market separation preserved', () => {
    expect(dashboardSource).toContain("data: { signup_market: bundleIsHebrew ? 'Local' : 'International' }");
  });

  it('the isLocalTestMode variable/import itself is never redefined locally in Dashboard.jsx (always the real shared-module value, no shadowing)', () => {
    const localRedeclare = /const isLocalTestMode|let isLocalTestMode|var isLocalTestMode/;
    expect(dashboardSource).not.toMatch(localRedeclare);
  });
});
