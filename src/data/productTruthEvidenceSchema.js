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
//
// THREE-ACTION DELTA (Action B): validateFinalMatrix() at the bottom of this file is the FINAL gate. Unlike the
// generic validateEvidenceMatrix() it takes NO caller-supplied slot list and NO caller-supplied expectation: the
// required slots and every expected value are resolved from productTruthFinalMatrixAcceptance.js (static,
// predeclared) + the canonical registry, so a missing row still leaves its required slot standing (=> failure),
// an extra row can never add a requirement, and a row can never author its own expectation.
import { getCapabilityById } from './productTruthRegistry.js';
import { checkAgainstRequiredSlotAuthority } from './productTruthRequiredSlotAuthority.js';
import { deriveRegistryEntitlement } from './productTruthCapabilityPolarity.js';
import { checkFactPayloadAgainstCanonical, checkProseAgainstPayload, deriveExpectedFactPayload, isKnownOutcome } from './productTruthFactPayload.js';
import { checkRawCaptureIntegrity, checkRowAgainstRawCapture, checkSupportLiveReadback } from './productTruthRawCaptureBinding.js';
import {
  EXPECTED_MATRIX_SIZES, EXPECTATION_AUTHORITIES, FINAL_MATRIX_DEFINITIONS, KNOWN_RUNTIME_PROVENANCE, MATRIX_LANGUAGES, OWNER_AREAS,
  OWNER_PHRASINGS, OWNER_SUBTOPIC_ALLOCATION, PERSONA_DECLARATIONS, RESULT_SENTINELS, RUNTIME_DEPLOYED_UPDATED_AT_UTC, RUNTIME_DEPLOYED_VERSION,
  SECURITY_EXPECTED_RESULT, SECURITY_UNSAFE_RESULT, structuredOutcomeOf, SUPPORT_REQUIRED_CATEGORIES, TEST_PROJECT_REF,
} from './productTruthFinalMatrixAcceptance.js';

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
  // three-action delta (Action B): the row's claim of WHICH predeclared slot it fills (matrixSlot), the Owner
  // subtopic it exercised, whether the live answer was deterministic, and which authority its entitlement
  // expectation came from. All are only CLAIMS - validateFinalMatrix checks them against the static definitions.
  'matrixSlot', 'matrixSubtopic', 'answerSource', 'expectedEntitlementSource',
  // structured-truth closure: the `factPayload` the live chat-ai response carried (the runtime's structured Product Truth).
  'factPayload',
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
  'canonical_support_category_map', // productTruthFinalMatrixAcceptance.js SUPPORT_CATEGORY_EXPECTATION_MAP (the AI Support category expectation map)
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

// =============================================================================================================
// THREE-ACTION DELTA - Action B: FINAL GATE (independent required slots + independent expectation authorities)
// =============================================================================================================

const ENTITLEMENT_VALUES = Object.freeze(['GRANTED', 'DENIED']);

// deriveRegistryEntitlement now lives with the capability-polarity truth derivation (it is the same canonical
// registry x server-verified-facts authority); re-exported here so existing importers keep working.
export { deriveRegistryEntitlement };

function isCanonicalExpectedResult(value) {
  return isNonEmptyString(value) && (RESULT_SENTINELS.includes(value) || getCapabilityById(value) !== null);
}

/**
 * Integrity of a static matrix definition against the SECOND, independent size declaration and the static
 * constants it must be built from. A definition edited to be shorter/longer/different is caught here rather than
 * silently redefining what "complete" means.
 * @param {'owner'|'planRole'|'security'|'support'} key
 * @param {{ slots: object[] }} [definition]
 * @returns {string[]} problems (empty = the definition is a well-formed instance of its required matrix)
 */
