import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateAiFacts, AI_FACTS_SCHEMA_VERSION, APPROVED_PRICE_ROW_COUNT } from './generate-ai-chat-facts.js';
import { SUPPORT_EMAIL_HE, SUPPORT_EMAIL_EN } from '../src/shared/brand.js';
import { REGION_RULES } from '../src/utils/regionConfig.js';
import { PRICE_VERSIONS, PRICE_CATALOG_VERSION, FREE_DAYS_TOTAL } from '../src/domain/subscriptions/priceCatalog.js';
import { PLAN_NAMES, FREE_QUOTES_TOTAL, CAPABILITIES } from '../supabase/functions/_shared/subscriptionContract.ts';

// Consolidated Gate 1, §11.4 + subscriptions cutover (OD-01..OD-20): proves the generated AI facts match the canonical
// sources value-by-value - the approved price rows (priceCatalog.js) and the canonical plan contract
// (subscriptionContract.ts) - and that no retired plan truth (trial, legacy tiers, monthly limits, unlimited, annual,
// old prices) survives in the facts the assistant reads.

describe('generateAiFacts - canonical facts parity', () => {
  const facts = generateAiFacts();
  const S = facts.subscriptions;

  it('carries the schema version (v3 after the Task 27 package reconciliation)', () => {
    expect(facts.schemaVersion).toBe(AI_FACTS_SCHEMA_VERSION);
    expect(AI_FACTS_SCHEMA_VERSION).toBe(3);
  });

  it('support emails match src/shared/brand.js exactly', () => {
    expect(facts.supportEmail.he).toBe(SUPPORT_EMAIL_HE);
    expect(facts.supportEmail.en).toBe(SUPPORT_EMAIL_EN);
  });

  it('quote VAT rates match src/utils/regionConfig.js exactly', () => {
    expect(facts.vatRate.il).toBe(REGION_RULES.LOCAL.vatRate);
    expect(facts.vatRate.international).toBe(REGION_RULES.INTERNATIONAL.vatRate);
  });

  it('plan names are exactly the canonical OD-16 names, in contract order', () => {
    expect(S.plans).toEqual(['free', 'all_inclusive', 'classic', 'modern', 'visual'].map((id) => ({ id, he: PLAN_NAMES.he[id], en: PLAN_NAMES.en[id] })));
    expect(S.plans.map((p) => p.he)).toEqual(['חינם', 'הכול כלול', 'קלאסיק', 'מודרן', 'ויזואל']);
    expect(S.currentPaidPlanId).toBe('all_inclusive');
    expect(S.legacyPaidPlanIds).toEqual(['classic', 'modern', 'visual']);
    expect(S.stylesAreNotPlans).toBe(true);
  });

  it('the package prices equal the package catalog (§249 + the $184 amendment); the catalog block keeps its approved row', () => {
    expect(S.prices.IL.package).toEqual({ id: 'all_inclusive', month: '30.00', year: '306.00', annualSaving: '54.00', annualSavingPercentRounded: 15, annualSavingPercentExact: true });
    expect(S.prices.INTERNATIONAL.package).toEqual({ id: 'all_inclusive', month: '18.00', year: '184.00', annualSaving: '32.00', annualSavingPercentRounded: 15, annualSavingPercentExact: false });
    expect(S.prices.IL.catalogBlock100).toBe('5.00');
    expect(S.prices.INTERNATIONAL.catalogBlock100).toBe('3.00');
    expect(S.prices.IL).not.toHaveProperty('plans'); // no per-style-plan price is an offer any more
    expect(PRICE_VERSIONS.every((p) => p.billingPeriod === 'month')).toBe(true); // the legacy catalog itself is unchanged
    expect(APPROVED_PRICE_ROW_COUNT).toBe(8);
    expect(S.priceCatalogVersion).toBe(PRICE_CATALOG_VERSION);
  });

  it('IL prices include VAT (OD-05); International is billed in USD only, local currency is an estimate (OD-08)', () => {
    expect(S.prices.IL.billingCurrency).toBe('ILS');
    expect(S.prices.IL.taxIncluded).toBe(true);
    expect(S.prices.INTERNATIONAL.billingCurrency).toBe('USD');
    expect(S.prices.INTERNATIONAL.localCurrencyDisplayIsEstimateOnly).toBe(true);
    expect(JSON.stringify(S.prices.INTERNATIONAL)).not.toMatch(/ILS|₪|NIS/);
  });

  it('Free is 10 quotes or 7 days, whichever ends first (Owner 2026-10-20), consumed on the first client output only (OD-01/OD-02)', () => {
    expect(S.free.quotesTotal).toBe(FREE_QUOTES_TOTAL);
    expect(S.free.quotesTotal).toBe(10);
    expect(S.free.expires).toBe(true);
    expect(S.free.days).toBe(FREE_DAYS_TOTAL);
    expect(S.free.days).toBe(7);
    expect(S.free.endsWhen).toBe('first_of_quotes_or_days');
    expect(S.free.countedOnFirstSaveWithClientAndItem).toBe(true); // Owner 2026-10-24 (L-14 + L-17): counted at the first save
    expect(S.free.resaveConsumesAgain).toBe(false);
    expect(S.free.consumingChannels).toEqual(['send', 'public_share', 'final_pdf', 'final_print']);
    expect(S.free.draftsAndPreviewsConsume).toBe(false);
    expect(S.free.deleteRefunds).toBe(false);
    expect(S.free.existingDocumentsStayAccessible).toBe(true);
  });

  it('the plan system is not active, there is no trial, and account state comes only from the server summary', () => {
    expect(S.planSystemActive).toBe(false);
    expect(S.activationPhase).toBe('off');
    expect(S.trialOffered).toBe(false);
    expect(S.accountStateSource).toBe('get_account_summary');
  });

  it('every open decision is listed as not decided (never a value)', () => {
    expect(S.notDecided).toEqual(expect.arrayContaining([
      'paid_plan_quote_limits', 'capability_matrix', 'storage', 'ai_quotas', 'attachments',
      'cancellation_refund_proration', 'tax_beyond_il_inclusion',
    ]));
    expect(S.notDecided).not.toContain('annual_billing'); // decided by §249
  });

  it('no retired plan truth survives anywhere in the generated facts', () => {
    expect(facts).not.toHaveProperty('trialDays');
    expect(facts).not.toHaveProperty('quoteLimits');
    expect(facts).not.toHaveProperty('pricing');
    expect(facts).not.toHaveProperty('attachments');
    const json = JSON.stringify(facts);
    expect(json).not.toMatch(/"basic"|"pro"|unlimited|annual(Effective|Total)|savingsPercent|monthlyQuoteLimit|trialDays/i);
    expect(json).not.toMatch(/14-day|ניסיון חינם|ללא הגבלה/);
  });

  it('subscription-gated capabilities are projected with their canonical id and NO plan availability (OPEN-02)', () => {
    const gated = facts.capabilities.filter((c) => c.subscriptionCapabilityId);
    expect(gated.map((c) => c.id).sort()).toEqual(['attachments', 'measured_quote', 'owner_whatsapp_share', 'professional_reuse', 'quote_duplicate', 'quote_edit']);
    for (const c of gated) {
      expect(CAPABILITIES[c.subscriptionCapabilityId]).toBeTruthy();
      expect(c.planEligibility).toBe('not_decided');
      expect(c.eligiblePlans).toBeNull();
      expect(c.minimumPlan).toBeNull();
      expect(c).not.toHaveProperty('planAvailability');
    }
    for (const c of facts.capabilities) expect(c.minimumPlan).toBeNull();
  });

  it('never claims live checkout/billing integration exists (billing-checkout-stub is a scaffold only)', () => {
    expect(facts.billing.liveCheckoutAvailable).toBe(false);
    expect(facts.billing.paymentProcessingAvailable).toBe(facts.billing.liveCheckoutAvailable);
    expect(facts.billing.acceptedPaymentCurrencies).toEqual([]);
    expect(facts.billing.paymentMethodsKnown).toBe(false);
  });

  it('the generator imports neither the retired static pricing catalog nor the legacy plan catalog', () => {
    const src = readFileSync('scripts/generate-ai-chat-facts.js', 'utf-8');
    expect(src).not.toMatch(/from ['"][^'"]*pricingCatalog/);
    expect(src).not.toMatch(/from ['"][^'"]*planCatalog/);
    expect(src).toMatch(/from '\.\.\/src\/domain\/subscriptions\/priceCatalog\.js'/);
    expect(src).toMatch(/subscriptionContract\.ts'/);
  });
});
