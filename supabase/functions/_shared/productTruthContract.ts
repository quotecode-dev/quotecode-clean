// PRODUCT TRUTH - STRUCTURED TRUTH CONTRACT (Owner task "STRUCTURED TRUTH CONTRACT CLOSURE FOR PRODUCT TRUTH").
//
// Why this exists: until now a deterministic Product Truth answer reached the client as PROSE ONLY
// (`factPayload` was null), so acceptance had to re-derive what the answer claimed by parsing natural
// language - a parser that independent break-testing showed can always be out-phrased (named external
// products, time, retraction, idioms, negated quantifiers, scope/polarity composition).
//
// The contract below is the machine-readable canonical state of ONE deterministic Product Truth answer.
//
//   canonical authority  ->  structured truth (this payload)  ->  prose
//
// - It is derived ONLY from canonical authority (capability registry projection, AI_FACTS billing /
//   invoicing flags, the server-verified account plan / role / market) - never from generated prose.
// - The user-facing prose formatters consume it (they pick their branch from the payload, not from the raw
//   facts), so the two layers cannot drift apart silently.
// - Acceptance validates THIS payload first; the prose parser is only a secondary consistency check.
//
// Pure module (no Deno API, no imports): it is imported by the Edge Function AND by the acceptance code in src/.
export const PRODUCT_TRUTH_PAYLOAD_KIND = 'product_truth';
export const PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION = 1;

export const TRUTH_STATUSES = [
  'AVAILABLE', // the capability exists and is usable by (or not gated against) this account
  'NOT_AVAILABLE', // roadmap / unavailable / deprecated / not released / test-only - not a customer capability today
  'PLAN_LOCKED', // exists, plan-gated, THIS account's plan is below the minimum
  'ROLE_LOCKED', // exists, role-gated, THIS account does not hold the role
  'MARKET_UNAVAILABLE', // live, but not in this account's market
  'PAYMENT_NOT_LIVE', // no checkout / payment processing exists
  'INVOICING_NOT_ISSUED', // no invoice / receipt issuance exists
  'COMPARISON', // a factual distinction between two real capabilities (PDF vs Print)
  'ACCOUNT_MARKET', // a statement about THIS account's verified market / currency
  'CLARIFICATION', // the capability could not be determined - the answer only asks
  'UNKNOWN', // canonical truth genuinely cannot be determined (fail closed)
] as const;
export type TruthStatus = typeof TRUTH_STATUSES[number];

// Where the capability applies (registry markets) - or, for ACCOUNT_MARKET, the single account market.
export const MARKET_SCOPES = ['LOCAL', 'INTERNATIONAL', 'BOTH', 'ACCOUNT', 'NOT_APPLICABLE', 'UNKNOWN'] as const;
export type MarketScope = typeof MARKET_SCOPES[number];

// The currency the claim is about. ILS / USD / EUR / GBP are only ever ACCOUNT- or MARKET-scoped (see the
// consistency rules in validateProductTruthPayload): a PRODUCT-wide "prices are ILS only" claim is not expressible.
export const CURRENCY_SCOPES = ['ILS', 'USD', 'EUR', 'GBP', 'ACCOUNT', 'MULTI', 'NOT_APPLICABLE', 'UNKNOWN'] as const;
export type CurrencyScope = typeof CURRENCY_SCOPES[number];

// WHO the claim is about.
export const CLAIM_SCOPES = ['PRODUCT', 'ACCOUNT', 'MARKET', 'CAPABILITY', 'NOT_APPLICABLE'] as const;
export type ClaimScope = typeof CLAIM_SCOPES[number];

export const TRUTH_SOURCES = [
  'CAPABILITY_REGISTRY', 'BILLING_FACTS', 'INVOICING_FACTS', 'MARKET_RULES', 'COMPARISON_RULES', 'CLARIFICATION_RULES', 'ACCOUNT_LIFECYCLE_RULES',
] as const;
export type TruthSource = typeof TRUTH_SOURCES[number];

export const ACCOUNT_ENTITLEMENTS = ['GRANTED', 'DENIED', 'UNKNOWN', 'NOT_APPLICABLE'] as const;
export type AccountEntitlement = typeof ACCOUNT_ENTITLEMENTS[number];

export const ACCOUNT_MARKETS = ['LOCAL', 'INTERNATIONAL'] as const;
export type AccountMarket = typeof ACCOUNT_MARKETS[number];

export const REGISTRY_STATES = [
  'LIVE_CURRENT', 'FIRST_LIVE_CANDIDATE', 'TEST_ONLY', 'IMPLEMENTED_NOT_RELEASED', 'ROADMAP_POST_LIVE', 'UNAVAILABLE', 'DEPRECATED',
] as const;
export type RegistryState = typeof REGISTRY_STATES[number];

