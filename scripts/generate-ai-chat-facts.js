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
// SUBSCRIPTIONS CUTOVER (OD-01..OD-20, 2026-10-07): the commercial facts now come ONLY from the canonical subscription
// sources - supabase/functions/_shared/subscriptionContract.ts (plan ids/names, Free-10, capability metadata) and
// src/domain/subscriptions/priceCatalog.js (the Owner-approved price rows). The legacy pricingCatalog.js / planCatalog.js
// (old two-tier plans, trial, monthly limits, annual pricing) are no longer a source of any AI fact. Values that the
// Owner has not decided (paid quote limits, capability matrix, storage, AI quotas, attachments, lifecycle, annual, tax
// beyond the IL inclusion) are NOT invented here - they are listed in `subscriptions.notDecided`.
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

import { SUPPORT_EMAIL_HE, SUPPORT_EMAIL_EN } from '../src/shared/brand.js';
import { REGION_RULES } from '../src/utils/regionConfig.js';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY, CAPABILITY_STATES } from '../src/data/productTruthRegistry.js';
import { PRODUCT_HOW_TO, projectHowTo } from '../src/data/productHowTo.js';
import { SUBSCRIPTION_ADD_ONS } from '../src/domain/subscriptions/addOnCatalog.js';
import {
  PRICE_CATALOG_VERSION, PRICE_VERSIONS, BILLING_CURRENCY, CATALOG_PRODUCTS_INCLUDED, CATALOG_BLOCK_PRODUCTS, approvedPrice,
} from '../src/domain/subscriptions/priceCatalog.js';
import { PLAN_IDS, PLAN_NAMES, FREE_QUOTES_TOTAL, OUTPUT_CHANNELS, CAPABILITIES, CURRENT_PAID_PLAN_ID, LEGACY_PAID_PLAN_IDS } from '../supabase/functions/_shared/subscriptionContract.ts';
// Task 27 (§249 + the Owner's 2026-10-11 amendment): the current offer is the ONE all-inclusive package (monthly / annual).
import { PACKAGE_CATALOG_VERSION, packagePrice, annualSavingMinor, annualSavingPercent } from '../src/domain/subscriptions/packageCatalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'supabase', 'functions', 'chat-ai', 'aiFacts.generated.ts');

// v2 (subscriptions cutover): removed trialDays / quoteLimits / attachments / pricing (legacy), added `subscriptions`.
// v3 (Task 27): subscriptions.prices.<market>.package (monthly / annual / saving) replaces the per-style-plan monthly prices; the old
// style plans are listed only as legacy plan identities (existing rights).
export const AI_FACTS_SCHEMA_VERSION = 3;

// The single source flag for the subscription system (CROSSCUT_CONTRACT §0: the live TEST/Production activation phase is
// 'off'). While false, no assistant answer may claim an active plan, an active balance, purchase availability or a trial.
// Do not flip without an Owner activation decision AND a server account summary that reports the phase.
const SUBSCRIPTION_PLAN_SYSTEM_ACTIVE = false;

// The Owner decisions that are explicitly NOT decided (OWNER_DECISIONS_LOCKED_2026-10-07.md §4/§5). Never state a value.
const NOT_DECIDED = Object.freeze([
  'paid_plan_quote_limits', // OPEN-01
  'capability_matrix', // OPEN-02
  'free_catalog_limit', // OPEN-03
  'storage', // OPEN-04
  'ai_quotas', // OPEN-05
  'cancellation_refund_proration', // OPEN-09
  'tax_beyond_il_inclusion', // OPEN-11
  'attachments', // OPEN-13
]);

const money = (amountMinor) => (amountMinor / 100).toFixed(2);

function marketPrices(market) {
  const pct = annualSavingPercent(market);
  return {
    billingCurrency: BILLING_CURRENCY[market],
    package: {
      id: CURRENT_PAID_PLAN_ID,
      month: money(packagePrice(market, 'month').amountMinor),
      year: money(packagePrice(market, 'year').amountMinor),
      annualSaving: money(annualSavingMinor(market)),
      annualSavingPercentRounded: Math.round(pct),
      annualSavingPercentExact: Number.isInteger(pct),
    },
    catalogBlock100: money(approvedPrice(market, 'catalog_block_100').amountMinor),
  };
}

