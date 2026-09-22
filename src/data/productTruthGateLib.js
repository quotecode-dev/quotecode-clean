// PRODUCT TRUTH GATE LIBRARY (Codex defects 7/8/9, 2026-09-23) — pure, dependency-free checking
// functions used BOTH against the real repository (in productTruthComponentCoverage.test.js) and
// against synthetic fixtures (the required negative-control tests in the same file). Keeping the
// logic here, separate from the test assertions, is what lets a fixture test prove the checker
// actually catches a defect class, not just that today's real data happens to look clean.

/**
 * Defect 7 (coverage): every capability with independent anchor evidence must be a real,
 * LIVE_CURRENT registry entry; every LIVE_CURRENT registry entry must have at least one anchor
 * declared (a "current" capability with zero independent evidence is a phantom-implementation risk).
 * @param {Record<string, {file:string, anchor:string}[]>} anchorMap
 * @param {{id:string, state:string}[]} registryEntries
 * @returns {{missingFromRegistry: string[], currentWithNoAnchors: string[]}}
 */
export function checkCoverage(anchorMap, registryEntries) {
  const registryById = new Map(registryEntries.map((c) => [c.id, c]));
  const missingFromRegistry = [];
  for (const id of Object.keys(anchorMap)) {
    const entry = registryById.get(id);
    if (!entry || entry.state !== 'LIVE_CURRENT') missingFromRegistry.push(id);
  }
  const currentWithNoAnchors = [];
  for (const c of registryEntries) {
    if (c.state === 'LIVE_CURRENT' && !(anchorMap[c.id] && anchorMap[c.id].length > 0)) {
      currentWithNoAnchors.push(c.id);
    }
  }
  return { missingFromRegistry, currentWithNoAnchors };
}

/**
 * Defect 9 (capability-specific source validation): for every capability with declared anchors,
 * at least one of its anchors must (a) name a file that exists per `fileExists`, and (b) that
 * file's real content (from `readFile`) must contain the anchor substring. Catches: dangling path,
 * an anchor pointing at an unrelated (but existing) file that lacks it, and a missing anchor in an
 * otherwise-valid file.
 * @param {Record<string, {file:string, anchor:string}[]>} anchorMap
 * @param {(file:string) => boolean} fileExists
 * @param {(file:string) => string} readFile
 * @returns {{id:string, reason:'dangling_path'|'missing_anchor', file:string, anchor:string}[]}
 */
export function checkAnchorPresence(anchorMap, fileExists, readFile) {
  const failures = [];
  for (const [id, anchors] of Object.entries(anchorMap)) {
    let satisfied = false;
    const attempts = [];
    for (const { file, anchor } of anchors) {
      if (!fileExists(file)) {
        attempts.push({ id, reason: 'dangling_path', file, anchor });
        continue;
      }
      const text = readFile(file);
      if (typeof text === 'string' && text.includes(anchor)) {
        satisfied = true;
        break;
      }
      attempts.push({ id, reason: 'missing_anchor', file, anchor });
    }
    if (!satisfied) failures.push(...attempts);
  }
  return failures;
}

/**
 * Defect 9 (unrelated-file proof, capability-specificity): a capability's canonicalSources entry
 * naming a file that DOES exist and DOES contain content is not proof by itself - the file must
 * contain THIS capability's own anchor, not merely be a real, non-empty file. This helper isolates
 * exactly that "unrelated existing file" case for the required negative fixture.
 * @param {string} anchor
 * @param {string} unrelatedFileText - real content of a genuinely different file
 * @returns {boolean} true if the unrelated file would WRONGLY satisfy the anchor (should be false)
 */
export function wouldUnrelatedFileWronglyPass(anchor, unrelatedFileText) {
  return typeof unrelatedFileText === 'string' && unrelatedFileText.includes(anchor);
}

