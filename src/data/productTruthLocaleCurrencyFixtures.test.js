// LOCALE / CURRENCY NEGATIVE FIXTURES (Codex finding 6, 2026-09-24).
//
// Extends the market-parity gate (productTruthComponentCoverage.test.js, Codex finding 2/8) with
// fixture-driven negative tests specifically for: Local vs International locale metadata, the
// RTL/LTR role that market classification implies, currency roles (quote/payment/display/
// conversion_only), unsupported currency values, a utility-conversion tool wrongly promoted to a
// quote/payment currency role, a Local-only prerequisite leaking into International without its
// scoping qualifier, and a genuinely-both capability wrongly narrowed to Local-only in the
// registry. Every fixture here mutates a COPY of real data (or uses a small synthetic shape) and
// asserts the relevant checker actually flags it - proving the gate has teeth, not just that
// today's real data happens to look clean (that clean-today assertion is also included, once,
// per check, using the real registry/evidence).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PRODUCT_TRUTH_REGISTRY, getCapabilityById } from './productTruthRegistry.js';
import { createFileMarketClassifier, deriveRtlLtrRole } from './productTruthMarketReachability.js';
import { scanCapabilityMarkers, groupMarkersById } from './productTruthCapabilityScanner.js';
import { REGION_RULES } from '../utils/regionConfig.js';
import {
  deriveMarketEvidenceFromScanner,
  checkMarketParity,
  checkCurrencyRoleIntegrity,
  isLocalPrerequisiteProperlyScoped,
  isInternationalPrerequisiteProperlyScoped,
  checkRegionConfigIntegrity,
  CONVERSION_ONLY_CAPABILITY_IDS,
} from './productTruthGateLib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const classifyFileMarket = createFileMarketClassifier(ROOT);
// Codex "scanner-derived market authority" (2026-09-2X): evidence comes from the scanner's own
// discovered marker locations, never from CAPABILITY_ANCHORS (see productTruthComponentCoverage.test.js
// for the full rationale - this file reuses the same derivation, not a second implementation).
const discoveredById = groupMarkersById(scanCapabilityMarkers(ROOT, ['src', 'supabase/functions']));
const evidence = deriveMarketEvidenceFromScanner(discoveredById, classifyFileMarket);

describe('LOCALE / CURRENCY NEGATIVE FIXTURES — locale metadata', () => {
  it('real data: every registry capability declares only real market strings (local/international)', () => {
    const validMarkets = new Set(['local', 'international']);
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      for (const m of c.markets) expect(validMarkets.has(m), `capability "${c.id}" declares invalid market "${m}"`).toBe(true);
    }
  });

  it('fixture: mutating a Local-only capability to claim International (locale metadata mismatch) is caught', () => {
    const syntheticEvidence = [{ id: 'fixture_local_only', localEvidence: true, internationalEvidence: false }];
    const mutatedMarkets = new Map([['fixture_local_only', ['local', 'international']]]);
    const failures = checkMarketParity(syntheticEvidence, mutatedMarkets);
    expect(failures.some((f) => f.id === 'fixture_local_only' && f.reason === 'extra_international')).toBe(true);
  });

  it('fixture: an International capability incorrectly narrowed to Local-only in the registry is caught against REAL evidence for a REAL capability id (quote_create genuinely has both-market evidence)', () => {
    const real = evidence.find((e) => e.id === 'quote_create');
    expect(real.localEvidence).toBe(true);
    expect(real.internationalEvidence).toBe(true);
    const mutatedMarkets = new Map([['quote_create', ['local']]]); // wrongly narrowed
    const failures = checkMarketParity([real], mutatedMarkets);
    expect(failures.some((f) => f.id === 'quote_create' && f.reason === 'missing_international')).toBe(true);
  });

  it('fixture: mutating an International-only capability to claim Local (mirror direction of the Local-only fixture above) is caught', () => {
    const syntheticEvidence = [{ id: 'fixture_international_only', localEvidence: false, internationalEvidence: true }];
    const mutatedMarkets = new Map([['fixture_international_only', ['local', 'international']]]);
    const failures = checkMarketParity(syntheticEvidence, mutatedMarkets);
    expect(failures.some((f) => f.id === 'fixture_international_only' && f.reason === 'extra_local')).toBe(true);
  });

  it('fixture: a both-market capability incorrectly narrowed to International-only in the registry is caught against REAL evidence (mirror direction of the Local-narrowing fixture above)', () => {
    const real = evidence.find((e) => e.id === 'quote_create');
    const mutatedMarkets = new Map([['quote_create', ['international']]]); // wrongly narrowed the OTHER way
    const failures = checkMarketParity([real], mutatedMarkets);
    expect(failures.some((f) => f.id === 'quote_create' && f.reason === 'missing_local')).toBe(true);
  });
});

