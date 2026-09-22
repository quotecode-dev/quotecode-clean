// AI Chat canonical facts generator (Consolidated Gate 1, §6). A Supabase
// Edge Function cannot import the frontend's `src/` modules across the
// deploy boundary (same constraint brand.js documents for CANONICAL_DOMAIN/
// SUPPORT_EMAIL_*) - so instead of a second, independently-maintained set of
// commercial numbers hand-typed into the chat-ai system prompt (the
// pre-Gate-1 defect this generator fixes), this script derives one
// generated, versioned facts artifact from the real canonical sources and
// writes it into supabase/functions/chat-ai/aiFacts.generated.ts, where the
// Edge Function imports it directly (a same-directory relative import,
// which Deno can do - only the cross-runtime frontend<->Edge boundary is
// the problem).
//
// `aiFacts.parity.test.js` fails the build if the committed generated file
// is stale relative to canonical sources - run this script (no flags) to
// regenerate it after any of the source files below change.
//
// Usage:
//   node scripts/generate-ai-chat-facts.js          # regenerate the file
//   node scripts/generate-ai-chat-facts.js --check  # exit 1 if stale, no write

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PRICING_CATALOG, getAnnualTotal, getSavingsPercent } from '../src/utils/pricingCatalog.js';
import { PLAN_CATALOG } from '../src/utils/planCatalog.js';
import { SUPPORT_EMAIL_HE, SUPPORT_EMAIL_EN } from '../src/shared/brand.js';
import { REGION_RULES } from '../src/utils/regionConfig.js';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY, CAPABILITY_STATES } from '../src/data/productTruthRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'supabase', 'functions', 'chat-ai', 'aiFacts.generated.ts');

export const AI_FACTS_SCHEMA_VERSION = 1;

// Not exposed as a named canonical export anywhere today (see the two
// literal-repetition sites cited below) - these three numbers are parity-
// tested against their real call sites in aiFacts.generate.test.js instead
// of imported, so a future edit to either real site is still caught.
const TRIAL_DAYS = 14; // Dashboard.jsx: trialEndDate.setDate(trialEndDate.getDate() + 14)
const MAX_ATTACHMENT_FILE_MB = 3; // QuoteForm.jsx: "עד 3MB" / "3MB limit for a single file"
const MAX_ATTACHMENT_TOTAL_MB = 30; // QuoteForm.jsx / PricingModal.jsx / Landing pages: "30MB" total capacity

function quoteLimitFor(planId) {
  const limit = PLAN_CATALOG[planId].entitlements.monthlyQuoteLimit;
  return limit === Infinity ? 'unlimited' : limit;
}

function marketPricing(catalog) {
  const plan = (id) => ({
    monthly: catalog[id].monthly,
    annualEffectiveMonthly: catalog[id].annualMonthly,
    annualTotal: getAnnualTotal(catalog[id].annualMonthly),
    savingsPercent: getSavingsPercent(catalog[id].monthly, catalog[id].annualMonthly),
  });
  return {
    currency: catalog.currency,
    currencySymbol: catalog.currencySymbol,
    plans: { free: { monthly: catalog.free.monthly }, basic: plan('basic'), pro: plan('pro') },
  };
}

// The single source flag for payment capability (see the billing record in generateAiFacts()).
const LIVE_CHECKOUT_AVAILABLE = false;
// The single source flag for invoicing capability (AI-HELP-AVAILABILITY-001 / First-LIVE truth, 2026-09-22). PayPlus is a documented
// provider CANDIDATE only (INVOICING_INFRASTRUCTURE.md: offer received, not signed, integration not started) - no invoice / receipt /
// tax document is issued by TEKANGO today. Do not flip without a live, verified integration.
const LIVE_INVOICING_AVAILABLE = false;
const INVOICING_PROVIDER_CANDIDATE = 'PayPlus';

