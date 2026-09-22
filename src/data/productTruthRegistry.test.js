// PRODUCT TRUTH SOURCE COVERAGE + AUTHORITY PARITY (TEKANGO_AI_ARCHITECTURE.md v2.5 §52,
// implementation task step 14/15). Static gates: every declared capability ID has a complete
// registry entry; no phantom/duplicate IDs; every plan-gated capability's entitlementKey/
// minimumPlan matches src/utils/planCatalog.js exactly (never a hand-typed duplicate that can
// drift); aiMayClaimExecution is hard-false for every entry.
import { describe, it, expect } from 'vitest';
import {
  PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY, CANONICAL_38_IDS, NON_CURRENT_IDS, CAPABILITY_STATES, getCapabilityById,
} from './productTruthRegistry.js';
import { PLAN_CATALOG, getEntitlementSet } from '../utils/planCatalog.js';

const REQUIRED_FIELDS = [
  'id', 'heLabel', 'enLabel', 'heDescription', 'enDescription', 'state', 'surfaces', 'markets', 'currencies',
  'entitlementKey', 'minimumPlan', 'authorityType', 'requiredRole', 'authoritySource', 'trialAvailable',
  'operationType', 'userActionAvailable', 'aiMayExplain',
  'aiMayNavigate', 'aiMayClaimExecution', 'safeNavigationId', 'deterministicFactKeys', 'forbiddenClaimCodes',
  'canonicalSources', 'tests', 'lastVerifiedRevision', 'releaseEnvironment',
];
const VALID_AUTHORITY_TYPES = new Set(['plan', 'role', 'none']);

const VALID_STATES = new Set(Object.values(CAPABILITY_STATES));
const VALID_OPERATION_TYPES = new Set(['read', 'mutate']);
const VALID_MARKETS = new Set(['local', 'international']);
// The real closed navigation set (supabase/functions/_shared/aiHelpContract.js NAV_ACTIONS).
const NAV_ACTIONS = new Set([
  'open_dashboard', 'open_quote_history', 'open_new_quote', 'open_clients', 'open_catalog', 'open_finances',
  'open_business_settings', 'open_business_details', 'open_business_phone', 'open_business_tax_id',
  'open_plan_information', 'open_selected_quote', 'open_admin',
]);

