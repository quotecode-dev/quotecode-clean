// PRODUCT TRUTH — STRUCTURED FORBIDDEN-CLAIM CONTRACT (Codex finding 4, 2026-09-24).
//
// Codex found the forbidden-claim gate was regex-on-prose only (forbiddenClaimSemantics.js) - real,
// and negation-aware, but still ultimately a text pattern match with no structured connection back
// to WHICH claim family a given capability's answer is even supposed to be checked against; a test
// author picks the family by hand per call site, which can silently drift from the capability's own
// declared facts.
//
// This module is the structural join: every capability that carries a real, already-registry-
// declared `forbiddenClaimCodes` entry (productTruthRegistry.js) is mapped, by CODE IDENTITY, to
// the semantic pattern family (forbiddenClaimSemantics.js) that represents the same forbidden
// claim. A capability's OWN facts now drive which check runs - regex prose-matching remains, by
// design, the defense-in-depth mechanism underneath (never the sole authority): the structural
// authority is the mapping from a real registry code to a real semantic family, and from there to
// the deterministic function's OWN facts (state), never from parsing the model's free text alone.
import { checkSemanticClaim, FORBIDDEN_CLAIM_FAMILIES } from "../../../src/data/forbiddenClaimSemantics.js";

// Codex "structured runtime answer contract" (2026-09-2X): EVERY forbiddenClaimCodes value
// actually declared anywhere in the registry (productTruthRegistry.js) now has a real semantic
// family - the 6 originally required (payment/invoicing/aiMutation/settingsLifecycle/
// calculatorRates/metals) plus 4 more this task added (conversionCurrency/whatsappConflation/
// draftProvenance/adminInference) so checkForbiddenClaimCodes's hard-fail-on-unknown-code gate
// (below) never trips on real, already-declared data - only on a genuinely new/typo'd code that
// was never given an owner at all.
export const FORBIDDEN_CODE_TO_SEMANTIC_FAMILY: Readonly<Record<string, keyof typeof FORBIDDEN_CLAIM_FAMILIES>> = Object.freeze({
  NO_PAYMENT_CAPABILITY_CLAIM: 'payment',
  NO_PAID_STATUS_AS_PAYMENT_COLLECTION: 'payment',
  NO_PAYMENT_COLLECTION_CLAIM: 'payment',
  NO_INVOICING_CAPABILITY_CLAIM: 'invoicing',
  NO_INVOICE_CONFLATION: 'invoicing',
  NO_AI_EXECUTION_CLAIM: 'aiMutation',
  NO_AUTONOMOUS_EMAIL_CLAIM: 'aiMutation',
  NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP: 'calculatorRates',
  NO_LIVE_METALS_FEED_CLAIM: 'metals',
  NO_CONVERSION_CURRENCY_AS_PAYMENT_CURRENCY: 'conversionCurrency',
  NO_CONVERSION_CURRENCY_AS_QUOTE_OR_SUBSCRIPTION_CURRENCY: 'conversionCurrency',
  NO_OWNER_PUBLIC_WHATSAPP_CONFLATION: 'whatsappConflation',
  NO_LOCAL_DRAFT_AS_CLOUD_SAVED: 'draftProvenance',
  NO_ADMIN_FROM_PLAN_OR_LIFETIME_INFERENCE: 'adminInference',
  // Structured-state-only invariant (capabilityAnswerState.ts) - no registry capability declares
  // it today (nothing self-service exists to conflate), given a real family so the structured
  // invariant check's own violation codes are never themselves "unknown".
  NO_LIFECYCLE_SELF_SERVICE_CLAIM: 'settingsLifecycle',
});

// account_lifecycle_not_self_service is the router-only sentinel (capabilityTruth.ts) - not one of
// the 38 registry ids, so it carries no registry-declared forbiddenClaimCodes of its own. Mapped
// here by name, once, so it participates in the same structured join as every registry capability.
export const SENTINEL_TO_SEMANTIC_FAMILY: Readonly<Record<string, keyof typeof FORBIDDEN_CLAIM_FAMILIES>> = Object.freeze({
  account_lifecycle_not_self_service: 'settingsLifecycle',
});

export type ClaimCodeCheckResult = {
  code: string;
  family: string | null;
  claimed: boolean;
  matches: string[];
};

/** Thrown by checkForbiddenClaimCodes/checkSentinelForbiddenClaim when a code has no mapped
 * semantic family - a hard, structural failure (Codex "structured runtime answer contract"):
 * an unknown forbidden-claim code must never be silently reported as `claimed: false`, because
 * that is textually indistinguishable from "checked and found clean" to any caller that only
 * inspects `.claimed` - exactly the fail-OPEN shape Codex found. */
export class UnknownForbiddenClaimCodeError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Unknown forbidden claim code "${code}" has no mapped semantic family - cannot be verified. This is a hard failure, not a silent pass.`);
    this.name = 'UnknownForbiddenClaimCodeError';
    this.code = code;
  }
}

/**
 * Structured check: for every forbidden claim code that maps to a known semantic family, verifies
 * the real answer text never semantically asserts that family's forbidden claim. A code with NO
 * mapped family throws UnknownForbiddenClaimCodeError immediately - it is a hard failure, never a
 * silent `claimed: false` pass (Codex "structured runtime answer contract", 2026-09-2X; supersedes
 * the earlier `family: null, claimed: false` reporting shape).
 */
export function checkForbiddenClaimCodes(forbiddenClaimCodes: readonly string[] | undefined, answerText: string, isHebrew: boolean): ClaimCodeCheckResult[] {
  const results: ClaimCodeCheckResult[] = [];
  for (const code of forbiddenClaimCodes || []) {
    const family = FORBIDDEN_CODE_TO_SEMANTIC_FAMILY[code];
    if (!family) throw new UnknownForbiddenClaimCodeError(code);
    const patterns = FORBIDDEN_CLAIM_FAMILIES[family][isHebrew ? 'he' : 'en'];
    let claimed = false;
    const matches: string[] = [];
    for (const p of patterns) {
      const r = checkSemanticClaim(answerText, p, isHebrew);
      if (r.claimed) {
        claimed = true;
        matches.push(...r.matches);
      }
    }
    results.push({ code, family, claimed, matches });
  }
  return results;
}

/** Same check, addressed by sentinel name instead of a registry-declared code list. Returns null
 * only for a sentinel id that legitimately has no forbidden-claim obligation at all (it is not in
 * SENTINEL_TO_SEMANTIC_FAMILY's key set by design) - a sentinel id that IS expected to carry one
 * but was mistyped would be a caller bug, not something this function can distinguish from "no
 * obligation"; callers that need the hard-fail guarantee should assert the sentinel id is a known
 * key of SENTINEL_TO_SEMANTIC_FAMILY before calling, exactly as checkForbiddenClaimCodes's callers
 * are expected to pass only registry-declared codes. */
export function checkSentinelForbiddenClaim(sentinelId: string, answerText: string, isHebrew: boolean): ClaimCodeCheckResult | null {
  const family = SENTINEL_TO_SEMANTIC_FAMILY[sentinelId];
  if (!family) return null;
  const patterns = FORBIDDEN_CLAIM_FAMILIES[family][isHebrew ? 'he' : 'en'];
  let claimed = false;
  const matches: string[] = [];
  for (const p of patterns) {
    const r = checkSemanticClaim(answerText, p, isHebrew);
    if (r.claimed) {
      claimed = true;
      matches.push(...r.matches);
    }
  }
  return { code: sentinelId, family, claimed, matches };
}
