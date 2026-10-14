// PRODUCT TRUTH - STRUCTURED TRUTH ACCEPTANCE (Owner task "STRUCTURED TRUTH CONTRACT CLOSURE FOR PRODUCT TRUTH").
//
// The chat-ai runtime now emits, with every deterministic Product Truth answer, a machine-readable payload in the response
// envelope's `factPayload` (supabase/functions/_shared/productTruthContract.ts):
//     canonical authority  ->  STRUCTURED TRUTH  ->  prose
// Acceptance therefore validates in this order:
//   (1) PRIMARY - the structured payload:
//        - it must be well-formed and internally consistent (validateProductTruthPayload);
//        - it must EQUAL the payload the canonical authorities independently derive for the slot
//          (deriveExpectedFactPayload: the frontend registry + AI_FACTS billing/invoicing facts + the persona's SERVER-VERIFIED
//          plan / role / market - it never reads the response, the prose, or the runtime's own payload builder);
//        - a slot that must NOT carry a structured claim (a free-form model answer) must carry none.
//   (2) SECONDARY - prose consistency: the prose must not contradict the (already validated) payload. The prose parser
//        (productTruthCapabilityPolarity.js / productTruthScopeClaims.js) is now a defence-in-depth consistency check, not the
//        authority: a missing / wrong payload fails the cell no matter what the prose says, and prose can never rescue it.
import { getCapabilityById, PRODUCT_TRUTH_REGISTRY } from './productTruthRegistry.js';
import { PLAN_IDS } from '../utils/planCatalog.js';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';
import {
  PRODUCT_TRUTH_PAYLOAD_KEYS, PRODUCT_TRUTH_PAYLOAD_KIND, PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION, TRUTH_STATUSES, validateProductTruthPayload,
} from '../../supabase/functions/_shared/productTruthContract.ts';
import { checkCapabilityPolarity, deriveRegistryEntitlement, TRUTH_KINDS } from './productTruthCapabilityPolarity.js';

export { PRODUCT_TRUTH_PAYLOAD_KEYS, PRODUCT_TRUTH_PAYLOAD_KIND, PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION, TRUTH_STATUSES, validateProductTruthPayload };

// The expected-outcome vocabulary of a slot: a registry capability id, one of the router sentinels below, or "no structured claim".
export const OUTCOME_SENTINELS = Object.freeze({
  PAYMENT: 'payment_truth_sentinel',
  INVOICING: 'invoicing_truth_sentinel',
  COMPARISON: 'quote_pdf_vs_print_comparison',
  LIFECYCLE: 'account_lifecycle_sentinel',
  ACCOUNT_MARKET: 'account_market_sentinel',
  CLARIFICATION: 'clarification',
  NO_STRUCTURED_CLAIM: 'no_structured_claim', // a free-form model answer: it must NOT carry a Product Truth payload
});
export const isKnownOutcome = (o) => Object.values(OUTCOME_SENTINELS).includes(o) || !!getCapabilityById(o);

const MARKET_TO_ACCOUNT = Object.freeze({ Local: 'LOCAL', International: 'INTERNATIONAL' });
const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// `accountPlan` is the account's EFFECTIVE plan tier under the canonical account-entitlement rule (src/utils/accountEntitlement.js:
// `tier = isSuperAdmin ? 'pro' : effectivePlan`): a super_admin is entitled at the top tier whatever plan its row says. The persona's
// server-verified raw plan is therefore mapped through that same rule here - independently of the runtime's port of it.
function accountFacts(sv) {
  const rawPlan = PLAN_IDS.includes(sv?.serverPlan) ? sv.serverPlan : null;
  const role = ['user', 'super_admin'].includes(sv?.serverRole) ? sv.serverRole : null;
  const plan = role === 'super_admin' ? 'pro' : rawPlan;
  return { accountPlan: plan, accountRole: role, accountMarket: MARKET_TO_ACCOUNT[sv?.serverMarket] ?? null };
}

