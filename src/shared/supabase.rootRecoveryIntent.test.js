import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeRootRecoveryIntent, consumeRootRecoveryIntent, rootRecoveryIntent } from './supabase';

// Password Recovery Fresh-Link Root-Landing Hardening (2026-09-15 task):
// a fresh recovery-email link's callback can land on bare "/" instead of
// the requested /dashboard?lang=he|en (Supabase's own redirect-URL
// allowlist/template behavior - see AppLocal.jsx/AppGlobal.jsx's own "/"
// route comment for the full explanation), and by the time any mounted
// component could inspect window.location.hash, Supabase's own client may
// already have consumed and cleared it. computeRootRecoveryIntent is the
// pure capture logic (no window/DOM access) that must run before that
// happens; these tests exercise it directly with arbitrary hash/search
// values, independent of jsdom/location plumbing.
describe('computeRootRecoveryIntent - pure capture logic', () => {
  it('detects a genuine recovery hash fragment', () => {
    const result = computeRootRecoveryIntent({ hash: '#access_token=abc123&type=recovery&expires_in=3600', search: '' });
    expect(result.isRecovery).toBe(true);
    expect(result.isError).toBe(false);
  });

  it('detects a genuine recovery signal carried in the query string instead of the hash', () => {
    const result = computeRootRecoveryIntent({ hash: '', search: '?type=recovery' });
    expect(result.isRecovery).toBe(true);
  });

  it('detects an expired/invalid-link error redirect (error_code=otp_expired)', () => {
    const result = computeRootRecoveryIntent({ hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', search: '' });
    expect(result.isError).toBe(true);
    expect(result.isRecovery).toBe(false);
  });

  it('detects a bare error= redirect even without an explicit error_code', () => {
    const result = computeRootRecoveryIntent({ hash: '#error=server_error', search: '' });
    expect(result.isError).toBe(true);
  });

  it('ordinary navigation (no hash, no search) is neither recovery nor error', () => {
    const result = computeRootRecoveryIntent({ hash: '', search: '' });
    expect(result.isRecovery).toBe(false);
    expect(result.isError).toBe(false);
  });

  it('an ordinary query string unrelated to recovery (e.g. ?signup=true) is not misdetected', () => {
    const result = computeRootRecoveryIntent({ hash: '', search: '?signup=true' });
    expect(result.isRecovery).toBe(false);
    expect(result.isError).toBe(false);
  });

  it('never inspects or returns any token/session material - only the two booleans', () => {
    const result = computeRootRecoveryIntent({ hash: '#access_token=super-secret-token-value&refresh_token=another-secret&type=recovery', search: '' });
    expect(Object.keys(result).sort()).toEqual(['isError', 'isRecovery']);
    expect(JSON.stringify(result)).not.toContain('super-secret-token-value');
    expect(JSON.stringify(result)).not.toContain('another-secret');
  });

  it('defaults missing arguments to empty strings without throwing', () => {
    expect(() => computeRootRecoveryIntent()).not.toThrow();
    expect(computeRootRecoveryIntent()).toEqual({ isRecovery: false, isError: false });
  });
});

describe('rootRecoveryIntent / consumeRootRecoveryIntent - marker lifecycle', () => {
  it('consumeRootRecoveryIntent clears both flags on the shared marker object', () => {
    rootRecoveryIntent.isRecovery = true;
    rootRecoveryIntent.isError = true;
    consumeRootRecoveryIntent();
    expect(rootRecoveryIntent.isRecovery).toBe(false);
    expect(rootRecoveryIntent.isError).toBe(false);
  });

  it('is safe to call repeatedly (idempotent)', () => {
    consumeRootRecoveryIntent();
    expect(() => consumeRootRecoveryIntent()).not.toThrow();
    expect(rootRecoveryIntent.isRecovery).toBe(false);
    expect(rootRecoveryIntent.isError).toBe(false);
  });
});

// Codex integration-coverage gap (2026-09-15, second pass): the tests above
// exercise computeRootRecoveryIntent as a pure helper only - they do not
// prove the REAL module's own top-level execution order (the actual
// concern the "fresh-link" hardening exists for: does capture genuinely
// happen before the Supabase client is initialized, in this exact file, as
// written - not merely in a helper re-implementation of the same logic).
//
// This proves that ordering directly against the real src/shared/supabase.js
// module: `@supabase/supabase-js`'s createClient is mocked (never a real
// network-touching SDK instance - this repo's own `.env` resolves
// VITE_SUPABASE_URL to a real project, so letting the genuine SDK construct
// and auto-initialize during a test would risk real Auth/network activity,
// which this task's own Production boundary forbids; and none of this
// file's own logic is redefined or duplicated - only the external npm
// package boundary is stubbed). The stub's own implementation clears
// window.location's hash/search INSIDE createClient(), faithfully modeling
// the real SDK's own detectSessionInUrl behavior (consumes/clears the URL
// shortly after client construction) so the test can assert, deterministically
// and without any timing race, that rootRecoveryIntent already reflects the
// PRE-clear location by the time createClient() ever runs - which can only
// be true if capture (module line ~77-79) executes before client
// construction (module line ~91), exactly as the source file's own control
// flow guarantees (both are synchronous top-level statements in file order,
// no `await` between them).
describe('src/shared/supabase.js - real module initialization order (Codex integration gap)', () => {
  afterEach(() => {
    vi.doUnmock('@supabase/supabase-js');
    vi.resetModules();
  });

  it('a recovery URL seeded before import is captured by the real module before its own createClient() call can clear the location', async () => {
    window.history.pushState(null, '', '/#access_token=fake-access-token-value&refresh_token=fake-refresh-token-value&type=recovery');

    let hashSeenInsideCreateClient = null;
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => {
        // Faithful stand-in for the real SDK's own detectSessionInUrl side
        // effect (consumes/clears the URL once the client exists) - moved
        // here, synchronously, specifically so this test can assert the
        // "captured before clear" ordering deterministically rather than
        // trusting an async race against the real SDK.
        hashSeenInsideCreateClient = window.location.hash;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return {
          auth: {
            getSession: () => Promise.resolve({ data: { session: null } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          },
          functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
        };
      }),
    }));

    vi.resetModules();
    const fresh = await import('./supabase');

    // The marker reflects the seeded URL...
    expect(fresh.rootRecoveryIntent.isRecovery).toBe(true);
    expect(fresh.rootRecoveryIntent.isError).toBe(false);
    // ...and it was already captured (the hash was still present) at the
    // moment createClient() ran, proving capture happened first, not after.
    expect(hashSeenInsideCreateClient).toContain('type=recovery');
    // The (simulated, faithful) post-createClient clear did happen, so this
    // is a genuine "captured before clear," not a no-op environment where
    // nothing ever clears the URL at all.
    expect(window.location.hash).toBe('');
    // The marker itself never retained any token material.
    expect(JSON.stringify(fresh.rootRecoveryIntent)).not.toContain('fake-access-token-value');
    expect(JSON.stringify(fresh.rootRecoveryIntent)).not.toContain('fake-refresh-token-value');

    window.history.pushState(null, '', '/');
  });

  it('ordinary (non-recovery) navigation seeded before import leaves the real module\'s marker false', async () => {
    window.history.pushState(null, '', '/');
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: () => Promise.resolve({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      })),
    }));

    vi.resetModules();
    const fresh = await import('./supabase');

    expect(fresh.rootRecoveryIntent.isRecovery).toBe(false);
    expect(fresh.rootRecoveryIntent.isError).toBe(false);
  });
});
