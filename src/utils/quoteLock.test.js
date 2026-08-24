import { describe, it, expect } from 'vitest';
import { isQuoteImmutable } from './quoteLock';

describe('isQuoteImmutable', () => {
  it('returns false for a pending quote', () => {
    expect(isQuoteImmutable({ status: 'pending', signature: null })).toBe(false);
  });

  it('returns false for a draft quote', () => {
    expect(isQuoteImmutable({ status: 'draft', signature: null })).toBe(false);
  });

  it('returns true for an approved quote', () => {
    expect(isQuoteImmutable({ status: 'approved', signature: null })).toBe(true);
  });

  it('returns true for an approved quote regardless of status casing', () => {
    expect(isQuoteImmutable({ status: 'APPROVED', signature: null })).toBe(true);
  });

  it('returns true for a paid quote', () => {
    expect(isQuoteImmutable({ status: 'paid', signature: null })).toBe(true);
  });

  it('returns true for a paid quote regardless of status casing', () => {
    expect(isQuoteImmutable({ status: 'Paid', signature: null })).toBe(true);
  });

  it('returns true when a signature exists even if status is unrelated', () => {
    expect(isQuoteImmutable({ status: 'pending', signature: 'data:image/png;base64,abc' })).toBe(true);
  });

  it('returns false when signature is an empty string and status is not immutable', () => {
    expect(isQuoteImmutable({ status: 'pending', signature: '' })).toBe(false);
  });

  it('returns false for a null quote', () => {
    expect(isQuoteImmutable(null)).toBe(false);
  });

  it('returns false for an undefined quote', () => {
    expect(isQuoteImmutable(undefined)).toBe(false);
  });

  it('returns false for a quote with no status and no signature', () => {
    expect(isQuoteImmutable({})).toBe(false);
  });
});
