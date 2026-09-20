import { describe, it, expect } from 'vitest';
import { computeEffectivePlan as edgeComputeEffectivePlan, resolveAccountEntitlement as edgeResolveAccountEntitlement, buildVerifiedAccountContext, isHebrewFromMarket } from './accountContext.ts';
import { computeEffectivePlan as realComputeEffectivePlan } from '../../../src/utils/planEntitlements.js';
import { resolveAccountEntitlement as realResolveAccountEntitlement } from '../../../src/utils/accountEntitlement.js';

// AI Chat Gate 2, §5.2/§14: proves the Edge Function's ported entitlement
// logic never drifts from the one real canonical authority
// (planEntitlements.js/accountEntitlement.js) across a wide fixture matrix -
// not just a single happy-path check.

const NOW = new Date('2026-09-15T00:00:00.000Z');
const iso = (daysFromNow) => new Date(NOW.getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

const FIXTURES = [
  { plan: 'free', trialEndsAt: null, role: 'user', isLifetime: false },
  { plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: false },
  { plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false },
  { plan: 'pro', trialEndsAt: iso(10), role: 'user', isLifetime: false },
  { plan: 'pro', trialEndsAt: iso(3), role: 'user', isLifetime: false }, // expiringSoon
  { plan: 'pro', trialEndsAt: iso(-1), role: 'user', isLifetime: false }, // expired -> free
  { plan: 'free', trialEndsAt: iso(5), role: 'user', isLifetime: false }, // legacy-shape active trial
  { plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true }, // Lifetime
  { plan: 'free', trialEndsAt: iso(-5), role: 'user', isLifetime: true }, // Lifetime overrides everything
  { plan: 'basic', trialEndsAt: null, role: 'super_admin', isLifetime: false },
  { plan: null, trialEndsAt: null, role: null, isLifetime: null }, // unknown/missing everything
  { plan: 'PRO', trialEndsAt: iso(1), role: 'user', isLifetime: false }, // case-insensitive plan
];

describe('accountContext.ts parity with the real canonical entitlement authority', () => {
  it('computeEffectivePlan matches planEntitlements.js exactly across every fixture', () => {
    for (const f of FIXTURES) {
      const real = realComputeEffectivePlan({ plan: f.plan, trialEndsAt: f.trialEndsAt, now: NOW });
      const edge = edgeComputeEffectivePlan({ plan: f.plan, trialEndsAt: f.trialEndsAt, now: NOW });
      expect(edge, JSON.stringify(f)).toEqual(real);
    }
  });

  it('resolveAccountEntitlement matches accountEntitlement.js exactly (tier/isLifetime/trialStatus) across every fixture', () => {
    for (const f of FIXTURES) {
      const real = realResolveAccountEntitlement({ plan: f.plan, trialEndsAt: f.trialEndsAt, role: f.role, isLifetime: f.isLifetime, now: NOW });
      const edge = edgeResolveAccountEntitlement({ plan: f.plan, trialEndsAt: f.trialEndsAt, role: f.role, isLifetime: f.isLifetime, now: NOW });
      expect(edge.tier, JSON.stringify(f)).toBe(real.tier);
      expect(edge.isLifetime, JSON.stringify(f)).toBe(real.isLifetime);
      expect(edge.trialStatus, JSON.stringify(f)).toBe(real.trialStatus);
      expect(edge.trialDaysLeft, JSON.stringify(f)).toBe(real.trialDaysLeft);
    }
  });
});

describe('buildVerifiedAccountContext - minimal safe field allowlist', () => {
  // AI Chat Hardening overnight task, Track C/I correction: "Unknown/absent
  // market must NOT silently become International" - a brand-new/mid-
  // onboarding account (no business_settings row yet) must resolve to the
  // explicit 'Unknown' state, never silently guessed as either real market.
  it('derives market from country exactly, and resolves an unknown/missing value to the explicit "Unknown" state (never silently International)', () => {
    expect(buildVerifiedAccountContext({ country: 'Local' }, null, NOW).market).toBe('Local');
    expect(buildVerifiedAccountContext({ country: 'International' }, null, NOW).market).toBe('International');
    expect(buildVerifiedAccountContext({}, null, NOW).market).toBe('Unknown');
    expect(buildVerifiedAccountContext(null, null, NOW).market).toBe('Unknown');
    expect(buildVerifiedAccountContext({ country: 'something-unexpected' }, null, NOW).market).toBe('Unknown');
  });

  it('an expired trial resolves to tier "free", never described as pro', () => {
    const ctx = buildVerifiedAccountContext({ plan: 'pro', trial_ends_at: iso(-3), country: 'Local' }, null, NOW);
    expect(ctx.tier).toBe('free');
    expect(ctx.trialStatus).toBe('expired');
  });

  it('Lifetime resolves consistently regardless of the raw plan column', () => {
    const ctx = buildVerifiedAccountContext({ plan: 'free', is_lifetime: true, country: 'International' }, null, NOW);
    expect(ctx.isLifetime).toBe(true);
    expect(ctx.tier).toBe('free'); // tier itself is the raw effective plan; isLifetime is the separate, authoritative upgrade signal (matches the real resolver's own contract)
  });

  it('never includes role, business name, tax id, address, phone, or any other non-allowlisted field on the returned object', () => {
    const ctx = buildVerifiedAccountContext({ plan: 'pro', role: 'super_admin', country: 'Local', business_name: 'Acme', tax_id: '123', phone: '0501234567' }, 'main', NOW);
    expect(Object.keys(ctx).sort()).toEqual(['currentArea', 'isLifetime', 'market', 'tier', 'trialStatus']);
  });

  it('carries the allowlisted currentArea through unchanged', () => {
    expect(buildVerifiedAccountContext({}, 'clients', NOW).currentArea).toBe('clients');
    expect(buildVerifiedAccountContext({}, null, NOW).currentArea).toBeNull();
  });
});

describe('isHebrewFromMarket - server-derived language policy for authenticated requests', () => {
  it('Local market locks Hebrew', () => {
    expect(isHebrewFromMarket('Local')).toBe(true);
  });
  it('International market locks English', () => {
    expect(isHebrewFromMarket('International')).toBe(false);
  });
  it('Unknown market uses the caller-supplied fallback for reply LANGUAGE only (never asserts a commercial market)', () => {
    expect(isHebrewFromMarket('Unknown', true)).toBe(true);
    expect(isHebrewFromMarket('Unknown', false)).toBe(false);
  });
  it('Unknown market with no fallback argument defaults safely to false (English), never throws', () => {
    expect(isHebrewFromMarket('Unknown')).toBe(false);
  });
  it('a confirmed Local/International market is never overridden by the fallback argument', () => {
    expect(isHebrewFromMarket('Local', false)).toBe(true);
    expect(isHebrewFromMarket('International', true)).toBe(false);
  });
});