describe('LOCALE / CURRENCY NEGATIVE FIXTURES — RTL/LTR role (derived from market, never re-derived independently)', () => {
  it('real data: PublicQuote.jsx is rtl, PublicQuoteEn.jsx is ltr, a genuinely shared file is both', () => {
    expect(deriveRtlLtrRole(classifyFileMarket('src/pages/PublicQuote.jsx'))).toBe('rtl');
    expect(deriveRtlLtrRole(classifyFileMarket('src/pages/PublicQuoteEn.jsx'))).toBe('ltr');
    expect(deriveRtlLtrRole(classifyFileMarket('src/pages/Dashboard.jsx'))).toBe('both');
  });

  it('fixture: a mutated/corrupted market value never silently maps to a plausible-looking role - unknown inputs are reported as unknown, not defaulted to rtl or ltr', () => {
    expect(deriveRtlLtrRole('not_a_real_market_value')).toBe('unknown');
    expect(deriveRtlLtrRole(undefined)).toBe('unknown');
  });

  it('fixture: swapping the local/international mapping would be caught by the real-data assertion above (regression guard - if someone "fixed" the mapping backwards, this test fails)', () => {
    // Direct, literal proof the mapping is the intended direction, not merely internally consistent.
    expect(deriveRtlLtrRole('local')).not.toBe('ltr');
    expect(deriveRtlLtrRole('international')).not.toBe('rtl');
  });

  it('fixture: HE/RTL metadata corrupted to EN/LTR on a real file is caught - the role is always freshly DERIVED from the real file every time, so a wrong assumption about which file is which never survives a fresh derivation', () => {
    // Simulate the corruption by asking about a real file under the WRONG assumed identity: someone
    // believed PublicQuoteEn.jsx (the real EN/LTR half) was the Local/RTL half.
    const wronglyAssumedLocalFile = 'src/pages/PublicQuoteEn.jsx';
    expect(deriveRtlLtrRole(classifyFileMarket(wronglyAssumedLocalFile))).not.toBe('rtl');
    expect(deriveRtlLtrRole(classifyFileMarket(wronglyAssumedLocalFile))).toBe('ltr');
  });

  it('fixture: the mirror corruption - EN/LTR metadata corrupted to HE/RTL, assuming a real Local/RTL file is really the International half - is caught the same way', () => {
    const wronglyAssumedInternationalFile = 'src/pages/PublicQuote.jsx';
    expect(deriveRtlLtrRole(classifyFileMarket(wronglyAssumedInternationalFile))).not.toBe('ltr');
    expect(deriveRtlLtrRole(classifyFileMarket(wronglyAssumedInternationalFile))).toBe('rtl');
  });
});

