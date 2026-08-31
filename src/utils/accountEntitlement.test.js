import { describe, it, expect } from 'vitest';
import { resolveAccountEntitlement } from './accountEntitlement';

const FIXED_NOW = new Date('2026-08-30T12:00:00.000Z');
const daysFromNow = (days) => new Date(FIXED_NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe('resolveAccountEntitlement — the confirmed Admin bug, regression-locked', () => {
  it('REGRESSION: a self-cancelled FREE account (plan:free, trial_ends_at:null) must resolve to FREE, never PRO/Lifetime', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.badgeState).toBe('FREE');
    expect(r.isLifetime).toBe(false);
  });

  it('REGRESSION: same self-cancelled shape with trial_ends_at undefined (not just null) also resolves to FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: undefined, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isLifetime).toBe(false);
  });

  it('a genuine admin-granted Lifetime PRO account (plan:pro, trial_ends_at:null) resolves to PRO with isLifetime true', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('PRO');
    expect(r.isLifetime).toBe(true);
  });

  it('a hypothetical Lifetime BASIC (plan:basic, trial_ends_at:null) resolves to BASIC with isLifetime true (same rule, not special-cased)', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('basic');
    expect(r.isLifetime).toBe(true);
  });
});

describe('resolveAccountEntitlement — trial lifecycle', () => {
  it('active trial, far from expiring: tier pro, badgeState TRIAL, trialStatus active', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('active');
    expect(r.trialDaysLeft).toBeGreaterThan(5);
  });

  it('active trial, within the expiring-soon window (<=5 days): trialStatus expiringSoon, tier still pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('expiringSoon');
  });

  it('expired trial (past date, not null): tier flips to free, trialStatus expired, badgeState FREE — the core §91 fix, reconfirmed here', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.trialStatus).toBe('expired');
    expect(r.badgeState).toBe('FREE');
    expect(r.isLifetime).toBe(false);
  });

  it('exact boundary (trial_ends_at exactly now) counts as expired', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: FIXED_NOW.toISOString(), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.trialStatus).toBe('expired');
  });

  it('genuine FREE (never trialed) has trialStatus none, not "expired"', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.trialStatus).toBe('none');
  });
});

describe('resolveAccountEntitlement — plan tiers', () => {
  it('FREE resolves correctly with FREE entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
    expect(r.entitlement.editDuplicate).toBe(false);
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
  });

  it('BASIC resolves correctly with BASIC entitlement limits, independent of any trial_ends_at value present', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('basic');
    expect(r.entitlement.monthlyQuoteLimit).toBe(20);
    expect(r.entitlement.editDuplicate).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
    // BASIC's tier is never trial-derived - a stray/legacy trial_ends_at must not produce a trial badge.
    expect(r.trialStatus).toBe('none');
    expect(r.badgeState).toBe('BASIC');
  });

  it('PRO (via active trial) resolves with full PRO entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.editDuplicate).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(true);
    expect(r.entitlement.attachments).toBe(true);
  });

  it('PRO (via Lifetime) resolves with full PRO entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.whatsappDelete).toBe(true);
  });
});

describe('resolveAccountEntitlement — role and legacy-data edge cases', () => {
  it('super_admin always resolves to PRO tier and full entitlement, regardless of stored plan/trial fields', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('PRO');
    expect(r.isSuperAdmin).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(true);
  });

  it('super_admin is never flagged isLifetime (that concept is for ordinary accounts, not the admin role itself)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
  });

  it('malformed/unknown plan value fails safe to FREE-equivalent behavior and is flagged, not silently pretended-known', () => {
    const r = resolveAccountEntitlement({ plan: 'enterprise', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isKnownPlan).toBe(false);
    expect(r.tier).toBe('free');
  });

  it('missing plan value (null) is treated as free and flagged as a known value (matches the DB column default, not a data error)', () => {
    const r = resolveAccountEntitlement({ plan: null, trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isKnownPlan).toBe(true);
  });

  it('is case-insensitive on the raw plan value, same as the underlying resolver', () => {
    const r = resolveAccountEntitlement({ plan: 'PRO', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.rawPlan).toBe('pro');
  });

  it('conflicting legacy state (raw plan free, but a genuinely future trial_ends_at present) resolves defensively to pro, same as the underlying resolver already did before this task', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: daysFromNow(5), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
  });
});

describe('resolveAccountEntitlement — badgeState is a display concept, distinct from tier', () => {
  it('badgeState is FREE for genuine FREE, never TRIAL or PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('FREE');
  });

  it('badgeState is TRIAL (not PRO) for an active trial, even though the underlying tier is pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
  });

  it('badgeState is FREE (not TRIAL, not PRO) once a trial expires', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-1), role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('FREE');
  });

  it('badgeState is PRO (not TRIAL) for a genuine Lifetime grant', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('PRO');
  });
});
