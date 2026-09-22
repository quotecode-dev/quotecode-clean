// STRUCTURED FORBIDDEN-CLAIM CONTRACT tests (Codex finding 4, 2026-09-24).
import { describe, it, expect } from 'vitest';
import { checkForbiddenClaimCodes, checkSentinelForbiddenClaim, FORBIDDEN_CODE_TO_SEMANTIC_FAMILY, SENTINEL_TO_SEMANTIC_FAMILY } from './claimCodes.ts';
import { FORBIDDEN_CLAIM_FAMILIES } from '../../../src/data/forbiddenClaimSemantics.js';
import { formatPaymentTruthAnswer } from './paymentTruth.ts';
import { formatInvoicingTruthAnswer } from './invoicingTruth.ts';
import { formatCapabilityTruthAnswer } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY } from '../../../src/data/productTruthRegistry.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

describe('STRUCTURED FORBIDDEN-CLAIM CONTRACT — the 6 required families are all reachable via a real registry code or sentinel', () => {
  it('every required family (payment, invoicing, aiMutation, settingsLifecycle, calculatorRates, metals) has at least one real code/sentinel mapped to it', () => {
    const requiredFamilies = ['payment', 'invoicing', 'aiMutation', 'settingsLifecycle', 'calculatorRates', 'metals'];
    const mappedFamilies = new Set([...Object.values(FORBIDDEN_CODE_TO_SEMANTIC_FAMILY), ...Object.values(SENTINEL_TO_SEMANTIC_FAMILY)]);
    for (const f of requiredFamilies) {
      expect(mappedFamilies.has(f), `family "${f}" has no real registry code or sentinel mapped to it`).toBe(true);
      expect(FORBIDDEN_CLAIM_FAMILIES[f], `family "${f}" has no semantic pattern definitions`).toBeTruthy();
    }
  });

  it('every code in FORBIDDEN_CODE_TO_SEMANTIC_FAMILY actually appears on at least one real registry capability (the join points at real data, not invented codes)', () => {
    const allRealCodes = new Set();
    for (const c of [...PRODUCT_TRUTH_REGISTRY, ...NON_CURRENT_REGISTRY]) {
      for (const code of c.forbiddenClaimCodes || []) allRealCodes.add(code);
    }
    for (const code of Object.keys(FORBIDDEN_CODE_TO_SEMANTIC_FAMILY)) {
      expect(allRealCodes.has(code), `mapped code "${code}" does not appear on any real registry capability`).toBe(true);
    }
  });
});

describe('STRUCTURED FORBIDDEN-CLAIM CONTRACT — real, current deterministic answers never assert their own registry-declared forbidden codes', () => {
  it('payment_processing (non-current): its own real forbiddenClaimCodes never claimed by the real answer, EN+HE', () => {
    const cap = NON_CURRENT_REGISTRY.find((c) => c.id === 'payment_processing');
    for (const isHebrew of [false, true]) {
      const answer = formatPaymentTruthAnswer(isHebrew);
      const results = checkForbiddenClaimCodes(cap.forbiddenClaimCodes, answer, isHebrew);
      for (const r of results) expect(r.claimed, `code "${r.code}" (family ${r.family}) claimed by: ${answer}`).toBe(false);
    }
  });

  it('invoicing (non-current): its own real forbiddenClaimCodes never claimed by the real answer, EN+HE', () => {
    const cap = NON_CURRENT_REGISTRY.find((c) => c.id === 'invoicing');
    for (const isHebrew of [false, true]) {
      const answer = formatInvoicingTruthAnswer(isHebrew);
      const results = checkForbiddenClaimCodes(cap.forbiddenClaimCodes, answer, isHebrew);
      for (const r of results) expect(r.claimed, `code "${r.code}" (family ${r.family}) claimed by: ${answer}`).toBe(false);
    }
  });

  it('ai_mutation (non-current): its own real forbiddenClaimCodes never claimed by the real answer, EN+HE', () => {
    const cap = NON_CURRENT_REGISTRY.find((c) => c.id === 'ai_mutation');
    for (const isHebrew of [false, true]) {
      const answer = formatCapabilityTruthAnswer('ai_mutation', FACTS, isHebrew);
      const results = checkForbiddenClaimCodes(cap.forbiddenClaimCodes, answer, isHebrew);
      for (const r of results) expect(r.claimed, `code "${r.code}" (family ${r.family}) claimed by: ${answer}`).toBe(false);
    }
  });

  it('account_lifecycle_not_self_service (sentinel, not a registry id): never claimed by the real answer, EN+HE', () => {
    for (const isHebrew of [false, true]) {
      const answer = formatCapabilityTruthAnswer('account_lifecycle_not_self_service', FACTS, isHebrew);
      const result = checkSentinelForbiddenClaim('account_lifecycle_not_self_service', answer, isHebrew);
      expect(result.claimed, `sentinel claimed by: ${answer}`).toBe(false);
    }
  });
});

describe('STRUCTURED FORBIDDEN-CLAIM CONTRACT — adversarial fixtures (proves the structured join has real teeth, not just a pass-through)', () => {
  it('a synthetic answer that DOES assert a mapped code\'s forbidden claim is caught, by code identity', () => {
    const fakeAnswer = 'Checkout is live and we accept credit cards for your subscription.';
    const results = checkForbiddenClaimCodes(['NO_PAYMENT_CAPABILITY_CLAIM'], fakeAnswer, false);
    expect(results[0].claimed).toBe(true);
    expect(results[0].family).toBe('payment');
  });

  it('an unmapped code (e.g. NO_OWNER_PUBLIC_WHATSAPP_CONFLATION - a real registry code outside the 6 required families) is reported honestly as unchecked, never silently "passing" as if it had been verified', () => {
    const results = checkForbiddenClaimCodes(['NO_OWNER_PUBLIC_WHATSAPP_CONFLATION'], 'irrelevant text', false);
    expect(results[0]).toEqual({ code: 'NO_OWNER_PUBLIC_WHATSAPP_CONFLATION', family: null, claimed: false, matches: [] });
  });

  it('the sentinel join also has teeth: a synthetic settings-lifecycle false claim is caught', () => {
    const fakeAnswer = 'Cancellation is available self-service from Business Settings.';
    const result = checkSentinelForbiddenClaim('account_lifecycle_not_self_service', fakeAnswer, false);
    expect(result.claimed).toBe(true);
  });

  it('an unknown sentinel id returns null (no family mapped) rather than throwing or silently passing', () => {
    expect(checkSentinelForbiddenClaim('not_a_real_sentinel', 'text', false)).toBeNull();
  });
});
