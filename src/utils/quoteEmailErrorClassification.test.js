import { describe, it, expect } from 'vitest';
import { classifyQuoteEmailError } from './quoteEmailErrorClassification';

// LIVE Admin Email Failure root-cause task (2026-09-08): the pre-fix
// behavior collapsed every send-quote-email failure into one indistinguishable
// generic message. These tests lock the classifier's mapping from the Edge
// Function's own real error strings (see supabase/functions/send-quote-email/
// index.ts) to distinct, safe-to-display categories/messages, per role/cause.

describe('classifyQuoteEmailError - known server messages map to distinct categories', () => {
  it('the ownership-mismatch 403 maps to "unauthorized", never the generic message', () => {
    const { category, userMessage } = classifyQuoteEmailError('Forbidden: you may only send your own quote', false);
    expect(category).toBe('unauthorized');
    expect(userMessage).toMatch(/permission/i);
  });

  it('an expired/missing session maps to "session_expired"', () => {
    expect(classifyQuoteEmailError('Invalid or expired session', false).category).toBe('session_expired');
    expect(classifyQuoteEmailError('Missing Authorization header', false).category).toBe('session_expired');
  });

  it('a deleted/missing quote maps to "quote_not_found"', () => {
    const { category } = classifyQuoteEmailError('Quote not found - refusing to send without a verified region/currency.', false);
    expect(category).toBe('quote_not_found');
  });

  it('a client with no email on file maps to "invalid_recipient"', () => {
    const { category } = classifyQuoteEmailError('No client email on file for this quote - refusing to send.', false);
    expect(category).toBe('invalid_recipient');
  });

  it('a missing RESEND_API_KEY or unresolvable business region maps to "sender_configuration"', () => {
    expect(classifyQuoteEmailError('Missing RESEND_API_KEY environment variable', false).category).toBe('sender_configuration');
    expect(classifyQuoteEmailError('Cannot verify quote region/currency against the database - refusing to send email.', false).category).toBe('sender_configuration');
    expect(classifyQuoteEmailError('Cannot establish a trustworthy business region/currency for this quote - refusing to send email.', false).category).toBe('sender_configuration');
  });
});

describe('classifyQuoteEmailError - unrecognized real server responses vs true network failures', () => {
  it('an unrecognized but real server message (e.g. a raw Resend rejection) maps to "resend_rejected", not "unknown"', () => {
    const { category } = classifyQuoteEmailError('domain is not verified', false, { hadReadableServerResponse: true });
    expect(category).toBe('resend_rejected');
  });

  it('no readable server response at all (true network/invocation failure) maps to "network_error"', () => {
    const { category, userMessage } = classifyQuoteEmailError('', false, { hadReadableServerResponse: false });
    expect(category).toBe('network_error');
    expect(userMessage).toMatch(/reach|connection/i);
  });
});

describe('classifyQuoteEmailError - HE/EN parity', () => {
  it('every category has a distinct, non-empty message in both languages', () => {
    const messages = ['Forbidden: you may only send your own quote', 'Invalid or expired session', 'Quote not found', 'No client email on file for this quote', 'Missing RESEND_API_KEY environment variable'];
    for (const msg of messages) {
      const he = classifyQuoteEmailError(msg, true);
      const en = classifyQuoteEmailError(msg, false);
      expect(he.category).toBe(en.category);
      expect(he.userMessage).toBeTruthy();
      expect(en.userMessage).toBeTruthy();
      expect(he.userMessage).not.toBe(en.userMessage);
    }
  });

  it('never leaks the raw internal server string as the user-facing message', () => {
    const raw = 'Missing RESEND_API_KEY environment variable';
    const { userMessage } = classifyQuoteEmailError(raw, false);
    expect(userMessage).not.toContain('RESEND_API_KEY');
  });
});
