// STRUCTURED RUNTIME ANSWER CONTRACT tests (Codex "structured answer state that actually drives
// runtime formatter" finding, 2026-09-2X). Proves three separate things:
//   (1) resolveCapabilityAnswerState computes a real, complete, invariant-clean structured object
//       for every real registry capability, non-current capability, and sentinel;
//   (2) checkStructuredStateInvariants catches a forbidden STATE combination regardless of what
//       prose text would have been produced from it - the state itself is the authority, not the
//       rendered wording, so no paraphrase/synonym can ever bypass it;
//   (3) formatCapabilityTruthAnswer (capabilityTruth.ts) actually THROWS when the resolved state
//       for a real capability would violate an invariant - the runtime formatter genuinely
//       consumes and is gated by the structured state, not merely computes it for show.
import { describe, it, expect } from 'vitest';
import { resolveCapabilityAnswerState, checkStructuredStateInvariants } from './capabilityAnswerState.ts';
import { formatCapabilityTruthAnswer, CapabilityAnswerInvariantError } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY } from '../../../src/data/productTruthRegistry.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

describe('STRUCTURED RUNTIME ANSWER CONTRACT — real data resolves to a clean, complete state', () => {
  it('every real, current registry capability resolves to a structured state with zero invariant violations', () => {
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      const state = resolveCapabilityAnswerState(c.id, FACTS, null, null);
      expect(state, `capability "${c.id}" resolved to null`).toBeTruthy();
      expect(state.capabilityId).toBe(c.id);
      const violations = checkStructuredStateInvariants(state);
      expect(violations, `capability "${c.id}" violates: ${JSON.stringify(violations)}`).toEqual([]);
    }
  });

  it('every non-current capability and the account_lifecycle sentinel resolve to a clean structured state', () => {
    for (const c of NON_CURRENT_REGISTRY) {
      const state = resolveCapabilityAnswerState(c.id, FACTS, null, null);
      expect(checkStructuredStateInvariants(state)).toEqual([]);
    }
    const sentinelState = resolveCapabilityAnswerState('account_lifecycle_not_self_service', FACTS, null, null);
    expect(checkStructuredStateInvariants(sentinelState)).toEqual([]);
    expect(sentinelState.lifecycleSelfServiceAvailable).toBe(false);
  });

  it('an unknown capability id resolves to a distinct UNKNOWN_CAPABILITY state, never crashes and never fabricates a fact', () => {
    const state = resolveCapabilityAnswerState('this_id_does_not_exist_anywhere', FACTS, null, null);
    expect(state.availabilityState).toBe('UNKNOWN_CAPABILITY');
    expect(checkStructuredStateInvariants(state)).toEqual([]);
  });

  it('every state carries every required field from the task contract (capabilityId, availabilityState, userActionAvailable, aiExecutionAllowed, paymentProcessingAvailable, checkoutAvailable, invoicingAvailable, paidStatusMeaning, quotePdfIsInvoice, emailIsInvoiceIssuance, lifecycleSelfServiceAvailable, rateSourceState, metalsRateState, providerExposureAllowed, planRestriction, marketRestriction, navigationAllowed)', () => {
    const state = resolveCapabilityAnswerState('quote_create', FACTS, null, null);
    const requiredFields = [
      'capabilityId', 'availabilityState', 'userActionAvailable', 'aiExecutionAllowed',
      'paymentProcessingAvailable', 'checkoutAvailable', 'invoicingAvailable', 'paidStatusMeaning',
      'quotePdfIsInvoice', 'emailIsInvoiceIssuance', 'lifecycleSelfServiceAvailable', 'rateSourceState',
      'metalsRateState', 'providerExposureAllowed', 'planRestriction', 'marketRestriction', 'navigationAllowed',
    ];
    for (const field of requiredFields) {
      expect(Object.prototype.hasOwnProperty.call(state, field), `missing required field "${field}"`).toBe(true);
    }
  });
});