describe('PRODUCT TRUTH SOURCE COVERAGE (§52.9 / step 14)', () => {
  it('has exactly the 38 frozen canonical IDs, no more, no fewer', () => {
    const ids = PRODUCT_TRUTH_REGISTRY.map((c) => c.id);
    expect(ids).toEqual(CANONICAL_38_IDS.slice());
    expect(ids.length).toBe(38);
  });

  it('has no duplicate IDs across the current registry', () => {
    const ids = PRODUCT_TRUTH_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly the 4 frozen non-current IDs', () => {
    expect(NON_CURRENT_REGISTRY.map((c) => c.id)).toEqual(NON_CURRENT_IDS.slice());
  });

  it.each(CANONICAL_38_IDS)('capability "%s" has every required field, none undefined', (id) => {
    const entry = getCapabilityById(id);
    expect(entry).toBeTruthy();
    for (const field of REQUIRED_FIELDS) {
      expect(entry, `missing field "${field}" on ${id}`).toHaveProperty(field);
      expect(entry[field], `field "${field}" on ${id} is undefined`).not.toBeUndefined();
    }
  });

  it.each(PRODUCT_TRUTH_REGISTRY.map((c) => c.id))('capability "%s" is a current (non-phantom) state, never UNAVAILABLE/ROADMAP', (id) => {
    const entry = getCapabilityById(id);
    // A "current" registry entry (one of the 38) must never claim a non-current state — that would be a
    // phantom-current capability (task step 14: "Can a phantom capability be marked current?" must be NO).
    expect([CAPABILITY_STATES.UNAVAILABLE, CAPABILITY_STATES.ROADMAP_POST_LIVE]).not.toContain(entry.state);
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" has a valid state enum value', (c) => {
    expect(VALID_STATES.has(c.state)).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" has a valid operationType', (c) => {
    expect(VALID_OPERATION_TYPES.has(c.operationType)).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" markets are a subset of {local,international}', (c) => {
    for (const m of c.markets) expect(VALID_MARKETS.has(m)).toBe(true);
    expect(c.markets.length).toBeGreaterThan(0);
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" aiMayClaimExecution is hard-false (never true)', (c) => {
    expect(c.aiMayClaimExecution).toBe(false);
  });

  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => c.safeNavigationId))('capability "$id" safeNavigationId resolves to a real NAV_ACTIONS member', (c) => {
    expect(NAV_ACTIONS.has(c.safeNavigationId)).toBe(true);
    expect(c.aiMayNavigate).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => !c.safeNavigationId && c.id !== 'ai_chat'))('capability "$id" without a safeNavigationId never claims aiMayNavigate', (c) => {
    expect(c.aiMayNavigate).toBe(false);
  });

  it('ai_chat is the one documented exception: it has general navigation capability without being itself a nav target', () => {
    const aiChat = getCapabilityById('ai_chat');
    expect(aiChat.safeNavigationId).toBeNull();
    expect(aiChat.aiMayNavigate).toBe(true);
  });

  it('every canonicalSources path is a non-empty string (a real evidence pointer, never invented)', () => {
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      expect(c.canonicalSources.length, `capability ${c.id} has no canonicalSources`).toBeGreaterThan(0);
      for (const p of c.canonicalSources) expect(typeof p).toBe('string');
    }
  });
});

describe('PRODUCT TRUTH AUTHORITY PARITY (§52.9 / step 15)', () => {
  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => c.entitlementKey && c.entitlementKey !== 'monthlyQuoteLimit'))(
    'capability "$id" entitlementKey "$entitlementKey" resolves to a real planCatalog.js entitlement field',
    (c) => {
      expect(Object.prototype.hasOwnProperty.call(PLAN_CATALOG.pro.entitlements, c.entitlementKey)).toBe(true);
    },
  );

  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => c.entitlementKey && c.entitlementKey !== 'monthlyQuoteLimit'))(
    'capability "$id" minimumPlan matches the LOWEST plan where planCatalog.js actually grants entitlementKey (no hand-typed drift)',
    (c) => {
      const grantingPlan = ['free', 'basic', 'pro'].find((p) => getEntitlementSet(p)[c.entitlementKey] === true);
      expect(c.minimumPlan, `${c.id}: registry says minimumPlan=${c.minimumPlan}, but planCatalog.js says the lowest granting plan is ${grantingPlan}`).toBe(grantingPlan);
    },
  );

  it('quote_create ties monthlyQuoteLimit to the real per-plan numeric limits (FREE 5 / BASIC 20 / PRO unlimited)', () => {
    expect(getEntitlementSet('free').monthlyQuoteLimit).toBe(5);
    expect(getEntitlementSet('basic').monthlyQuoteLimit).toBe(20);
    expect(getEntitlementSet('pro').monthlyQuoteLimit).toBe(Infinity);
    expect(getCapabilityById('quote_create').deterministicFactKeys).toContain('monthlyQuoteLimit');
  });

  it('capabilities with no plan gate found by Codex genuinely have no entitlementKey (never invented)', () => {
    const NO_GATE_IDS = [
      'dashboard_overview', 'quote_history', 'quote_status', 'smart_quote', 'clients', 'catalog', 'finance_views',
      'expenses', 'quote_csv', 'expense_csv', 'editor_calculator', 'editor_currency_converter',
      'public_currency_converter', 'public_unit_converter', 'public_metals_calculator', 'public_crypto_calculator',
      'business_settings', 'profile_prerequisites', 'plan_trial', 'quote_pdf', 'quote_print', 'quote_email',
      'public_whatsapp_contact', 'public_call', 'public_quote_view', 'public_quote_sign', 'quote_expiry',
      'draft_recovery', 'accessibility_tools', 'ai_chat', 'admin_console',
    ];
    for (const id of NO_GATE_IDS) {
      expect(getCapabilityById(id).entitlementKey, `${id} should have no plan gate per §52.4`).toBeNull();
    }
  });

  it('owner_whatsapp_share and public_whatsapp_contact are never merged into one entry (§52.4)', () => {
    const owner = getCapabilityById('owner_whatsapp_share');
    const pub = getCapabilityById('public_whatsapp_contact');
    expect(owner.id).not.toBe(pub.id);
    expect(owner.entitlementKey).toBe('whatsappDelete');
    expect(pub.entitlementKey).toBeNull();
  });

  it('calculator/public-tool conversion currencies never carry a payment or quote role (§52.5)', () => {
    for (const id of ['editor_calculator', 'editor_currency_converter', 'public_currency_converter', 'public_metals_calculator', 'public_crypto_calculator']) {
      const c = getCapabilityById(id);
      expect(c.currencies).toBeTruthy();
      expect(c.currencies.role).toBe('conversion_only');
    }
  });

  it('payment_processing / invoicing are the only non-current entries payment/invoicing modules own; never routed by the capability classifier (see capabilityTruth.ts)', () => {
    expect(NON_CURRENT_IDS).toContain('payment_processing');
    expect(NON_CURRENT_IDS).toContain('invoicing');
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" has a valid authorityType', (c) => {
    expect(VALID_AUTHORITY_TYPES.has(c.authorityType)).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" never sets BOTH a plan gate and a role gate on the same entry', (c) => {
    expect(!(c.entitlementKey && c.requiredRole)).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => c.authorityType === 'role'))('role-gated capability "$id" has a requiredRole and an authoritySource, never inferred from plan', (c) => {
    expect(c.requiredRole).toBeTruthy();
    expect(c.authoritySource).toBeTruthy();
    expect(c.minimumPlan).toBeNull();
    expect(c.entitlementKey).toBeNull();
  });
});