/**
 * Defect 8 (generalized market authority parity), evidence derivation: for a capability's anchor
 * list, determine which market(s) have REAL, FOUND evidence - not merely declared. An anchor only
 * counts as evidence for a market if the file actually contains it (real fs read) AND the file's
 * naming-convention market classification includes that market.
 * @param {{file:string, anchor:string}[]} anchors
 * @param {(file:string) => boolean} fileExists
 * @param {(file:string) => string} readFile
 * @param {(file:string) => 'local'|'international'|'both'} classifyFileMarket
 * @returns {{localEvidence:boolean, internationalEvidence:boolean}}
 */
export function deriveMarketEvidence(anchors, fileExists, readFile, classifyFileMarket) {
  let localEvidence = false;
  let internationalEvidence = false;
  for (const { file, anchor } of anchors) {
    if (!fileExists(file)) continue;
    const text = readFile(file);
    if (!(typeof text === 'string' && text.includes(anchor))) continue;
    const market = classifyFileMarket(file);
    if (market === 'local' || market === 'both') localEvidence = true;
    if (market === 'international' || market === 'both') internationalEvidence = true;
  }
  return { localEvidence, internationalEvidence };
}

/**
 * Defect 8 (generalized market authority parity): derive a capability's INTENDED market
 * applicability from independent, source-derived evidence (which real per-market files/routes
 * implement it), then compare against the registry's own declared `markets`. Never hard-codes a
 * single capability (e.g. WhatsApp) - operates generically over whatever evidence is supplied.
 * @param {{id:string, localEvidence:boolean, internationalEvidence:boolean}[]} evidence
 * @param {Map<string, readonly string[]>} registryMarketsById
 * @returns {{id:string, reason:'missing_local'|'missing_international'|'extra_local'|'extra_international'}[]}
 */
export function checkMarketParity(evidence, registryMarketsById) {
  const failures = [];
  for (const e of evidence) {
    const markets = registryMarketsById.get(e.id) || [];
    const hasLocal = markets.includes('local');
    const hasIntl = markets.includes('international');
    if (e.localEvidence && !hasLocal) failures.push({ id: e.id, reason: 'missing_local' });
    if (e.internationalEvidence && !hasIntl) failures.push({ id: e.id, reason: 'missing_international' });
    if (!e.localEvidence && hasLocal && e.internationalEvidence !== undefined) failures.push({ id: e.id, reason: 'extra_local' });
    if (!e.internationalEvidence && hasIntl && e.localEvidence !== undefined) failures.push({ id: e.id, reason: 'extra_international' });
  }
  return failures;
}

// Codex finding 6 (2026-09-24): the fixed, real, currently-declared set of "utility conversion
// tool" capabilities (calculator/currency/metals/crypto converters) whose currency role must never
// be promoted to 'quote' or 'payment' - a conversion tool's numbers are never a quote amount or a
// subscription charge. This list is a TEST-LEVEL fact about today's real registry (cross-checked in
// productTruthRegistry.test.js against the same 5 ids by their real `conversion_only` role), not a
// second capability inventory - it exists only to give the negative-fixture mutation a fixed target.
export const CONVERSION_ONLY_CAPABILITY_IDS = Object.freeze([
  'editor_calculator', 'editor_currency_converter', 'public_currency_converter', 'public_metals_calculator', 'public_crypto_calculator',
]);

const VALID_CURRENCY_ROLES = new Set(['quote', 'payment', 'display', 'conversion_only']);
// Real, supported currency codes across both markets (Local: ILS; International: USD/EUR/GBP - the
// confirmed synthetic INTL_EUR/INTL_GBP personas), plus the one documented free-text descriptor
// already used for metals' live-fetched-but-unenumerated currency list (prose, not a currency code
// - allow-listed by exact string so a DIFFERENT stray value is still caught).
const SUPPORTED_CURRENCY_CODES = new Set(['ILS', 'USD', 'EUR', 'GBP']);
const ALLOWED_FREE_TEXT_CURRENCY_VALUES = new Set(['and other live-fetched currencies']);

