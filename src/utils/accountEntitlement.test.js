import { describe, it, expect } from 'vitest';
import { resolveAccountEntitlement } from './accountEntitlement';
import { getEntitlementSet } from './planCatalog';

// חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner mandate:
// "No more inference-based Lifetime model. No more patches."): resolveAccountEntitlement
// now takes `isLifetime` as an EXPLICIT input parameter (sourced from
// business_settings.is_lifetime, migration 20260908000000) — it is never
// again derived from trialEndsAt===null. Every test below that wants a
// LIFETIME result must pass isLifetime:true explicitly; omitting it (or
// passing false) must NEVER produce a Lifetime result, no matter what
// plan/trialEndsAt shape accompanies it. This file replaces the previous
// inference-era test suite in full — see PROFLOW_PROJECT_CONTEXT.md §204
// for the proven root-cause history this model replaces.

const FIXED_NOW = new Date('2026-08-30T12:00:00.000Z');
const daysFromNow = (days) => new Date(FIXED_NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe('resolveAccountEntitlement — explicit Lifetime input, never inferred', () => {
  it('plan=free + trialEndsAt=null + isLifetime omitted: resolves to FREE, never LIFETIME (the exact historically-ambiguous shape, now unambiguous by construction)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('FREE');
  });

  it('plan=free + trialEndsAt=null + isLifetime explicitly false: resolves to FREE (same as omitted — explicit false and omitted are equivalent)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('FREE');
  });

  it('plan=pro + trialEndsAt=null + isLifetime=false: resolves to ordinary non-trial PRO, NOT Lifetime — this state was impossible to represent cleanly under the old inference (it always read as Lifetime); the explicit model makes it a real, distinct, correctly-classified state', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('PRO');
  });

  it('plan=pro + trialEndsAt=null + isLifetime omitted (undefined): same as explicit false — defaults safely, never silently becomes Lifetime', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('PRO');
  });

  it('isLifetime=true resolves to LIFETIME regardless of trialEndsAt shape — even with a real, non-null, in-window trial date present (proves the field, not trial-null, is the sole source)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
  });

  it('isLifetime=true on a plan=free underlying account resolves to LIFETIME — no longer impossible by construction (the old model\'s isLifetime required rawPlan!=="free"; the explicit model has no such restriction, since is_lifetime is fully orthogonal to plan)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('isLifetime=true on a plan=basic underlying account resolves to LIFETIME with full PRO entitlement, same rule, not special-cased', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.tier).toBe('basic');
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('super_admin is never flagged isLifetime even if isLifetime=true is passed (defensive — Admin authority and Lifetime are two separate concepts, never conflated)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'super_admin', isLifetime: true, now: FIXED_NOW });
    expect(r.isSuperAdmin).toBe(true);
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('PRO');
  });
});

