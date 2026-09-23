// PRODUCT TRUTH FOUR-FINDING REMEDIATION - Finding 2 (Codex "PRODUCT TRUTH FINAL THREE-ACTION DELTA REVIEW: FAIL"):
// "`immutableTestRowId` only has to be a non-empty string - Codex replaced the Cancellation row UUID with
// 00000000-0000-0000-0000-000000000000 and the Support gate still passed 4/4."
//
// An acceptance row's own fields can never prove that the row it cites really is the TEST `chat_logs` row the live call
// produced. This module binds every acceptance row to an INDEPENDENT source of truth: the RAW committed capture
// (`2026-09-23-three-action-delta-v32-raw-matrices.json`), which the capture harness wrote straight from the live
// HTTP responses and the read-only `chat_logs` read-back BEFORE any acceptance row existed. The acceptance row is only
// a projection of that raw record and must equal it, field for field:
//
//   Support tuple bound to the raw read-back:   immutable row id  <-> raw readback.row.id (and it must be a real UUID)
//                                               support category   <-> raw readback.row.category <-> the category map
//                                               prompt identity    <-> raw readback.row.user_question <-> predeclared slot prompt
//                                               persona / request  <-> raw alias, language, requestId
//                                               capture identity   <-> raw timestampUtc (+ created_at inside the call window)
//                                               runtime provenance <-> the raw before/after chat-ai version bracket
// plus: one raw entry per slot, one row id per raw entry, no id reused across Support rows.
//
// Optionally (the gate runner's `--live-support-readback`) the same tuple is re-read LIVE, read-only, from TEST
// `chat_logs` by id and compared again - proving the id exists in TEST with that category / question / response and
// belongs to that persona (hash of the persona's e-mail; the e-mail itself is never recorded).
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ok = (v) => typeof v === 'string' && v.trim().length > 0;
const ms = (iso) => Date.parse(iso);
// The harness and the server run on different clocks; created_at (server) must fall inside the call window (local)
// within this tolerance.
const CLOCK_SKEW_MS = 5000;

/** Structural integrity of the raw capture itself. */
export function checkRawCaptureIntegrity(raw) {
  const p = [];
  if (!raw || typeof raw !== 'object') return ['raw_capture_missing'];
  const b = raw.functionBefore;
  const a = raw.functionAfter;
  if (!b || !a) return ['raw_capture_has_no_function_version_bracket'];
  if (b.version !== a.version || b.ezbrSha256 !== a.ezbrSha256) p.push('raw_capture_function_changed_during_run');
  if (!raw.matrices || typeof raw.matrices !== 'object') p.push('raw_capture_has_no_matrices');
  const ids = (raw.matrices?.support || []).map((e) => e?.readback?.row?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) p.push('raw_capture_support_row_id_reused_across_entries');
  return p;
}

/**
 * Binds one acceptance row to its raw capture entry.
 * @param {object} row - the acceptance row
 * @param {object} slot - its predeclared slot definition
 * @param {'owner'|'planRole'|'security'|'support'} key
 * @param {object} raw - the parsed raw capture (the independent source)
 * @returns {string[]} violations
 */