// Product Truth Registry (TEKANGO_AI_ARCHITECTURE.md v2.5 §52) — the Edge/AI-facing PROJECTION of
// the curated registry (src/data/productTruthRegistry.js). Plan availability is DERIVED here from
// PLAN_CATALOG, never hand-typed on the curated entry, so a future planCatalog.js change flows
// through automatically (same discipline as `attachments.proOnly` above). This is the ONLY place
// a capability's plan facts are computed; capabilityTruth.ts (the Edge Function's deterministic
// router) only ever reads this projection, never re-derives entitlement itself.
function derivePlanAvailability(entitlementKey) {
  if (!entitlementKey || entitlementKey === 'monthlyQuoteLimit') {
    // No boolean plan gate (or a numeric-limit capability that is available on every plan, just
    // with a different limit — see AI_FACTS.quoteLimits) — available on every plan.
    return { free: true, basic: true, pro: true };
  }
  return {
    free: PLAN_CATALOG.free.entitlements[entitlementKey] === true,
    basic: PLAN_CATALOG.basic.entitlements[entitlementKey] === true,
    pro: PLAN_CATALOG.pro.entitlements[entitlementKey] === true,
  };
}

function minimumPlanFor(planAvailability) {
  if (planAvailability.free) return 'free';
  if (planAvailability.basic) return 'basic';
  if (planAvailability.pro) return 'pro';
  return null; // no plan grants it — only valid for a capability with a non-plan gate (e.g. role-only)
}

function projectCapability(c) {
  const planAvailability = derivePlanAvailability(c.entitlementKey);
  return {
    id: c.id,
    heLabel: c.heLabel,
    enLabel: c.enLabel,
    heDescription: c.heDescription,
    enDescription: c.enDescription,
    state: c.state,
    markets: c.markets,
    currencies: c.currencies,
    planAvailability,
    minimumPlan: c.entitlementKey ? minimumPlanFor(planAvailability) : null,
    aiMayExplain: c.aiMayExplain,
    aiMayNavigate: c.aiMayNavigate,
    safeNavigationId: c.safeNavigationId,
    aiMayClaimExecution: false,
    forbiddenClaimCodes: c.forbiddenClaimCodes,
    deterministicFactKeys: c.deterministicFactKeys,
  };
}

// The 2 non-current entries whose state tracks a live source flag (payment/invoicing) — never a
// second hand-typed boolean; state is computed from the SAME flags the `billing`/`invoicing`
// records above use. autonomous_email/ai_mutation pass their curated ROADMAP_POST_LIVE through
// unchanged (no source flag exists for a roadmap item).
function projectNonCurrentCapability(c) {
  let state = c.state || CAPABILITY_STATES.ROADMAP_POST_LIVE;
  if (c.id === 'payment_processing') state = LIVE_CHECKOUT_AVAILABLE ? CAPABILITY_STATES.LIVE_CURRENT : CAPABILITY_STATES.UNAVAILABLE;
  if (c.id === 'invoicing') state = LIVE_INVOICING_AVAILABLE ? CAPABILITY_STATES.LIVE_CURRENT : CAPABILITY_STATES.UNAVAILABLE;
  return {
    id: c.id, heLabel: c.heLabel, enLabel: c.enLabel, heDescription: c.heDescription, enDescription: c.enDescription,
    state, forbiddenClaimCodes: c.forbiddenClaimCodes,
  };
}

