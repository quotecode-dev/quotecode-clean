import { describe, it, expect } from 'vitest';
import { generateAiFacts, AI_FACTS_SCHEMA_VERSION } from './generate-ai-chat-facts.js';
import { PRICING_CATALOG, getAnnualTotal, getSavingsPercent } from '../src/utils/pricingCatalog.js';
import { PLAN_CATALOG } from '../src/utils/planCatalog.js';
import { SUPPORT_EMAIL_HE, SUPPORT_EMAIL_EN } from '../src/shared/brand.js';
import { REGION_RULES } from '../src/utils/regionConfig.js';

// Consolidated Gate 1, §11.4: proves the generated AI facts match the real
// canonical sources value-by-value - not just "the generator ran", but that
// its output is actually derived from (not duplicated from) those sources.

describe('generateAiFacts - canonical facts parity', () => {
  const facts = generateAiFacts();

  it('carries the schema version', () => {
    expect(facts.schemaVersion).toBe(AI_FACTS_SCHEMA_VERSION);
  });

  it('support emails match src/shared/brand.js exactly', () => {
    expect(facts.supportEmail.he).toBe(SUPPORT_EMAIL_HE);
    expect(facts.supportEmail.en).toBe(SUPPORT_EMAIL_EN);
  });

  it('VAT rates match src/utils/regionConfig.js exactly', () => {
    expect(facts.vatRate.il).toBe(REGION_RULES.LOCAL.vatRate);
    expect(facts.vatRate.international).toBe(REGION_RULES.INTERNATIONAL.vatRate);
  });

  it('quote limits match src/utils/planCatalog.js entitlements exactly', () => {
    expect(facts.quoteLimits.free).toBe(PLAN_CATALOG.free.entitlements.monthlyQuoteLimit);
    expect(facts.quoteLimits.basic).toBe(PLAN_CATALOG.basic.entitlements.monthlyQuoteLimit);
    expect(facts.quoteLimits.pro).toBe('unlimited');
    expect(PLAN_CATALOG.pro.entitlements.monthlyQuoteLimit).toBe(Infinity);
  });

  it('attachments.proOnly is derived from planCatalog entitlements, not hardcoded', () => {
    expect(facts.attachments.proOnly).toBe(
      PLAN_CATALOG.pro.entitlements.attachments === true && PLAN_CATALOG.basic.entitlements.attachments === false
    );
  });

  it('every market price matches src/utils/pricingCatalog.js exactly, including derived annual figures', () => {
    const cases = [
      ['il', PRICING_CATALOG.il],
      ['usd', PRICING_CATALOG.global.usd],
      ['gbp', PRICING_CATALOG.global.gbp],
      ['eur', PRICING_CATALOG.global.eur],
    ];
    for (const [key, catalog] of cases) {
      const generated = facts.pricing[key];
      expect(generated.currency).toBe(catalog.currency);
      expect(generated.currencySymbol).toBe(catalog.currencySymbol);
      expect(generated.plans.free.monthly).toBe(catalog.free.monthly);
      for (const planId of ['basic', 'pro']) {
        expect(generated.plans[planId].monthly).toBe(catalog[planId].monthly);
        expect(generated.plans[planId].annualEffectiveMonthly).toBe(catalog[planId].annualMonthly);
        expect(generated.plans[planId].annualTotal).toBe(getAnnualTotal(catalog[planId].annualMonthly));
        expect(generated.plans[planId].savingsPercent).toBe(getSavingsPercent(catalog[planId].monthly, catalog[planId].annualMonthly));
      }
    }
  });

  it('never claims live checkout/billing integration exists (billing-checkout-stub is a scaffold only)', () => {
    expect(facts.billing.liveCheckoutAvailable).toBe(false);
    // OD-C2: the whole negative-capability record derives from ONE flag and never claims a payment capability
    expect(facts.billing.paymentProcessingAvailable).toBe(facts.billing.liveCheckoutAvailable);
    expect(facts.billing.acceptedPaymentCurrencies).toEqual([]);
    expect(facts.billing.paymentMethodsKnown).toBe(false);
  });

  it('the monthly price is never silently equal to the annual-effective price presented as "the" price (the exact pre-Gate-1 defect)', () => {
    // Regression guard for the bug this generator fixes: the old hand-typed
    // prompt used the annualMonthly figure (e.g. $12/₪39) as if it were the
    // flat monthly price. Any real market here must show monthly > annualEffectiveMonthly.
    for (const key of ['il', 'usd', 'gbp', 'eur']) {
      for (const planId of ['basic', 'pro']) {
        const plan = facts.pricing[key].plans[planId];
        expect(plan.monthly).toBeGreaterThan(plan.annualEffectiveMonthly);
      }
    }
  });
});
