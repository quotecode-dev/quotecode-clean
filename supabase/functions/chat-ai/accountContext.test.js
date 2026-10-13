import { describe, it, expect } from 'vitest';
import { computeEffectivePlan as edgeComputeEffectivePlan, resolveAccountEntitlement as edgeResolveAccountEntitlement, buildVerifiedAccountContext, isHebrewFromMarket } from './accountContext.ts';
import { computeEffectivePlan as realComputeEffectivePlan } from '../../../src/utils/planEntitlements.js';
import { resolveAccountEntitlement as realResolveAccountEntitlement } from '../../../src/utils/accountEntitlement.js';
import { buildSystemPrompt } from './validation.ts';

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

// The parity matrix above proves edge == real; these pin the VALUES at each entitlement boundary, so a change applied to
// both copies at once (parity still green) can never silently move a trial edge or upgrade an account the assistant describes.
describe('entitlement boundaries the assistant states as account facts', () => {
  it('a trial ending exactly now is expired (0 days left, tier free); one millisecond later it is still a running trial', () => {
    const atNow = edgeResolveAccountEntitlement({ plan: 'pro', trialEndsAt: NOW.toISOString(), role: 'user', isLifetime: false, now: NOW });
    expect(atNow).toMatchObject({ tier: 'free', trialStatus: 'expired', trialDaysLeft: 0, isTrialExpired: true });
    const justAfter = edgeResolveAccountEntitlement({ plan: 'pro', trialEndsAt: new Date(NOW.getTime() + 1).toISOString(), role: 'user', isLifetime: false, now: NOW });
    expect(justAfter).toMatchObject({ tier: 'pro', trialStatus: 'expiringSoon', trialDaysLeft: 1, isTrialExpired: false });
  });

  it('"expiring soon" starts at exactly 5 days left; 6 days left is an ordinary active trial', () => {
    expect(edgeResolveAccountEntitlement({ plan: 'pro', trialEndsAt: iso(5), role: 'user', isLifetime: false, now: NOW }).trialStatus).toBe('expiringSoon');
    expect(edgeResolveAccountEntitlement({ plan: 'pro', trialEndsAt: iso(6), role: 'user', isLifetime: false, now: NOW }).trialStatus).toBe('active');
  });

  it('a super admin is always tier pro with no trial state and is never reported as Lifetime', () => {
    const r = edgeResolveAccountEntitlement({ plan: 'free', trialEndsAt: iso(-10), role: 'super_admin', isLifetime: true, now: NOW });
    expect(r).toMatchObject({ tier: 'pro', isSuperAdmin: true, isLifetime: false, trialStatus: 'none' });
    expect(buildVerifiedAccountContext({ plan: 'free', trial_ends_at: iso(-10), role: 'super_admin', is_lifetime: true, country: 'Local' }, null, NOW))
      .toEqual({ market: 'Local', tier: 'pro', isLifetime: false, trialStatus: 'none', currentArea: null });
  });

  it('a paid Basic account never shows a trial state, even with a leftover trial date (active or expired)', () => {
    for (const d of [iso(3), iso(-3)]) {
      const r = edgeResolveAccountEntitlement({ plan: 'basic', trialEndsAt: d, role: 'user', isLifetime: false, now: NOW });
      expect(r.tier).toBe('basic');
      expect(r.trialStatus).toBe('none');
    }
  });

  it('a Lifetime account never shows a trial state, even when its trial date has passed', () => {
    const ctx = buildVerifiedAccountContext({ plan: 'pro', trial_ends_at: iso(-30), is_lifetime: true, country: 'International' }, null, NOW);
    expect(ctx.isLifetime).toBe(true);
    expect(ctx.trialStatus).toBe('none');
  });

  it('an unparseable trial date has no days-left value and is never reported as expired - resolved exactly as the real resolver does', () => {
    for (const plan of ['free', 'pro']) {
      const args = { plan, trialEndsAt: 'not-a-date', role: 'user', isLifetime: false, now: NOW };
      const edge = edgeResolveAccountEntitlement(args);
      const real = realResolveAccountEntitlement(args);
      expect(edge.trialDaysLeft).toBeNull();
      expect(edge.isTrialExpired).toBe(false);
      expect([edge.tier, edge.trialStatus]).toEqual([real.tier, real.trialStatus]);
    }
    expect(edgeComputeEffectivePlan({ plan: 'free', trialEndsAt: 'not-a-date', now: NOW })).toEqual(realComputeEffectivePlan({ plan: 'free', trialEndsAt: 'not-a-date', now: NOW }));
  });
});

