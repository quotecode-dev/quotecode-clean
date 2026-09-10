import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// EN Matrix Closure follow-up task (2026-09-09) - CONFIRMED root cause via
// source tracing + a real reproduction (not guessed): a pre-existing,
// unrelated effect (getMarketRoutingCorrection, Item 25,
// src/utils/regionConfig.js - already fully unit-tested and never itself
// the defect, see regionConfig.test.js's own "isPasswordRecoveryMode: true"
// case) also depends on isPasswordRecoveryMode. The instant that flag flips
// to false, that effect re-evaluates using whatever session/account data has
// already loaded in the background - and for any account whose real
// registered market doesn't match the recovery link's own bundle, it fires
// its OWN competing window.location.href navigation. The original code in
// handleUpdatePasswordFromRecovery called setIsPasswordRecoveryMode(false)
// BEFORE awaiting supabase.auth.signOut() - opening exactly this race, which
// won against the still in-flight sign-out and aborted it before the
// session was ever cleared from storage (live-reproduced twice against the
// real TEST Supabase project, see PROFLOW_PROJECT_CONTEXT.md for the full
// evidence). The fix is pure ordering - no new mechanism, no broad
// auth-state change - so a live browser/Supabase mock cannot cheaply prove
// it without fabricating a session token (deliberately not done in this
// suite - see the sibling E2E ordering test in
// e2e/critical-journeys.spec.js for what IS safely provable there). This is
// a source-level regression guard against the *ordering* pattern recurring,
// matching this file's own sibling Dashboard.navigation.test.js precedent -
// not a substitute for the pure-function unit tests, the E2E ordering test,
// or the live real-TEST-persona verification recorded in continuity.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

describe('Password recovery - signOut() must fully resolve before isPasswordRecoveryMode is ever cleared', () => {
  it('handleUpdatePasswordFromRecovery still exists with its known post-save setTimeout block', () => {
    expect(dashboardSource).toMatch(/const handleUpdatePasswordFromRecovery = async \(e\) => \{/);
  });

  it('within that post-save setTimeout block, supabase.auth.signOut() is awaited strictly before setIsPasswordRecoveryMode(false) is called', () => {
    const fnStart = dashboardSource.indexOf('const handleUpdatePasswordFromRecovery = async (e) => {');
    expect(fnStart).toBeGreaterThan(-1);
    // The function's own closing "};" that precedes the next handler,
    // handleSignOut - a stable, already-existing sibling function - bounds
    // the search window without needing brace-matching.
    const fnEnd = dashboardSource.indexOf('const handleSignOut = async () => {', fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = dashboardSource.slice(fnStart, fnEnd);

    const signOutIndex = fnBody.indexOf('await supabase.auth.signOut();');
    const flipIndex = fnBody.indexOf('setIsPasswordRecoveryMode(false);');

    expect(signOutIndex).toBeGreaterThan(-1);
    expect(flipIndex).toBeGreaterThan(-1);
    // This is the exact regression this task fixed: the flip must never
    // again precede the awaited sign-out call within this handler.
    expect(signOutIndex).toBeLessThan(flipIndex);
  });

  it('the redirect itself still only ever runs after both of the above, so a future edit cannot silently reintroduce the race by moving the redirect line instead', () => {
    const fnStart = dashboardSource.indexOf('const handleUpdatePasswordFromRecovery = async (e) => {');
    const fnEnd = dashboardSource.indexOf('const handleSignOut = async () => {', fnStart);
    const fnBody = dashboardSource.slice(fnStart, fnEnd);

    const flipIndex = fnBody.indexOf('setIsPasswordRecoveryMode(false);');
    const redirectIndex = fnBody.indexOf("window.location.href = window.location.origin + '/dashboard?lang=' + (bundleIsHebrew ? 'he' : 'en');");

    expect(redirectIndex).toBeGreaterThan(-1);
    expect(flipIndex).toBeLessThan(redirectIndex);
  });
});
