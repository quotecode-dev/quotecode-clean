import { describe, it, expect } from 'vitest';
import { computeEffectivePlan } from './planEntitlements';

const FIXED_NOW = new Date('2026-08-30T12:00:00.000Z');
const daysFromNow = (days) => new Date(FIXED_NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe('computeEffectivePlan', () => {
  it('resolves an active trial (raw plan pro, trial_ends_at in the future) to pro', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: daysFromNow(10), now: FIXED_NOW });
    expect(result.effectivePlan).toBe('pro');
    expect(result.isTrialExpired).toBe(false);
    expect(result.trialDaysLeft).toBeGreaterThan(0);
  });

  it('resolves an expired trial (raw plan pro, trial_ends_at in the past) to free - the core fix', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: daysFromNow(-5), now: FIXED_NOW });
    expect(result.effectivePlan).toBe('free');
    expect(result.isTrialExpired).toBe(true);
  });

  it('resolves raw plan free with no trial to free', () => {
    const result = computeEffectivePlan({ plan: 'free', trialEndsAt: null, now: FIXED_NOW });
    expect(result.effectivePlan).toBe('free');
  });

  it('resolves raw plan basic to basic unconditionally (never trial-produced, always a deliberate admin assignment)', () => {
    const result = computeEffectivePlan({ plan: 'basic', trialEndsAt: null, now: FIXED_NOW });
    expect(result.effectivePlan).toBe('basic');
  });

  it('resolves raw plan basic to basic even with a past trial_ends_at present (basic is never trial-derived)', () => {
    const result = computeEffectivePlan({ plan: 'basic', trialEndsAt: daysFromNow(-30), now: FIXED_NOW });
    expect(result.effectivePlan).toBe('basic');
  });

  it('resolves raw plan pro with trial_ends_at null to pro (Lifetime-grant / explicit admin PRO assignment, never trial-produced)', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: null, now: FIXED_NOW });
    expect(result.effectivePlan).toBe('pro');
  });

  it('resolves raw plan pro with trial_ends_at undefined to pro (same as null)', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: undefined, now: FIXED_NOW });
    expect(result.effectivePlan).toBe('pro');
  });

  it('treats the exact boundary (trial_ends_at exactly now) as expired', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: FIXED_NOW.toISOString(), now: FIXED_NOW });
    expect(result.isTrialExpired).toBe(true);
    expect(result.effectivePlan).toBe('free');
  });

  it('treats one full day remaining as still active', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: daysFromNow(1), now: FIXED_NOW });
    expect(result.isTrialExpired).toBe(false);
    expect(result.effectivePlan).toBe('pro');
  });

  it('treats one second past the boundary as expired', () => {
    const oneSecondAgo = new Date(FIXED_NOW.getTime() - 1000).toISOString();
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: oneSecondAgo, now: FIXED_NOW });
    expect(result.isTrialExpired).toBe(true);
    expect(result.effectivePlan).toBe('free');
  });

  it('does not crash on a malformed trial_ends_at string and fails safe (treats as no trial signal)', () => {
    const result = computeEffectivePlan({ plan: 'pro', trialEndsAt: 'not-a-real-date', now: FIXED_NOW });
    expect(result.isTrialExpired).toBe(false);
    expect(result.trialDaysLeft).toBe(null);
    // rawPlan stays 'pro' and the malformed date is not treated as a real expiry signal -
    // effectivePlan resolves via the pro branch's !isTrialExpired path, i.e. still 'pro'.
    // This preserves today's fail-safe (non-crashing) behavior for malformed data; it does
    // not newly invent expiry detection for corrupt values, which is out of this task's scope.
    expect(result.effectivePlan).toBe('pro');
  });

  it('treats a missing plan value as free (matches the DB column default)', () => {
    const result = computeEffectivePlan({ plan: null, trialEndsAt: null, now: FIXED_NOW });
    expect(result.effectivePlan).toBe('free');
  });

  it('is case-insensitive on the raw plan value', () => {
    const result = computeEffectivePlan({ plan: 'PRO', trialEndsAt: daysFromNow(10), now: FIXED_NOW });
    expect(result.effectivePlan).toBe('pro');
  });

  it('resolves raw plan free with a genuinely still-future trial_ends_at to pro (defensive symmetry, same as before this fix)', () => {
    const result = computeEffectivePlan({ plan: 'free', trialEndsAt: daysFromNow(5), now: FIXED_NOW });
    expect(result.effectivePlan).toBe('pro');
  });
});