export function checkFinalMatrixDefinitionIntegrity(key, definition = FINAL_MATRIX_DEFINITIONS[key]) {
  const problems = [];
  if (!(key in EXPECTED_MATRIX_SIZES)) return [`unknown_matrix_key:${key}`];
  const slots = definition && Array.isArray(definition.slots) ? definition.slots : null;
  if (!slots) return ['definition_has_no_slots'];
  if (slots.length !== EXPECTED_MATRIX_SIZES[key]) problems.push(`slot_count_${slots.length}_not_${EXPECTED_MATRIX_SIZES[key]}`);
  const ids = slots.map((s) => s?.slot);
  if (new Set(ids).size !== ids.length) problems.push('duplicate_slot_ids_in_definition');
  for (const s of slots) {
    for (const f of ['slot', 'persona', 'language', 'prompt', 'expectedResult', 'expectationAuthority', 'evidenceMethod']) {
      if (!isNonEmptyString(s?.[f])) problems.push(`slot_${s?.slot}_missing_${f}`);
    }
    if (!MATRIX_LANGUAGES.includes(s?.language)) problems.push(`slot_${s?.slot}_invalid_language`);
    const persona = PERSONA_DECLARATIONS[s?.persona];
    if (!persona) problems.push(`slot_${s?.slot}_unknown_persona`);
    // market isolation: Hebrew cells are Local personas, English cells International personas - never mixed.
    else if ((s.language === 'he') !== (persona.market === 'Local')) problems.push(`slot_${s.slot}_language_market_mismatch`);
    if (!isKnownOutcome(structuredOutcomeOf(key, s))) problems.push(`slot_${s?.slot}_structured_outcome_unknown:${structuredOutcomeOf(key, s) ?? 'missing'}`);
    if (!ALLOWED_EXPECTATION_SOURCES.includes(s?.expectationAuthority) || !(s?.expectationAuthority in EXPECTATION_AUTHORITIES)) {
      problems.push(`slot_${s?.slot}_unsupported_expectation_authority:${s?.expectationAuthority}`);
    }
  }
  if (key === 'owner') {
    const want = new Set();
    for (const a of OWNER_AREAS) for (const p of OWNER_PHRASINGS) for (const l of MATRIX_LANGUAGES) want.add(`${a}|${p}|${l}`);
    for (const id of want) if (!ids.includes(id)) problems.push(`owner_required_slot_absent_from_definition:${id}`);
    for (const id of ids) if (!want.has(id)) problems.push(`owner_definition_slot_outside_required_set:${id}`);
    for (const s of slots) {
      if (!isCanonicalExpectedResult(s.expectedResult)) problems.push(`slot_${s.slot}_expected_not_canonical:${s.expectedResult}`);
      const wantSub = OWNER_SUBTOPIC_ALLOCATION[s.slot] ?? null;
      if ((s.subtopic ?? null) !== wantSub) problems.push(`slot_${s.slot}_subtopic_allocation_${s.subtopic ?? 'null'}_not_${wantSub ?? 'null'}`);
      if (s.expectationAuthority !== 'static_fixture') problems.push(`slot_${s.slot}_owner_authority_must_be_static_fixture`);
    }
  } else if (key === 'planRole') {
    for (const s of slots) {
      const capability = getCapabilityById(s.expectedResult);
      if (!capability || !['plan', 'role'].includes(capability.authorityType)) problems.push(`slot_${s.slot}_expected_not_a_plan_or_role_gated_registry_capability`);
      if (!ENTITLEMENT_VALUES.includes(s.fixtureExpectedEntitlement)) problems.push(`slot_${s.slot}_fixture_entitlement_invalid`);
      if (s.expectationAuthority !== 'static_fixture') problems.push(`slot_${s.slot}_planrole_authority_must_be_static_fixture`);
    }
  } else if (key === 'security') {
    for (const s of slots) {
      if (s.expectedResult !== SECURITY_EXPECTED_RESULT) problems.push(`slot_${s.slot}_expected_not_fail_safe`);
      if (!Array.isArray(s.forbiddenResponsePatterns) || s.forbiddenResponsePatterns.length === 0 || !s.forbiddenResponsePatterns.every((p) => p instanceof RegExp)) {
        problems.push(`slot_${s.slot}_missing_forbidden_patterns`);
      }
      if (s.expectationAuthority !== 'predeclared_acceptance_fixture') problems.push(`slot_${s.slot}_security_authority_must_be_predeclared_acceptance_fixture`);
    }
  } else if (key === 'support') {
    const cats = slots.map((s) => s.category).sort();
    if (JSON.stringify(cats) !== JSON.stringify([...SUPPORT_REQUIRED_CATEGORIES].sort())) problems.push('support_categories_not_the_four_required');
    for (const s of slots) {
      if (s.expectedResult !== s.category) problems.push(`slot_${s.slot}_expected_category_differs_from_slot_category`);
      if (s.expectationAuthority !== 'canonical_support_category_map') problems.push(`slot_${s.slot}_support_authority_must_be_canonical_support_category_map`);
    }
  }
  // FINDING 1 (four-finding remediation): EXACT-SET + identity check for ALL FOUR matrices against the separately
  // committed canonical authority table - a same-cardinality substitution (13 stays 13, 9 stays 9) can no longer pass.
  problems.push(...checkAgainstRequiredSlotAuthority(key, slots));
  return problems;
}

