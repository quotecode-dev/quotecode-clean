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
 * Codex "scanner-derived market authority" (2026-09-2X): derive a capability's per-market
 * IMPLEMENTATION evidence directly from the scanner-DISCOVERED marker locations
 * (productTruthCapabilityScanner.js's scanCapabilityMarkers/groupMarkersById) - never from a
 * second, hand-maintained location list (productTruthComponentAnchors.js's CAPABILITY_ANCHORS,
 * which Codex found still drove market evidence as a second central authority). A capability with
 * a real marker discovered in a Local-classified file has real Local evidence, and likewise for
 * International; a file the reachability classifier cannot resolve ('unknown') contributes NO
 * evidence in either direction - fail closed, an unresolved source can never silently promote a
 * capability to 'both'.
 * @param {Record<string, {file:string, line:number}[]>} discoveredById
 * @param {(file:string) => 'local'|'international'|'both'|'unknown'} classifyFileMarket
 * @returns {{id:string, localEvidence:boolean, internationalEvidence:boolean}[]}
 */
export function deriveMarketEvidenceFromScanner(discoveredById, classifyFileMarket) {
  const evidence = [];
  for (const [id, markers] of Object.entries(discoveredById)) {
    let localEvidence = false;
    let internationalEvidence = false;
    for (const { file } of markers) {
      const market = classifyFileMarket(file);
      if (market === 'local' || market === 'both') localEvidence = true;
      if (market === 'international' || market === 'both') internationalEvidence = true;
    }
    evidence.push({ id, localEvidence, internationalEvidence });
  }
  return evidence;
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
 * Codex "locale/currency negative matrix" mirror check: the same leakage class as
 * isLocalPrerequisiteProperlyScoped, in the opposite direction - an International-market-only
 * prerequisite fact must be scoped as International-only whenever mentioned, never presented as
 * if it also applies to the Local market. No real International-only prerequisite fact exists in
 * today's registry (the only asymmetric prerequisite today, the Local tax/business ID, is the
 * function above's real-data case) - this exists so the negative-fixture matrix proves the SAME
 * leakage class is caught in BOTH directions on a synthetic mirror, not merely assumed safe
 * because today's real data happens to have nothing International-only to leak.
 * @param {string} description
 * @param {boolean} isHebrew
 * @returns {boolean}
 */
export function isInternationalPrerequisiteProperlyScoped(description, isHebrew) {
  const text = String(description || '');
  const mentionsIntlTaxId = isHebrew ? /מספר עוסק בינלאומי|EIN/.test(text) : /\b(EIN|international tax id|sales tax id)\b/i.test(text);
  if (!mentionsIntlTaxId) return true;
  const mentionsInternationalScope = isHebrew ? /ב-?שוק הבינלאומי/.test(text) : /\bInternational market\b/i.test(text);
  return mentionsInternationalScope;
}

/**
 * Product Truth final closure (2026-09-23, Blocker 4 §5): regionConfig.js's Local ₪ vs
 * International $ distinction (`REGION_RULES.LOCAL.currencySymbol` / `.INTERNATIONAL.
 * defaultCurrencySymbol`) is used in real source ONLY as a DEFAULT DISPLAY / CONFIG condition -
 * `getCurrencySym`'s own fallback when no more specific currency is known, and
 * `getRegionBillingProfile`'s still-dormant future-billing-integration default (see its own comment:
 * "מיועד לשימוש ע"י אינטגרציות עתידיות", not a live payment/subscription system). It is never proof
 * of the FULL quote-currency support set - `getCurrencySym` itself demonstrates real International
 * quote-currency support is broader (explicit EUR/GBP/USD branches), not narrowed to the single
 * default symbol. This check catches the exact wrong-claim shape: a registry capability whose
 * 'quote' or 'payment' role currency VALUES are narrowed to exactly regionConfig's own single
 * International default code alone, as if that were the complete supported set.
 * @param {{LOCAL:{currencySymbol?:string}, INTERNATIONAL:{defaultCurrencySymbol?:string}}} regionRules
 * @param {{id:string, currencies?: {role:string, values:readonly string[]} | null}[]} registryEntries
 * @returns {{id:string, reason:'region_default_symbol_treated_as_exhaustive_currency_set'}[]}
 */
export function checkRegionConfigClaimScope(regionRules, registryEntries) {
  const failures = [];
  // The real quote-currency truth (getCurrencySym) supports USD/EUR/GBP for International, ILS for
  // Local - strictly broader than regionConfig's own single default symbol per market. A 'quote' or
  // 'payment' role narrowed to exactly one currency code, equal to what regionConfig's own default
  // symbol maps to, is the shape a wrong "regionConfig proves the currency set" claim would take.
  const intlDefaultIsDollarSymbol = regionRules?.INTERNATIONAL?.defaultCurrencySymbol === '$';
  const intlDefaultCode = intlDefaultIsDollarSymbol ? 'USD' : null;
  for (const c of registryEntries) {
    if (!c.currencies) continue;
    const { role, values } = c.currencies;
    if ((role === 'quote' || role === 'payment') && Array.isArray(values) && values.length === 1 && intlDefaultCode && values[0] === intlDefaultCode) {
      failures.push({ id: c.id, reason: 'region_default_symbol_treated_as_exhaustive_currency_set' });
    }
  }
  return failures;
}

/**
 * Codex "locale/currency negative matrix": regionConfig.js's REGION_RULES is the ONE source for
 * Local vs International locale/currency semantics that the rest of the Product Truth gate
 * structurally depends on. Checks the real invariants (Local = ILS symbol + a positive VAT rate;
 * International = never the ILS symbol, VAT-exempt) so a corrupted regionConfig value is caught
 * structurally rather than assumed safe because today's committed values happen to be correct.
 * @param {{LOCAL:{currencySymbol?:string, vatRate:number}, INTERNATIONAL:{defaultCurrencySymbol?:string, vatRate:number}}} regionRules
 * @returns {string[]} violation reason codes, empty if consistent
 */
export function checkRegionConfigIntegrity(regionRules) {
  const failures = [];
  if (!regionRules || !regionRules.LOCAL || !regionRules.INTERNATIONAL) return ['missing_region_rules'];
  if (regionRules.LOCAL.currencySymbol !== '₪') failures.push('local_currency_symbol_not_ils');
  if (!(regionRules.LOCAL.vatRate > 0)) failures.push('local_vat_rate_not_positive');
  if (regionRules.INTERNATIONAL.defaultCurrencySymbol === '₪') failures.push('international_currency_symbol_is_ils');
  if (regionRules.INTERNATIONAL.vatRate !== 0) failures.push('international_vat_rate_not_zero');
  return failures;
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

/**
 * Codex "enforceable source inventory" (2026-09-2X): a discovered marker's file must be one of
 * that capability's own DECLARED canonicalSources whenever the registry declares any at all (a
 * marker discovered somewhere the registry never listed is an undeclared/ambiguous placement -
 * either the canonicalSources list is stale, or the marker was pasted into the wrong file).
 *
 * Product Truth final closure (2026-09-23, Blocker 1 §3.4): the same capability id legitimately
 * appearing MORE THAN ONCE in the same file is no longer, by itself, a failure - control-level
 * coverage (productTruthControlScanner.js) intentionally attaches one capability id to several
 * distinct controls in the same file (e.g. separate Add/Edit/Delete buttons all mapped to
 * `clients`). The old file-level "duplicate_in_file" rule collapsed under this legitimate pattern
 * and is superseded by the control scanner's own per-control identity/signature tracking, which
 * catches the real failure class (an accidental duplicate marker ON THE SAME CONTROL, or two
 * controls colliding on one structural signature) at the correct granularity. This function keeps
 * only the still-valid source-location join check.
 * @param {{id:string, file:string, line:number}[]} markers - flat scanner output (scanCapabilityMarkers)
 * @param {{id:string, canonicalSources?: readonly string[]}[]} registryEntries
 * @returns {{id:string, file:string, reason:'undeclared_marker_location'}[]}
 */
export function checkMarkerAmbiguity(markers, registryEntries) {
  const failures = [];
  const registryById = new Map(registryEntries.map((c) => [c.id, c]));

  const seenIdFile = new Set();
  for (const m of markers) {
    const key = `${m.id}::${m.file}`;
    if (seenIdFile.has(key)) continue;
    seenIdFile.add(key);
    const entry = registryById.get(m.id);
    const sources = entry?.canonicalSources || [];
    if (entry && sources.length > 0 && !sources.includes(m.file)) {
      failures.push({ id: m.id, file: m.file, reason: 'undeclared_marker_location' });
    }
  }
  return failures;
}
