// PRODUCT TRUTH FINAL THREE-ACTION DELTA - Action B: turns the fresh raw v32 capture
// (scripts/run-final-matrices-v32.mjs) into the four final evidence-row files.
//
// This builder does NOT decide what is "expected". Every row's expectedResult / expectationSource / entitlement
// expectation is COPIED from the static acceptance definition of the slot the row fills
// (src/data/productTruthFinalMatrixAcceptance.js) - and the validator (validateFinalMatrix) then re-derives each of
// them from that authority and rejects any row that differs. The only values computed here are OBSERVATIONS:
//   resolvedResult      - owner/plan-role: what the real deployed-equivalent routing (payment -> invoicing ->
//                         capability, index.ts's own order) resolves the prompt to; security: the live response scanned
//                         with the predeclared forbidden patterns; support: the category the live system STORED in
//                         chat_logs (immutable row id captured for the join);
//   supportCategory     - classifySupportMessage's own category for the prompt;
//   resolvedEntitlement - the real capability-answer-state resolver's output for the persona's server-verified facts.
// Provenance is taken from the capture's own before/after `supabase functions list` bracket, never typed in here.
import { classifyCapabilityIntent } from '../supabase/functions/chat-ai/capabilityTruth.ts';
import { classifyPaymentIntent } from '../supabase/functions/chat-ai/paymentTruth.ts';
import { classifyInvoicingIntent } from '../supabase/functions/chat-ai/invoicingTruth.ts';
import { classifySupportMessage } from '../supabase/functions/chat-ai/validation.ts';
import { resolveCapabilityAnswerState } from '../supabase/functions/chat-ai/capabilityAnswerState.ts';
import { AI_FACTS } from '../supabase/functions/chat-ai/aiFacts.generated.ts';
import { FINAL_MATRIX_DEFINITIONS, KNOWN_RUNTIME_PROVENANCE, SECURITY_EXPECTED_RESULT, SECURITY_UNSAFE_RESULT } from '../src/data/productTruthFinalMatrixAcceptance.js';
import { readFileSync, writeFileSync } from 'node:fs';

// version-agnostic (the name is historical): the deployed version / SHA come from the raw capture's own function bracket.
const RAW = process.argv[2] || 'evidence/product-truth/2026-09-24-account-system-question-v39-raw-matrices.json';
const OUT_PREFIX = process.argv[3] || 'evidence/product-truth/2026-09-24-account-system-question';
const raw = JSON.parse(readFileSync(RAW, 'utf-8'));

if (raw.functionBefore.version !== raw.functionAfter.version || raw.functionBefore.ezbrSha256 !== raw.functionAfter.ezbrSha256) {
  throw new Error('capture is not attributable to a single chat-ai version');
}
const deployedFunctionVersion = `chat-ai-v${raw.functionBefore.version}`;
const implementationSourceSha = KNOWN_RUNTIME_PROVENANCE[deployedFunctionVersion];
if (!implementationSourceSha) throw new Error(`no truthfully-known implementation SHA for ${deployedFunctionVersion}`);

function resolveRouting(prompt) {
  if (classifyPaymentIntent(prompt)) return 'payment_truth_sentinel';
  if (classifyInvoicingIntent(prompt)) return 'invoicing_truth_sentinel';
  return classifyCapabilityIntent(prompt);
}
const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
function entitlementFromState(state) {
  if (!state) return 'UNKNOWN';
  if (state.roleRestriction) return state.roleRestriction.accountHasRole === true ? 'GRANTED' : state.roleRestriction.accountHasRole === false ? 'DENIED' : 'UNKNOWN';
  if (state.planRestriction) return state.planRestriction.accountHasIt === true ? 'GRANTED' : state.planRestriction.accountHasIt === false ? 'DENIED' : 'UNKNOWN';
  return 'GRANTED';
}
const factsByAlias = Object.fromEntries(raw.serverFacts.results.map((r) => [r.alias, r]));

function serverVerifiedFor(alias) {
  const facts = factsByAlias[alias];
  return facts ? { http: facts.http, serverPlan: facts.serverPlan, serverRole: facts.serverRole, serverMarket: facts.serverCountry, method: raw.serverFacts.method, capturedAtUtc: raw.serverFacts.capturedAtUtc } : { note: 'no server facts for this persona' };
}

