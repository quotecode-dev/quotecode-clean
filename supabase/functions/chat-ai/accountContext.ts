// AI Chat Gate 2, §5: verified, minimal, read-only account context for the
// authenticated Dashboard surface. Authority for every field here comes
// from the server-verified user id (see index.ts's JWT verification) and a
// server-side `business_settings` row lookup by that id - NEVER from
// anything the caller claims about their own account.
//
// The plan/trial resolution logic below is a byte-for-byte PORT of
// src/utils/planEntitlements.js's `computeEffectivePlan` and
// src/utils/accountEntitlement.js's `resolveAccountEntitlement` - this Edge
// Function cannot import those frontend-only modules across the deploy
// boundary (same documented constraint as src/shared/brand.js and
// scripts/generate-ai-chat-facts.js). `accountContext.test.js` imports BOTH
// the real frontend modules and this file and asserts identical output
// across a wide fixture matrix, so this port can never silently drift from
// the one real entitlement authority.

export type BusinessSettingsRow = {
  plan?: string | null;
  trial_ends_at?: string | null;
  is_lifetime?: boolean | null;
  role?: string | null;
  country?: string | null;
};

const TRIAL_EXPIRING_SOON_DAYS = 5;

// Verbatim port of planEntitlements.js's computeEffectivePlan.
export function computeEffectivePlan({ plan, trialEndsAt, now = new Date() }: { plan?: string | null; trialEndsAt?: string | null; now?: Date }) {
  const rawPlan = (plan || 'free').toLowerCase();

  let trialDaysLeft: number | null = null;
  let isTrialExpired = false;
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    if (!Number.isNaN(end.getTime())) {
      const diffTime = end.getTime() - now.getTime();
      trialDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isTrialExpired = trialDaysLeft <= 0;
    }
  }

  let effectivePlan: string;
  if (rawPlan === 'basic') {
    effectivePlan = 'basic';
  } else if (rawPlan === 'pro') {
    if (trialEndsAt === null || trialEndsAt === undefined) {
      effectivePlan = 'pro';
    } else if (!isTrialExpired) {
      effectivePlan = 'pro';
    } else {
      effectivePlan = 'free';
    }
  } else {
    effectivePlan = (trialEndsAt && !isTrialExpired) ? 'pro' : 'free';
  }

  return { effectivePlan, isTrialExpired, trialDaysLeft };
}

// Verbatim port of accountEntitlement.js's resolveAccountEntitlement,
// trimmed to the fields this Edge Function actually needs (tier/isLifetime/
// trialStatus) - badgeState/displayIdentity/entitlement (full capability
// set) are UI-display concerns not needed here; the parity test still
// proves tier/isLifetime/trialStatus match the real resolver exactly.
export function resolveAccountEntitlement({ plan, trialEndsAt, role, isLifetime: rawIsLifetime, now = new Date() }: {
  plan?: string | null; trialEndsAt?: string | null; role?: string | null; isLifetime?: boolean | null; now?: Date;
}) {
  const rawPlan = (plan || 'free').toLowerCase();
  const isSuperAdmin = role === 'super_admin';

  const { effectivePlan, isTrialExpired, trialDaysLeft } = computeEffectivePlan({ plan, trialEndsAt, now });

  const isLifetime = !isSuperAdmin && rawIsLifetime === true;
  const tier = isSuperAdmin ? 'pro' : effectivePlan;

  let trialStatus: 'none' | 'active' | 'expiringSoon' | 'expired' = 'none';
  if (!isSuperAdmin && !isLifetime && rawPlan !== 'basic' && trialEndsAt) {
    if (isTrialExpired) trialStatus = 'expired';
    else if (trialDaysLeft !== null && trialDaysLeft <= TRIAL_EXPIRING_SOON_DAYS) trialStatus = 'expiringSoon';
    else trialStatus = 'active';
  }

  return { tier, isSuperAdmin, isLifetime, trialStatus, trialDaysLeft, isTrialExpired };
}

// AI Chat Hardening overnight task, Track C/I ("Unknown/absent market must
// NOT silently become International" - a direct Owner requirement, ProFlow's
// own locked market-isolation discipline): the pre-existing binary
// `row?.country === 'Local' ? 'Local' : 'International'` check silently
// treated a brand-new/mid-onboarding account (no `business_settings` row
// yet, so `row` itself is null) as International - showing USD pricing and
// English-market framing to an account that might still become Local/
// Hebrew. `market` now has an explicit third state so that case is never
// silently guessed either way.
export type VerifiedAccountContext = {
  market: 'Local' | 'International' | 'Unknown';
  tier: 'free' | 'basic' | 'pro';
  isLifetime: boolean;
  trialStatus: 'none' | 'active' | 'expiringSoon' | 'expired';
  currentArea: string | null;
};

// §5.1's minimal, read-only allowlist - deliberately excludes everything
// under §5.1's "Do NOT send" list (raw business_settings row, full profile,
// tax id, address, phone, bank/payment data, role exposed to the model,
// customer/quote lists, support logs, secrets/tokens). `role` is read only
// to compute isSuperAdmin internally above and is never placed on this object.
export function buildVerifiedAccountContext(row: BusinessSettingsRow | null | undefined, currentArea: string | null, now = new Date()): VerifiedAccountContext {
  const market: 'Local' | 'International' | 'Unknown' =
    row?.country === 'Local' ? 'Local' :
    row?.country === 'International' ? 'International' :
    'Unknown';
  const resolved = resolveAccountEntitlement({
    plan: row?.plan,
    trialEndsAt: row?.trial_ends_at,
    role: row?.role,
    isLifetime: row?.is_lifetime,
    now,
  });

  return {
    market,
    tier: resolved.tier as 'free' | 'basic' | 'pro',
    isLifetime: resolved.isLifetime,
    trialStatus: resolved.trialStatus,
    currentArea,
  };
}

// §4: for the AUTHENTICATED surface, the language policy is derived from
// the verified account's own market - never trusted from the caller's
// `isHebrew` claim. A public (unauthenticated) request has no verified
// account, so its own caller-supplied isHebrew (which is just "which
// locale of the public marketing site is this", not an account fact)
// remains the correct signal there - see index.ts's call site.
//
// When the market itself is 'Unknown' (no business_settings row yet), there
// is no commercial-market fact to derive a REPLY LANGUAGE from either - but a
// reply must still be given in some language. `fallbackIsHebrew` (the
// caller's own dashboard-bundle locale, i.e. which of AppLocal.jsx/
// AppGlobal.jsx is actually mounted) is used ONLY for that narrow UI-
// language purpose in that one case; it is never used to assert the
// account's actual commercial market (currency/pricing framing) - see
// buildPricingBlock/buildAccountContextBlock in validation.ts, which treat
// 'Unknown' as its own case rather than silently picking a side.
export function isHebrewFromMarket(market: 'Local' | 'International' | 'Unknown', fallbackIsHebrew: boolean = false): boolean {
  if (market === 'Local') return true;
  if (market === 'International') return false;
  return fallbackIsHebrew;
}
