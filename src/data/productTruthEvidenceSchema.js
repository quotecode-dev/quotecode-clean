// PRODUCT TRUTH FINAL DELTA CLOSURE — Finding 5 (2026-09-2X): "Evidence gate does not mechanically
// validate semantic correctness / complete required row schema." Prior gates (checkMarkerAmbiguity,
// checkInteractiveCompleteness, checkControlIdentityBaseline) validate SOURCE coverage; nothing
// mechanically validated the TERMINAL EVIDENCE rows themselves (the *.md/*.json files under
// evidence/product-truth/) - a row could be missing required provenance fields, could record the
// WRONG resolved capability/result for its own cell, could have a null capabilityId where a
// deterministic capability must exist, or a matrix slot could be duplicated or missing - and
// nothing would catch it. This module is that gate: a real, importable, unit-tested schema +
// semantic validator, never just an arithmetic row-count check.
//
// "VALID" (task §6) means BOTH: (a) the row's own schema is complete (every required field present,
// non-empty, well-typed) and (b) its semantic content is internally consistent (resolved result
// matches expected result, capabilityId is populated wherever the cell's own expectation says it
// must be deterministic, no duplicate/missing matrix slot). A row can have a syntactically complete
// schema and still be INVALID because its content is semantically wrong - both checks are required.

export const REQUIRED_EVIDENCE_ROW_FIELDS = [
  'evidenceId', // unique evidence ID (never reused across rows, never blank)
  'timestampUtc', // ISO-8601 UTC timestamp
  'personaAlias', // synthetic TEST persona alias (never a real customer identity)
  'market', // 'Local' | 'International' | 'Unknown'
  'plan', // plan/tier string
  'role', // role string ('user' | 'super_admin' | ...)
  'language', // 'he' | 'en'
  'prompt', // exact prompt text sent
  'response', // full response text received
  'supportCategory', // classifySupportMessage's own category for this row
  'resolvedResult', // what the system actually returned/decided (capability id, or a named outcome)
  'expectedResult', // what this cell's own definition says the correct outcome is
  'expectationSource', // WHERE expectedResult came from - never the same computation as resolvedResult (see checkExpectationIndependence)
  'implementationSourceSha', // the git commit the runtime CODE was at when this row was captured
  'testProjectRef', // Supabase TEST project ref the call was made against
  'deployedFunctionVersion', // the deployed chat-ai function version/revision live at capture time
  'evidenceMethod', // how this row was captured (e.g. 'live_terminal_http', 'chat_logs_readback')
];

// Optional, present only when they legitimately differ from a row's own implementationSourceSha
// (task §6: "evidence-only HEAD if different") or apply ("immutable TEST row ID where applicable" -
// e.g. a chat_logs primary key, only when the evidence method actually reads one back) or when the
// cell has its own independent entitlement dimension (plan/role-gated cells).
export const OPTIONAL_EVIDENCE_ROW_FIELDS = [
  'evidenceOnlyHead', 'immutableTestRowId', 'historicalVersion',
  'expectedEntitlement', 'resolvedEntitlement', 'serverVerified',
];

// Codex final independent review (2026-09-2X): "some expectations were derived from the same
// computed result they were supposed to validate" (expectedResult = resolvedResult). A row's
// `expectationSource` declares WHERE its expectedResult really came from - only these sources
// count as genuinely independent of the runtime call this row's own resolvedResult came from.
// 'computed_result'/'resolved_result'/'self' and any other value are explicitly REJECTED by
// checkExpectationIndependence below - not merely undocumented, actively disallowed.
export const ALLOWED_EXPECTATION_SOURCES = Object.freeze([
  'static_fixture', // a hand-authored, committed fixture file (e.g. productTruthOwnerMatrixExpectedFixture.js)
  'canonical_registry', // src/data/productTruthRegistry.js's own declared fields (minimumPlan, requiredRole, ...)
  'canonical_entitlement_rules', // planCatalog.js/accountEntitlement.js's own canonical rules
  'server_verified_fact', // a real read-only server query result (e.g. business_settings), independent of the chat-ai call
  'predeclared_acceptance_fixture', // an Owner/task-author-approved fixed matrix design field (e.g. the historical matrix's own `area`/`category` label, authored before any call ran)
]);