/**
 * Runtime provenance for FINAL acceptance: the row must be a genuine, honestly-labelled, CURRENT-runtime capture.
 * - version/SHA pair must be a truthfully known pair (a v31 call labelled with the v32 SHA is a mislabel);
 * - it must be the current deployed version (a stale/historical v31 row is honest but is NOT acceptance evidence);
 * - it cannot have been captured before that version existed;
 * - it must have been made against the TEST project.
 * @param {object} row
 * @returns {string[]}
 */
export function checkFinalRuntimeProvenance(row) {
  const v = [];
  if (!row || typeof row !== 'object') return ['row_not_an_object'];
  const knownSha = KNOWN_RUNTIME_PROVENANCE[row.deployedFunctionVersion];
  if (!knownSha) v.push(`unknown_deployed_function_version:${row.deployedFunctionVersion ?? 'missing'}`);
  else if (row.implementationSourceSha !== knownSha) {
    v.push(`runtime_provenance_mislabel: ${row.deployedFunctionVersion} was deployed from ${knownSha.slice(0, 7)}, row claims ${String(row.implementationSourceSha).slice(0, 7)}`);
  }
  if (row.deployedFunctionVersion !== RUNTIME_DEPLOYED_VERSION) v.push(`stale_runtime_version_not_acceptable_for_final_gate: ${row.deployedFunctionVersion ?? 'missing'} (required ${RUNTIME_DEPLOYED_VERSION})`);
  if (row.historicalVersion) v.push('historical_row_not_acceptable_for_final_gate');
  if (isNonEmptyString(row.timestampUtc) && UTC_TIMESTAMP_RE.test(row.timestampUtc) && Date.parse(row.timestampUtc) < Date.parse(RUNTIME_DEPLOYED_UPDATED_AT_UTC)) {
    v.push(`captured_before_${RUNTIME_DEPLOYED_VERSION}_existed: ${row.timestampUtc} < ${RUNTIME_DEPLOYED_UPDATED_AT_UTC}`);
  }
  if (row.testProjectRef !== TEST_PROJECT_REF) v.push(`wrong_test_project_ref:${row.testProjectRef ?? 'missing'}`);
  return v;
}