describe('LOCALE / CURRENCY NEGATIVE FIXTURES — currency roles', () => {
  it('real data: the 5 real conversion-only tools all declare role conversion_only, and every declared currency value is real', () => {
    for (const id of CONVERSION_ONLY_CAPABILITY_IDS) {
      expect(getCapabilityById(id).currencies.role).toBe('conversion_only');
    }
    const failures = checkCurrencyRoleIntegrity(PRODUCT_TRUTH_REGISTRY);
    expect(failures, `currency role integrity failures:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  it('fixture: an unsupported currency role string is caught', () => {
    const synthetic = [{ id: 'fixture_bad_role', currencies: { role: 'subscription', values: ['USD'] } }];
    const failures = checkCurrencyRoleIntegrity(synthetic);
    expect(failures.some((f) => f.id === 'fixture_bad_role' && f.reason === 'invalid_role')).toBe(true);
  });

  it('fixture: a utility-conversion tool (editor_calculator) wrongly promoted to a "quote" currency role is caught', () => {
    const real = getCapabilityById('editor_calculator');
    const mutated = { ...real, currencies: { ...real.currencies, role: 'quote' } };
    const failures = checkCurrencyRoleIntegrity([mutated]);
    expect(failures.some((f) => f.id === 'editor_calculator' && f.reason === 'conversion_tool_promoted')).toBe(true);
  });

  it('fixture: a utility-conversion tool wrongly promoted to "payment" role (subscription/checkout currency) is caught the same way', () => {
    const real = getCapabilityById('public_metals_calculator');
    const mutated = { ...real, currencies: { ...real.currencies, role: 'payment' } };
    const failures = checkCurrencyRoleIntegrity([mutated]);
    expect(failures.some((f) => f.id === 'public_metals_calculator' && f.reason === 'conversion_tool_promoted')).toBe(true);
  });

  it('fixture: an unsupported currency value (not a real ISO code either market actually uses, and not the one documented free-text exception) is caught', () => {
    const synthetic = [{ id: 'fixture_bad_currency', currencies: { role: 'conversion_only', values: ['USD', 'JPY_NOT_SUPPORTED_TODAY'] } }];
    const failures = checkCurrencyRoleIntegrity(synthetic);
    expect(failures.some((f) => f.id === 'fixture_bad_currency' && f.reason === 'unsupported_currency_value')).toBe(true);
  });

  it('fixture: the truthful negative (a capability with NO currencies field at all) is never flagged - absence is not a violation', () => {
    const failures = checkCurrencyRoleIntegrity([{ id: 'fixture_no_currency_field' }]);
    expect(failures).toEqual([]);
  });

  it('fixture: an unsupported currency VALUE declared under a "quote" role is caught the same way as any other role - no real capability declares role:\'quote\' today, proving the value check generalizes beyond the 5 real conversion_only tools', () => {
    const synthetic = [{ id: 'fixture_quote_role', currencies: { role: 'quote', values: ['ILS', 'JPY_NOT_SUPPORTED_TODAY'] } }];
    const failures = checkCurrencyRoleIntegrity(synthetic);
    expect(failures.some((f) => f.id === 'fixture_quote_role' && f.reason === 'unsupported_currency_value')).toBe(true);
  });

  it('fixture: a legitimate hypothetical subscription/payment-currency capability mutated to an invalid role string (subscription currency role mutation) is caught', () => {
    const valid = [{ id: 'fixture_subscription', currencies: { role: 'payment', values: ['USD'] } }];
    expect(checkCurrencyRoleIntegrity(valid)).toEqual([]);
    const mutated = [{ id: 'fixture_subscription', currencies: { role: 'subscription', values: ['USD'] } }]; // 'subscription' is not a real declared role value
    const failures = checkCurrencyRoleIntegrity(mutated);
    expect(failures.some((f) => f.id === 'fixture_subscription' && f.reason === 'invalid_role')).toBe(true);
  });

  it('fixture: a utility-conversion tool wrongly declared "display" role (a third mismatch direction beyond the quote/payment promotions already tested - quote/display/conversion role mismatch) is caught by the same conversion-only invariant', () => {
    const real = getCapabilityById('public_currency_converter');
    const mutated = { ...real, currencies: { ...real.currencies, role: 'display' } };
    const failures = checkCurrencyRoleIntegrity([mutated]);
    expect(failures.some((f) => f.id === 'public_currency_converter' && f.reason === 'conversion_tool_promoted')).toBe(true);
  });
});

describe('LOCALE / CURRENCY NEGATIVE FIXTURES — regionConfig.js integrity', () => {
  it('real data: regionConfig.js\'s REGION_RULES pass the structural Local/International locale-currency integrity check', () => {
    expect(checkRegionConfigIntegrity(REGION_RULES)).toEqual([]);
  });

  it('fixture: regionConfig locale mutation - International corrupted to use the ILS symbol (as if it were Local) is caught', () => {
    const mutated = { ...REGION_RULES, INTERNATIONAL: { ...REGION_RULES.INTERNATIONAL, defaultCurrencySymbol: '₪' } };
    expect(checkRegionConfigIntegrity(mutated)).toContain('international_currency_symbol_is_ils');
  });

  it('fixture: regionConfig market currency mutation - Local VAT rate corrupted to zero (as if it were International, VAT-exempt) is caught', () => {
    const mutated = { ...REGION_RULES, LOCAL: { ...REGION_RULES.LOCAL, vatRate: 0 } };
    expect(checkRegionConfigIntegrity(mutated)).toContain('local_vat_rate_not_positive');
  });

  it('fixture: regionConfig market currency mutation - International VAT rate corrupted to a nonzero value (as if it were Local) is caught', () => {
    const mutated = { ...REGION_RULES, INTERNATIONAL: { ...REGION_RULES.INTERNATIONAL, vatRate: 0.18 } };
    expect(checkRegionConfigIntegrity(mutated)).toContain('international_vat_rate_not_zero');
  });

  it('fixture: regionConfig locale mutation - Local corrupted to a non-ILS currency symbol is caught', () => {
    const mutated = { ...REGION_RULES, LOCAL: { ...REGION_RULES.LOCAL, currencySymbol: '$' } };
    expect(checkRegionConfigIntegrity(mutated)).toContain('local_currency_symbol_not_ils');
  });

  it('missing/malformed regionConfig input fails closed rather than throwing or silently passing', () => {
    expect(checkRegionConfigIntegrity(null)).toEqual(['missing_region_rules']);
    expect(checkRegionConfigIntegrity({})).toEqual(['missing_region_rules']);
  });
});

describe('LOCALE / CURRENCY NEGATIVE FIXTURES — Local-only prerequisite scoping (tax/business ID)', () => {
  it('real data: profile_prerequisites\' real EN+HE descriptions properly scope the tax/business ID requirement to the Local market', () => {
    const cap = getCapabilityById('profile_prerequisites');
    expect(isLocalPrerequisiteProperlyScoped(cap.enDescription, false)).toBe(true);
    expect(isLocalPrerequisiteProperlyScoped(cap.heDescription, true)).toBe(true);
  });

  it('fixture: a Local-only prerequisite description with the scoping qualifier stripped out (leaked into International as if it applied everywhere) is caught', () => {
    const leakedEn = 'A business phone and a tax/business ID are required before the first quote can be created.';
    expect(isLocalPrerequisiteProperlyScoped(leakedEn, false)).toBe(false);
    const leakedHe = 'טלפון עסקי וגם ח.פ./עוסק נדרשים לפני יצירת הצעה ראשונה.';
    expect(isLocalPrerequisiteProperlyScoped(leakedHe, true)).toBe(false);
  });

  it('fixture: a description that never mentions the tax/business ID topic at all is not a false positive', () => {
    expect(isLocalPrerequisiteProperlyScoped('A business phone is required before the first quote can be created.', false)).toBe(true);
  });

  it('real data: no current capability description mentions an International-only prerequisite fact at all (nothing to leak today) - the mirror checker is proven on a synthetic fixture below instead', () => {
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      expect(isInternationalPrerequisiteProperlyScoped(c.enDescription, false), `capability "${c.id}" (EN)`).toBe(true);
      expect(isInternationalPrerequisiteProperlyScoped(c.heDescription, true), `capability "${c.id}" (HE)`).toBe(true);
    }
  });

  it('fixture: an International-only prerequisite description with its scoping qualifier stripped out (leaked into Local as if it applied everywhere - the mirror-direction leak) is caught', () => {
    const leakedEn = 'An EIN is required before the first quote can be created.';
    expect(isInternationalPrerequisiteProperlyScoped(leakedEn, false)).toBe(false);
    const properlyScopedEn = 'In the International market, an EIN is required before the first quote can be created.';
    expect(isInternationalPrerequisiteProperlyScoped(properlyScopedEn, false)).toBe(true);
    const leakedHe = 'EIN נדרש לפני יצירת הצעה ראשונה.';
    expect(isInternationalPrerequisiteProperlyScoped(leakedHe, true)).toBe(false);
    const properlyScopedHe = 'בשוק הבינלאומי, EIN נדרש לפני יצירת הצעה ראשונה.';
    expect(isInternationalPrerequisiteProperlyScoped(properlyScopedHe, true)).toBe(true);
  });

  it('fixture: a description that never mentions the International-only topic at all is not a false positive (mirror of the Local-only false-positive guard above)', () => {
    expect(isInternationalPrerequisiteProperlyScoped('A business phone is required before the first quote can be created.', false)).toBe(true);
  });
});