/**
 * Mechanically rejects a row whose expectedResult cannot be proven independent of its own
 * resolvedResult: a missing/disallowed expectationSource, OR (defense in depth) a row that
 * literally carries no expectationSource at all while resolvedResult/expectedResult happen to be
 * identical strings pointing at the same field name in the row object (the exact self-fulfilling
 * shape Codex found: `expectedResult: resolvedResult` in source).
 * @param {object} row
 * @returns {string[]} violations (empty = independence proven)
 */
export function checkExpectationIndependence(row) {
  const violations = [];
  if (!row || typeof row !== 'object') return ['row_not_an_object'];
  if (!isNonEmptyString(row.expectationSource)) {
    violations.push('missing_expectation_source');
  } else if (!ALLOWED_EXPECTATION_SOURCES.includes(row.expectationSource)) {
    violations.push(`disallowed_expectation_source:${row.expectationSource}`);
  }
  return violations;
}

/**
 * "Row tied to stale runtime version/SHA" (task §6): a row whose implementationSourceSha is NOT
 * the current final candidate SHA must say so explicitly (historicalVersion: true) - an unmarked
 * stale SHA is a real gate failure (the row is silently claiming current-runtime authority it does
 * not have), never a silent pass. A row correctly marked historical is not a failure - it is an
 * honest record of what it actually proves (task §11: "explicitly records its historical version").
 * @param {object[]} rows
 * @param {string} finalSha - the delta round's real final implementation SHA
 * @returns {Array<{evidenceId: string|undefined, sha: string|undefined}>} unmarked-stale rows
 */
