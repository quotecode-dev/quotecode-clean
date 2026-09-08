import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRICING_CATALOG, getSavingsPercent } from '../utils/pricingCatalog';

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
  it('confirms the real savings are NOT uniformly 20% across markets/plans (the fact this task corrected for)', () => {
    const percents = new Set();
    for (const plan of ['basic', 'pro']) {
      percents.add(getSavingsPercent(PRICING_CATALOG.il[plan].monthly, PRICING_CATALOG.il[plan].annualMonthly));
      for (const market of ['usd', 'gbp', 'eur']) {
        percents.add(getSavingsPercent(PRICING_CATALOG.global[market][plan].monthly, PRICING_CATALOG.global[market][plan].annualMonthly));
      }
    }
    // If every value were exactly 20, a single shared "Save 20%!" badge
    // would actually be accurate - it is not, which is the whole reason
    // this task replaced it with non-numeric wording + per-card values.
    expect([...percents].some((p) => p !== 20)).toBe(true);
  });

  it('the shared annual-toggle badge no longer claims a fixed percentage in either landing page', () => {
    const he = readSource('LandingLocal.jsx');
    const en = readSource('LandingGlobal.jsx');
    expect(he).not.toMatch(/חסוך\s*20%/);
    expect(en).not.toMatch(/Save\s*20%/i);
  });

  it('each landing page renders a per-plan savings badge sourced from the canonical savingsPercent, not a literal', () => {
    const he = readSource('LandingLocal.jsx');
    const en = readSource('LandingGlobal.jsx');
    expect(he).toMatch(/basicPricing\.savingsPercent/);
    expect(he).toMatch(/proPricing\.savingsPercent/);
    expect(en).toMatch(/basicPricing\.savingsPercent/);
    expect(en).toMatch(/proPricing\.savingsPercent/);
  });
});
