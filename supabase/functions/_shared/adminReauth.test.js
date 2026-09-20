import { describe, it, expect } from 'vitest';
import { canonicalParamsHash } from './adminReauth.ts';

// TEKANGO Admin V1 (Task 3.2): the re-auth proof's entire "bound to these
// exact parameters" guarantee rests on canonicalParamsHash being both
// deterministic (same logical params -> same hash, regardless of key
// order) and discriminating (any real difference in the params -> a
// different hash). Both properties are asserted directly here since they
// are the actual security property, not implementation detail.
describe('canonicalParamsHash', () => {
  it('is deterministic regardless of object key order', async () => {
    const a = await canonicalParamsHash({ reason: 'x', targetPlan: 'pro' });
    const b = await canonicalParamsHash({ targetPlan: 'pro', reason: 'x' });
    expect(a).toBe(b);
  });

  it('produces a different hash for a different reason (a claim attempt with a different reason than it was minted for must fail)', async () => {
    const a = await canonicalParamsHash({ reason: 'legit business need' });
    const b = await canonicalParamsHash({ reason: 'a different reason' });
    expect(a).not.toBe(b);
  });

  it('is a 64-char lowercase hex SHA-256 digest', async () => {
    const hash = await canonicalParamsHash({ reason: 'x' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats null/undefined params consistently, not as a wildcard', async () => {
    const a = await canonicalParamsHash(null);
    const b = await canonicalParamsHash(undefined);
    const c = await canonicalParamsHash({});
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