function subscriptionFacts() {
  return {
    source: 'supabase/functions/_shared/subscriptionContract.ts + src/domain/subscriptions/packageCatalog.js + src/domain/subscriptions/priceCatalog.js',
    priceCatalogVersion: PRICE_CATALOG_VERSION,
    packageCatalogVersion: PACKAGE_CATALOG_VERSION,
    currentPaidPlanId: CURRENT_PAID_PLAN_ID,
    legacyPaidPlanIds: [...LEGACY_PAID_PLAN_IDS],
    stylesAreNotPlans: true,
    planSystemActive: SUBSCRIPTION_PLAN_SYSTEM_ACTIVE,
    activationPhase: SUBSCRIPTION_PLAN_SYSTEM_ACTIVE ? 'enforced' : 'off',
    // OD-01: there is no trial for any account.
    trialOffered: false,
    // Current account state (plan, balance, capabilities) comes ONLY from the server account summary (account-summary/v1).
    accountStateSource: 'get_account_summary',
    plans: PLAN_IDS.map((id) => ({ id, he: PLAN_NAMES.he[id], en: PLAN_NAMES.en[id] })),
    free: {
      quotesTotal: FREE_QUOTES_TOTAL, // OD-01
      expires: false,
      // OD-02: a quote uses one the FIRST time it reaches a client through one of these channels.
      consumingChannels: [...OUTPUT_CHANNELS],
      draftsAndPreviewsConsume: false,
      reuseConsumesAgain: false,
      deleteRefunds: false,
      existingDocumentsStayAccessible: true,
    },
    prices: {
      // OD-03/04/05: ILS per month, consumer price INCLUDING VAT - nothing is ever added on top.
      IL: { ...marketPrices('IL'), taxIncluded: true },
      // OD-06/07/08: canonical billing currency USD; a local-currency figure is only a labelled estimate.
      INTERNATIONAL: { ...marketPrices('INTERNATIONAL'), localCurrencyDisplayIsEstimateOnly: true },
    },
    catalog: {
      includedProductsPerPaidPlan: CATALOG_PRODUCTS_INCLUDED, // OD-04
      blockProducts: CATALOG_BLOCK_PRODUCTS,
      blockRequiresExplicitPurchase: true,
      catalogCapacityUnlocksStyleOrMedia: false, // OD-09
    },
    notDecided: [...NOT_DECIDED],
  };
}

// The single source flag for payment capability (see the billing record in generateAiFacts()).
const LIVE_CHECKOUT_AVAILABLE = false;
// The single source flag for invoicing capability (AI-HELP-AVAILABILITY-001 / First-LIVE truth, 2026-09-22). PayPlus is a documented
// provider CANDIDATE only (INVOICING_INFRASTRUCTURE.md: offer received, not signed, integration not started) - no invoice / receipt /
// tax document is issued by TEKANGO today. Do not flip without a live, verified integration.
const LIVE_INVOICING_AVAILABLE = false;
const INVOICING_PROVIDER_CANDIDATE = 'PayPlus';

