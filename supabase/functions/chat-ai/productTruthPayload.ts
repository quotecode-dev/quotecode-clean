// PRODUCT TRUTH - STRUCTURED TRUTH PAYLOAD BUILDERS (see supabase/functions/_shared/productTruthContract.ts).
//
//   canonical authority  ->  structured truth (built here)  ->  prose (capabilityTruth.ts / paymentTruth.ts / ... consume it)
//
// Every builder derives the payload ONLY from canonical authority: the capability registry projection
// (CapabilityAnswerState, itself resolved from AI_FACTS.capabilities), the AI_FACTS billing / invoicing flags, and the
// SERVER-VERIFIED account facts (tier / market / role - never anything the caller claimed). No builder ever reads, parses
// or receives generated prose. Every payload is validated (validateProductTruthPayload) before it is returned: a payload
// that would contradict itself throws - the request fails closed rather than emitting a wrong structured truth.
import {
  PLAN_TIER_VALUES, PRODUCT_TRUTH_PAYLOAD_KEYS, PRODUCT_TRUTH_PAYLOAD_KIND, PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION, validateProductTruthPayload,
  type AccountEntitlement, type AccountMarket, type ClaimScope, type MarketScope, type ProductTruthFactPayload, type RegistryState, type TruthStatus,
} from "../_shared/productTruthContract.ts";
import type { CapabilityAnswerState } from "./capabilityAnswerState.ts";
import type { CapabilityFact, CapabilityFacts, NonCurrentCapabilityFact } from "./capabilityTruth.ts";
import type { BillingFacts } from "./paymentTruth.ts";
import type { InvoicingFacts } from "./invoicingTruth.ts";

/** The SERVER-VERIFIED account facts a payload is resolved against. `null` everywhere = no verified account (public chat). */
export type PayloadAccountFacts = {
  readonly market: 'Local' | 'International' | 'Unknown' | null;
  readonly tier: string | null;
  readonly isAdmin: boolean | null;
};
export const NO_ACCOUNT_FACTS: PayloadAccountFacts = Object.freeze({ market: null, tier: null, isAdmin: null });

export class ProductTruthPayloadError extends Error {
  readonly problems: readonly string[];
  constructor(message: string, problems: readonly string[]) {
    super(`${message}: ${problems.join(', ')}`);
    this.name = 'ProductTruthPayloadError';
    this.problems = problems;
  }
}

function mapMarket(m: PayloadAccountFacts['market']): AccountMarket | null {
  return m === 'Local' ? 'LOCAL' : m === 'International' ? 'INTERNATIONAL' : null;
}
function mapPlan(tier: string | null): string | null {
  return tier !== null && (PLAN_TIER_VALUES as readonly string[]).includes(tier) ? tier : null;
}
function mapRole(isAdmin: boolean | null): string | null {
  return isAdmin === null ? null : isAdmin ? 'super_admin' : 'user';
}

type Base = Pick<ProductTruthFactPayload, 'kind' | 'schemaVersion' | 'accountPlan' | 'accountRole' | 'accountMarket'>;
function base(acct: PayloadAccountFacts): Base {
  return {
    kind: PRODUCT_TRUTH_PAYLOAD_KIND,
    schemaVersion: PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION,
    accountPlan: mapPlan(acct.tier),
    accountRole: mapRole(acct.isAdmin),
    accountMarket: mapMarket(acct.market),
  };
}

function seal(payload: ProductTruthFactPayload): ProductTruthFactPayload {
  const problems = validateProductTruthPayload(payload);
  if (problems.length) throw new ProductTruthPayloadError(`Structured Product Truth payload for "${payload.capabilityId ?? 'clarification'}" is invalid`, problems);
  // deterministic serialisation: keys always in the contract's canonical order, whatever order a builder assembled them in
  const ordered = Object.fromEntries(PRODUCT_TRUTH_PAYLOAD_KEYS.map((k) => [k, (payload as Record<string, unknown>)[k]])) as unknown as ProductTruthFactPayload;
  return Object.freeze({ ...ordered, comparedCapabilityIds: payload.comparedCapabilityIds ? Object.freeze([...payload.comparedCapabilityIds]) : null });
}