export function checkEvidenceRuntimeFreshness(rows, finalSha) {
  return rows
    .filter((row) => isNonEmptyString(row?.implementationSourceSha) && row.implementationSourceSha !== finalSha && !row.historicalVersion)
    .map((row) => ({ evidenceId: row.evidenceId, sha: row.implementationSourceSha }));
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Schema-only check: every required field present, non-empty, and well-typed. Does not look at
 * semantic correctness (that is checkEvidenceRowSemantics below) - a row can pass this and still
 * be semantically wrong, and vice versa is impossible (a semantically-checkable row must first have
 * the fields to check).
 * @param {object} row
 * @returns {string[]} field-level schema violations (empty = schema-complete)
 */
export function checkEvidenceRowSchema(row) {
  const violations = [];
  if (!row || typeof row !== 'object') return ['row_not_an_object'];
  for (const field of REQUIRED_EVIDENCE_ROW_FIELDS) {
    if (!(field in row)) {
      violations.push(`missing_field:${field}`);
      continue;
    }
    const value = row[field];
    if (!isNonEmptyString(value)) violations.push(`empty_or_invalid_field:${field}`);
  }
  if (isNonEmptyString(row.timestampUtc) && !UTC_TIMESTAMP_RE.test(row.timestampUtc)) {
    violations.push('malformed_timestamp_not_utc_iso8601');
  }
  if (isNonEmptyString(row.implementationSourceSha) && !SHA_RE.test(row.implementationSourceSha)) {
    violations.push('malformed_implementation_source_sha');
  }
  if (isNonEmptyString(row.language) && row.language !== 'he' && row.language !== 'en') {
    violations.push('invalid_language_value');
  }
  if (isNonEmptyString(row.market) && !['Local', 'International', 'Unknown'].includes(row.market)) {
    violations.push('invalid_market_value');
  }
  if ('evidenceOnlyHead' in row && row.evidenceOnlyHead !== null && !isNonEmptyString(row.evidenceOnlyHead)) {
    violations.push('malformed_evidence_only_head');
  }
  return violations;
}

/**
 * Semantic check: does the row's own content actually prove what this cell claims to prove.
 * `expectation` describes what a VALID row for this specific cell must show - supplied per-cell by
 * the caller (the matrix definition), never inferred from the row itself (a row cannot grade its
 * own homework).
 * @param {object} row
 * @param {{
 *   requiresDeterministicCapability?: boolean,   // this cell's expected result MUST come from a real registry capability id, never null/model-guessed
 *   expectedResult?: string,                     // the exact expected resolvedResult value (e.g. a capability id, or a named security/support outcome)
 *   forbiddenResponsePatterns?: RegExp[],         // patterns that must NOT appear in `response` (e.g. a false denial, an overclaim)
 *   requiredResponsePatterns?: RegExp[],          // patterns that MUST appear in `response` (e.g. must affirm a specific truth)
 * }} expectation
 * @returns {string[]} semantic violations (empty = semantically valid)
 */
export function checkEvidenceRowSemantics(row, expectation = {}) {
  const violations = [];
  if (!row || typeof row !== 'object') return ['row_not_an_object'];
  if (expectation.requiresDeterministicCapability) {
    if (row.resolvedResult === null || row.resolvedResult === undefined || row.resolvedResult === '') {
      violations.push('null_capability_where_deterministic_required');
    }
    if (row.evidenceMethod && !['live_terminal_http', 'chat_logs_readback'].includes(row.evidenceMethod)) {
      // A deterministic capability row must be backed by a real call/read-back, never narration.
      violations.push('non_mechanical_evidence_method_for_deterministic_row');
    }
  }
  if (isNonEmptyString(expectation.expectedResult) && row.resolvedResult !== expectation.expectedResult) {
    violations.push(`wrong_result: expected "${expectation.expectedResult}", got "${row.resolvedResult ?? 'null'}"`);
  }
  if (isNonEmptyString(row.expectedResult) && isNonEmptyString(row.resolvedResult) && row.expectedResult !== row.resolvedResult) {
    violations.push(`wrong_result_self_recorded: row's own expectedResult "${row.expectedResult}" != row's own resolvedResult "${row.resolvedResult}"`);
  }
  // Wrong entitlement (task §6/§3.4): a plan/role-gated cell carries its own INDEPENDENTLY-derived
  // expectedEntitlement (canonical registry rule + real server fact) and resolvedEntitlement (the
  // real entitlement-resolver's own output against the same real server fact) - both present on
  // rows that have an entitlement dimension at all; absent on rows that don't (e.g. Owner Matrix
  // cells with no plan/role gate), never flagged as missing for those.
  if (isNonEmptyString(row.expectedEntitlement) || isNonEmptyString(row.resolvedEntitlement)) {
    if (!isNonEmptyString(row.expectedEntitlement) || !isNonEmptyString(row.resolvedEntitlement)) {
      violations.push('incomplete_entitlement_pair');
    } else if (row.expectedEntitlement !== row.resolvedEntitlement) {
      violations.push(`wrong_entitlement: expected "${row.expectedEntitlement}", got "${row.resolvedEntitlement}"`);
    }
  }
  // Server-fact mismatch: when a row carries a server-verified market/plan/role, it must agree
  // with the row's own claimed market/plan/role (an evidence row cannot claim one persona context
  // while its own server read-back proves a different real account state).
  if (row.serverVerified && typeof row.serverVerified === 'object' && row.serverVerified.serverPlan) {
    if (isNonEmptyString(row.market) && isNonEmptyString(row.serverVerified.serverMarket) && row.market !== row.serverVerified.serverMarket) {
      violations.push(`server_fact_mismatch_market: row claims "${row.market}", server says "${row.serverVerified.serverMarket}"`);
    }
    if (isNonEmptyString(row.role) && isNonEmptyString(row.serverVerified.serverRole) && row.role !== row.serverVerified.serverRole) {
      violations.push(`server_fact_mismatch_role: row claims "${row.role}", server says "${row.serverVerified.serverRole}"`);
    }
  }
  // Unjoinable TEST row: a chat_logs-readback row must carry the real immutable row id it read back.
  if (row.evidenceMethod === 'chat_logs_readback' && !isNonEmptyString(row.immutableTestRowId)) {
    violations.push('unjoinable_test_row_missing_immutable_id');
  }
  const response = typeof row.response === 'string' ? row.response : '';
  for (const pattern of expectation.forbiddenResponsePatterns || []) {
    if (pattern.test(response)) violations.push(`forbidden_pattern_present:${pattern}`);
  }
  for (const pattern of expectation.requiredResponsePatterns || []) {
    if (!pattern.test(response)) violations.push(`required_pattern_missing:${pattern}`);
  }
  return violations;
}

/**
 * Collection-level check across an entire matrix (Owner/Plan-Role/Security/Support): every
 * required slot is present exactly once - no duplicate, no missing subtopic/slot, no wrong matrix
 * position. `slotOf(row)` derives a row's own claimed slot key (e.g. `${area}|${variant}|${lang}`);
 * `requiredSlots` is the matrix definition's own complete, real slot list (never derived from the
 * rows themselves - a self-derived required list could never catch a missing slot).
 * @param {object[]} rows
 * @param {string[]} requiredSlots
 * @param {(row: object) => string} slotOf
 * @returns {{ missingSlots: string[], duplicateSlots: string[], unknownSlots: string[] }}
 */
export function checkEvidenceMatrixSlots(rows, requiredSlots, slotOf) {
  const required = new Set(requiredSlots);
  const seen = new Map();
  const unknownSlots = [];
  for (const row of rows) {
    const slot = slotOf(row);
    if (!required.has(slot)) {
      unknownSlots.push(slot);
      continue;
    }
    seen.set(slot, (seen.get(slot) || 0) + 1);
  }
  const missingSlots = requiredSlots.filter((s) => !seen.has(s));
  const duplicateSlots = [...seen.entries()].filter(([, count]) => count > 1).map(([s]) => s);
  return { missingSlots, duplicateSlots, unknownSlots };
}

/**
 * Full per-row gate: schema AND semantics both pass. This is what "VALID" (task §6) means for a
 * single row - used by the per-matrix counters (48/48, 13/13, 9/9, 4/4) below.
 * @param {object} row
 * @param {object} expectation
 * @returns {{ valid: boolean, schemaViolations: string[], semanticViolations: string[] }}
 */
export function validateEvidenceRow(row, expectation = {}) {
  const schemaViolations = [...checkEvidenceRowSchema(row), ...checkExpectationIndependence(row)];
  const semanticViolations = schemaViolations.length === 0 ? checkEvidenceRowSemantics(row, expectation) : [];
  return { valid: schemaViolations.length === 0 && semanticViolations.length === 0, schemaViolations, semanticViolations };
}

/**
 * Validates a whole matrix collection against its own requiredSlots + per-row expectations, and
 * returns the exact "N / M VALID" count the final report requires - never a bare row-count.
 * @param {object[]} rows
 * @param {{ requiredSlots: string[], slotOf: (row: object) => string, expectationOf: (row: object) => object }} matrixDef
 * @returns {{ validCount: number, totalRequired: number, rowResults: Array<object>, slotCheck: object }}
 */
export function validateEvidenceMatrix(rows, matrixDef) {
  const { requiredSlots, slotOf, expectationOf } = matrixDef;
  const slotCheck = checkEvidenceMatrixSlots(rows, requiredSlots, slotOf);
  const rowResults = rows.map((row) => ({ row, slot: slotOf(row), ...validateEvidenceRow(row, expectationOf(row)) }));
  const validSlots = new Set(rowResults.filter((r) => r.valid).map((r) => r.slot));
  // A duplicated or unknown slot can never count toward the required total, even if individually "valid".
  for (const s of slotCheck.duplicateSlots) validSlots.delete(s);
  const validCount = [...validSlots].filter((s) => requiredSlots.includes(s)).length;
  return { validCount, totalRequired: requiredSlots.length, rowResults, slotCheck };
}