export const PLAN_TIER_VALUES = ['free', 'basic', 'pro'] as const;
export const ROLE_VALUES = ['user', 'super_admin'] as const;

export type ProductTruthFactPayload = {
  readonly kind: typeof PRODUCT_TRUTH_PAYLOAD_KIND;
  readonly schemaVersion: typeof PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION;
  // registry capability id, a router sentinel (payment_processing / invoicing / quote_pdf_vs_print_comparison /
  // account_lifecycle_not_self_service / account_market) or null (clarification)
  readonly capabilityId: string | null;
  readonly truthStatus: TruthStatus;
  readonly claimScope: ClaimScope;
  readonly source: TruthSource;
  readonly marketScope: MarketScope;
  readonly currencyScope: CurrencyScope;
  // the registry lifecycle state behind a capability answer (drives the exact NOT_AVAILABLE wording); null otherwise
  readonly registryState: RegistryState | null;
  readonly minimumPlan: string | null;
  readonly requiredRole: string | null;
  // the SERVER-VERIFIED account facts the answer was resolved against (null = no verified account / unknown)
  readonly accountPlan: string | null;
  readonly accountRole: string | null;
  readonly accountMarket: AccountMarket | null;
  readonly accountEntitlement: AccountEntitlement;
  readonly comparedCapabilityIds: readonly string[] | null;
};

const PAYLOAD_KEYS = [
  'kind', 'schemaVersion', 'capabilityId', 'truthStatus', 'claimScope', 'source', 'marketScope', 'currencyScope', 'registryState',
  'minimumPlan', 'requiredRole', 'accountPlan', 'accountRole', 'accountMarket', 'accountEntitlement', 'comparedCapabilityIds',
] as const;
export const PRODUCT_TRUTH_PAYLOAD_KEYS: readonly string[] = PAYLOAD_KEYS;

const isIn = (list: readonly string[], v: unknown): boolean => typeof v === 'string' && list.includes(v);
const isStrOrNull = (v: unknown): boolean => v === null || (typeof v === 'string' && v.length > 0);

/**
 * Structural + consistency validation of a payload. Returns problems (empty = well-formed and internally
 * consistent). This does NOT know the canonical truth of a particular question - equality with the canonical
 * expectation is a separate, independent check in the acceptance layer.
 */