const NEUTRAL = Object.freeze({
  kind: PRODUCT_TRUTH_PAYLOAD_KIND, schemaVersion: PRODUCT_TRUTH_PAYLOAD_SCHEMA_VERSION, marketScope: 'NOT_APPLICABLE', currencyScope: 'NOT_APPLICABLE',
  registryState: null, minimumPlan: null, requiredRole: null, accountEntitlement: 'NOT_APPLICABLE', comparedCapabilityIds: null,
});
const ordered = (p) => Object.fromEntries(PRODUCT_TRUTH_PAYLOAD_KEYS.map((k) => [k, p[k]]));

/**
 * The structured truth the CANONICAL authorities dictate for an expected outcome, resolved against a persona's server-verified facts.
 * Independent of the runtime's builders (productTruthPayload.ts): derived here from the frontend registry, AI_FACTS.billing /
 * AI_FACTS.invoicing and the server facts. Returns `null` for no_structured_claim, or `{ problem }` when it cannot be derived.
 * @param {{ outcome: string, serverVerified?: { serverPlan?: string, serverRole?: string, serverMarket?: string } }} input
 */
export function deriveExpectedFactPayload({ outcome, serverVerified }) {
  if (outcome === OUTCOME_SENTINELS.NO_STRUCTURED_CLAIM) return null;
  const acct = accountFacts(serverVerified);
  const base = { ...NEUTRAL, ...acct };
  if (outcome === OUTCOME_SENTINELS.CLARIFICATION) {
    return ordered({ ...base, capabilityId: null, truthStatus: 'CLARIFICATION', claimScope: 'NOT_APPLICABLE', source: 'CLARIFICATION_RULES' });
  }
  if (outcome === OUTCOME_SENTINELS.PAYMENT) {
    if (AI_FACTS.billing.paymentProcessingAvailable !== false || AI_FACTS.billing.liveCheckoutAvailable !== false) return { problem: 'AI_FACTS.billing says payment/checkout is live - the payment expectation no longer holds' };
    return ordered({ ...base, capabilityId: 'payment_processing', truthStatus: 'PAYMENT_NOT_LIVE', claimScope: 'PRODUCT', source: 'BILLING_FACTS', marketScope: 'BOTH' });
  }
  if (outcome === OUTCOME_SENTINELS.INVOICING) {
    if (AI_FACTS.invoicing.invoiceIssuanceAvailable !== false || AI_FACTS.invoicing.receiptIssuanceAvailable !== false) return { problem: 'AI_FACTS.invoicing says invoices are issued - the invoicing expectation no longer holds' };
    return ordered({ ...base, capabilityId: 'invoicing', truthStatus: 'INVOICING_NOT_ISSUED', claimScope: 'PRODUCT', source: 'INVOICING_FACTS', marketScope: 'BOTH' });
  }
  if (outcome === OUTCOME_SENTINELS.COMPARISON) {
    if (!['quote_pdf', 'quote_print'].every((id) => getCapabilityById(id)?.state === 'LIVE_CURRENT')) return { problem: 'quote_pdf / quote_print are not both LIVE_CURRENT in the registry' };
    return ordered({ ...base, capabilityId: 'quote_pdf_vs_print_comparison', truthStatus: 'COMPARISON', claimScope: 'CAPABILITY', source: 'COMPARISON_RULES', marketScope: 'BOTH', comparedCapabilityIds: ['quote_pdf', 'quote_print'] });
  }
  if (outcome === OUTCOME_SENTINELS.LIFECYCLE) {
    return ordered({ ...base, capabilityId: 'account_lifecycle_not_self_service', truthStatus: 'NOT_AVAILABLE', claimScope: 'PRODUCT', source: 'ACCOUNT_LIFECYCLE_RULES', marketScope: 'BOTH', registryState: 'UNAVAILABLE' });
  }
  if (outcome === OUTCOME_SENTINELS.ACCOUNT_MARKET) {
    if (!acct.accountMarket) return { problem: 'no server-verified market' };
    return ordered({ ...base, capabilityId: 'account_market', truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', source: 'MARKET_RULES', marketScope: 'ACCOUNT', currencyScope: acct.accountMarket === 'LOCAL' ? 'ILS' : 'MULTI' });
  }
  const cap = getCapabilityById(outcome);
  if (!cap) return { problem: `not a registry capability id or a known outcome sentinel: ${outcome}` };
  const cbase = { ...base, capabilityId: cap.id, source: 'CAPABILITY_REGISTRY', registryState: cap.state, marketScope: capMarketScope(cap) };
  if (cap.state !== 'LIVE_CURRENT') return ordered({ ...cbase, truthStatus: 'NOT_AVAILABLE', claimScope: 'CAPABILITY' });
  if (Array.isArray(cap.markets) && cap.markets.length === 1 && acct.accountMarket && !cap.markets.includes(acct.accountMarket.toLowerCase())) {
    return ordered({ ...cbase, truthStatus: 'MARKET_UNAVAILABLE', claimScope: 'MARKET' });
  }
  if (cap.authorityType === 'role') {
    if (!isNonEmpty(acct.accountRole)) return { problem: 'role entitlement underivable (no server-verified role)' };
    const e = deriveRegistryEntitlement(cap.id, serverVerified?.serverPlan, serverVerified?.serverRole);
    if (e === 'UNKNOWN') return { problem: 'role entitlement underivable' };
    return ordered({ ...cbase, truthStatus: e === 'GRANTED' ? 'AVAILABLE' : 'ROLE_LOCKED', claimScope: 'ACCOUNT', requiredRole: cap.requiredRole, accountEntitlement: e });
  }
  if (cap.authorityType === 'plan') {
    if (!isNonEmpty(acct.accountPlan)) return { problem: 'plan entitlement underivable (no server-verified plan)' };
    const have = PLAN_IDS.indexOf(acct.accountPlan);
    const need = PLAN_IDS.indexOf(cap.minimumPlan);
    if (have < 0 || need < 0) return { problem: 'plan entitlement underivable' };
    const e = have >= need ? 'GRANTED' : 'DENIED';
    return ordered({ ...cbase, truthStatus: e === 'GRANTED' ? 'AVAILABLE' : 'PLAN_LOCKED', claimScope: 'ACCOUNT', minimumPlan: cap.minimumPlan, accountEntitlement: e });
  }
  return ordered({ ...cbase, truthStatus: 'AVAILABLE', claimScope: 'CAPABILITY' });
}

function capMarketScope(cap) {
  if (!Array.isArray(cap.markets) || cap.markets.length === 0) return 'NOT_APPLICABLE';
  const local = cap.markets.includes('local');
  const intl = cap.markets.includes('international');
  return local && intl ? 'BOTH' : local ? 'LOCAL' : intl ? 'INTERNATIONAL' : 'UNKNOWN';
}

/** Canonical (key-order independent) serialisation, for exact payload comparison. */
export const canonicalPayloadJson = (p) => JSON.stringify(p === null || p === undefined ? null : sortKeys(p));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

/**
 * PRIMARY structured-truth check of one slot: does the payload the live runtime returned equal the canonical expectation?
 * @param {object|null|undefined} actual - the `factPayload` from the live response (as captured in the raw capture / the row)
 * @param {string} outcome - the slot's expected outcome (capability id / sentinel / no_structured_claim)
 * @param {object} serverVerified
 * @returns {string[]} violations, all prefixed `structured:`
 */
export function checkFactPayloadAgainstCanonical(actual, outcome, serverVerified) {
  const expected = deriveExpectedFactPayload({ outcome, serverVerified });
  if (expected === null) {
    return actual === null || actual === undefined ? [] : ['structured:unexpected_payload_on_a_free_form_answer'];
  }
  if ('problem' in expected) return [`structured:expected_payload_underivable:${expected.problem}`];
  if (actual === null || actual === undefined) return ['structured:factPayload_missing'];
  const v = validateProductTruthPayload(actual).map((x) => `structured:invalid:${x}`);
  if (v.length) return v;
  for (const k of PRODUCT_TRUTH_PAYLOAD_KEYS) {
    if (canonicalPayloadJson(actual[k]) !== canonicalPayloadJson(expected[k])) v.push(`structured:${k}_differs: runtime ${canonicalPayloadJson(actual[k])}, canonical authority ${canonicalPayloadJson(expected[k])}`);
  }
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------
// SECONDARY: prose consistency against the (validated) payload.

const STATUS_TO_KIND = Object.freeze({
  AVAILABLE: TRUTH_KINDS.AVAILABLE, NOT_AVAILABLE: TRUTH_KINDS.NOT_AVAILABLE, PLAN_LOCKED: TRUTH_KINDS.PLAN_LOCKED, ROLE_LOCKED: TRUTH_KINDS.ROLE_LOCKED,
  MARKET_UNAVAILABLE: TRUTH_KINDS.MARKET_UNAVAILABLE, PAYMENT_NOT_LIVE: TRUTH_KINDS.PAYMENT_NOT_LIVE, INVOICING_NOT_ISSUED: TRUTH_KINDS.INVOICING_NOT_ISSUED,
  COMPARISON: TRUTH_KINDS.COMPARISON_BOTH_AVAILABLE, CLARIFICATION: TRUTH_KINDS.CLARIFICATION,
});

/** The truth object the existing prose-consistency checker expects, built FROM the payload (never from the prose). */
export function payloadToTruth(p) {
  const kind = STATUS_TO_KIND[p.truthStatus];
  if (!kind) return { kind: 'UNDERIVABLE', reason: `no prose-consistency mapping for truth status ${p.truthStatus}` };
  return {
    kind, capabilityId: p.capabilityId ?? undefined, authority: 'structured payload',
    gate: p.requiredRole !== null ? 'role' : p.minimumPlan !== null ? 'plan' : null, minimumPlan: p.minimumPlan, requiredRole: p.requiredRole,
  };
}

// --- market / currency prose safety (the "TEKANGO prices are ILS only" family) -------------------------------------------
const CURRENCY_TOKEN = /(?:₪|\bILS\b|\bNIS\b|\bshekels?\b|שקל(?:ים)?|ש"ח|\$|€|£|\bUSD\b|\bEUR\b|\bGBP\b|\bdollars?\b|\beuros?\b|\bpounds?\b|דולר(?:ים)?|יורו|אירו|לירות)/i;
const ILS_TOKEN = /(?:₪|\bILS\b|\bNIS\b|\bshekels?\b|שקל(?:ים)?|ש"ח)/i;
const FOREIGN_TOKEN = /(?:\$|€|£|\bUSD\b|\bEUR\b|\bGBP\b|\bdollars?\b|\beuros?\b|\bpounds?\b|דולר(?:ים)?|יורו|אירו|לירות\s+שטרלינג)/i;
// a sentence speaks about the PRODUCT / everyone (not about this account) when it names one of these
const PRODUCT_WIDE = /(?:\btekango\b|\ball\s+(?:the\s+)?(?:prices|pricing|users|accounts|customers|plans)\b|\bevery(?:one|body)\b|\bglobally\b|\bworldwide\b|\bthe\s+(?:product|platform|system|app)\b|כל\s+(?:ה)?(?:מחירים|משתמשים|חשבונות|לקוחות|תוכניות)|\bTEKANGO\b|המערכת|המוצר|הפלטפורמה|בכל\s+מקום|בעולם|כולם)/i;
// ... and is account/market-scoped when it says so
const ACCOUNT_SCOPE = /(?:\byour\s+(?:account|market|plan)\b|\bthis\s+account\b|\bfor\s+you\b|החשבון\s+שלך|בחשבון\s+שלך|לחשבון\s+שלך|השוק\s+שלך|בשוק\s+(?:המקומי|הבינלאומי)|\b(?:local|international)\s+market\b|\bin\s+(?:the\s+)?(?:local|international)\s+market\b|\bLocal\b|\bInternational\b)/i;

function splitSentencesLite(text) {
  return String(text ?? '').split(/(?<=[.!?։…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Prose claims about a currency that are PRODUCT-wide (false for a product serving a Local ILS and an International USD/EUR/GBP market). */
export function findProductWideCurrencyClaims(response) {
  return splitSentencesLite(response).filter((s) => CURRENCY_TOKEN.test(s) && PRODUCT_WIDE.test(s) && !ACCOUNT_SCOPE.test(s));
}

// Only answers that speak about THIS account's / the product's MONEY are subject to market isolation. A capability description may legitimately list every
// currency it converts between (the editor / public currency converter: "USD, EUR, GBP and ILS"), so capability payloads are exempt.
const MONEY_STATUSES = new Set(['ACCOUNT_MARKET', 'PAYMENT_NOT_LIVE', 'INVOICING_NOT_ISSUED']);

/** Market isolation: an International account's prose never names the shekel; a Local account's never names a foreign currency as ITS currency. */
export function findMarketLeaks(payload, response, language) {
  const out = [];
  if (!MONEY_STATUSES.has(payload.truthStatus)) return out;
  const text = String(response ?? '');
  if (payload.accountMarket === 'INTERNATIONAL' && ILS_TOKEN.test(text)) out.push('international_account_prose_names_the_shekel');
  if (payload.accountMarket === 'LOCAL' && language === 'he' && FOREIGN_TOKEN.test(text)) out.push('local_account_prose_names_a_foreign_currency');
  return out;
}

// --- account lifecycle (cancel / archive / delete are not self-service) ---------------------------------------------------
const LIFECYCLE = Object.freeze({
  en: { denies: /\b(?:not|no)\b[^.!?]{0,30}\bself-?service\b/i, contradicts: [/\byou\s+can\s+(?:cancel|delete|archive|close)\b/i, /\bcancel(?:l?ed|lation)?\s+(?:is\s+)?(?:done|complete|processed)\b/i, /\b(?:is|are)\s+(?:a\s+)?self-?service\s+(?:action|option|feature)\b(?!\s+today)/i] },
  he: { denies: /(?:אינם|אינן|אינה|אינו|לא)\s+[^.!?]{0,30}(?:עצמאי|self-?service)/, contradicts: [/(?:אפשר|ניתן)\s+(?:ל)?(?:בטל|מחוק|לארכב|לסגור)/, /(?:המנוי|החשבון)\s+(?:בוטל|נמחק|נסגר)/] },
});

/**
 * SECONDARY consistency check: the prose must not contradict the structured payload. `payload` must already have passed the
 * primary check - the prose can never establish or repair structured truth.
 * @returns {string[]} violations, all prefixed `prose:`
 */
export function checkProseAgainstPayload(payload, response, language) {
  const v = [];
  const text = String(response ?? '');
  if (!text.trim()) return ['prose:empty_response'];
  const problems = validateProductTruthPayload(payload);
  if (problems.length) return ['prose:cannot_check_against_an_invalid_payload'];

  // market / currency safety applies to EVERY payload-backed answer
  for (const s of findProductWideCurrencyClaims(text)) v.push(`prose:product_wide_currency_claim:${s.slice(0, 80)}`);
  for (const m of findMarketLeaks(payload, text, language)) v.push(`prose:${m}`);

  if (payload.truthStatus === 'ACCOUNT_MARKET') {
    if (payload.accountMarket === 'LOCAL' && !ILS_TOKEN.test(text)) v.push('prose:account_market_local_but_prose_does_not_state_the_local_currency');
    if (payload.accountMarket === 'INTERNATIONAL' && !/\b(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b|דולר|יורו|אירו|לירות|מטבע\s+החשבון/i.test(text)) v.push('prose:account_market_international_but_prose_does_not_state_the_account_currency');
    if (!ACCOUNT_SCOPE.test(text)) v.push('prose:account_market_answer_is_not_account_scoped');
    if (payload.accountMarket === 'LOCAL' && /(?:international|בינלאומי)/i.test(text) && !/(?:\bnot\b|\bdon['’]t\b|\bcan['’]t\b|לא|אי אפשר|ולא)/i.test(text)) v.push('prose:account_market_local_but_prose_treats_the_account_as_international');
    return v;
  }
  if (payload.capabilityId === 'account_lifecycle_not_self_service') {
    const spec = LIFECYCLE[language];
    if (!spec.denies.test(text)) v.push('prose:lifecycle_expected_not_self_service_but_prose_does_not_say_so');
    for (const re of spec.contradicts) if (re.test(text)) v.push(`prose:lifecycle_contradiction:${re}`);
    return v;
  }
  const truth = payloadToTruth(payload);
  v.push(...checkCapabilityPolarity(truth, text, language).map((x) => `prose:${x}`));
  return v;
}

export const ALL_CAPABILITY_IDS = Object.freeze(PRODUCT_TRUTH_REGISTRY.map((c) => c.id));