const NEUTRAL = {
  marketScope: 'NOT_APPLICABLE' as MarketScope,
  currencyScope: 'NOT_APPLICABLE' as const,
  registryState: null as RegistryState | null,
  minimumPlan: null as string | null,
  requiredRole: null as string | null,
  accountEntitlement: 'NOT_APPLICABLE' as AccountEntitlement,
  comparedCapabilityIds: null as readonly string[] | null,
};

function capabilityMarketScope(fact: CapabilityFact | NonCurrentCapabilityFact): MarketScope {
  const markets = (fact as CapabilityFact).markets;
  if (!markets || markets.length === 0) return 'NOT_APPLICABLE';
  const local = markets.includes('local');
  const intl = markets.includes('international');
  return local && intl ? 'BOTH' : local ? 'LOCAL' : intl ? 'INTERNATIONAL' : 'UNKNOWN';
}

/** A registry capability answer: derived from the resolved CapabilityAnswerState (registry) + the verified account facts. */
export function buildCapabilityFactPayload(state: CapabilityAnswerState, fact: CapabilityFact | NonCurrentCapabilityFact, acct: PayloadAccountFacts): ProductTruthFactPayload {
  const common = { ...NEUTRAL, ...base(acct), capabilityId: state.capabilityId, source: 'CAPABILITY_REGISTRY' as const, marketScope: capabilityMarketScope(fact) };
  if (state.availabilityState === 'UNKNOWN_CAPABILITY') {
    return seal({ ...common, truthStatus: 'UNKNOWN', claimScope: 'NOT_APPLICABLE', marketScope: 'UNKNOWN' });
  }
  const registryState = state.availabilityState as RegistryState;
  if (registryState !== 'LIVE_CURRENT') {
    return seal({ ...common, registryState, truthStatus: 'NOT_AVAILABLE', claimScope: 'CAPABILITY' });
  }
  const accountMarket = mapMarket(acct.market);
  if (state.marketRestriction && accountMarket && !state.marketRestriction.markets.includes(accountMarket.toLowerCase())) {
    return seal({ ...common, registryState, truthStatus: 'MARKET_UNAVAILABLE', claimScope: 'MARKET' });
  }
  const entitlement = (has: boolean | null): AccountEntitlement => (has === true ? 'GRANTED' : has === false ? 'DENIED' : 'UNKNOWN');
  if (state.roleRestriction) {
    const e = entitlement(state.roleRestriction.accountHasRole);
    const status: TruthStatus = e === 'DENIED' ? 'ROLE_LOCKED' : 'AVAILABLE';
    const claimScope: ClaimScope = e === 'UNKNOWN' ? 'CAPABILITY' : 'ACCOUNT';
    return seal({ ...common, registryState, truthStatus: status, claimScope, requiredRole: state.roleRestriction.requiredRole, accountEntitlement: e });
  }
  if (state.planRestriction) {
    const e = entitlement(state.planRestriction.accountHasIt);
    const status: TruthStatus = e === 'DENIED' ? 'PLAN_LOCKED' : 'AVAILABLE';
    const claimScope: ClaimScope = e === 'UNKNOWN' ? 'CAPABILITY' : 'ACCOUNT';
    return seal({ ...common, registryState, truthStatus: status, claimScope, minimumPlan: state.planRestriction.minimumPlan, accountEntitlement: e });
  }
  return seal({ ...common, registryState, truthStatus: 'AVAILABLE', claimScope: 'CAPABILITY' });
}