// The real consumer chain in index.ts: business_settings row -> buildVerifiedAccountContext -> isHebrewFromMarket ->
// buildSystemPrompt (validation.ts). The prompt is what the model actually receives, so the account facts are asserted
// THERE - not on a hand-built context object.
describe('verified account context as the system prompt receives it (index.ts chain)', () => {
  const promptFor = (row, clientIsHebrew = false, area = null) => {
    const accountContext = buildVerifiedAccountContext(row, area, NOW);
    const isHebrew = isHebrewFromMarket(accountContext.market, clientIsHebrew);
    const prompt = buildSystemPrompt({ isHebrew, accountContext });
    const block = prompt.slice(prompt.indexOf('VERIFIED ACCOUNT CONTEXT'), prompt.indexOf('\n\n', prompt.indexOf('VERIFIED ACCOUNT CONTEXT')) >>> 0);
    return { prompt, block, isHebrew };
  };

  it('no business row yet: the market is stated as NOT confirmed, prices are general information only, the reply language is only a UI fallback', () => {
    const { prompt, block, isHebrew } = promptFor(null, true);
    expect(isHebrew).toBe(true);
    expect(block).toMatch(/- Market: not yet confirmed/);
    expect(block).not.toMatch(/- Market: (Local|International)/);
    expect(prompt).toMatch(/טרם השלים את בחירת האזור/);
    expect(block).toMatch(/- Plan tier: free/);
  });

  it('a Local account whose Pro trial expired is described as tier free / trial expired, in Hebrew with the Israeli pricing context only', () => {
    const { prompt, block, isHebrew } = promptFor({ country: 'Local', plan: 'pro', trial_ends_at: iso(-2) }, false, 'quotes');
    expect(isHebrew).toBe(true);
    expect(block).toMatch(/- Plan tier: free\n- Trial status: expired/);
    expect(block).not.toMatch(/Plan tier: pro/);
    expect(block).toMatch(/- Current screen: quotes/);
    expect(prompt).toMatch(/Pricing \(ISRAEL\/HEBREW CONTEXT ONLY/);
    expect(prompt).not.toMatch(/Pricing \(INTERNATIONAL\/ENGLISH CONTEXT ONLY/);
  });

  it('an International Lifetime account is answered in English with the Lifetime entitlement stated next to its tier', () => {
    const { prompt, block, isHebrew } = promptFor({ country: 'International', plan: 'free', is_lifetime: true }, true);
    expect(isHebrew).toBe(false);
    expect(block).toMatch(/- Market: International/);
    expect(block).toMatch(/- Plan tier: free \(Lifetime - full PRO entitlement permanently\)/);
    expect(block).toMatch(/- Trial status: none/);
    expect(prompt).toMatch(/Language Rule: You MUST answer strictly in English/);
  });

  it('nothing outside the allowlist reaches the prompt: no role, business name, tax id or phone from the row', () => {
    const { prompt, block } = promptFor({ country: 'Local', plan: 'basic', role: 'super_admin', business_name: 'Zeta Glass 7731', tax_id: '514998877', phone: '0527766554' });
    expect(block).toMatch(/- Plan tier: pro/);
    for (const secret of ['super_admin', 'Zeta Glass 7731', '514998877', '0527766554']) expect(prompt).not.toContain(secret);
    expect(block.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.split(':')[0])).toEqual(['- Market', '- Plan tier', '- Trial status']);
  });
});
