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

describe('normalizeAuthError - password reuse (Password Recovery Fresh-Link + Error-Classification Fix, 2026-09-15)', () => {
  // Supabase/GoTrue's own documented updateUser() behavior: rejecting a new
  // password identical to the account's current one returns this exact
  // code/message pair. Live re-reproduction inside this task was blocked by
  // this session's own credential-write safety gate - see the classifier's
  // own comment for the full disclosure.
  const sameCodeError = { code: 'same_password', message: 'New password should be different from the old password.' };

  it('the real Supabase code+message pair maps to password_reuse, not weak_password', () => {
    const { category } = normalizeAuthError(sameCodeError, false);
    expect(category).toBe('password_reuse');
    expect(category).not.toBe('weak_password');
  });

  it('HE message is the exact curated reuse text', () => {
    const { message } = normalizeAuthError(sameCodeError, true);
    expect(message).toBe('❌ כבר השתמשת בסיסמה הזו בעבר. יש לבחור סיסמה אחרת.');
  });

  it('EN message is the exact curated reuse text', () => {
    const { message } = normalizeAuthError(sameCodeError, false);
    expect(message).toBe('❌ You have used this password before. Please choose a different password.');
  });

  it('classifies correctly by message text alone, even without the code field (defensive - provider message wording is the fallback signal)', () => {
    const messageOnlyError = { message: 'New password should be different from the old password.' };
    expect(normalizeAuthError(messageOnlyError, false).category).toBe('password_reuse');
  });

  it('a genuinely weak (not reused) password is never swallowed by the reuse branch', () => {
    const weak = { message: 'Password should be at least 6 characters' };
    const { category } = normalizeAuthError(weak, false);
    expect(category).toBe('weak_password');
    expect(category).not.toBe('password_reuse');
  });

  it('the pre-existing weak-password test still passes unchanged (precedence regression guard)', () => {
    const err = { message: 'Password should be at least 6 characters' };
    expect(normalizeAuthError(err, false).category).toBe('weak_password');
    expect(normalizeAuthError(err, true).category).toBe('weak_password');
  });

  it('reuse rejection cannot be swallowed by the broader weak-password substring rule (the exact live-reported defect)', () => {
    // Both messages contain "should be" - proves ordering, not substring
    // specificity, is what prevents the misclassification.
    expect(sameCodeError.message).toMatch(/should be/i);
    expect(normalizeAuthError(sameCodeError, false).category).toBe('password_reuse');
  });

  it('an unrelated unknown provider error remains sanitized, never raw object/JSON leakage', () => {
    const weird = { code: 'some_other_code', message: 'Some completely different provider message' };
    const { category, message } = normalizeAuthError(weird, false);
    expect(category).toBe('auth_provider_message');
    expect(message).not.toMatch(/\{|\}/);
  });
});

describe('normalizeAuthError - password reuse negative controls (Codex NO-GO remediation, 2026-09-15, second pass)', () => {
  // Codex finding: the original message fallback (`different from the old`,
  // `(?:same|identical) as.*(?:old|current|previous)`) was not
  // password-qualified, so a structurally identical rejection about a
  // DIFFERENT field (email, username, any other value) also matched and was
  // misclassified as password_reuse. Every case below asserts the exact
  // actual category (not merely "not password_reuse"), proving these fall
  // through to the same safe, curated auth_provider_message passthrough any
  // other unrecognized-but-readable provider message gets - never raw
  // object/JSON leakage, and never a password-specific message shown for a
  // non-password field.

  it('the real Supabase code+message pair still maps to password_reuse (positive control, unchanged)', () => {
    const err = { code: 'same_password', message: 'New password should be different from the old password.' };
    expect(normalizeAuthError(err, false).category).toBe('password_reuse');
  });

  it('a password-qualified message fallback without the code field still maps to password_reuse', () => {
    const err = { message: 'New password is the same as current password.' };
    expect(normalizeAuthError(err, false).category).toBe('password_reuse');
  });

  it('a genuine weak password still maps to weak_password', () => {
    const err = { message: 'Password should be at least 6 characters' };
    expect(normalizeAuthError(err, false).category).toBe('weak_password');
  });

  it('a genuine expired/invalid recovery session still maps to invalid_or_expired_recovery_session', () => {
    const err = { message: 'Auth session missing!' };
    expect(normalizeAuthError(err, false).category).toBe('invalid_or_expired_recovery_session');
  });

  it('"New email should be different from the old email." is NOT password_reuse - it is the generic provider-message passthrough', () => {
    const err = { message: 'New email should be different from the old email.' };
    const { category, message } = normalizeAuthError(err, false);
    expect(category).toBe('auth_provider_message');
    expect(category).not.toBe('password_reuse');
    expect(message).not.toMatch(/password/i);
  });

  it('"Email is the same as current email." is NOT password_reuse - it is the generic provider-message passthrough', () => {
    const err = { message: 'Email is the same as current email.' };
    const { category, message } = normalizeAuthError(err, false);
    expect(category).toBe('auth_provider_message');
    expect(category).not.toBe('password_reuse');
    expect(message).not.toMatch(/password/i);
  });

  it('"Username is the same as current username." is NOT password_reuse', () => {
    const err = { message: 'Username is the same as current username.' };
    expect(normalizeAuthError(err, false).category).toBe('auth_provider_message');
  });

  it('"New value should be different from the old value." is NOT password_reuse (generic, unqualified field)', () => {
    const err = { message: 'New value should be different from the old value.' };
    expect(normalizeAuthError(err, false).category).toBe('auth_provider_message');
  });

  it('"Current email already used." is NOT password_reuse', () => {
    const err = { message: 'Current email already used.' };
    expect(normalizeAuthError(err, false).category).toBe('auth_provider_message');
  });

  it('an additional generic non-password "different from old/current" case is NOT password_reuse', () => {
    const err = { message: 'New name should be different from the old name.' };
    const { category } = normalizeAuthError(err, false);
    expect(category).toBe('auth_provider_message');
    expect(category).not.toBe('password_reuse');
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