/** OD-C2: derived from AI_FACTS.billing. Fail closed - anything but an explicit, fully-positive record is "not live". */
export function buildPaymentFactPayload(billing: BillingFacts | undefined | null, acct: PayloadAccountFacts): ProductTruthFactPayload {
  const live = billing?.liveCheckoutAvailable === true && billing?.paymentProcessingAvailable === true;
  return seal({ ...NEUTRAL, ...base(acct), capabilityId: 'payment_processing', truthStatus: live ? 'AVAILABLE' : 'PAYMENT_NOT_LIVE', claimScope: 'PRODUCT', source: 'BILLING_FACTS', marketScope: 'BOTH' });
}

/** Derived from AI_FACTS.invoicing. Fail closed - invoicing counts as issued only when the facts explicitly say so. */
export function buildInvoicingFactPayload(inv: InvoicingFacts | undefined | null, acct: PayloadAccountFacts): ProductTruthFactPayload {
  const issued = inv?.invoiceIssuanceAvailable === true;
  return seal({ ...NEUTRAL, ...base(acct), capabilityId: 'invoicing', truthStatus: issued ? 'AVAILABLE' : 'INVOICING_NOT_ISSUED', claimScope: 'PRODUCT', source: 'INVOICING_FACTS', marketScope: 'BOTH' });
}

/** PDF vs Print: a COMPARISON of two real capabilities - it requires both to be LIVE_CURRENT in the registry. */
export function buildComparisonFactPayload(facts: CapabilityFacts, acct: PayloadAccountFacts, ids: readonly [string, string] = ['quote_pdf', 'quote_print']): ProductTruthFactPayload {
  const live = ids.every((id) => facts.capabilities.find((c) => c.id === id)?.state === 'LIVE_CURRENT');
  if (!live) throw new ProductTruthPayloadError('Comparison payload requires both compared capabilities to be LIVE_CURRENT', ids.map((id) => `not_live:${id}`));
  return seal({ ...NEUTRAL, ...base(acct), capabilityId: 'quote_pdf_vs_print_comparison', truthStatus: 'COMPARISON', claimScope: 'CAPABILITY', source: 'COMPARISON_RULES', marketScope: 'BOTH', comparedCapabilityIds: ids });
}

/** A bounded clarification: canonical truth was NOT determined, so the payload asserts nothing about any capability. */
export function buildClarificationFactPayload(acct: PayloadAccountFacts): ProductTruthFactPayload {
  return seal({ ...NEUTRAL, ...base(acct), capabilityId: null, truthStatus: 'CLARIFICATION', claimScope: 'NOT_APPLICABLE', source: 'CLARIFICATION_RULES' });
}

/** Account / subscription cancellation, archiving and permanent deletion are not self-service today (a product rule). */
export function buildLifecycleFactPayload(state: CapabilityAnswerState, acct: PayloadAccountFacts): ProductTruthFactPayload {
  return seal({
    ...NEUTRAL, ...base(acct), capabilityId: state.capabilityId,
    truthStatus: state.lifecycleSelfServiceAvailable === false ? 'NOT_AVAILABLE' : 'UNKNOWN', registryState: 'UNAVAILABLE',
    claimScope: 'PRODUCT', source: 'ACCOUNT_LIFECYCLE_RULES', marketScope: 'BOTH',
  });
}

/**
 * THIS account's verified market / currency (MARKET / CURRENCY SAFETY). Local -> ILS, International -> MULTI (the account's
 * own USD / EUR / GBP setting). The claim is ACCOUNT-scoped by construction: it can never read as a product-wide fact.
 */
export function buildAccountMarketFactPayload(acct: PayloadAccountFacts): ProductTruthFactPayload {
  const market = mapMarket(acct.market);
  if (!market) throw new ProductTruthPayloadError('Account-market payload requires a verified account market', ['account_market_unknown']);
  return seal({
    ...NEUTRAL, ...base(acct), capabilityId: 'account_market', truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', source: 'MARKET_RULES',
    marketScope: 'ACCOUNT', currencyScope: market === 'LOCAL' ? 'ILS' : 'MULTI',
  });
}
