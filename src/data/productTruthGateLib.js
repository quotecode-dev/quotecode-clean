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