describe('resolveAccountEntitlement — trial lifecycle (unaffected by the Lifetime model change)', () => {
  it('active trial, far from expiring: tier pro, badgeState TRIAL, trialStatus active', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('active');
    expect(r.trialDaysLeft).toBeGreaterThan(5);
    expect(r.isLifetime).toBe(false);
  });

  it('active trial, within the expiring-soon window (<=5 days): trialStatus expiringSoon, tier still pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('expiringSoon');
  });

  it('expired trial (past date, not null): tier flips to free, trialStatus expired, badgeState FREE', () => {
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

  it('one millisecond before the boundary still counts as active (not yet expired)', () => {
    const almostThere = new Date(FIXED_NOW.getTime() + 1).toISOString();
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: almostThere, role: 'user', now: FIXED_NOW });
    expect(r.isTrialExpired).toBe(false);
  });

  it('genuine FREE (never trialed) has trialStatus none, not "expired"', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.trialStatus).toBe('none');
  });

  it('malformed trial_ends_at string fails safe (does not crash, treated as no usable trial date)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: 'not-a-real-date', role: 'user', now: FIXED_NOW });
    expect(() => r).not.toThrow();
    expect(r.trialDaysLeft).toBeNull();
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
    expect(r.trialStatus).toBe('none');
    expect(r.badgeState).toBe('BASIC');
  });

  it('BASIC → PRO transition (same account, plan field changes): displayIdentity and entitlement both switch cleanly, no leftover BASIC state', () => {
    const before = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    const after = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(before.displayIdentity).toBe('BASIC');
    expect(before.entitlement.monthlyQuoteLimit).toBe(20);
    expect(after.displayIdentity).toBe('FREE_TRIAL');
    expect(after.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('PRO (via active trial) resolves with full PRO entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.editDuplicate).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(true);
    expect(r.entitlement.attachments).toBe(true);
  });

  it('PRO, ordinary non-trial (explicit isLifetime:false, trialEndsAt:null): resolves with full PRO entitlement limits, identity PRO not LIFETIME', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.whatsappDelete).toBe(true);
    expect(r.displayIdentity).toBe('PRO');
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

  it('SUPER_ADMIN: full entitlement == PRO, Admin authority remains role-gated (isSuperAdmin), never conflated with isLifetime', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'super_admin', now: FIXED_NOW });
    expect(r.entitlement).toEqual(getEntitlementSet('pro'));
    expect(r.isSuperAdmin).toBe(true);
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('PRO');
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

  it('badgeState is PRO (not TRIAL) for a genuine explicit Lifetime grant', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.badgeState).toBe('PRO');
  });
});

describe('resolveAccountEntitlement — displayIdentity (the seven canonical states this task requires)', () => {
  it('FREE: displayIdentity FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
  });

  it('FREE + ACTIVE TRIAL: displayIdentity FREE_TRIAL, effective entitlement tier is pro — never becomes real PRO or LIFETIME display identity', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.isLifetime).toBe(false);
  });

  it('expiring-soon trial: displayIdentity is still FREE_TRIAL, not FREE and not PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('EXPIRED TRIAL → FREE: displayIdentity reverts to FREE, not left as FREE_TRIAL and never PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
    expect(r.tier).toBe('free');
  });

  it('BASIC: displayIdentity BASIC (trial_ends_at present but irrelevant)', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('BASIC');
  });

  it('PRO (ordinary, non-trial, explicit isLifetime:false): displayIdentity PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(r.displayIdentity).toBe('PRO');
  });

  it('ordinary PRO while trialing is represented as FREE_TRIAL, never a bare "PRO" identity during trial', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).not.toBe('PRO');
  });

  it('LIFETIME: displayIdentity LIFETIME, entitlement tier pro, no trial countdown (trialStatus none)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.displayIdentity).not.toBe('PRO');
    expect(r.trialStatus).toBe('none');
    expect(r.trialDaysLeft).toBeNull();
  });

  it('LIFETIME on BASIC underlying (explicit, same rule not special-cased): displayIdentity LIFETIME, not BASIC', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
  });

  it('SUPER_ADMIN: displayIdentity PRO (matches existing badgeState/tier behavior for the admin role, not conflated with Lifetime)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('PRO');
    expect(r.isLifetime).toBe(false);
  });

  it('self-cancelled FREE (plan:free, trial_ends_at:null, no explicit Lifetime flag): displayIdentity FREE, never LIFETIME', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
  });
});

