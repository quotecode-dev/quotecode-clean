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

export const FORBIDDEN_CODE_TO_SEMANTIC_FAMILY: Readonly<Record<string, keyof typeof FORBIDDEN_CLAIM_FAMILIES>> = Object.freeze({
  NO_PAYMENT_CAPABILITY_CLAIM: 'payment',
  NO_PAID_STATUS_AS_PAYMENT_COLLECTION: 'payment',
  NO_PAYMENT_COLLECTION_CLAIM: 'payment',
  NO_INVOICING_CAPABILITY_CLAIM: 'invoicing',
  NO_INVOICE_CONFLATION: 'invoicing',
  NO_AI_EXECUTION_CLAIM: 'aiMutation',
  NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP: 'calculatorRates',
  NO_LIVE_METALS_FEED_CLAIM: 'metals',
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

/**
 * Structured check: for every forbidden claim code that maps to a known semantic family, verifies
 * the real answer text never semantically asserts that family's forbidden claim. A code with no
 * mapped family is reported with `family: null` and `claimed: false` (nothing to check, not a
 * silent pass disguised as success - callers can assert every code in the required families list
 * IS mapped, separately, as a coverage check).
 */
export function checkForbiddenClaimCodes(forbiddenClaimCodes: readonly string[] | undefined, answerText: string, isHebrew: boolean): ClaimCodeCheckResult[] {
  const results: ClaimCodeCheckResult[] = [];
  for (const code of forbiddenClaimCodes || []) {
    const family = FORBIDDEN_CODE_TO_SEMANTIC_FAMILY[code];
    if (!family) {
      results.push({ code, family: null, claimed: false, matches: [] });
      continue;
    }
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

/** Same check, addressed by sentinel name instead of a registry-declared code list. */
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
