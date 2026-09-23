// PRODUCT TRUTH — STRUCTURED RUNTIME ANSWER CONTRACT (Codex "structured answer state that
// actually drives runtime formatter" finding, 2026-09-2X).
//
// Codex found that claimCodes.ts/forbiddenClaimSemantics.js exist, but the runtime formatter
// (capabilityTruth.ts's formatCapabilityTruthAnswer) never consumed a structured object - it
// branched directly on the raw CapabilityFact's own loose fields (fact.state, fact.minimumPlan,
// fact.authorityType, ...) and hand-assembled prose per branch, so a regex-on-prose check remained
// the ONLY thing standing between a future wording change and a false claim slipping through.
//
// This module is the structural fix: resolveCapabilityAnswerState() computes ONE fully-typed
// answer-state object for a given capability BEFORE any prose is built. formatCapabilityTruthAnswer
// (capabilityTruth.ts) now reads every value it renders FROM this object, never re-deriving a fact
// from the raw CapabilityFact inline. checkStructuredStateInvariants() (below) validates the state
// itself against the hard product invariants (payment/checkout/invoicing/AI-execution/provider-
// exposure) - a check that can never be bypassed by ANY prose wording, paraphrase, or synonym,
// because it never looks at the rendered text at all. Regex prose checks (claimCodes.ts /
// forbiddenClaimSemantics.js) remain, by design, a SECOND, textual defense-in-depth layer - never
// the primary or only semantic gate.
import { AI_FACTS } from "./aiFacts.generated.ts";
import type { CapabilityFact, NonCurrentCapabilityFact, CapabilityFacts } from "./capabilityTruth.ts";

export type AvailabilityState =
  | 'LIVE_CURRENT' | 'FIRST_LIVE_CANDIDATE' | 'TEST_ONLY' | 'IMPLEMENTED_NOT_RELEASED'
  | 'ROADMAP_POST_LIVE' | 'UNAVAILABLE' | 'DEPRECATED' | 'UNKNOWN_CAPABILITY';

export type PlanRestriction = { readonly minimumPlan: string; readonly accountHasIt: boolean | null } | null;
export type RoleRestriction = { readonly requiredRole: string; readonly accountHasRole: boolean | null } | null;
export type MarketRestriction = { readonly markets: readonly string[] } | null;
export type RateSourceState = 'live_feed' | 'fallback_not_live' | 'indicative_estimate' | 'not_applicable';
export type MetalsRateState = 'independent_live_feed' | 'estimate_from_fx_rate' | 'not_applicable';
export type PaidStatusMeaning = 'manual_label_only' | 'not_applicable';

// Capabilities whose displayed conversion numbers are a FIXED fallback, never a live-fetched rate
// (forbiddenClaimCodes: NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP in the registry). A structural fact
// about today's real implementation, not something re-guessed per answer.
const FALLBACK_RATE_CAPABILITY_IDS = new Set(['editor_calculator', 'editor_currency_converter']);
// Capabilities whose conversion numbers ARE fetched from a live third-party feed at request time
// (per their own registry description: public_currency_converter/public_crypto_calculator).
const LIVE_FEED_RATE_CAPABILITY_IDS = new Set(['public_currency_converter', 'public_crypto_calculator']);

export type CapabilityAnswerState = {
  readonly capabilityId: string;
  readonly availabilityState: AvailabilityState;
  readonly userActionAvailable: boolean;
  readonly aiExecutionAllowed: boolean;
  readonly paymentProcessingAvailable: boolean;
  readonly checkoutAvailable: boolean;
  readonly invoicingAvailable: boolean;
  readonly paidStatusMeaning: PaidStatusMeaning;
  readonly quotePdfIsInvoice: boolean;
  readonly emailIsInvoiceIssuance: boolean;
  readonly lifecycleSelfServiceAvailable: boolean | null;
  readonly rateSourceState: RateSourceState;
  readonly metalsRateState: MetalsRateState;
  readonly providerExposureAllowed: boolean;
  readonly planRestriction: PlanRestriction;
  readonly marketRestriction: MarketRestriction;
  readonly navigationAllowed: boolean;
  readonly roleRestriction: RoleRestriction;
};

function findFact(id: string, facts: CapabilityFacts): CapabilityFact | NonCurrentCapabilityFact | undefined {
  return facts.capabilities.find((c) => c.id === id) || facts.nonCurrentCapabilities.find((c) => c.id === id);
}

function isCurrentFact(fact: CapabilityFact | NonCurrentCapabilityFact | undefined): fact is CapabilityFact {
  return !!fact && (fact as CapabilityFact).markets !== undefined;
}

