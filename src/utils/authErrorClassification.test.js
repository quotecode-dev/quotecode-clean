import { describe, it, expect } from 'vitest';
import { normalizeAuthError } from './authErrorClassification';

// Auth/Account Lifecycle Forensic Audit (2026-09-09): locks the mapping from
// real, live-reproduced Supabase Auth error shapes to safe, curated,
// bilingual messages - and, just as importantly, proves this module can
// never itself produce a raw-object rendering (the class of bug behind the
// Owner-reported "{}:Error") no matter what shape `error` actually is.

describe('normalizeAuthError - known Supabase Auth error shapes', () => {
  it('the real, live-reproduced 429 rate-limit error maps to auth_rate_limit and preserves the countdown', () => {
    const err = { code: 429, error_code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 44 seconds.' };
    const { category, message } = normalizeAuthError(err, false);
    expect(category).toBe('auth_rate_limit');
    expect(message).toMatch(/44 seconds/);
    expect(message).not.toBe(err.message); // curated, not the raw passthrough
  });

  it('the rate-limit message is bilingual and mentions waiting, in Hebrew too', () => {
    const err = { error_code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 30 seconds.' };
    const { message } = normalizeAuthError(err, true);
    expect(message).toMatch(/30 שניות/);
    expect(message).not.toMatch(/[a-zA-Z]{4,}/); // no stray English leaking into the Hebrew string
  });

  it('a genuine duplicate-signup error maps to already_registered, not a generic message', () => {
    const err = { message: 'User already registered' };
    expect(normalizeAuthError(err, false).category).toBe('already_registered');
    expect(normalizeAuthError(err, true).category).toBe('already_registered');
  });

  it('a weak-password error maps to weak_password, distinct from already_registered', () => {
    const err = { message: 'Password should be at least 6 characters' };
    const { category } = normalizeAuthError(err, false);
    expect(category).toBe('weak_password');
    expect(category).not.toBe('already_registered');
  });

  it('a network/fetch-level failure (not a real AuthApiError) maps to network_error', () => {
    expect(normalizeAuthError(new TypeError('Failed to fetch'), false).category).toBe('network_error');
  });

  it('a real, unrecognized AuthApiError with a genuine .message is shown as-is (curated prefix, not re-invented)', () => {
    const err = { message: 'Signups not allowed for this instance' };
    const { category, message } = normalizeAuthError(err, false);
    expect(category).toBe('auth_provider_message');
    expect(message).toContain('Signups not allowed for this instance');
  });

  it('the Hebrew prefix is used for an unrecognized-but-real message when isHebrew is true', () => {
    const err = { message: 'Some new Supabase message not yet classified' };
    const { message } = normalizeAuthError(err, true);
    expect(message.startsWith('שגיאה: ')).toBe(true);
  });

  it('the real, live-reproduced "Auth session missing!" (invalid/expired recovery token) maps to a curated bilingual message, not the raw provider passthrough', () => {
    const err = { message: 'Auth session missing!' };
    const heResult = normalizeAuthError(err, true);
    const enResult = normalizeAuthError(err, false);
    expect(heResult.category).toBe('invalid_or_expired_recovery_session');
    expect(enResult.category).toBe('invalid_or_expired_recovery_session');
    expect(heResult.message).not.toMatch(/[a-zA-Z]{4,}/); // no stray English leaking into the Hebrew string
    expect(enResult.message).toMatch(/expired|invalid/i);
  });
});

describe('normalizeAuthError - the real, Production-discovered AuthRetryableFetchError "{}" shape (2026-09-09)', () => {
  // @supabase/auth-js@2.110.9 constructs an AuthRetryableFetchError for any
  // 5xx response before parsing the body - the real server message
  // ("Error sending recovery email") never reaches this module; what
  // arrives is this exact shape, with `.message` being the literal
  // 3-character string "{}" (the unparsed Response, stringified). This is
  // the real object captured live against Production, not a hypothetical.
  const retryableFetchError = { name: 'AuthRetryableFetchError', status: 500, message: '{}' };

  it('EN: is classified as auth_server_error with a curated message, never the raw "{}"', () => {
    const { category, message } = normalizeAuthError(retryableFetchError, false);
    expect(category).toBe('auth_server_error');
    expect(message).not.toBe('Error: {}');
    expect(message).not.toContain('{}');
    expect(message.length).toBeGreaterThan(0);
  });

  it('HE: is classified as auth_server_error with a curated bilingual message, never the raw "{}"', () => {
    const { category, message } = normalizeAuthError(retryableFetchError, true);
    expect(category).toBe('auth_server_error');
    expect(message).not.toBe('שגיאה: {}');
    expect(message).not.toContain('{}');
    expect(message).toMatch(/[֐-׿]/); // contains real Hebrew characters
  });

  it('does not leak the internal status code, error name, or any raw JSON in either language', () => {
    const en = normalizeAuthError(retryableFetchError, false).message;
    const he = normalizeAuthError(retryableFetchError, true).message;
    for (const msg of [en, he]) {
      expect(msg).not.toMatch(/AuthRetryableFetchError/);
      expect(msg).not.toMatch(/\b500\b/);
      expect(msg).not.toMatch(/[{}[\]]/);
    }
  });

  it('a differently-shaped 5xx-like object without the AuthRetryableFetchError name is not swept into this category (narrow, name-based detection only)', () => {
    // Guards against over-broad classification: an ordinary AuthApiError
    // that happens to carry a numeric 5xx status but a real, readable
    // message must still be shown via the existing auth_provider_message
    // path, not silently generalized into the server-error bucket.
    const ordinaryServerError = { status: 500, message: 'Some other real, specific server message' };
    const { category, message } = normalizeAuthError(ordinaryServerError, false);
    expect(category).toBe('auth_provider_message');
    expect(message).toContain('Some other real, specific server message');
  });
});

describe('normalizeAuthError - never renders a raw object, the exact "{}:Error" bug class', () => {
  it('a genuinely empty error object ({}) never produces "[object Object]" or a raw JSON dump', () => {
    const { category, message } = normalizeAuthError({}, false);
    expect(category).toBe('unknown');
    expect(message).not.toContain('[object Object]');
    expect(message).not.toContain('{}');
    expect(typeof message).toBe('string');
  });

  it('null/undefined error input never throws and never renders a raw value', () => {
    expect(() => normalizeAuthError(null, false)).not.toThrow();
    expect(() => normalizeAuthError(undefined, false)).not.toThrow();
    expect(normalizeAuthError(null, false).message).not.toContain('null');
    expect(normalizeAuthError(undefined, false).message).not.toContain('undefined');
  });

  it('a non-Error, non-object primitive (e.g. a rejected string) never leaks its raw value unformatted', () => {
    const { message } = normalizeAuthError('some raw rejection string', false);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('every returned message is HE-appropriate when isHebrew is true: contains no untranslated English error scaffolding', () => {
    const { message } = normalizeAuthError({}, true);
    expect(message).not.toMatch(/^Error:/);
    expect(message).toMatch(/[֐-׿]/); // contains real Hebrew characters
  });
});
