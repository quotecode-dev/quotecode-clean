import { describe, it, expect } from 'vitest';
import { classifyQuoteApprovalError } from './quoteApprovalErrorClassification';

describe('classifyQuoteApprovalError', () => {
  it('classifies the owner-cannot-self-approve RPC error (the corrected, narrower contract)', () => {
    const msg = "Not permitted: the quote's own business account cannot approve or sign it on the customer's behalf";
    expect(classifyQuoteApprovalError(msg, true)).toEqual({
      category: 'owner_cannot_self_approve',
      userMessage: '❌ לא ניתן לחתום על הצעה זו מחשבון העסק ששלח אותה. אם את/ה הלקוח/ה, יש להיכנס עם החשבון שלך או בגלישה אנונימית.',
    });
    expect(classifyQuoteApprovalError(msg, false).category).toBe('owner_cannot_self_approve');
  });

  it('still classifies the OLD (pre-2026-09-09) RPC error text the same way, for a stale/already-open client', () => {
    const oldMsg = "Not permitted: a ProFlow business account cannot approve or sign a quote on the customer's behalf";
    expect(classifyQuoteApprovalError(oldMsg, true).category).toBe('owner_cannot_self_approve');
  });

  it('classifies "quote not found or cannot be approved" as already-approved/unavailable', () => {
    const result = classifyQuoteApprovalError('Quote not found or cannot be approved', true);
    expect(result.category).toBe('already_approved_or_unavailable');
  });

  it('classifies invalid/missing/oversized signature errors as invalid_signature', () => {
    expect(classifyQuoteApprovalError('Invalid signature format', false).category).toBe('invalid_signature');
    expect(classifyQuoteApprovalError('Missing signature', false).category).toBe('invalid_signature');
    expect(classifyQuoteApprovalError('Signature payload too large', false).category).toBe('invalid_signature');
  });

  it('falls back to the generic message for an unrecognized error', () => {
    const result = classifyQuoteApprovalError('some unexpected database error', true);
    expect(result.category).toBe('unknown_error');
    expect(result.userMessage).toBe('❌ לא הצלחנו לאשר את ההצעה. נסו שוב בעוד רגע.');
  });

  it('falls back to the generic message for a missing/empty error', () => {
    expect(classifyQuoteApprovalError(undefined, false).category).toBe('unknown_error');
    expect(classifyQuoteApprovalError('', true).category).toBe('unknown_error');
  });

  it('returns the English variant when isHebrew is false', () => {
    const result = classifyQuoteApprovalError('Quote not found or cannot be approved', false);
    expect(result.userMessage).toMatch(/no longer be approved/);
  });
});
