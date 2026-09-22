// FORBIDDEN CLAIM SEMANTIC GATE (Codex defect 9B, 2026-09-23) — tests the real, current answer
// functions against MEANING, not just historical exact strings, and proves the checker itself has
// teeth via adversarial synthetic fixtures for every family.
import { describe, it, expect } from 'vitest';
import { checkSemanticClaim, FORBIDDEN_CLAIM_FAMILIES } from './forbiddenClaimSemantics.js';
import { formatPaymentTruthAnswer } from '../../supabase/functions/chat-ai/paymentTruth.ts';
import { formatInvoicingTruthAnswer } from '../../supabase/functions/chat-ai/invoicingTruth.ts';
import { formatCapabilityTruthAnswer } from '../../supabase/functions/chat-ai/capabilityTruth.ts';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

function assertNeverClaims(text, family, isHebrew) {
  const patterns = FORBIDDEN_CLAIM_FAMILIES[family][isHebrew ? 'he' : 'en'];
  for (const p of patterns) {
    const { claimed, matches } = checkSemanticClaim(text, p, isHebrew);
    expect(claimed, `"${family}" family pattern ${p} matched an unnegated claim: ${JSON.stringify(matches)} in text: ${text}`).toBe(false);
  }
}

describe('FORBIDDEN CLAIM SEMANTIC GATE — real, current deterministic answers never assert a forbidden claim', () => {
  it('payment: the real deterministic answer (EN + HE) never asserts checkout/card capability', () => {
    assertNeverClaims(formatPaymentTruthAnswer(false), 'payment', false);
    assertNeverClaims(formatPaymentTruthAnswer(true), 'payment', true);
  });

  it('invoicing: the real deterministic answer (EN + HE) never asserts invoice-issuance capability', () => {
    assertNeverClaims(formatInvoicingTruthAnswer(false), 'invoicing', false);
    assertNeverClaims(formatInvoicingTruthAnswer(true), 'invoicing', true);
  });

  it('AI mutation: the real deterministic answer never claims the AI already performed or can autonomously perform a mutation', () => {
    assertNeverClaims(formatCapabilityTruthAnswer('ai_mutation', FACTS, false), 'aiMutation', false);
    assertNeverClaims(formatCapabilityTruthAnswer('ai_mutation', FACTS, true), 'aiMutation', true);
  });

  it('Settings lifecycle: the real deterministic answer never claims self-service cancellation/archive/delete', () => {
    assertNeverClaims(formatCapabilityTruthAnswer('account_lifecycle_not_self_service', FACTS, false), 'settingsLifecycle', false);
    assertNeverClaims(formatCapabilityTruthAnswer('account_lifecycle_not_self_service', FACTS, true), 'settingsLifecycle', true);
  });
});

describe('FORBIDDEN CLAIM SEMANTIC GATE — adversarial fixtures (proves the checker has real teeth)', () => {
  it('payment: a synthetic false claim ("Checkout is live and we accept credit cards.") IS caught', () => {
    const fake = 'Checkout is live and we accept credit cards for your subscription.';
    const { claimed } = checkSemanticClaim(fake, FORBIDDEN_CLAIM_FAMILIES.payment.en[0], false);
    expect(claimed).toBe(true);
    const { claimed: claimed2 } = checkSemanticClaim(fake, FORBIDDEN_CLAIM_FAMILIES.payment.en[1], false);
    expect(claimed2).toBe(true);
  });

  it('payment: a truthful negative sentence using the SAME words is NOT caught (negation-aware)', () => {
    const truthful = 'Checkout is not live and TEKANGO does not accept credit cards today.';
    for (const p of FORBIDDEN_CLAIM_FAMILIES.payment.en) {
      expect(checkSemanticClaim(truthful, p, false).claimed).toBe(false);
    }
  });

  it('payment (HE): a synthetic false claim is caught, a truthful negative is not', () => {
    expect(checkSemanticClaim('הסליקה זמינה עכשיו.', FORBIDDEN_CLAIM_FAMILIES.payment.he[0], true).claimed).toBe(true);
    expect(checkSemanticClaim('הסליקה לא זמינה כרגע.', FORBIDDEN_CLAIM_FAMILIES.payment.he[0], true).claimed).toBe(false);
  });

  it('invoicing: a synthetic false claim ("Invoice issuance is available now.") IS caught', () => {
    expect(checkSemanticClaim('Invoice issuance is available now.', FORBIDDEN_CLAIM_FAMILIES.invoicing.en[0], false).claimed).toBe(true);
  });

  it('invoicing: conflating the quote PDF with an invoice IS caught', () => {
    expect(checkSemanticClaim('Your quote PDF is an invoice you can send to accounting.', FORBIDDEN_CLAIM_FAMILIES.invoicing.en[1], false).claimed).toBe(true);
  });

  it('AI mutation: a synthetic "I already did it" claim IS caught', () => {
    expect(checkSemanticClaim('I edited it and saved the changes.', FORBIDDEN_CLAIM_FAMILIES.aiMutation.en[0], false).claimed).toBe(true);
    expect(checkSemanticClaim('The AI can autonomously edit the quote for you.', FORBIDDEN_CLAIM_FAMILIES.aiMutation.en[2], false).claimed).toBe(true);
  });

  it('AI mutation: the truthful "the AI cannot edit it" is NOT caught', () => {
    expect(checkSemanticClaim('The AI can not autonomously edit the quote.', FORBIDDEN_CLAIM_FAMILIES.aiMutation.en[2], false).claimed).toBe(false);
  });

  it('Settings lifecycle: a synthetic false self-service claim IS caught', () => {
    expect(checkSemanticClaim('Cancellation is available self-service from Business Settings.', FORBIDDEN_CLAIM_FAMILIES.settingsLifecycle.en[0], false).claimed).toBe(true);
  });

  it('calculator rates: a synthetic "fallback rates are live" claim IS caught, the truthful negative is not', () => {
    expect(checkSemanticClaim('The fallback rate is live right now.', FORBIDDEN_CLAIM_FAMILIES.calculatorRates.en[0], false).claimed).toBe(true);
    expect(checkSemanticClaim('The fallback rate is not live.', FORBIDDEN_CLAIM_FAMILIES.calculatorRates.en[0], false).claimed).toBe(false);
  });

  it('metals: a synthetic "independent live feed" claim IS caught, the truthful estimate wording is not', () => {
    expect(checkSemanticClaim('Our metals calculator uses an independent live feed.', FORBIDDEN_CLAIM_FAMILIES.metals.en[0], false).claimed).toBe(true);
    expect(checkSemanticClaim('Our metals estimate is not an independent live feed.', FORBIDDEN_CLAIM_FAMILIES.metals.en[0], false).claimed).toBe(false);
  });
});
