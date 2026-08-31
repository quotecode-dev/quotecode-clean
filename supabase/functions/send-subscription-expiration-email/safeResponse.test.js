import { describe, it, expect } from 'vitest';
import { buildSubscriptionEmailSafeResponse } from './safeResponse.ts';

describe('buildSubscriptionEmailSafeResponse', () => {
  it('REGRESSION: missing subscription schema safety — never claims a send, never throws', () => {
    const res = buildSubscriptionEmailSafeResponse();
    expect(res.success).toBe(true);
    expect(res.sent3d).toBe(0);
    expect(res.sent24h).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.skipped).toBe(true);
  });

  it('REGRESSION: a healthy auto-renewing subscriber must never be treated as naturally expiring — the response carries no per-user send at all', () => {
    const res = buildSubscriptionEmailSafeResponse();
    expect(res.sent3d + res.sent24h).toBe(0);
  });

  it('documents the exact reason for future maintainers', () => {
    const res = buildSubscriptionEmailSafeResponse();
    expect(res.reason).toMatch(/schema not yet implemented/);
  });
});