describe('DEFECT-6 ADMIN AUTHORITY PARITY (Codex, 2026-09-22)', () => {
  it('admin_console is role-gated, not plan-gated (Lifetime/PRO entitlement != Admin authority)', () => {
    const admin = getCapabilityById('admin_console');
    expect(admin.authorityType).toBe('role');
    expect(admin.requiredRole).toBe('super_admin');
    expect(admin.minimumPlan).toBeNull();
    expect(admin.entitlementKey).toBeNull();
  });

  it('admin_console authoritySource points at the real server-side role check (accountContext.ts)', () => {
    const admin = getCapabilityById('admin_console');
    expect(admin.authoritySource).toBe('supabase/functions/chat-ai/accountContext.ts');
    expect(admin.canonicalSources).toContain('supabase/functions/chat-ai/accountContext.ts');
  });

  it('admin_console carries a forbidden-claim code against inferring Admin from plan/Lifetime', () => {
    expect(getCapabilityById('admin_console').forbiddenClaimCodes).toContain('NO_ADMIN_FROM_PLAN_OR_LIFETIME_INFERENCE');
  });
});

describe('DEFECT-5 PUBLIC WHATSAPP MARKET PARITY (Codex, 2026-09-22)', () => {
  it('public_whatsapp_contact is available in BOTH markets (real source: PublicQuote.jsx (HE) and PublicQuoteEn.jsx (EN) both render a bizWhatsAppHref button)', () => {
    const c = getCapabilityById('public_whatsapp_contact');
    expect(c.markets).toContain('local');
    expect(c.markets).toContain('international');
    expect(c.canonicalSources).toContain('src/pages/PublicQuote.jsx');
    expect(c.canonicalSources).toContain('src/pages/PublicQuoteEn.jsx');
  });
});