/**
 * Codex finding 6: validates a capability's `currencies` field (when declared) is internally
 * consistent, and that the fixed conversion-only tools never get promoted to a quote/payment role.
 * @param {{id:string, currencies?: {role:string, values:readonly string[]} | null}[]} registryEntries
 * @returns {{id:string, reason:'invalid_role'|'conversion_tool_promoted'|'unsupported_currency_value'}[]}
 */
export function checkCurrencyRoleIntegrity(registryEntries) {
  const failures = [];
  const conversionOnlySet = new Set(CONVERSION_ONLY_CAPABILITY_IDS);
  for (const c of registryEntries) {
    if (!c.currencies) continue;
    const { role, values } = c.currencies;
    if (!VALID_CURRENCY_ROLES.has(role)) {
      failures.push({ id: c.id, reason: 'invalid_role' });
      continue;
    }
    if (conversionOnlySet.has(c.id) && role !== 'conversion_only') {
      failures.push({ id: c.id, reason: 'conversion_tool_promoted' });
    }
    for (const v of values || []) {
      if (!SUPPORTED_CURRENCY_CODES.has(v) && !ALLOWED_FREE_TEXT_CURRENCY_VALUES.has(v)) {
        failures.push({ id: c.id, reason: 'unsupported_currency_value' });
      }
    }
  }
  return failures;
}

/**
 * Codex finding 6: a Local-market-only sub-requirement (e.g. a tax/business ID) must be described
 * as scoped to the Local market whenever it is mentioned at all - never presented as if it also
 * applies internationally. Structural, not exhaustive prose-parsing: checks that a description
 * mentioning "tax" (EN) or "ח.פ" (HE) also mentions the Local-market qualifier nearby.
 * @param {string} description
 * @param {boolean} isHebrew
 * @returns {boolean} true if the description is properly scoped (or does not mention the topic at all)
 */
export function isLocalPrerequisiteProperlyScoped(description, isHebrew) {
  const text = String(description || '');
  const mentionsTaxId = isHebrew ? /ח\.?פ\.?/.test(text) : /\btax(\/business)? id\b/i.test(text);
  if (!mentionsTaxId) return true;
  const mentionsLocalScope = isHebrew ? /ב-?שוק המקומי/.test(text) : /\bLocal market\b/i.test(text);
  return mentionsLocalScope;
}

/**
 * Codex finding 3 (2026-09-24): a registry capability's `canonicalSources` and its independently
 * SCANNED, source-owned marker (productTruthCapabilityScanner.js) must be JOINED by identity, not
 * merely both "exist" as separate, never-cross-checked facts. For every LIVE_CURRENT capability
 * with declared canonicalSources, AT LEAST ONE of those source paths must be a file where this
 * SAME capability's own marker was actually discovered - other canonicalSources entries may be
 * legitimate supplementary evidence (an entitlement/config file, a caller, a role-check module)
 * that never carries a UI-implementation marker itself, so "at least one" (not "every") is the
 * correct join semantics; but a capability where NONE of its sources carry its own marker is
 * exactly the failure class this exists to catch (an unrelated existing file, a generic text match
 * that isn't really this capability, a correct file with the wrong/missing marker, or a dangling
 * path all collapse to "no discovered-marker file among canonicalSources").
 * @param {{id:string, state:string, canonicalSources?: readonly string[]}[]} registryEntries
 * @param {Record<string, {file:string, line:number}[]>} discoveredById
 * @returns {{id:string, reason:'no_source_carries_own_marker'|'no_canonical_sources_declared'}[]}
 */
export function checkSourceAnchorJoin(registryEntries, discoveredById) {
  const failures = [];
  for (const c of registryEntries) {
    if (c.state !== 'LIVE_CURRENT') continue;
    const sources = c.canonicalSources || [];
    if (sources.length === 0) {
      failures.push({ id: c.id, reason: 'no_canonical_sources_declared' });
      continue;
    }
    const markerFiles = (discoveredById[c.id] || []).map((m) => m.file);
    const joined = sources.some((s) => markerFiles.includes(s));
    if (!joined) failures.push({ id: c.id, reason: 'no_source_carries_own_marker' });
  }
  return failures;
}
