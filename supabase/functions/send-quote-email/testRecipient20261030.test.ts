// Codex release 9, L-13 (Owner console 2026-10-30, typed: "... L-13 רק לחסימת הנמען של חשבונות הבדיקה בשחרור 9 ..."): a registered
// LIVE-check test account emails a quote only to its own test mailbox - the refusal comes before the send is reserved or the provider
// called, an unreadable answer sends nothing, and the screen says it in Hebrew and English. Every other account is unchanged
// (live_check_recipient_allowed = true for it; DB test 448 P5-P7).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEST_RECIPIENT } from './sendLedger.ts';
import { classifyQuoteEmailError } from '../../../src/utils/quoteEmailErrorClassification.js';

describe('the test-recipient refusal', () => {
  const src = readFileSync('supabase/functions/send-quote-email/index.ts', 'utf8').replace(/\r\n/g, '\n');
  it('is checked before the reservation and the provider call', () => {
    const guard = src.indexOf("rpc('live_check_recipient_allowed', { p_user: callerUser.id, p_recipient: clientEmail })");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(src.indexOf("rpc('quote_email_reserve'"));
    expect(guard).toBeLessThan(src.indexOf("fetch('https://api.resend.com/emails'"));
    expect(src).toContain('if (recipientErr) throw new EmailRefusal(UNVERIFIED)');
    expect(src).toContain('if (recipientAllowed !== true) throw new EmailRefusal(TEST_RECIPIENT)');
  });
  it('the screen names it, in both languages', () => {
    expect(classifyQuoteEmailError(TEST_RECIPIENT, true).userMessage).toBe('❌ המייל לא נשלח: חשבון בדיקה שולח הצעות רק לכתובת הבדיקה הרשומה שלו.');
    expect(classifyQuoteEmailError(TEST_RECIPIENT, false).userMessage).toBe('❌ The email was not sent: a test account sends quotes only to its registered test address.');
  });
});
