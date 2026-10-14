import { describe, it, expect } from 'vitest';
import {
  PRICING_CATALOG,
  VAT_RATE_IL,
  getAnnualTotal,
  getMonthlyCycleAnnualTotal,
  getSavingsPercent,
  getVatBreakdown,
  getStripePriceId,
  getPlanPricingDisplay,
} from './pricingCatalog';

// Unified Landing/Tools/Billing-Readiness task, §B: this catalog must
// preserve the exact prices already displayed on both landing pages before
// this task (no invented prices) and every derived figure (annual total,
// monthly-equivalent, VAT breakdown, savings %) must be arithmetically
// consistent - not just plausible-looking.

describe('pricingCatalog - preserves already-displayed prices exactly', () => {
  it('Israel (ILS) Basic/Pro monthly and annual-monthly rates match what was already shown', () => {
    expect(PRICING_CATALOG.il.basic.monthly).toBe(49);
    expect(PRICING_CATALOG.il.basic.annualMonthly).toBe(39);
    expect(PRICING_CATALOG.il.pro.monthly).toBe(99);
    expect(PRICING_CATALOG.il.pro.annualMonthly).toBe(79);
    expect(PRICING_CATALOG.il.free.monthly).toBe(0);
  });

  it('International USD/GBP/EUR Basic/Pro rates match what was already shown', () => {
    expect(PRICING_CATALOG.global.usd).toMatchObject({ basic: { monthly: 15, annualMonthly: 12 }, pro: { monthly: 29, annualMonthly: 23 } });
    expect(PRICING_CATALOG.global.gbp).toMatchObject({ basic: { monthly: 12, annualMonthly: 10 }, pro: { monthly: 24, annualMonthly: 19 } });
    expect(PRICING_CATALOG.global.eur).toMatchObject({ basic: { monthly: 14, annualMonthly: 11 }, pro: { monthly: 27, annualMonthly: 22 } });
  });
});

describe('pricingCatalog - pure arithmetic helpers', () => {
  it('getAnnualTotal multiplies the annual-monthly rate by 12', () => {
    expect(getAnnualTotal(39)).toBe(468);
    expect(getAnnualTotal(79)).toBe(948);
    expect(getAnnualTotal(12)).toBe(144);
    expect(getAnnualTotal(23)).toBe(276);
  });

  it('getMonthlyCycleAnnualTotal multiplies the monthly rate by 12 (what a monthly-cycle subscriber pays across a year)', () => {
    expect(getMonthlyCycleAnnualTotal(49)).toBe(588);
    expect(getMonthlyCycleAnnualTotal(99)).toBe(1188);
  });

  it('getSavingsPercent is approximately 20% for every plan/currency (not asserted as exactly 20 - real rounding varies ~17-21%)', () => {
    const pairs = [
      [49, 39], [99, 79], // ILS
      [15, 12], [29, 23], // USD
      [12, 10], [24, 19], // GBP
      [14, 11], [27, 22], // EUR
    ];
    for (const [monthly, annualMonthly] of pairs) {
      const pct = getSavingsPercent(monthly, annualMonthly);
      expect(pct).toBeGreaterThanOrEqual(15);
      expect(pct).toBeLessThanOrEqual(22);
    }
  });

  it('getSavingsPercent returns 0 for a free/zero-price plan instead of dividing by zero', () => {
    expect(getSavingsPercent(0, 0)).toBe(0);
  });

  it('getVatBreakdown at 18% correctly reconstructs the pre-VAT price already shown for ILS Basic/Pro', () => {
    expect(getVatBreakdown(49).beforeVat).toBeCloseTo(41.53, 1);
    expect(getVatBreakdown(39).beforeVat).toBeCloseTo(33.05, 1);
    expect(getVatBreakdown(99).beforeVat).toBeCloseTo(83.90, 1);
    expect(getVatBreakdown(79).beforeVat).toBeCloseTo(66.95, 1);
  });

  it('getVatBreakdown round-trips: beforeVat * (1 + rate) reconstructs the original total', () => {
    const { beforeVat, vatRate } = getVatBreakdown(99, VAT_RATE_IL);
    expect(Math.round(beforeVat * (1 + vatRate))).toBe(99);
  });

  it('getStripePriceId matches the existing pre-Stripe naming convention already used by both landing pages', () => {
    expect(getStripePriceId('basic', 'il', 'monthly')).toBe('price_basic_il_monthly');
    expect(getStripePriceId('pro', 'il', 'annual')).toBe('price_pro_il_yearly');
    expect(getStripePriceId('basic', 'global', 'monthly')).toBe('price_basic_global_monthly');
    expect(getStripePriceId('pro', 'global', 'annual')).toBe('price_pro_global_yearly');
  });
});

describe('pricingCatalog - getPlanPricingDisplay (single entry point for landing pages)', () => {
  it('returns the monthly rate and its x12 total for a monthly cycle', () => {
    const d = getPlanPricingDisplay('il', 'basic', 'monthly');
    expect(d.monthlyRate).toBe(49);
    expect(d.annualTotal).toBe(588);
    expect(d.currencySymbol).toBe('₪');
    expect(d.isAnnualCycle).toBe(false);
  });

  it('returns the annual-monthly-equivalent rate and the real annual total for an annual cycle', () => {
    const d = getPlanPricingDisplay('il', 'basic', 'annual');
    expect(d.monthlyRate).toBe(39);
    expect(d.annualTotal).toBe(468);
    expect(d.isAnnualCycle).toBe(true);
  });

  it('works for every supported International currency', () => {
    expect(getPlanPricingDisplay('usd', 'pro', 'annual')).toMatchObject({ monthlyRate: 23, annualTotal: 276, currencySymbol: '$' });
    expect(getPlanPricingDisplay('gbp', 'pro', 'monthly')).toMatchObject({ monthlyRate: 24, annualTotal: 288, currencySymbol: '£' });
    expect(getPlanPricingDisplay('eur', 'basic', 'annual')).toMatchObject({ monthlyRate: 11, annualTotal: 132, currencySymbol: '€' });
  });

  it('returns null for an unknown market or plan instead of throwing', () => {
    expect(getPlanPricingDisplay('mars', 'basic', 'monthly')).toBeNull();
    expect(getPlanPricingDisplay('il', 'enterprise', 'monthly')).toBeNull();
  });
});
