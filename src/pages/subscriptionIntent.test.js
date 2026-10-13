import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Unified Landing/Tools/Billing-Readiness task, §B: the pricing-card CTAs
// on both landing pages carry `intendedPlan`/`intendedCycle` as a
// non-authoritative hint through the signup URL (verified live: clicking a
// card navigates to e.g. /dashboard?signup=true&lang=en&intendedPlan=pro&
// intendedCycle=annual). This must never become authoritative - it must
// not set a real plan/entitlement, since no payment backend exists yet.
// This is a structural regression guard: it fails loudly if a future
// change starts reading these params anywhere in the authenticated app,
// forcing a deliberate decision (and a schema/entitlement-safety review)
// rather than a silent, accidental wiring-in.

function readSource(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf-8');
}

describe('subscription intent (intendedPlan/intendedCycle) stays non-authoritative', () => {
  // Owner 2026-10-07: the review plan cards carry no signup / plan-hint action (registration and billing are not active),
  // so the landing pages no longer send an intended-plan hint at all; it must still never become stored / authoritative.
  it('the landing pages send no intended-plan hint and never store one', () => {
    const he = readSource('LandingLocal.jsx');
    const en = readSource('LandingGlobal.jsx');
    expect(he).not.toMatch(/intendedPlan=|intendedCycle=/);
    expect(en).not.toMatch(/intendedPlan=|intendedCycle=/);
    // Never written to localStorage/sessionStorage/a Supabase call from the landing pages themselves.
    expect(he).not.toMatch(/(localStorage|sessionStorage|supabase)[^\n]*intended(Plan|Cycle)/i);
    expect(en).not.toMatch(/(localStorage|sessionStorage|supabase)[^\n]*intended(Plan|Cycle)/i);
  });

  it('nothing in the authenticated app (Dashboard, the two app bundles) reads or consumes it', () => {
    const dashboard = readSource('Dashboard.jsx');
    const appLocal = readSource('../local/AppLocal.jsx');
    const appGlobal = readSource('../global/AppGlobal.jsx');
    for (const src of [dashboard, appLocal, appGlobal]) {
      expect(src).not.toMatch(/intendedPlan/);
      expect(src).not.toMatch(/intendedCycle/);
    }
  });
});