function checkFinalRowAgainstSlot(row, slot, key) {
  const expectation = [];
  const semantic = [];
  const persona = PERSONA_DECLARATIONS[slot.persona];

  // (1) EXPECTATION INDEPENDENCE - what the row CLAIMS must equal what the slot's authority derives.
  if (row.expectationSource !== slot.expectationAuthority) {
    expectation.push(`expectation_source_not_slot_authority: row declares "${row.expectationSource ?? 'missing'}", slot authority is "${slot.expectationAuthority}"`);
  }
  if (row.expectedResult !== slot.expectedResult) {
    expectation.push(`expected_result_differs_from_authority: row "${row.expectedResult ?? 'missing'}", ${slot.expectationAuthority} says "${slot.expectedResult}"`);
  }
  if (isNonEmptyString(row.expectedResult) && row.expectedResult === row.resolvedResult && row.expectedResult !== slot.expectedResult) {
    expectation.push('self_derived_expectation: expectedResult == resolvedResult but neither is what the independent authority expects');
  }
  // (2) the row must actually be the predeclared cell (prompt / persona / language / market / role / subtopic).
  if (row.prompt !== slot.prompt) expectation.push('prompt_differs_from_predeclared_slot_prompt');
  if (row.language !== slot.language) expectation.push(`language_differs_from_slot:${row.language}!=${slot.language}`);
  if (row.personaAlias !== slot.persona) expectation.push(`persona_differs_from_slot:${row.personaAlias}!=${slot.persona}`);
  if (persona && row.market !== persona.market) expectation.push(`market_differs_from_persona_declaration:${row.market}!=${persona.market}`);
  if (persona && row.role !== persona.role) expectation.push(`role_differs_from_persona_declaration:${row.role}!=${persona.role}`);
  if (key === 'owner') {
    if (slot.subtopic !== null && row.matrixSubtopic !== slot.subtopic) expectation.push(`subtopic_allocation_not_preserved:${row.matrixSubtopic ?? 'missing'}!=${slot.subtopic}`);
    if (slot.subtopic === null && row.matrixSubtopic) expectation.push(`unexpected_subtopic_on_single_topic_slot:${row.matrixSubtopic}`);
  }
  if (row.evidenceMethod !== slot.evidenceMethod) expectation.push(`evidence_method_differs_from_slot:${row.evidenceMethod}!=${slot.evidenceMethod}`);

  // (3) ACTUAL RESULT - checked against the independent expectation and against the LIVE response text itself.
  semantic.push(...checkEvidenceRowSemantics(row, {
    requiresDeterministicCapability: true,
    expectedResult: slot.expectedResult,
    forbiddenResponsePatterns: key === 'security' ? slot.forbiddenResponsePatterns : [],
  }));
  const response = typeof row.response === 'string' ? row.response : '';
  if (slot.requiresDeterministicAnswer && row.answerSource !== 'deterministic') semantic.push(`answer_not_deterministic:${row.answerSource ?? 'missing'}`);
  // STRUCTURED TRUTH CONTRACT (Product Truth closure). The PRIMARY authority is the structured `factPayload` the live runtime
  // returned: it must be well-formed, must EQUAL the payload the canonical authorities (registry + AI_FACTS billing/invoicing +
  // the persona's SERVER-VERIFIED plan/role/market) independently derive for this slot, and a free-form answer must carry none.
  // Only when that holds is the PROSE checked - as a SECONDARY consistency check that it does not contradict the payload
  // (productTruthCapabilityPolarity.js / productTruthScopeClaims.js are defence in depth, no longer the authority): a missing or
  // wrong payload fails the cell whatever the prose says, and the prose can never rescue it.
  {
    const outcome = structuredOutcomeOf(key, slot);
    const structured = checkFactPayloadAgainstCanonical(row.factPayload, outcome, row.serverVerified);
    semantic.push(...structured);
    const expectedPayload = deriveExpectedFactPayload({ outcome, serverVerified: row.serverVerified });
    if (expectedPayload && !('problem' in expectedPayload)) {
      if (row.answerSource !== 'deterministic') semantic.push(`structured:answer_not_deterministic_but_a_structured_truth_is_required:${row.answerSource ?? 'missing'}`);
      if (structured.length === 0) semantic.push(...checkProseAgainstPayload(row.factPayload, response, slot.language));
    }
  }
  if (key === 'security') {
    // re-derive the outcome from the LIVE response with the predeclared patterns - the row's own resolvedResult is
    // only a claim that must equal this independent recomputation.
    const recomputed = slot.forbiddenResponsePatterns.some((p) => p.test(response)) ? SECURITY_UNSAFE_RESULT : SECURITY_EXPECTED_RESULT;
    if (row.resolvedResult !== recomputed) semantic.push(`resolved_result_disagrees_with_live_response_recompute: row "${row.resolvedResult}", recomputed "${recomputed}"`);
  }
  if (key === 'support') {
    if (row.supportCategory !== slot.expectedResult) semantic.push(`support_category_differs_from_expectation_map:${row.supportCategory}!=${slot.expectedResult}`);
    if (!isNonEmptyString(row.immutableTestRowId)) semantic.push('support_row_not_joinable_to_test_chat_logs_row');
  }
  {
    const sv = row.serverVerified;
    if (!sv || typeof sv !== 'object' || !isNonEmptyString(sv.serverPlan) || !isNonEmptyString(sv.serverRole) || !isNonEmptyString(sv.serverMarket)) {
      semantic.push('server_verified_plan_role_market_facts_required');
    } else {
      if (key === 'planRole') {
        const derived = deriveRegistryEntitlement(slot.expectedResult, sv.serverPlan, sv.serverRole);
        if (!ENTITLEMENT_VALUES.includes(derived)) semantic.push(`registry_entitlement_underivable:${derived}`);
        if (derived !== slot.fixtureExpectedEntitlement) semantic.push(`fixture_entitlement_disagrees_with_registry_derivation: fixture "${slot.fixtureExpectedEntitlement}", registry+server facts "${derived}"`);
        if (row.expectedEntitlement !== derived) semantic.push(`row_expected_entitlement_differs_from_registry_derivation: row "${row.expectedEntitlement ?? 'missing'}", derived "${derived}"`);
        if (row.resolvedEntitlement !== derived) semantic.push(`wrong_entitlement_result: resolver output "${row.resolvedEntitlement ?? 'missing'}", registry+server facts say "${derived}"`);
        if (row.expectedEntitlementSource !== 'canonical_registry') semantic.push(`entitlement_expectation_source_not_canonical_registry:${row.expectedEntitlementSource ?? 'missing'}`);
      }
      if (persona && sv.serverMarket !== persona.market) semantic.push(`server_market_differs_from_persona_declaration:${sv.serverMarket}!=${persona.market}`);
      if (persona && sv.serverRole !== persona.role) semantic.push(`server_role_differs_from_persona_declaration:${sv.serverRole}!=${persona.role}`);
      if (isNonEmptyString(row.plan) && !row.plan.toLowerCase().startsWith(sv.serverPlan)) semantic.push(`plan_claim_disagrees_with_server_plan:${row.plan}!=${sv.serverPlan}`);
    }
  }
  return { expectation, semantic };
}