// חוק ברזל (Entitlement/Quota Centralization, PROFLOW_PROJECT_CONTEXT.md §150,
// extended 2026-09-08 for the explicit Lifetime model): שש-שבע הזהויות
// הקנוניות, כולן עוברות דרך entitlement.monthlyQuoteLimit היחיד.
describe('resolveAccountEntitlement — Owner canonical quota contract, seven-identity matrix', () => {
  it('A. FREE: monthlyQuoteLimit = 5', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('B. FREE (TRIAL active): monthlyQuoteLimit = unlimited (temporary PRO-level entitlement — identity stays FREE_TRIAL, never becomes real PRO)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('B2. FREE (TRIAL expiring-soon, still active): monthlyQuoteLimit still unlimited until actual expiry', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('C. EXPIRED TRIAL → FREE: monthlyQuoteLimit reverts to 5, not left unlimited', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('D. BASIC: monthlyQuoteLimit = 20', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('BASIC');
    expect(r.entitlement.monthlyQuoteLimit).toBe(20);
  });

  it('E. PRO (ordinary, non-trial, explicit): monthlyQuoteLimit = unlimited, displayIdentity PRO — now a real, cleanly-representable state under the explicit Lifetime model (previously this exact raw shape always read as Lifetime)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.displayIdentity).toBe('PRO');
  });

  it('F. LIFETIME on a pro-shaped underlying account: monthlyQuoteLimit = unlimited', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('F2. LIFETIME on a basic-shaped underlying account also resolves to monthlyQuoteLimit = unlimited, not 20 — proves the Owner\'s "LIFETIME = unlimited, no subscription expiry" contract holds regardless of the raw plan underneath', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.tier).toBe('basic');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('F3. LIFETIME on a free-shaped underlying account is now POSSIBLE and correct under the explicit model (the old model made this impossible by design — isLifetime required rawPlan!=="free" — which was itself the exact root cause of the "Lifetime grant on a FREE account silently becomes FREE" bug)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('G. SUPER_ADMIN: full entitlement == PRO regardless of raw plan/trial/isLifetime input', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('PRO');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });
});

describe('resolveAccountEntitlement — quota boundary proof (mirrors Dashboard.jsx enforcement comparison)', () => {
  const wouldBlock = (count, limit) => count >= limit;

  it('FREE: usage 4 does not block, usage 5 blocks', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(wouldBlock(4, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(5, r.entitlement.monthlyQuoteLimit)).toBe(true);
  });

  it('BASIC: usage 19 does not block, usage 20 blocks', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(wouldBlock(19, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(20, r.entitlement.monthlyQuoteLimit)).toBe(true);
  });

  it('FREE(TRIAL active): usage 20+ never blocks on the monthly quota', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(wouldBlock(20, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(9999, r.entitlement.monthlyQuoteLimit)).toBe(false);
  });

  it('LIFETIME (any underlying tier, explicit): usage 20+ never blocks on the monthly quota', () => {
    const rPro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    const rBasic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(wouldBlock(20, rPro.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(20, rBasic.entitlement.monthlyQuoteLimit)).toBe(false);
  });
});

// חוק ברזל (LIFETIME Full-PRO Inheritance, PROFLOW_PROJECT_CONTEXT.md §151,
// unchanged by the explicit Lifetime model — only the *source* of isLifetime
// changed, never the inheritance mechanism itself): LIFETIME יורש את קבוצת-
// הזכאות *המלאה* של PRO - כל יכולת נוכחית ועתידית.
describe('resolveAccountEntitlement — LIFETIME Full-PRO Inheritance (§151), explicit-input era', () => {
  it('A. PRO entitlement object contains the expected full capability set', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement).toEqual({
      monthlyQuoteLimit: Infinity,
      editDuplicate: true,
      whatsappDelete: true,
      attachments: true,
      professionalQuotes: true,
      professionalQuoteReuse: true,
    });
  });

  it('B/I. THE ARCHITECTURAL INVARIANT: LIFETIME\'s entitlement set is deep-equal to a real PRO account\'s entitlement set, derived from the same source. A future fifth capability added to PLAN_CATALOG.pro.entitlements is automatically covered, with zero change to this test.', () => {
    const proResult = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetimeOnPro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    const lifetimeOnBasic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    const lifetimeOnFree = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(lifetimeOnPro.entitlement).toEqual(proResult.entitlement);
    expect(lifetimeOnBasic.entitlement).toEqual(proResult.entitlement);
    expect(lifetimeOnFree.entitlement).toEqual(proResult.entitlement);
  });

  it('C. LIFETIME identity remains LIFETIME, not collapsed into PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.isLifetime).toBe(true);
  });

  it('D. PRO identity remains PRO where representable (super_admin, and now also an ordinary explicit isLifetime:false non-trial PRO account)', () => {
    const superAdmin = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    const ordinaryPro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: false, now: FIXED_NOW });
    expect(superAdmin.displayIdentity).toBe('PRO');
    expect(superAdmin.isLifetime).toBe(false);
    expect(ordinaryPro.displayIdentity).toBe('PRO');
    expect(ordinaryPro.isLifetime).toBe(false);
  });

  it('E. FREE(TRIAL) receives temporary full PRO-level capabilities while retaining FREE_TRIAL display identity, never becoming real PRO/LIFETIME', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement).toEqual(getEntitlementSet('pro'));
  });

  it('F. BASIC does NOT accidentally inherit full PRO entitlements', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.entitlement).not.toEqual(getEntitlementSet('pro'));
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
  });

  it('G. FREE does NOT accidentally inherit full PRO entitlements', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement).not.toEqual(getEntitlementSet('pro'));
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('H. LIFETIME monthlyQuoteLimit = Infinity, regardless of underlying raw tier', () => {
    expect(resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('I2. LIFETIME editDuplicate === PRO editDuplicate', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(lifetime.entitlement.editDuplicate).toBe(pro.entitlement.editDuplicate);
    expect(lifetime.entitlement.editDuplicate).toBe(true);
  });

  it('J. LIFETIME whatsappDelete === PRO whatsappDelete', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(lifetime.entitlement.whatsappDelete).toBe(pro.entitlement.whatsappDelete);
    expect(lifetime.entitlement.whatsappDelete).toBe(true);
  });

  it('K. LIFETIME attachments === PRO attachments — this is the exact field the Super Admin logo-gate bug fix now consumes (SettingsTab.jsx canUseAttachments)', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(lifetime.entitlement.attachments).toBe(pro.entitlement.attachments);
    expect(lifetime.entitlement.attachments).toBe(true);
  });

  it('super_admin entitlement set also matches getEntitlementSet("pro") exactly, via the same tier-forcing path, not a separate isSuperAdmin override — this is what proves the Super Admin logo-gate fix is correct: entitlement.attachments is true for super_admin regardless of raw plan', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.entitlement).toEqual(getEntitlementSet('pro'));
    expect(r.entitlement.attachments).toBe(true);
  });

  it('SUPER_ADMIN with a plan=basic, expired-trial raw shape still gets entitlement.attachments=true — the exact real-world shape that triggered the proven logo-gate bug (SettingsTab.jsx previously checked raw effectivePlan, which resolves to "basic" or "free" here, not "pro")', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-10), role: 'super_admin', now: FIXED_NOW });
    expect(r.entitlement.attachments).toBe(true);
    expect(r.displayIdentity).toBe('PRO');
  });
});