// Product Truth Registry (TEKANGO_AI_ARCHITECTURE.md v2.5 §52) — the Edge/AI-facing PROJECTION of the curated registry
// (src/data/productTruthRegistry.js). Subscription gating is DERIVED here from the canonical capability metadata
// (subscriptionContract.ts CAPABILITIES): eligiblePlans is null there for every capability (OPEN-02 / OPEN-13), so no plan
// availability and no minimum plan is ever projected. capabilityTruth.ts only reads this projection.
function projectCapability(c) {
  const meta = c.subscriptionCapabilityId ? CAPABILITIES[c.subscriptionCapabilityId] : null;
  if (c.subscriptionCapabilityId && !meta) throw new Error(`registry capability "${c.id}" names an unknown subscription capability "${c.subscriptionCapabilityId}"`);
  return {
    id: c.id,
    heLabel: c.heLabel,
    enLabel: c.enLabel,
    heDescription: c.heDescription,
    enDescription: c.enDescription,
    state: c.state,
    markets: c.markets,
    currencies: c.currencies,
    subscriptionCapabilityId: c.subscriptionCapabilityId,
    // 'not_decided' while the canonical metadata has no approved eligible plans; null for an ungated capability.
    planEligibility: meta ? (meta.eligiblePlans ? 'decided' : 'not_decided') : null,
    eligiblePlans: meta?.eligiblePlans ? [...meta.eligiblePlans] : null,
    minimumPlan: null,
    // Codex defect 6 (2026-09-22): role authority is a separate axis from subscription gating — passed through as curated.
    authorityType: c.authorityType,
    requiredRole: c.requiredRole,
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
    // Task 21: optional one-sentence note the deterministic NOT_AVAILABLE answer adds (e.g. the internal Calendar exists).
    ...(c.heAnswerNote ? { heAnswerNote: c.heAnswerNote, enAnswerNote: c.enAnswerNote } : {}),
  };
}

// Pure - no filesystem/network access, so it can be unit-tested directly
// against the canonical modules' current values.
export function generateAiFacts() {
  return {
    schemaVersion: AI_FACTS_SCHEMA_VERSION,
    supportEmail: { he: SUPPORT_EMAIL_HE, en: SUPPORT_EMAIL_EN },
    // The VAT a business's OWN quotes apply to its clients (regionConfig.js) - a quote-editor fact, NOT a statement about
    // TEKANGO subscription prices (IL subscription prices already include VAT - subscriptions.prices.IL.taxIncluded).
    vatRate: { il: REGION_RULES.LOCAL.vatRate, international: REGION_RULES.INTERNATIONAL.vatRate },
    subscriptions: subscriptionFacts(),
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
    // Owner 2026-10-20 (L-14): the verified "how do I ..." steps (src/data/productHowTo.js; every quoted label is checked against
    // its source file by productHowTo.test.js). chat-ai/howToTruth.ts renders them for the chat and the support email assistant.
    howTo: PRODUCT_HOW_TO.map(projectHowTo),
    // Owner 2026-10-20 (L-14, typed "חכם פלוס בעובדות המוצר (תוכן, מחיר, עדיין לא לרכישה)"): the subscription add-ons from
    // src/domain/subscriptions/addOnCatalog.js. chat-ai/addOnTruth.ts renders them; purchase is not open.
    addOns: SUBSCRIPTION_ADD_ONS.map((a) => ({
      id: a.id, name: { ...a.name }, optional: a.optional, sameBillingPeriodAsMainPlan: a.sameBillingPeriodAsMainPlan, purchasable: a.purchasable,
      prices: { IL: { currency: a.priceMinor.IL.currency, month: (a.priceMinor.IL.month / 100).toFixed(2), year: (a.priceMinor.IL.year / 100).toFixed(2), taxIncluded: a.priceMinor.IL.taxIncluded },
        INTERNATIONAL: { currency: a.priceMinor.INTERNATIONAL.currency, month: (a.priceMinor.INTERNATIONAL.month / 100).toFixed(2), year: (a.priceMinor.INTERNATIONAL.year / 100).toFixed(2) } },
      includes: { he: [...a.includes.he], en: [...a.includes.en] }, comingSoon: { he: [...a.comingSoon.he], en: [...a.comingSoon.en] },
    })),
  };
}

// Exported for tests: every approved price row must be reachable from the generated facts (no row silently dropped).
export const APPROVED_PRICE_ROW_COUNT = PRICE_VERSIONS.length;

function renderFile(facts) {
  return `// GENERATED FILE - do not hand-edit.
// Regenerate with: node scripts/generate-ai-chat-facts.js
// Source of truth: supabase/functions/_shared/subscriptionContract.ts, src/domain/subscriptions/priceCatalog.js,
// src/data/productTruthRegistry.js, src/data/productHowTo.js, src/domain/subscriptions/addOnCatalog.js, src/shared/brand.js, src/utils/regionConfig.js.
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
