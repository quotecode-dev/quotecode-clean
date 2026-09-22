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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PRODUCT_TRUTH_REGISTRY, getCapabilityById } from './productTruthRegistry.js';
import { CAPABILITY_ANCHORS } from './productTruthComponentAnchors.js';
import { createFileMarketClassifier, deriveRtlLtrRole } from './productTruthMarketReachability.js';
import {
  deriveMarketEvidence,
  checkMarketParity,
  checkCurrencyRoleIntegrity,
  isLocalPrerequisiteProperlyScoped,
  CONVERSION_ONLY_CAPABILITY_IDS,
} from './productTruthGateLib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const fileExists = (rel) => existsSync(join(ROOT, rel));
const readFile = (rel) => readFileSync(join(ROOT, rel), 'utf-8');
const classifyFileMarket = createFileMarketClassifier(ROOT);
const evidence = Object.entries(CAPABILITY_ANCHORS).map(([id, anchors]) => ({
  id,
  ...deriveMarketEvidence(anchors, fileExists, readFile, classifyFileMarket),
}));

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
});