export function checkRowAgainstRawCapture(row, slot, key, raw) {
  const v = [];
  if (!raw) return ['raw_capture_authority_missing'];
  const entries = (raw.matrices?.[key] || []).filter((e) => e?.slot === slot.slot);
  if (entries.length === 0) return ['raw_capture_has_no_entry_for_slot'];
  if (entries.length > 1) return ['raw_capture_has_duplicate_entries_for_slot'];
  const e = entries[0];
  if (e.http !== 200) v.push(`raw_call_not_http_200:${e.http}`);
  // request context: the exact prompt/response/persona/language/request identity the live call had
  if (row.prompt !== e.prompt) v.push('row_prompt_differs_from_raw_capture');
  if (e.prompt !== slot.prompt) v.push('raw_capture_prompt_differs_from_predeclared_slot');
  if (row.response !== e.response) v.push('row_response_differs_from_raw_capture');
  if (row.personaAlias !== e.alias) v.push('row_persona_differs_from_raw_capture');
  if (row.language !== e.language) v.push('row_language_differs_from_raw_capture');
  if (row.timestampUtc !== e.timestampUtc) v.push('row_timestamp_differs_from_raw_capture');
  if (ok(e.requestId) && row.requestId !== e.requestId) v.push('row_request_id_differs_from_raw_capture');
  if (ok(e.answerSource) && row.answerSource !== e.answerSource) v.push('row_answer_source_differs_from_raw_capture');
  // runtime provenance from the capture's own version bracket
  const bracket = raw.functionBefore;
  if (bracket && row.deployedFunctionVersion !== `chat-ai-v${bracket.version}`) v.push(`row_deployed_version_differs_from_raw_bracket:${row.deployedFunctionVersion}!=chat-ai-v${bracket.version}`);
  if (raw.testProjectRef !== row.testProjectRef) v.push('row_test_project_ref_differs_from_raw_capture');
  if (raw.functionBefore && raw.functionAfter && (ms(e.timestampUtc) < ms(raw.functionBefore.readAtUtc) || ms(e.timestampUtc) > ms(raw.functionAfter.readAtUtc))) {
    v.push('raw_call_outside_the_version_bracket');
  }
  // server-verified facts from the same capture
  if ((key === 'owner' || key === 'planRole') && Array.isArray(raw.serverFacts?.results)) {
    const f = raw.serverFacts.results.find((r) => r.alias === e.alias);
    const sv = row.serverVerified || {};
    if (!f) v.push('raw_capture_has_no_server_facts_for_persona');
    else if (f.serverPlan !== sv.serverPlan || f.serverRole !== sv.serverRole || f.serverCountry !== sv.serverMarket) v.push('row_server_facts_differ_from_raw_capture');
  }
  if (key === 'support') v.push(...checkSupportTuple(row, slot, e, raw));
  return v;
}

function checkSupportTuple(row, slot, e, raw) {
  const v = [];
  const rb = e.readback?.row;
  if (e.readback?.httpStatus !== 200 || !rb) return ['raw_readback_missing_or_failed'];
  if (!ok(rb.id) || !UUID_RE.test(rb.id)) v.push(`raw_readback_id_not_a_real_uuid:${rb.id}`);
  if (!ok(row.immutableTestRowId) || !UUID_RE.test(row.immutableTestRowId)) v.push(`row_immutable_id_not_a_real_uuid:${row.immutableTestRowId ?? 'missing'}`);
  if (row.immutableTestRowId !== rb.id) v.push(`row_immutable_id_differs_from_raw_readback:${row.immutableTestRowId ?? 'missing'}!=${rb.id}`);
  if (rb.category !== slot.expectedResult) v.push(`raw_readback_category_differs_from_expectation_map:${rb.category}!=${slot.expectedResult}`);
  if (row.resolvedResult !== rb.category) v.push(`row_category_differs_from_raw_readback:${row.resolvedResult}!=${rb.category}`);
  if (row.supportCategory !== rb.category) v.push(`row_support_category_differs_from_raw_readback:${row.supportCategory}!=${rb.category}`);
  if (rb.user_question !== slot.prompt) v.push('raw_readback_question_differs_from_predeclared_prompt');
  const created = ms(rb.created_at);
  if (!(created >= ms(e.startedAtUtc) - CLOCK_SKEW_MS && created <= ms(e.timestampUtc) + CLOCK_SKEW_MS)) v.push(`raw_readback_created_at_outside_the_call_window:${rb.created_at}`);
  const reuse = (raw.matrices?.support || []).filter((x) => x?.readback?.row?.id === rb.id).length;
  if (reuse > 1) v.push('raw_readback_id_reused_across_support_entries');
  return v;
}

/**
 * Optional LIVE re-read (read-only, TEST `chat_logs` by id) of a Support row. `live` is what the runner fetched; the
 * validator only compares it.
 * @param {object} row
 * @param {object} slot
 * @param {{ id: string, category: string, user_question: string, ai_response: string, created_at: string, userEmailHash: string, expectedPersonaEmailHash: string }|undefined} live
 */
export function checkSupportLiveReadback(row, slot, live) {
  if (!live) return ['live_readback_missing_for_row'];
  const v = [];
  if (live.id !== row.immutableTestRowId) v.push('live_row_id_differs');
  if (live.category !== slot.expectedResult) v.push(`live_category_differs_from_expectation_map:${live.category}!=${slot.expectedResult}`);
  if (live.user_question !== slot.prompt) v.push('live_question_differs_from_predeclared_prompt');
  if (live.ai_response !== row.response) v.push('live_ai_response_differs_from_row_response');
  if (!ok(live.userEmailHash) || live.userEmailHash !== live.expectedPersonaEmailHash) v.push('live_row_does_not_belong_to_the_persona');
  return v;
}