function baseRow(slot, call, evidenceId, method) {
  return {
    evidenceId,
    matrixSlot: slot.slot,
    timestampUtc: call.timestampUtc,
    personaAlias: call.alias,
    market: call.market,
    plan: call.plan,
    role: call.role,
    language: call.language,
    prompt: call.prompt,
    response: call.response,
    answerSource: call.answerSource,
    // STRUCTURED TRUTH: a projection of the raw capture's payload (the validator requires it to equal the raw capture's, field for field)
    factPayload: call.factPayload ?? null,
    // the persona's server-verified plan / role / market from the SAME capture run - the structured expectation is derived from these
    serverVerified: serverVerifiedFor(call.alias),
    supportCategory: classifySupportMessage(call.prompt),
    expectedResult: slot.expectedResult,
    expectationSource: slot.expectationAuthority,
    implementationSourceSha,
    testProjectRef: raw.testProjectRef,
    deployedFunctionVersion,
    evidenceMethod: method,
    requestId: call.requestId,
  };
}

const out = { owner: [], planRole: [], security: [], support: [] };
for (const slot of FINAL_MATRIX_DEFINITIONS.owner.slots) {
  const call = raw.matrices.owner.find((c) => c.slot === slot.slot);
  if (!call) continue; // a missing capture leaves the slot MISSING - the gate, not this builder, decides
  out.owner.push({
    ...baseRow(slot, call, `owner-v32-${slot.slot}`, 'live_terminal_http'),
    ...(slot.subtopic ? { matrixSubtopic: slot.subtopic } : {}),
    resolvedResult: resolveRouting(call.prompt),
  });
}
for (const slot of FINAL_MATRIX_DEFINITIONS.planRole.slots) {
  const call = raw.matrices.planRole.find((c) => c.slot === slot.slot);
  if (!call) continue;
  const facts = factsByAlias[call.alias];
  const capabilityId = classifyCapabilityIntent(call.prompt);
  const state = capabilityId && facts ? resolveCapabilityAnswerState(capabilityId, FACTS, facts.serverPlan, facts.serverRole === 'super_admin') : null;
  out.planRole.push({
    ...baseRow(slot, call, `plan-role-v32-${slot.slot}`, 'live_terminal_http'),
    resolvedResult: capabilityId,
    expectedEntitlement: slot.fixtureExpectedEntitlement,
    expectedEntitlementSource: 'canonical_registry',
    resolvedEntitlement: entitlementFromState(state),
  });
}
for (const slot of FINAL_MATRIX_DEFINITIONS.security.slots) {
  const call = raw.matrices.security.find((c) => c.slot === slot.slot);
  if (!call) continue;
  const leaked = slot.forbiddenResponsePatterns.some((p) => p.test(call.response || ''));
  out.security.push({ ...baseRow(slot, call, `security-v32-${slot.slot}`, 'live_terminal_http'), resolvedResult: leaked ? SECURITY_UNSAFE_RESULT : SECURITY_EXPECTED_RESULT });
}
for (const slot of FINAL_MATRIX_DEFINITIONS.support.slots) {
  const call = raw.matrices.support.find((c) => c.slot === slot.slot);
  if (!call) continue;
  out.support.push({
    ...baseRow(slot, call, `support-v32-${slot.slot}`, 'chat_logs_readback'),
    resolvedResult: call.readback?.row?.category ?? null,
    immutableTestRowId: call.readback?.row?.id ?? null,
  });
}

const FILES = { owner: 'owner-matrix', planRole: 'plan-role-matrix', security: 'security-matrix', support: 'support-matrix' };
for (const [key, rows] of Object.entries(out)) {
  writeFileSync(`${OUT_PREFIX}-${FILES[key]}-final-rows.json`, JSON.stringify({ deployedFunctionVersion, implementationSourceSha, rawSource: RAW, rows }, null, 2) + '\n');
  console.log(`${key}: ${rows.length} rows -> ${OUT_PREFIX}-${FILES[key]}-final-rows.json`);
}
