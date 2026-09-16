import { describe, it, expect } from 'vitest';
import { computeRootSignupIntent, consumeRootSignupIntent, rootSignupIntent } from './supabase';

// Signup Callback Fix (2026-09-16, TEST-only task): a fresh signup-
// confirmation link's callback can land on bare "/" instead of the
// requested /dashboard?lang=he|en (same Supabase redirect-URL allowlist
// mechanism already documented for rootRecoveryIntent - see that marker's
// own sibling test file, supabase.rootRecoveryIntent.test.js, and
// AppLocal.jsx/AppGlobal.jsx's own "/" route comment). Before this fix, the
// "/" route had NO fallback at all for type=signup, so a successfully-
// verified signup silently mounted the public landing page. These tests
// exercise computeRootSignupIntent directly, mirroring the recovery
// marker's own test shape exactly.
describe('computeRootSignupIntent - pure capture logic', () => {
  it('detects a genuine signup-confirmation hash fragment', () => {
    const result = computeRootSignupIntent({ hash: '#access_token=abc123&type=signup&expires_in=3600', search: '' });
    expect(result.isSignup).toBe(true);
  });

  it('detects a genuine signup signal carried in the query string instead of the hash', () => {
    const result = computeRootSignupIntent({ hash: '', search: '?type=signup' });
    expect(result.isSignup).toBe(true);
  });

  it('ordinary navigation (no hash, no search) is not signup intent', () => {
    const result = computeRootSignupIntent({ hash: '', search: '' });
    expect(result.isSignup).toBe(false);
  });

  it('a recovery link (type=recovery) is not misdetected as signup intent - the two markers are independent', () => {
    const result = computeRootSignupIntent({ hash: '#access_token=abc123&type=recovery', search: '' });
    expect(result.isSignup).toBe(false);
  });

  it('an ordinary query string unrelated to signup (e.g. ?signup=true, the pre-existing manual-signup-form toggle) is not misdetected', () => {
    const result = computeRootSignupIntent({ hash: '', search: '?signup=true' });
    expect(result.isSignup).toBe(false);
  });

  it('never inspects or returns any token/session material - only the one boolean', () => {
    const result = computeRootSignupIntent({ hash: '#access_token=super-secret-token-value&refresh_token=another-secret&type=signup', search: '' });
    expect(Object.keys(result)).toEqual(['isSignup']);
    expect(JSON.stringify(result)).not.toContain('super-secret-token-value');
    expect(JSON.stringify(result)).not.toContain('another-secret');
  });

  it('defaults missing arguments to empty strings without throwing', () => {
    expect(() => computeRootSignupIntent()).not.toThrow();
    expect(computeRootSignupIntent()).toEqual({ isSignup: false });
  });
});

describe('rootSignupIntent / consumeRootSignupIntent - marker lifecycle', () => {
  it('consumeRootSignupIntent clears the flag on the shared marker object', () => {
    rootSignupIntent.isSignup = true;
    consumeRootSignupIntent();
    expect(rootSignupIntent.isSignup).toBe(false);
  });

  it('is safe to call repeatedly (idempotent)', () => {
    consumeRootSignupIntent();
    expect(() => consumeRootSignupIntent()).not.toThrow();
    expect(rootSignupIntent.isSignup).toBe(false);
  });
});