// Pure - no filesystem/network access, so it can be unit-tested directly
// against the canonical modules' current values.
export function generateAiFacts() {
  return {
    schemaVersion: AI_FACTS_SCHEMA_VERSION,
    supportEmail: { he: SUPPORT_EMAIL_HE, en: SUPPORT_EMAIL_EN },
    vatRate: { il: REGION_RULES.LOCAL.vatRate, international: REGION_RULES.INTERNATIONAL.vatRate },
    trialDays: TRIAL_DAYS,
    quoteLimits: { free: quoteLimitFor('free'), basic: quoteLimitFor('basic'), pro: quoteLimitFor('pro') },
    attachments: {
      // Derived, not hardcoded: true only if PRO has the entitlement and
      // BASIC does not - if that ever changes in planCatalog.js, this
      // fact changes with it automatically instead of silently going stale.
      proOnly: PLAN_CATALOG.pro.entitlements.attachments === true && PLAN_CATALOG.basic.entitlements.attachments === false,
      maxFileMb: MAX_ATTACHMENT_FILE_MB,
      maxTotalMb: MAX_ATTACHMENT_TOTAL_MB,
    },
    pricing: {
      il: marketPricing(PRICING_CATALOG.il),
      usd: marketPricing(PRICING_CATALOG.global.usd),
      gbp: marketPricing(PRICING_CATALOG.global.gbp),
      eur: marketPricing(PRICING_CATALOG.global.eur),
    },
    // billing-checkout-stub is a documented scaffold only (see its own
    // header comment) - no live payment/checkout integration exists for
    // ANY currency yet. Every price above is DISPLAY-only. Do not flip this
    // to true without a real payment-provider integration behind it.
    //
    // OD-C2 (2026-09-21): the negative capability is now a full record, so downstream consumers cannot infer a
    // payment capability from adjacent facts (display currency, quote currency, plan price). Every field is
    // derived from ONE source flag; nothing here may be flipped independently. chat-ai/paymentTruth.ts is the
    // only consumer (deterministic answer + authoritative prompt block).
    billing: {
      liveCheckoutAvailable: LIVE_CHECKOUT_AVAILABLE,
      paymentProcessingAvailable: LIVE_CHECKOUT_AVAILABLE,
      acceptedPaymentCurrencies: [],
      paymentMethodsKnown: false,
    },
    // Invoicing truth - as deterministic as payment truth. Distinct from: quote PDF (a quote document, not a tax invoice), quote email
    // (sends the quote), and the quote "Paid" status (a label the business sets manually; it does not collect money or issue a receipt).
    invoicing: {
      liveInvoicingAvailable: LIVE_INVOICING_AVAILABLE,
      invoiceIssuanceAvailable: LIVE_INVOICING_AVAILABLE,
      receiptIssuanceAvailable: LIVE_INVOICING_AVAILABLE,
      providerCandidate: INVOICING_PROVIDER_CANDIDATE,
      providerStatus: LIVE_INVOICING_AVAILABLE ? 'live' : 'candidate_not_integrated',
    },
    // Product Truth Registry Edge/AI projection (TEKANGO_AI_ARCHITECTURE.md v2.5 §52). Curated
    // source: src/data/productTruthRegistry.js. capabilityTruth.ts (chat-ai) is the only runtime
    // consumer. Do not hand-maintain a second capability table anywhere else.
    capabilities: PRODUCT_TRUTH_REGISTRY.map(projectCapability),
    nonCurrentCapabilities: NON_CURRENT_REGISTRY.map(projectNonCurrentCapability),
  };
}

function renderFile(facts) {
  return `// GENERATED FILE - do not hand-edit.
// Regenerate with: node scripts/generate-ai-chat-facts.js
// Source of truth: src/utils/pricingCatalog.js, src/utils/planCatalog.js,
// src/shared/brand.js, src/utils/regionConfig.js (plus two parity-tested
// literals documented in scripts/generate-ai-chat-facts.js).
// Staleness is enforced by supabase/functions/chat-ai/aiFacts.parity.test.js.
export const AI_FACTS = ${JSON.stringify(facts, null, 2)} as const;
`;
}

export function isGeneratedFileStale() {
  const expected = renderFile(generateAiFacts());
  if (!existsSync(OUTPUT_PATH)) return true;
  const actual = readFileSync(OUTPUT_PATH, 'utf-8');
  return actual !== expected;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const stale = isGeneratedFileStale();

  if (checkOnly) {
    if (stale) {
      console.error('aiFacts.generated.ts is STALE relative to canonical sources. Run: node scripts/generate-ai-chat-facts.js');
      process.exit(1);
    }
    console.log('aiFacts.generated.ts is up to date.');
    process.exit(0);
  }

  writeFileSync(OUTPUT_PATH, renderFile(generateAiFacts()), 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main();
}
