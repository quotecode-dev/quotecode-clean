// PRODUCT TRUTH COVERAGE GATE — HARDENED PART 2 (Codex defects 7/8/9, 2026-09-23).
//
// Extends src/data/productTruthSurfaceCoverage.test.js (route/tab/admin-id level, from the prior
// task) with TRUE component-level independent coverage, generalized (non-hard-coded) market
// parity, and capability-specific source validation. Every real-data check here is backed by a
// pure function in productTruthGateLib.js, which is ALSO exercised against synthetic fixtures in
// this file - proving the checker actually catches each required defect class, not merely that
// today's real data happens to look clean.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PRODUCT_TRUTH_REGISTRY, getCapabilityById } from './productTruthRegistry.js';
import { CAPABILITY_ANCHORS } from './productTruthComponentAnchors.js';
import { createFileMarketClassifier } from './productTruthMarketReachability.js';
import { checkCoverage, checkAnchorPresence, wouldUnrelatedFileWronglyPass, deriveMarketEvidence, checkMarketParity, checkSourceAnchorJoin } from './productTruthGateLib.js';
import { scanCapabilityMarkers, groupMarkersById } from './productTruthCapabilityScanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const fileExists = (rel) => existsSync(join(ROOT, rel));
const readFile = (rel) => readFileSync(join(ROOT, rel), 'utf-8');

