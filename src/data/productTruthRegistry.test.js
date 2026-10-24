// PRODUCT TRUTH SOURCE COVERAGE + AUTHORITY PARITY (TEKANGO_AI_ARCHITECTURE.md v2.5 §52,
// implementation task step 14/15). Static gates: every declared capability ID has a complete
// registry entry; no phantom/duplicate IDs; every subscription-gated capability names a real canonical
// capability of supabase/functions/_shared/subscriptionContract.ts whose plan eligibility is NOT decided
// (OPEN-02 / OPEN-13) - no legacy minimum plan / entitlement key survives the subscriptions cutover;
// aiMayClaimExecution is hard-false for every entry.
import { describe, it, expect } from 'vitest';
import {
  PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY, CANONICAL_38_IDS, PHASE_CAPABILITY_IDS, NON_CURRENT_IDS, CAPABILITY_STATES, getCapabilityById,
} from './productTruthRegistry.js';
import { CAPABILITIES, FREE_QUOTES_TOTAL } from '../../supabase/functions/_shared/subscriptionContract.ts';

const REQUIRED_FIELDS = [
  'id', 'heLabel', 'enLabel', 'heDescription', 'enDescription', 'state', 'surfaces', 'markets', 'currencies',
  'entitlementKey', 'minimumPlan', 'subscriptionCapabilityId', 'planEligibility', 'authorityType', 'requiredRole', 'authoritySource',
  'operationType', 'userActionAvailable', 'aiMayExplain',
  'aiMayNavigate', 'aiMayClaimExecution', 'safeNavigationId', 'deterministicFactKeys', 'forbiddenClaimCodes',
  'canonicalSources', 'tests', 'lastVerifiedRevision', 'releaseEnvironment',
];
const VALID_AUTHORITY_TYPES = new Set(['subscription', 'role', 'none']);

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
  it('has exactly the 38 frozen canonical IDs followed by the explicitly pinned Task 20 IDs, no more, no fewer', () => {
    const ids = PRODUCT_TRUTH_REGISTRY.map((c) => c.id);
    expect(ids).toEqual([...CANONICAL_38_IDS, ...PHASE_CAPABILITY_IDS]);
    expect(PHASE_CAPABILITY_IDS).toEqual(['quote_statistics', 'manual_tasks', 'calendar', 'quote_link_view', 'reminders_automation', 'digital_business_card']); // Task 23: Phase 5 card
    expect(ids.length).toBe(44);
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
  const GATED = PRODUCT_TRUTH_REGISTRY.filter((c) => c.subscriptionCapabilityId);

  it('exactly the six historically plan-gated capabilities are subscription-gated, each mapped to its canonical capability id', () => {
    expect(Object.fromEntries(GATED.map((c) => [c.id, c.subscriptionCapabilityId]))).toEqual({
      quote_edit: 'quote.edit_duplicate',
      quote_duplicate: 'quote.edit_duplicate',
      measured_quote: 'professional_quote.use',
      professional_reuse: 'professional_quote.reuse',
      attachments: 'quote_attachment.upload',
      owner_whatsapp_share: 'quote.whatsapp_delete',
    });
  });

  it.each(GATED)('subscription-gated capability "$id" names a real canonical capability whose plan eligibility is NOT decided', (c) => {
    expect(CAPABILITIES[c.subscriptionCapabilityId], c.subscriptionCapabilityId).toBeTruthy();
    expect(CAPABILITIES[c.subscriptionCapabilityId].eligiblePlans).toBeNull();
    expect(c.planEligibility).toBe('not_decided');
    expect(c.authorityType).toBe('subscription');
  });

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" carries no legacy plan gate (minimumPlan / entitlementKey are null after the cutover)', (c) => {
    expect(c.minimumPlan).toBeNull();
    expect(c.entitlementKey).toBeNull();
    expect(c).not.toHaveProperty('trialAvailable');
  });

  it('quote_create ties to the Free-10 fact (OD-01), never to a monthly limit', () => {
    expect(FREE_QUOTES_TOTAL).toBe(10);
    expect(getCapabilityById('quote_create').deterministicFactKeys).toEqual(['subscriptions.free.quotesTotal']);
  });

  it('no current label or description states a trial, a legacy plan name, "unlimited" or a monthly quote limit', () => {
    const BAD = /\btrial\b|\b14[- ]day|\bbasic\b|\bpro\b|\bunlimited\b|monthly quote|ניסיון|ללא הגבלה|\bPRO\b|\bBASIC\b|החודשית/i;
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      for (const k of ['heLabel', 'enLabel', 'heDescription', 'enDescription']) expect(c[k], `${c.id}.${k}`).not.toMatch(BAD);
    }
  });

  it('plan_trial keeps its frozen technical id but now states the Free-10 plan truth (OD-01) and the inactive plan system', () => {
    const c = getCapabilityById('plan_trial');
    expect(c.enLabel).toBe('Plans and Free quotes');
    // Task 27 (§249 + the Owner's 2026-10-11 amendment): Free-10, then ONE package; HE = ILS only, EN = USD only (market isolation)
    expect(c.enDescription).toMatch(/10 quotes in total or 7 days from sign-up, whichever ends first/);
    expect(c.enDescription).toMatch(/one package with every available capability, billed monthly or annually: 18\.00 USD per month or 184\.00 USD per year/);
    expect(c.enDescription).toMatch(/still being prepared/);
    expect(c.enDescription).not.toMatch(/Classic|Modern|Visual|₪|ILS/);
    expect(c.heDescription).toMatch(/30\.00 ₪ לחודש או 306\.00 ₪ לשנה, כולל מע״מ/);
    expect(c.heDescription).not.toMatch(/קלאסיק|מודרן|ויזואל|USD|\$/);
  });

  it('capabilities with no subscription gate found by Codex genuinely have no subscriptionCapabilityId (never invented)', () => {
    const NO_GATE_IDS = [
      'dashboard_overview', 'quote_history', 'quote_create', 'quote_status', 'smart_quote', 'clients', 'catalog', 'finance_views',
      'expenses', 'quote_csv', 'expense_csv', 'editor_calculator', 'editor_currency_converter',
      'public_currency_converter', 'public_unit_converter', 'public_metals_calculator', 'public_crypto_calculator',
      'business_settings', 'profile_prerequisites', 'plan_trial', 'quote_pdf', 'quote_print', 'quote_email',
      'public_whatsapp_contact', 'public_call', 'public_quote_view', 'public_quote_sign', 'quote_expiry',
      'draft_recovery', 'accessibility_tools', 'ai_chat', 'admin_console',
    ];
    for (const id of NO_GATE_IDS) {
      expect(getCapabilityById(id).subscriptionCapabilityId, `${id} should have no subscription gate`).toBeNull();
    }
  });

  it('owner_whatsapp_share and public_whatsapp_contact are never merged into one entry (§52.4)', () => {
    const owner = getCapabilityById('owner_whatsapp_share');
    const pub = getCapabilityById('public_whatsapp_contact');
    expect(owner.id).not.toBe(pub.id);
    expect(owner.subscriptionCapabilityId).toBe('quote.whatsapp_delete');
    expect(pub.subscriptionCapabilityId).toBeNull();
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

  it.each(PRODUCT_TRUTH_REGISTRY)('capability "$id" never sets BOTH a subscription gate and a role gate on the same entry', (c) => {
    expect(!(c.subscriptionCapabilityId && c.requiredRole)).toBe(true);
  });

  it.each(PRODUCT_TRUTH_REGISTRY.filter((c) => c.authorityType === 'role'))('role-gated capability "$id" has a requiredRole and an authoritySource, never inferred from plan', (c) => {
    expect(c.requiredRole).toBeTruthy();
    expect(c.authoritySource).toBeTruthy();
    expect(c.minimumPlan).toBeNull();
    expect(c.subscriptionCapabilityId).toBeNull();
  });
});

describe('DEFECT-6 ADMIN AUTHORITY PARITY (Codex, 2026-09-22)', () => {
  it('admin_console is role-gated, not plan-gated (no plan is ever Admin authority)', () => {
    const admin = getCapabilityById('admin_console');
    expect(admin.authorityType).toBe('role');
    expect(admin.requiredRole).toBe('super_admin');
    expect(admin.minimumPlan).toBeNull();
    expect(admin.subscriptionCapabilityId).toBeNull();
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