describe('resolveAccountEntitlement — Professional Quotes entitlement matrix (§156, Stage B), explicit-input era', () => {
  it('FREE: neither capability', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(false);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
  });

  it('FREE(TRIAL active): both capabilities temporarily, identity stays FREE_TRIAL', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('EXPIRED TRIAL: both capabilities withdrawn automatically, reverts to FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(false);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
    expect(r.displayIdentity).toBe('FREE');
  });

  it('BASIC: Core yes, Advanced Reuse no', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
  });

  it('PRO: both capabilities', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
  });

  it('LIFETIME (pro-underlying, explicit): both capabilities, identity stays LIFETIME', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.isLifetime).toBe(true);
  });

  it('LIFETIME (basic-underlying, explicit): both capabilities still fully inherited', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
  });

  it('regression: monthlyQuoteLimit is unaffected by the new capabilities for every identity', () => {
    expect(resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(5);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(20);
    expect(resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', isLifetime: true, now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('regression: editDuplicate/whatsappDelete/attachments are unaffected by the new capabilities', () => {
    const free = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(free.entitlement.editDuplicate).toBe(false);
    expect(free.entitlement.whatsappDelete).toBe(false);
    expect(free.entitlement.attachments).toBe(false);
    const basic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(basic.entitlement.editDuplicate).toBe(true);
    expect(basic.entitlement.whatsappDelete).toBe(false);
    expect(basic.entitlement.attachments).toBe(false);
  });
});