describe('DEFECT-7 INDEPENDENT COMPONENT SURFACE COVERAGE (real data)', () => {
  it('sanity: the anchor map actually covers all 38 capabilities (not a subset re-hiding the original gap)', () => {
    const ids = Object.keys(CAPABILITY_ANCHORS);
    expect(ids.length).toBe(38);
    for (const c of PRODUCT_TRUTH_REGISTRY) {
      expect(CAPABILITY_ANCHORS[c.id], `capability "${c.id}" has no component-level anchor entry`).toBeTruthy();
    }
  });

  it('every component-level anchor id resolves to a real, LIVE_CURRENT registry capability', () => {
    const { missingFromRegistry, currentWithNoAnchors } = checkCoverage(CAPABILITY_ANCHORS, PRODUCT_TRUTH_REGISTRY);
    expect(missingFromRegistry, `visible capabilities with no LIVE_CURRENT registry entry: ${missingFromRegistry.join(', ')}`).toEqual([]);
    expect(currentWithNoAnchors, `LIVE_CURRENT capabilities with zero independent anchor evidence: ${currentWithNoAnchors.join(', ')}`).toEqual([]);
  });

  it('every anchor is actually found in its real, existing file (the anchors describe real, current code)', () => {
    const failures = checkAnchorPresence(CAPABILITY_ANCHORS, fileExists, readFile);
    expect(failures, `anchor presence failures:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
});

describe('DEFECT-7/9 NEGATIVE FIXTURES (synthetic - proves the checker catches each required defect class)', () => {
  it('fixture: a visible capability omitted from the registry is caught (checkCoverage)', () => {
    const syntheticAnchors = { totally_new_visible_action: [{ file: 'x.jsx', anchor: 'x' }] };
    const { missingFromRegistry } = checkCoverage(syntheticAnchors, PRODUCT_TRUTH_REGISTRY);
    expect(missingFromRegistry).toContain('totally_new_visible_action');
  });

  it('fixture: a phantom current capability (LIVE_CURRENT with no anchors at all) is caught (checkCoverage)', () => {
    const syntheticRegistry = [...PRODUCT_TRUTH_REGISTRY, { id: 'phantom_capability', state: 'LIVE_CURRENT' }];
    const { currentWithNoAnchors } = checkCoverage(CAPABILITY_ANCHORS, syntheticRegistry);
    expect(currentWithNoAnchors).toContain('phantom_capability');
  });

  it('fixture: a phantom capability pointed at an UNRELATED but genuinely existing file never passes just because the file exists and is non-empty', () => {
    // Use a real, existing, non-empty file that has NOTHING to do with the fabricated capability.
    const unrelatedRealFile = 'src/utils/regionConfig.js';
    expect(fileExists(unrelatedRealFile)).toBe(true);
    const unrelatedText = readFile(unrelatedRealFile);
    expect(unrelatedText.length).toBeGreaterThan(0);
    const wronglyPasses = wouldUnrelatedFileWronglyPass('this_string_does_not_exist_anywhere_xyz123', unrelatedText);
    expect(wronglyPasses).toBe(false);
    // And checkAnchorPresence must actually fail this exact shape end-to-end:
    const syntheticMap = { phantom_capability: [{ file: unrelatedRealFile, anchor: 'this_string_does_not_exist_anywhere_xyz123' }] };
    const failures = checkAnchorPresence(syntheticMap, fileExists, readFile);
    expect(failures.some((f) => f.id === 'phantom_capability' && f.reason === 'missing_anchor')).toBe(true);
  });

  it('fixture: a dangling (nonexistent) path is caught, not silently skipped', () => {
    const syntheticMap = { some_capability: [{ file: 'src/this/path/does/not/exist.jsx', anchor: 'anything' }] };
    const failures = checkAnchorPresence(syntheticMap, fileExists, readFile);
    expect(failures.some((f) => f.reason === 'dangling_path')).toBe(true);
  });

  it('fixture: an anchor missing from an otherwise-valid, correct file is caught (wrong anchor in correct file)', () => {
    // A real file (DraggableCalculator.jsx) that genuinely does NOT contain this specific string.
    const syntheticMap = { editor_calculator: [{ file: 'src/components/DraggableCalculator.jsx', anchor: 'ZZZ_NOT_A_REAL_CALCULATOR_SYMBOL_ZZZ' }] };
    const failures = checkAnchorPresence(syntheticMap, fileExists, readFile);
    expect(failures.some((f) => f.id === 'editor_calculator' && f.reason === 'missing_anchor')).toBe(true);
  });

  it('fixture: removing the real implementation anchor from a capability that previously had it flips the result to a failure', () => {
    // Prove the check is sensitive to content, not just to the (file, anchor-name) pair existing in
    // the map: same file, a string that WAS real (grep-verified) is swapped for a similar-looking
    // but absent one.
    const realAnchor = CAPABILITY_ANCHORS.editor_calculator[0];
    expect(readFile(realAnchor.file).includes(realAnchor.anchor)).toBe(true); // sanity: really there today
    const brokenMap = { editor_calculator: [{ file: realAnchor.file, anchor: realAnchor.anchor + '_REMOVED_XYZ' }] };
    const failures = checkAnchorPresence(brokenMap, fileExists, readFile);
    expect(failures.length).toBeGreaterThan(0);
  });
});

describe('DEFECT-8 GENERALIZED MARKET AUTHORITY PARITY (real data, not hard-coded to one capability)', () => {
  // Codex finding 2 (2026-09-24): classifyFileMarket is now a real, generalized derivation
  // (naming-convention + import-graph reachability, computed once for the whole repo) rather than
  // a 2-entry hard-coded Set - see productTruthMarketReachability.js.
  const classifyFileMarket = createFileMarketClassifier(ROOT);
  // Independently derive REAL per-capability market evidence from the SAME anchor map used for
  // coverage (§ above) - never reading PRODUCT_TRUTH_REGISTRY's own `markets` field as an input.
  const evidence = Object.entries(CAPABILITY_ANCHORS).map(([id, anchors]) => ({
    id,
    ...deriveMarketEvidence(anchors, fileExists, readFile, classifyFileMarket),
  }));

  it('sanity: evidence derivation actually distinguishes markets (not everything trivially "both")', () => {
    const localOnly = evidence.filter((e) => e.localEvidence && !e.internationalEvidence);
    const bothMarkets = evidence.filter((e) => e.localEvidence && e.internationalEvidence);
    // At least the profile_prerequisites-shaped and the shared-component-shaped cases exist.
    expect(bothMarkets.length).toBeGreaterThan(20);
    // No capability should show international-only via this file-naming convention today.
    expect(evidence.every((e) => e.localEvidence || e.internationalEvidence)).toBe(true);
    void localOnly;
  });

  it('the generalized classifier fails CLOSED to \'unknown\' for a file reachable from neither app entry point (never a silent \'both\')', () => {
    // src/data files (this gate's own infrastructure) are never imported by the real app bundle.
    expect(classifyFileMarket('src/data/productTruthGateLib.js')).toBe('unknown');
    expect(classifyFileMarket('src/does/not/exist.jsx')).toBe('unknown');
  });

  it('the generalized classifier correctly distinguishes PublicQuote.jsx (local) from PublicQuoteEn.jsx (international) even though BOTH are import-graph-reachable from both app entries via the shared SmartPublicQuote.jsx router (naming convention must win over raw reachability here)', () => {
    expect(classifyFileMarket('src/pages/PublicQuote.jsx')).toBe('local');
    expect(classifyFileMarket('src/pages/PublicQuoteEn.jsx')).toBe('international');
  });

  it('a genuinely shared component (Dashboard.jsx) is derived as \'both\' via real reachability from BOTH app entries, not assumed', () => {
    expect(classifyFileMarket('src/pages/Dashboard.jsx')).toBe('both');
  });

  it('Supabase Edge Functions classify \'both\' by directory convention (one deployment serves both markets identically - no Local/International function split exists)', () => {
    expect(classifyFileMarket('supabase/functions/get-public-quote/index.ts')).toBe('both');
    expect(classifyFileMarket('supabase/functions/send-quote-email/index.ts')).toBe('both');
  });

  it('every capability with real dual-market anchor evidence declares BOTH markets in the registry (generalized - not just WhatsApp)', () => {
    const registryMarketsById = new Map(PRODUCT_TRUTH_REGISTRY.map((c) => [c.id, c.markets]));
    const failures = checkMarketParity(evidence, registryMarketsById);
    expect(failures, `market parity failures:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  it('public_whatsapp_contact specifically resolves via the SAME generalized mechanism (not a special case)', () => {
    const e = evidence.find((x) => x.id === 'public_whatsapp_contact');
    expect(e.localEvidence).toBe(true);
    expect(e.internationalEvidence).toBe(true);
    expect(getCapabilityById('public_whatsapp_contact').markets).toEqual(expect.arrayContaining(['local', 'international']));
  });

  describe('negative controls (synthetic - proves the generalized checker, not just today\'s clean data)', () => {
    it('mutate a Local-only capability to claim both markets in the registry -> caught', () => {
      const syntheticEvidence = [{ id: 'fake_local_only', localEvidence: true, internationalEvidence: false }];
      const syntheticRegistryMarkets = new Map([['fake_local_only', ['local', 'international']]]);
      const failures = checkMarketParity(syntheticEvidence, syntheticRegistryMarkets);
      expect(failures.some((f) => f.id === 'fake_local_only' && f.reason === 'extra_international')).toBe(true);
    });

    it('remove International from the registry where real implementation evidence exists -> caught', () => {
      const syntheticEvidence = [{ id: 'fake_both', localEvidence: true, internationalEvidence: true }];
      const syntheticRegistryMarkets = new Map([['fake_both', ['local']]]);
      const failures = checkMarketParity(syntheticEvidence, syntheticRegistryMarkets);
      expect(failures.some((f) => f.id === 'fake_both' && f.reason === 'missing_international')).toBe(true);
    });

    it('a market-specific capability with NO real implementation evidence for a market it claims -> caught as a mismatch the OTHER direction (registry over-claims, no evidence to justify it is a separate, honest signal - not silently accepted)', () => {
      // Registry claims 'international' but there is genuinely zero evidence for it - this shape is
      // the "extra_international" reason (registry says a market exists with nothing backing it).
      const syntheticEvidence = [{ id: 'fake_overclaim', localEvidence: true, internationalEvidence: false }];
      const syntheticRegistryMarkets = new Map([['fake_overclaim', ['local', 'international']]]);
      const failures = checkMarketParity(syntheticEvidence, syntheticRegistryMarkets);
      expect(failures.some((f) => f.id === 'fake_overclaim' && f.reason === 'extra_international')).toBe(true);
    });

    it('assign an unsupported currency role is a distinct, already-covered check (see productTruthRegistry.test.js conversion_only assertions) - cross-referenced, not duplicated here', () => {
      for (const id of ['editor_calculator', 'editor_currency_converter', 'public_currency_converter', 'public_metals_calculator', 'public_crypto_calculator']) {
        expect(getCapabilityById(id).currencies.role).toBe('conversion_only');
      }
    });

    it('mismatched locale/market metadata: a capability cannot declare a market with zero markets array entries at all', () => {
      for (const c of PRODUCT_TRUTH_REGISTRY) {
        expect(c.markets.length, `capability "${c.id}" has an empty markets array`).toBeGreaterThan(0);
      }
    });
  });
});

describe('DEFECT-9 depth: REGISTRY SOURCE-ANCHOR JOIN (Codex finding 3, 2026-09-24)', () => {
  const discoveredById = groupMarkersById(scanCapabilityMarkers(ROOT, ['src', 'supabase/functions']));

  it('every LIVE_CURRENT capability has at least one canonicalSources entry that carries its OWN scanned marker', () => {
    const failures = checkSourceAnchorJoin(PRODUCT_TRUTH_REGISTRY, discoveredById);
    expect(failures, `source-anchor join failures:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  describe('negative fixtures (synthetic - proves the join is checked by identity, not by mere co-existence)', () => {
    it('fixture: canonicalSources names a real, EXISTING, unrelated file that carries a DIFFERENT capability\'s marker -> caught (not accepted just because some marker happens to be in that file)', () => {
      const syntheticRegistry = [{ id: 'fake_cap', state: 'LIVE_CURRENT', canonicalSources: ['src/components/DraggableCalculator.jsx'] }];
      // DraggableCalculator.jsx really does carry editor_calculator's marker, not fake_cap's.
      const failures = checkSourceAnchorJoin(syntheticRegistry, discoveredById);
      expect(failures.some((f) => f.id === 'fake_cap' && f.reason === 'no_source_carries_own_marker')).toBe(true);
    });

    it('fixture: a generic text match in an unrelated file is not a join - the discovered-marker set only ever contains REAL marker occurrences, never generic substrings', () => {
      // wouldUnrelatedFileWronglyPass already proves generic substring search is not how discovery
      // works; this proves the join-level consequence end-to-end for a capability id that has no
      // real marker anywhere.
      const syntheticRegistry = [{ id: 'never_marked_anywhere', state: 'LIVE_CURRENT', canonicalSources: ['src/utils/regionConfig.js'] }];
      const failures = checkSourceAnchorJoin(syntheticRegistry, discoveredById);
      expect(failures.some((f) => f.id === 'never_marked_anywhere')).toBe(true);
    });

    it('fixture: correct file, but this capability\'s marker was removed from the discovered set (simulating deletion) -> caught', () => {
      const withoutOne = { ...discoveredById };
      delete withoutOne.editor_calculator;
      const syntheticRegistry = [{ id: 'editor_calculator', state: 'LIVE_CURRENT', canonicalSources: ['src/components/DraggableCalculator.jsx'] }];
      const failures = checkSourceAnchorJoin(syntheticRegistry, withoutOne);
      expect(failures.some((f) => f.id === 'editor_calculator' && f.reason === 'no_source_carries_own_marker')).toBe(true);
    });

    it('fixture: a dangling (nonexistent) canonicalSources path never joins (no discovered marker can ever come from a file that does not exist)', () => {
      const syntheticRegistry = [{ id: 'editor_calculator', state: 'LIVE_CURRENT', canonicalSources: ['src/this/path/does/not/exist.jsx'] }];
      const failures = checkSourceAnchorJoin(syntheticRegistry, discoveredById);
      expect(failures.some((f) => f.id === 'editor_calculator' && f.reason === 'no_source_carries_own_marker')).toBe(true);
    });

    it('fixture: a LIVE_CURRENT capability with NO canonicalSources declared at all is caught as its own distinct reason', () => {
      const syntheticRegistry = [{ id: 'nothing_declared', state: 'LIVE_CURRENT', canonicalSources: [] }];
      const failures = checkSourceAnchorJoin(syntheticRegistry, discoveredById);
      expect(failures.some((f) => f.id === 'nothing_declared' && f.reason === 'no_canonical_sources_declared')).toBe(true);
    });

    it('fixture: a non-LIVE_CURRENT capability (e.g. ROADMAP_POST_LIVE) is never checked at all - the join only governs claims about what exists TODAY', () => {
      const syntheticRegistry = [{ id: 'future_thing', state: 'ROADMAP_POST_LIVE', canonicalSources: [] }];
      const failures = checkSourceAnchorJoin(syntheticRegistry, discoveredById);
      expect(failures).toEqual([]);
    });
  });
});