/**
 * Resolves the ONE structured answer-state object for a capability id (or the
 * account_lifecycle_not_self_service sentinel), BEFORE any prose is generated. Every field is
 * derived from real facts (the generated registry projection + AI_FACTS.billing/invoicing, the
 * SAME single source flags paymentTruth.ts/invoicingTruth.ts use - never a second hand-typed
 * boolean here) - never guessed, never left implicit inside prose branching.
 */
export function resolveCapabilityAnswerState(
  id: string,
  facts: CapabilityFacts,
  accountTier: string | null = null,
  isAdmin: boolean | null = null,
): CapabilityAnswerState | null {
  // The router-only sentinel (not one of the 38 ids): account lifecycle is not self-service today.
  if (id === 'account_lifecycle_not_self_service') {
    return Object.freeze({
      capabilityId: id,
      availabilityState: 'UNAVAILABLE',
      userActionAvailable: false,
      aiExecutionAllowed: false,
      paymentProcessingAvailable: AI_FACTS.billing.paymentProcessingAvailable,
      checkoutAvailable: AI_FACTS.billing.liveCheckoutAvailable,
      invoicingAvailable: AI_FACTS.invoicing.invoiceIssuanceAvailable,
      paidStatusMeaning: 'not_applicable',
      quotePdfIsInvoice: false,
      emailIsInvoiceIssuance: false,
      lifecycleSelfServiceAvailable: false,
      rateSourceState: 'not_applicable',
      metalsRateState: 'not_applicable',
      providerExposureAllowed: false,
      planRestriction: null,
      marketRestriction: null,
      navigationAllowed: false,
      roleRestriction: null,
    });
  }

  const fact = findFact(id, facts);
  if (!fact) {
    return Object.freeze({
      capabilityId: id,
      availabilityState: 'UNKNOWN_CAPABILITY',
      userActionAvailable: false,
      aiExecutionAllowed: false,
      paymentProcessingAvailable: AI_FACTS.billing.paymentProcessingAvailable,
      checkoutAvailable: AI_FACTS.billing.liveCheckoutAvailable,
      invoicingAvailable: AI_FACTS.invoicing.invoiceIssuanceAvailable,
      paidStatusMeaning: 'not_applicable',
      quotePdfIsInvoice: false,
      emailIsInvoiceIssuance: false,
      lifecycleSelfServiceAvailable: null,
      rateSourceState: 'not_applicable',
      metalsRateState: 'not_applicable',
      providerExposureAllowed: false,
      planRestriction: null,
      marketRestriction: null,
      navigationAllowed: false,
      roleRestriction: null,
    });
  }

  const current = isCurrentFact(fact) ? fact : undefined;

  let planRestriction: PlanRestriction = null;
  if (current?.minimumPlan && current.minimumPlan !== 'free') {
    const accountHasIt = accountTier && current.planAvailability
      ? current.planAvailability[accountTier as 'free' | 'basic' | 'pro'] === true
      : null;
    planRestriction = { minimumPlan: current.minimumPlan, accountHasIt };
  }

  let roleRestriction: RoleRestriction = null;
  if (current?.authorityType === 'role' && current.requiredRole) {
    roleRestriction = { requiredRole: current.requiredRole, accountHasRole: isAdmin };
  }

  const marketRestriction: MarketRestriction =
    current?.markets && current.markets.length > 0 && current.markets.length < 2 ? { markets: current.markets } : null;

  let rateSourceState: RateSourceState = 'not_applicable';
  if (FALLBACK_RATE_CAPABILITY_IDS.has(id)) rateSourceState = 'fallback_not_live';
  else if (LIVE_FEED_RATE_CAPABILITY_IDS.has(id)) rateSourceState = 'live_feed';
  else if (id === 'public_metals_calculator') rateSourceState = 'indicative_estimate';

  const metalsRateState: MetalsRateState = id === 'public_metals_calculator' ? 'estimate_from_fx_rate' : 'not_applicable';

  return Object.freeze({
    capabilityId: id,
    availabilityState: (fact.state as AvailabilityState) || 'UNKNOWN_CAPABILITY',
    userActionAvailable: current ? (current as any).userActionAvailable ?? true : false,
    // Hard invariant, never conditional on any per-capability data: the AI never itself performs
    // a mutating action (§52.8). Structural, not a value that could ever be flipped by a fact.
    aiExecutionAllowed: false,
    // Global negative-capability truth (OD-C2) - the SAME single source flags every deterministic
    // answer function reads; never re-derived or duplicated per capability.
    paymentProcessingAvailable: AI_FACTS.billing.paymentProcessingAvailable,
    checkoutAvailable: AI_FACTS.billing.liveCheckoutAvailable,
    invoicingAvailable: AI_FACTS.invoicing.invoiceIssuanceAvailable,
    paidStatusMeaning: id === 'quote_status' ? 'manual_label_only' : 'not_applicable',
    // Hard invariants for the two capabilities Codex's NO_INVOICE_CONFLATION code covers - a quote
    // PDF/email is never an invoice-issuance event, structurally, regardless of wording.
    quotePdfIsInvoice: false,
    emailIsInvoiceIssuance: false,
    lifecycleSelfServiceAvailable: null,
    rateSourceState,
    metalsRateState,
    // Hard invariant: no payment provider name may ever be presented as live/customer-facing while
    // checkoutAvailable is false (mirrors the PayPlus forbidden-claim pattern structurally).
    providerExposureAllowed: AI_FACTS.billing.liveCheckoutAvailable,
    planRestriction,
    marketRestriction,
    navigationAllowed: !!current?.aiMayNavigate,
    roleRestriction,
  });
}