/**
 * THE FINAL GATE. Required slots + expected values are resolved from the static acceptance definitions; the
 * evidence rows only supply what they observed. Consequences (each proven by a unit test):
 *  - a required slot with no row is MISSING and lowers validCount - it cannot vanish;
 *  - an extra / unknown-slot row never adds a requirement (totalRequired stays 48/13/9/4) and is reported;
 *  - a duplicated slot never counts;
 *  - a row whose expectation was authored by the row itself (or differs from the authority) is INVALID.
 * @param {'owner'|'planRole'|'security'|'support'} key
 * @param {object[]} rows
 * @param {{ definition?: { slots: object[] }, rawCapture?: object, liveSupportReadback?: Record<string, object> }} [opts]
 *   definition - test hook only; the real gate always uses FINAL_MATRIX_DEFINITIONS.
 *   rawCapture - the parsed RAW committed capture, the independent source every row is bound to (MANDATORY for 'support',
 *     which fails closed without it; verified for the other matrices whenever supplied - the runner always supplies it).
 *   liveSupportReadback - optional, `{ [matrixSlot]: liveTuple }` from a read-only TEST chat_logs re-read by id.
 */
export function validateFinalMatrix(key, rows, opts = {}) {
  const definition = opts.definition || FINAL_MATRIX_DEFINITIONS[key];
  const name = definition?.name || key;
  const definitionProblems = checkFinalMatrixDefinitionIntegrity(key, definition);
  const slots = definition && Array.isArray(definition.slots) ? definition.slots : [];
  const requiredSlots = slots.map((s) => s.slot);
  const totalRequired = EXPECTED_MATRIX_SIZES[key] ?? requiredSlots.length;
  const list = Array.isArray(rows) ? rows : [];

  const bySlot = new Map();
  const unknownSlots = [];
  for (const row of list) {
    const slotId = row?.matrixSlot;
    if (isNonEmptyString(slotId) && requiredSlots.includes(slotId)) bySlot.set(slotId, [...(bySlot.get(slotId) || []), row]);
    else unknownSlots.push({ evidenceId: row?.evidenceId ?? null, claimedSlot: slotId ?? null });
  }
  const idCounts = new Map();
  for (const row of list) if (isNonEmptyString(row?.evidenceId)) idCounts.set(row.evidenceId, (idCounts.get(row.evidenceId) || 0) + 1);
  const duplicateEvidenceIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  const rawCapture = opts.rawCapture ?? null;
  const rawCaptureProblems = rawCapture ? checkRawCaptureIntegrity(rawCapture) : (key === 'support' ? ['raw_capture_authority_missing'] : []);
  const uuidCounts = new Map();
  // reuse is counted only among rows that fill REQUIRED slots - an extra/unknown-slot row can never damage a valid slot
  if (key === 'support') for (const row of [...bySlot.values()].flat()) if (isNonEmptyString(row?.immutableTestRowId)) uuidCounts.set(row.immutableTestRowId, (uuidCounts.get(row.immutableTestRowId) || 0) + 1);
  const authorityTally = {};
  const slotResults = slots.map((slot) => {
    const found = bySlot.get(slot.slot) || [];
    const authority = { kind: slot.expectationAuthority, description: EXPECTATION_AUTHORITIES[slot.expectationAuthority] ?? null, expected: slot.expectedResult };
    if (key === 'planRole') authority.entitlement = { fixture: slot.fixtureExpectedEntitlement, derivedFrom: 'canonical_registry + server_verified_fact' };
    if (found.length === 0) return { slot: slot.slot, status: 'MISSING', valid: false, violations: ['required_slot_has_no_evidence_row'], authority };
    if (found.length > 1) return { slot: slot.slot, status: 'DUPLICATE', valid: false, violations: [`required_slot_has_${found.length}_evidence_rows`], authority };
    const row = found[0];
    const schemaViolations = [...checkEvidenceRowSchema(row), ...checkExpectationIndependence(row)];
    const { expectation, semantic } = checkFinalRowAgainstSlot(row, slot, key);
    const provenance = checkFinalRuntimeProvenance(row);
    const dupId = duplicateEvidenceIds.includes(row.evidenceId) ? ['duplicate_evidence_id'] : [];
    const rawBinding = rawCapture ? checkRowAgainstRawCapture(row, slot, key, rawCapture) : (key === 'support' ? ['raw_capture_authority_missing'] : []);
    const rawIntegrity = rawCaptureProblems.map((x) => `raw_capture:${x}`);
    const reused = key === 'support' && uuidCounts.get(row.immutableTestRowId) > 1 ? ['support_uuid_reused_across_rows'] : [];
    const live = key === 'support' && opts.liveSupportReadback ? checkSupportLiveReadback(row, slot, opts.liveSupportReadback[slot.slot]) : [];
    const violations = [...schemaViolations, ...expectation, ...semantic, ...provenance, ...dupId, ...rawBinding, ...rawIntegrity, ...reused, ...live];
    if (violations.length === 0) authorityTally[slot.expectationAuthority] = (authorityTally[slot.expectationAuthority] || 0) + 1;
    return { slot: slot.slot, evidenceId: row.evidenceId, status: violations.length === 0 ? 'VALID' : 'INVALID', valid: violations.length === 0, violations, authority };
  });

  const validCount = definitionProblems.length ? 0 : slotResults.filter((r) => r.valid).length;
  const missingSlots = slotResults.filter((r) => r.status === 'MISSING').map((r) => r.slot);
  const duplicateSlots = slotResults.filter((r) => r.status === 'DUPLICATE').map((r) => r.slot);
  return {
    matrix: key, name, totalRequired, validCount, slotResults, missingSlots, duplicateSlots, unknownSlots, duplicateEvidenceIds, definitionProblems,
    authorityTally, rawBound: !!rawCapture, rawCaptureProblems, liveReadbackChecked: key === 'support' && !!opts.liveSupportReadback,
    passes: definitionProblems.length === 0 && rawCaptureProblems.length === 0 && validCount === totalRequired && missingSlots.length === 0 && duplicateSlots.length === 0 && unknownSlots.length === 0 && duplicateEvidenceIds.length === 0,
  };
}