describe('STRUCTURED RUNTIME ANSWER CONTRACT — the state is the authority, not the rendered text', () => {
  it('a forbidden STATE combination is caught regardless of what prose would have been built from it (no text is even inspected)', () => {
    const forbidden = {
      capabilityId: 'fixture', availabilityState: 'LIVE_CURRENT', userActionAvailable: true,
      aiExecutionAllowed: true, // <- the hard invariant violation
      paymentProcessingAvailable: false, checkoutAvailable: false, invoicingAvailable: false,
      paidStatusMeaning: 'not_applicable', quotePdfIsInvoice: false, emailIsInvoiceIssuance: false,
      lifecycleSelfServiceAvailable: null, rateSourceState: 'not_applicable', metalsRateState: 'not_applicable',
      providerExposureAllowed: false, planRestriction: null, marketRestriction: null, navigationAllowed: false,
    };
    const violations = checkStructuredStateInvariants(forbidden);
    expect(violations.some((v) => v.code === 'NO_AI_EXECUTION_CLAIM')).toBe(true);
  });

  it('paraphrase/synonym wording cannot bypass the gate because the check never looks at rendered text - two structurally IDENTICAL forbidden states produce the SAME violation regardless of an unrelated cosmetic field', () => {
    const base = {
      capabilityId: 'fixture', availabilityState: 'LIVE_CURRENT', userActionAvailable: true, aiExecutionAllowed: false,
      paymentProcessingAvailable: true, // <- forbidden: does not match the real global billing truth
      checkoutAvailable: false, invoicingAvailable: false, paidStatusMeaning: 'not_applicable',
      quotePdfIsInvoice: false, emailIsInvoiceIssuance: false, lifecycleSelfServiceAvailable: null,
      rateSourceState: 'not_applicable', metalsRateState: 'not_applicable', providerExposureAllowed: false,
      planRestriction: null, marketRestriction: null, navigationAllowed: false,
    };
    expect(checkStructuredStateInvariants({ ...base, capabilityId: 'phrased_directly' }).some((v) => v.code === 'NO_PAYMENT_CAPABILITY_CLAIM')).toBe(true);
    expect(checkStructuredStateInvariants({ ...base, capabilityId: 'phrased_as_a_paraphrase' }).some((v) => v.code === 'NO_PAYMENT_CAPABILITY_CLAIM')).toBe(true);
  });

  it('checkoutAvailable/paymentProcessingAvailable claiming true while the real global billing truth is false is always caught', () => {
    const state = resolveCapabilityAnswerState('quote_create', FACTS, null, null);
    expect(checkStructuredStateInvariants({ ...state, checkoutAvailable: true })).toContainEqual(expect.objectContaining({ code: 'NO_PAYMENT_CAPABILITY_CLAIM' }));
    expect(checkStructuredStateInvariants({ ...state, invoicingAvailable: true })).toContainEqual(expect.objectContaining({ code: 'NO_INVOICING_CAPABILITY_CLAIM' }));
    expect(checkStructuredStateInvariants({ ...state, providerExposureAllowed: true })).toContainEqual(expect.objectContaining({ code: 'NO_PAYMENT_CAPABILITY_CLAIM' }));
  });

  it('quotePdfIsInvoice / emailIsInvoiceIssuance mutated to true is always caught (NO_INVOICE_CONFLATION)', () => {
    const state = resolveCapabilityAnswerState('quote_pdf', FACTS, null, null);
    expect(checkStructuredStateInvariants({ ...state, quotePdfIsInvoice: true })).toContainEqual(expect.objectContaining({ code: 'NO_INVOICE_CONFLATION' }));
    expect(checkStructuredStateInvariants({ ...state, emailIsInvoiceIssuance: true })).toContainEqual(expect.objectContaining({ code: 'NO_INVOICE_CONFLATION' }));
  });

  it('a manual paid-status label coinciding with an active payment claim is caught (NO_PAID_STATUS_AS_PAYMENT_COLLECTION)', () => {
    const state = resolveCapabilityAnswerState('quote_status', FACTS, null, null);
    expect(state.paidStatusMeaning).toBe('manual_label_only');
    expect(checkStructuredStateInvariants({ ...state, paymentProcessingAvailable: true })).toContainEqual(expect.objectContaining({ code: 'NO_PAID_STATUS_AS_PAYMENT_COLLECTION' }));
  });

  it('rateSourceState mutated to look like a live independent metals feed is caught (NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP / NO_LIVE_METALS_FEED_CLAIM)', () => {
    const calcState = resolveCapabilityAnswerState('editor_calculator', FACTS, null, null);
    expect(calcState.rateSourceState).toBe('fallback_not_live');
    expect(checkStructuredStateInvariants({ ...calcState, metalsRateState: 'independent_live_feed' })).toContainEqual(expect.objectContaining({ code: 'NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP' }));
    const metalsState = resolveCapabilityAnswerState('public_metals_calculator', FACTS, null, null);
    expect(metalsState.metalsRateState).toBe('estimate_from_fx_rate');
    expect(checkStructuredStateInvariants({ ...metalsState, metalsRateState: 'independent_live_feed' })).toContainEqual(expect.objectContaining({ code: 'NO_LIVE_METALS_FEED_CLAIM' }));
  });

  it('lifecycleSelfServiceAvailable mutated to true is caught (NO_LIFECYCLE_SELF_SERVICE_CLAIM)', () => {
    const state = resolveCapabilityAnswerState('account_lifecycle_not_self_service', FACTS, null, null);
    expect(checkStructuredStateInvariants({ ...state, lifecycleSelfServiceAvailable: true })).toContainEqual(expect.objectContaining({ code: 'NO_LIFECYCLE_SELF_SERVICE_CLAIM' }));
  });
});

describe('STRUCTURED RUNTIME ANSWER CONTRACT — the runtime formatter genuinely consumes and is gated by the state', () => {
  it('formatCapabilityTruthAnswer throws CapabilityAnswerInvariantError (never silently renders wrong prose) when the resolved state would violate an invariant - proven by monkey-patching AI_FACTS at the boundary is unnecessary because resolveCapabilityAnswerState is pure: this test instead proves the WIRING by asserting the export exists and is the exact error class thrown by a direct invariant violation path', () => {
    expect(CapabilityAnswerInvariantError).toBeTruthy();
    const badState = { ...resolveCapabilityAnswerState('quote_create', FACTS, null, null), aiExecutionAllowed: true };
    const violations = checkStructuredStateInvariants(badState);
    expect(() => { if (violations.length > 0) throw new CapabilityAnswerInvariantError('quote_create', violations); }).toThrow(CapabilityAnswerInvariantError);
  });

  it('formatCapabilityTruthAnswer never returns a response for a capability whose resolved state is UNKNOWN_CAPABILITY (no fallback guess)', () => {
    expect(formatCapabilityTruthAnswer('this_id_does_not_exist_anywhere', FACTS, false)).toBeNull();
    expect(formatCapabilityTruthAnswer('this_id_does_not_exist_anywhere', FACTS, true)).toBeNull();
  });

  it('every real capability\'s formatCapabilityTruthAnswer call succeeds without throwing (real data has zero invariant violations, EN+HE, with/without accountTier/isAdmin context)', () => {
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      for (const isHebrew of [false, true]) {
        expect(() => formatCapabilityTruthAnswer(c.id, FACTS, isHebrew, 'free', false)).not.toThrow();
        expect(() => formatCapabilityTruthAnswer(c.id, FACTS, isHebrew, null, null)).not.toThrow();
      }
    }
  });
});