export type StructuredInvariantViolation = { readonly code: string; readonly reason: string };

/**
 * Validates a resolved CapabilityAnswerState against the hard product invariants - checks the
 * STATE, never the rendered prose, so no paraphrase/synonym/wording change can ever bypass it.
 * Returns violations (empty = clean). This is the PRIMARY semantic gate; forbiddenClaimSemantics.js
 * (regex-on-prose) is defense-in-depth underneath it, never the other way around.
 */
export function checkStructuredStateInvariants(state: CapabilityAnswerState): StructuredInvariantViolation[] {
  const violations: StructuredInvariantViolation[] = [];
  if (state.aiExecutionAllowed !== false) {
    violations.push({ code: 'NO_AI_EXECUTION_CLAIM', reason: 'aiExecutionAllowed must always be false' });
  }
  if (state.quotePdfIsInvoice !== false) {
    violations.push({ code: 'NO_INVOICE_CONFLATION', reason: 'quotePdfIsInvoice must always be false' });
  }
  if (state.emailIsInvoiceIssuance !== false) {
    violations.push({ code: 'NO_INVOICE_CONFLATION', reason: 'emailIsInvoiceIssuance must always be false' });
  }
  if (state.paymentProcessingAvailable === true && AI_FACTS.billing.paymentProcessingAvailable !== true) {
    violations.push({ code: 'NO_PAYMENT_CAPABILITY_CLAIM', reason: 'paymentProcessingAvailable does not match the global billing truth' });
  }
  if (state.checkoutAvailable === true && AI_FACTS.billing.liveCheckoutAvailable !== true) {
    violations.push({ code: 'NO_PAYMENT_CAPABILITY_CLAIM', reason: 'checkoutAvailable does not match the global billing truth' });
  }
  if (state.invoicingAvailable === true && AI_FACTS.invoicing.invoiceIssuanceAvailable !== true) {
    violations.push({ code: 'NO_INVOICING_CAPABILITY_CLAIM', reason: 'invoicingAvailable does not match the global invoicing truth' });
  }
  if (state.providerExposureAllowed === true && AI_FACTS.billing.liveCheckoutAvailable !== true) {
    violations.push({ code: 'NO_PAYMENT_CAPABILITY_CLAIM', reason: 'providerExposureAllowed is true while checkout is not live' });
  }
  if (state.paidStatusMeaning === 'manual_label_only' && (state.paymentProcessingAvailable === true || state.checkoutAvailable === true)) {
    violations.push({ code: 'NO_PAID_STATUS_AS_PAYMENT_COLLECTION', reason: 'a manual paid-status label must never coincide with an active payment-collection claim' });
  }
  if (state.rateSourceState === 'fallback_not_live' && state.metalsRateState === 'independent_live_feed') {
    violations.push({ code: 'NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP', reason: 'a fallback rate source can never simultaneously be an independent live feed' });
  }
  if (state.metalsRateState === 'independent_live_feed') {
    // No capability today has an independent, non-FX-derived live metals feed - this branch exists
    // so a future mutation toward it is caught structurally, not merely by prose wording.
    violations.push({ code: 'NO_LIVE_METALS_FEED_CLAIM', reason: 'metalsRateState must never be an independent live feed (today: FX-derived estimate only)' });
  }
  if (state.lifecycleSelfServiceAvailable === true) {
    violations.push({ code: 'NO_LIFECYCLE_SELF_SERVICE_CLAIM', reason: 'account/subscription lifecycle is never self-service today' });
  }
  return violations;
}