export function validateProductTruthPayload(p: unknown): string[] {
  const v: string[] = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['payload_not_an_object'];
  const o = p as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!PAYLOAD_KEYS.includes(k as typeof PAYLOAD_KEYS[number])) v.push(`payload_unknown_field:${k}`);
  for (const k of PAYLOAD_KEYS) if (!(k in o)) v.push(`payload_missing_field:${k}`);
  if (v.length) return v;
  if (o.kind !== PRODUCT_TRUTH_PAYLOAD_KIND) v.push(`payload_kind_invalid:${String(o.kind)}`);
  if (o.schemaVersion !== PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION) v.push(`payload_schema_version_invalid:${String(o.schemaVersion)}`);
  if (!isStrOrNull(o.capabilityId)) v.push('payload_capability_id_invalid');
  if (!isIn(TRUTH_STATUSES, o.truthStatus)) v.push(`payload_truth_status_invalid:${String(o.truthStatus)}`);
  if (!isIn(CLAIM_SCOPES, o.claimScope)) v.push(`payload_claim_scope_invalid:${String(o.claimScope)}`);
  if (!isIn(TRUTH_SOURCES, o.source)) v.push(`payload_source_invalid:${String(o.source)}`);
  if (!isIn(MARKET_SCOPES, o.marketScope)) v.push(`payload_market_scope_invalid:${String(o.marketScope)}`);
  if (!isIn(CURRENCY_SCOPES, o.currencyScope)) v.push(`payload_currency_scope_invalid:${String(o.currencyScope)}`);
  if (!(o.registryState === null || isIn(REGISTRY_STATES, o.registryState))) v.push(`payload_registry_state_invalid:${String(o.registryState)}`);
  for (const k of ['minimumPlan', 'requiredRole', 'accountPlan', 'accountRole'] as const) if (!isStrOrNull(o[k])) v.push(`payload_${k}_invalid`);
  if (!(o.accountMarket === null || isIn(ACCOUNT_MARKETS, o.accountMarket))) v.push(`payload_account_market_invalid:${String(o.accountMarket)}`);
  if (!isIn(ACCOUNT_ENTITLEMENTS, o.accountEntitlement)) v.push(`payload_account_entitlement_invalid:${String(o.accountEntitlement)}`);
  if (!(o.comparedCapabilityIds === null || (Array.isArray(o.comparedCapabilityIds) && o.comparedCapabilityIds.every((x) => typeof x === 'string' && x.length > 0)))) v.push('payload_compared_ids_invalid');
  if (v.length) return v;

  const status = o.truthStatus as TruthStatus;
  const market = o.accountMarket as AccountMarket | null;
  const currency = o.currencyScope as CurrencyScope;
  // --- internal consistency (a payload that contradicts ITSELF is invalid whatever the canonical truth is) ---
  if (status === 'PLAN_LOCKED') {
    if (o.minimumPlan === null) v.push('plan_locked_without_minimum_plan');
    if (o.accountEntitlement !== 'DENIED') v.push('plan_locked_requires_entitlement_denied');
    if (o.claimScope !== 'ACCOUNT') v.push('plan_locked_requires_account_claim_scope');
    if (o.requiredRole !== null) v.push('plan_locked_must_not_carry_a_required_role');
  }
  if (status === 'ROLE_LOCKED') {
    if (o.requiredRole === null) v.push('role_locked_without_required_role');
    if (o.accountEntitlement !== 'DENIED') v.push('role_locked_requires_entitlement_denied');
    if (o.claimScope !== 'ACCOUNT') v.push('role_locked_requires_account_claim_scope');
    if (o.minimumPlan !== null) v.push('role_locked_must_not_carry_a_minimum_plan');
  }
  if (status === 'AVAILABLE' && o.accountEntitlement === 'DENIED') v.push('available_contradicts_entitlement_denied');
  if (status === 'MARKET_UNAVAILABLE' && o.claimScope !== 'MARKET') v.push('market_unavailable_requires_market_claim_scope');
  if (status === 'PAYMENT_NOT_LIVE' || status === 'INVOICING_NOT_ISSUED') {
    if (o.claimScope !== 'PRODUCT') v.push(`${status.toLowerCase()}_requires_product_claim_scope`);
    if (o.currencyScope !== 'NOT_APPLICABLE') v.push(`${status.toLowerCase()}_must_not_scope_a_currency`);
  }
  if (status === 'COMPARISON' && !(Array.isArray(o.comparedCapabilityIds) && o.comparedCapabilityIds.length === 2)) v.push('comparison_requires_two_compared_capabilities');
  if (status !== 'COMPARISON' && o.comparedCapabilityIds !== null) v.push('compared_capabilities_only_valid_for_comparison');
  if (status === 'CLARIFICATION') {
    if (o.capabilityId !== null) v.push('clarification_must_not_name_a_capability');
    if (o.claimScope !== 'NOT_APPLICABLE') v.push('clarification_requires_not_applicable_claim_scope');
  }
  if (status === 'ACCOUNT_MARKET') {
    if (o.claimScope !== 'ACCOUNT') v.push('account_market_requires_account_claim_scope');
    if (o.marketScope !== 'ACCOUNT') v.push('account_market_requires_account_market_scope');
    if (market === null) v.push('account_market_requires_a_verified_account_market');
  }
  // MARKET / CURRENCY SAFETY: a concrete currency is only ever an ACCOUNT- or MARKET-scoped claim, and only for the
  // market that owns it (ILS <-> LOCAL; USD / EUR / GBP / MULTI <-> INTERNATIONAL). "TEKANGO prices are ILS only" as a
  // PRODUCT-wide fact cannot be expressed by a valid payload.
  if (['ILS', 'USD', 'EUR', 'GBP', 'MULTI', 'ACCOUNT'].includes(currency)) {
    if (o.claimScope !== 'ACCOUNT' && o.claimScope !== 'MARKET') v.push(`currency_claim_must_be_account_or_market_scoped:${o.claimScope as string}`);
    if (market === null) v.push('currency_claim_requires_a_verified_account_market');
    if (currency === 'ILS' && market !== 'LOCAL') v.push('ils_currency_only_valid_for_a_local_account');
    if (['USD', 'EUR', 'GBP', 'MULTI'].includes(currency) && market !== 'INTERNATIONAL') v.push('foreign_currency_only_valid_for_an_international_account');
  }
  if (o.accountRole !== null && !ROLE_VALUES.includes(o.accountRole as typeof ROLE_VALUES[number])) v.push(`account_role_unrecognised:${String(o.accountRole)}`);
  if (o.accountPlan !== null && !PLAN_TIER_VALUES.includes(o.accountPlan as typeof PLAN_TIER_VALUES[number])) v.push(`account_plan_unrecognised:${String(o.accountPlan)}`);
  return v;
}
