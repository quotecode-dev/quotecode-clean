import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
function readSource(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf-8');
}

// Proportional Workspace Correction task, §B: the annual-billing toggle
// previously showed a single hardcoded "Save 20%!" badge covering both
// Basic and Pro across every currency, but the real computed savings range
// ~17-21% depending on plan/currency (whole-unit rounding at the source
// prices) - not uniformly 20% anywhere. This is a structural regression
// guard: it fails loudly if a hardcoded uniform percentage claim is ever
// reintroduced into the shared toggle badge, and confirms the per-plan-card
// badges are wired to the canonical computed value instead of a literal.

describe('annual savings claims stay truthful (no hardcoded uniform percentage)', () => {
  // OD-03..OD-08 / OPEN-10 (subscriptions cross-cut): the legacy static Basic/Pro catalog with annual prices
  // (src/utils/pricingCatalog.js) is retired; the only price source is src/domain/subscriptions/priceCatalog.js, which has
  // monthly rows only. Annual billing is not decided, so no surface may show an annual price or saving.
  it('the legacy annual Basic/Pro catalog is retired and the price catalog has no annual row', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(__dirname, '../utils/pricingCatalog.js'))).toBe(false);
    const { PRICE_VERSIONS } = await import('../domain/subscriptions/priceCatalog');
    expect(JSON.stringify(PRICE_VERSIONS)).not.toMatch(/annual|year/i);
  });

  it('the shared annual-toggle badge no longer claims a fixed percentage in either landing page', () => {
    const he = readSource('LandingLocal.jsx');
    const en = readSource('LandingGlobal.jsx');
    expect(he).not.toMatch(/חסוך\s*20%/);
    expect(en).not.toMatch(/Save\s*20%/i);
  });

  // IRON-LANDING-001 as amended by the Owner 2026-10-11 (§249): the annual package price is Owner-approved and the landing shows
  // it as a PRICE taken from packageCatalog.js (monthly x 12 - 15%, proven below). Task 26 (Owner 2026-10-11): the ONE savings statement
  // is the annual saving vs 12 monthly payments, computed from the same rows (no percentage, no literal amount, no promotion wording). The in-app pricing modal is a separate, not-yet-rescoped surface: still no annual there.
  it('the §249 annual package price is the monthly x 12 - 15% and is the only annual figure the catalog holds', async () => {
    const { PACKAGE_PRICES, packagePrice, annualFromMonthly, ANNUAL_DISCOUNT_PERCENT } = await import('../domain/subscriptions/packageCatalog');
    expect(ANNUAL_DISCOUNT_PERCENT).toBe(15);
    expect(PACKAGE_PRICES.map((p) => [p.market, p.currency, p.billingPeriod, p.amountMinor])).toEqual([
      ['IL', 'ILS', 'month', 3000], ['IL', 'ILS', 'year', 30600], ['INTERNATIONAL', 'USD', 'month', 1800], ['INTERNATIONAL', 'USD', 'year', 18400],
    ]);
    // Israel follows the §249 formula; the International annual price is the Owner-set $184.00 (IRON-LANDING-001 amended 2026-10-11)
    expect(packagePrice('IL', 'year').amountMinor).toBe(annualFromMonthly(packagePrice('IL', 'month').amountMinor));
    expect(packagePrice('INTERNATIONAL', 'year').amountMinor).toBe(18400);
    // Task 26 (Owner 2026-10-11): the annual saving vs 12 monthly payments - ₪54.00 / $32.00 - comes from the same rows
    const { annualSavingMinor } = await import('../domain/subscriptions/packageCatalog');
    expect([annualSavingMinor('IL'), annualSavingMinor('INTERNATIONAL')]).toEqual([5400, 3200]);
    const { ilsAnnualSaving, usdAnnualSaving } = await import('../components/landing/landingPackageFacts');
    expect([ilsAnnualSaving(), usdAnnualSaving()]).toEqual(['₪54.00', '$32.00']);
    const { annualSavingPercent } = await import('../domain/subscriptions/packageCatalog');
    expect(annualSavingPercent('IL')).toBe(15); // exactly 15%
    expect(annualSavingPercent('INTERNATIONAL')).toBeCloseTo(14.8148, 3); // $32.00 / $216.00
    const { ilsAnnualSavingRate, usdAnnualSavingRate } = await import('../components/landing/landingPackageFacts');
    expect([ilsAnnualSavingRate(), usdAnnualSavingRate()]).toEqual([{ text: '15%', exact: true }, { text: '15%', exact: false }]);
    expect(() => packagePrice('IL', 'week')).toThrow();
  });

  it('the only savings statement is the computed annual saving; no percentage / literal / hardcoded saving; the annual price comes only from the package catalog', () => {
    const code = (f) => readSource(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const he = code('LandingLocal.jsx');
    const en = code('LandingGlobal.jsx');
    expect(he).not.toMatch(/savingsPercent|annualTotal|חיסכון \$\{|חיסכון \d|חסכו|חוסכים \d|\d+\s*%\s*הנחה|הנחה של \d/);
    expect(en).not.toMatch(/savingsPercent|annualTotal|Save \$\{|\bsave \d|Save with annual|\d+\s*% (off|discount)/i);
    expect(`${he}${en}`).not.toMatch(/\b15\s*%/); // the rate is computed (annualSavingPercent), never a literal
    expect(he).toContain('ilsAnnualSavingRate()');
    expect(en).toContain('usdAnnualSavingRate()');
    expect(en).toContain("savingRate.exact ? '' : 'approximately '");
    expect(en).not.toMatch(/Annual Billing/); // the retired annual-toggle title (plain "annual billing" in a sentence is the §249 choice)
    expect(he).toContain("ilsPackageAmount('year')");
    expect(en).toContain("usdPackageAmount('year')");
    expect(he.match(/חיסכון/g) || []).toHaveLength(2); // the annual note + the base capability text "וחיסכון בזמן" (time, not money)
    expect(he).toContain('{ilsAnnualSaving()}');
    expect(en).toContain('{usdAnnualSaving()}');
    expect(`${he}${en}`).not.toMatch(/54\.00|32\.40|32\.00|5400|3240|3200|מבצע|לזמן מוגבל|limited time|promo/i);
    expect(`${he}${en}`).not.toMatch(/30600|18360|18400|306\.00|183\.60|184\.00/); // no literal annual amount in the page copy
    // Task 27: the in-app plans view shows the same package (monthly / annual) from the same source - no literal amount, no hardcoded rate
    const modal = code('../components/PricingModal.jsx') + code('../domain/subscriptions/pricingModalModel.js') + code('../components/PackageOfferCards.jsx');
    expect(modal).not.toMatch(/savingsPercent|annualTotal|billingCycle|\b15\s*%|54\.00|32\.00|306\.00|184\.00/i);
    expect(code('../domain/subscriptions/pricingModalModel.js')).toMatch(/ilsAnnualSaving\(\)|usdAnnualSaving\(\)/);
  });
});
