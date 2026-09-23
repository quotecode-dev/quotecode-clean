// PRODUCT TRUTH FINAL DELTA CLOSURE — item 8, final plan/role evidence rows. Combines:
// (a) the historical terminal prompt/answer (2026-09-23-final-closure-blocker5-raw-owner-planrole.json,
//     captured live against a prior TEST deploy - the underlying capability facts these prompts
//     exercise are unaffected by this delta's Finding 2/3/4 fixes, verified by inspecting each
//     prompt below: none match the widened broad-guard/print-comparison/market-forgery patterns),
// (b) a fresh deterministic capabilityId for each row from the CURRENT classifier (never left null),
// (c) fresh real server-side plan/market/role facts (2026-09-24-final-delta-closure-plan-role-server-facts.json).
//
// Codex final independent review (2026-09-2X): the PRIOR version of this script set
// `expectedResult = resolvedCapabilityId` - a self-fulfilling comparison. Fixed:
// `expectedResult`/`expectedEntitlement` are now looked up from
// `productTruthPlanRoleExpectedFixture.js`, a STATIC fixture hand-authored from each prompt's real
// text and the CANONICAL registry's own minimumPlan/requiredRole rules - independent of both the
// classifier and the entitlement resolver called below. `resolvedEntitlement` is computed by
// calling the REAL `resolveCapabilityAnswerState` (the actual system logic the live answer was
// built from) against the real server-verified plan/role facts - a second, genuinely independent
// computation from the same real inputs, not a copy of the fixture's own expectation.
import { classifyCapabilityIntent } from '../supabase/functions/chat-ai/capabilityTruth.ts';
import { resolveCapabilityAnswerState } from '../supabase/functions/chat-ai/capabilityAnswerState.ts';
import { AI_FACTS } from '../supabase/functions/chat-ai/aiFacts.generated.ts';
import { PLAN_ROLE_EXPECTED_FIXTURE } from '../src/data/productTruthPlanRoleExpectedFixture.js';
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('evidence/product-truth/2026-09-23-final-closure-blocker5-raw-owner-planrole.json', 'utf-8'));
const serverFacts = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-plan-role-server-facts.json', 'utf-8'));
const factsByAlias = Object.fromEntries(serverFacts.results.map((r) => [r.alias, r]));
const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const FINAL_SHA = '08c012bcd6094335e987e7972c66604c2579e125';

function entitlementFromState(state) {
  if (!state) return 'UNKNOWN';
  if (state.roleRestriction) {
    if (state.roleRestriction.accountHasRole === true) return 'GRANTED';
    if (state.roleRestriction.accountHasRole === false) return 'DENIED';
    return 'UNKNOWN';
  }
  if (state.planRestriction) {
    if (state.planRestriction.accountHasIt === true) return 'GRANTED';
    if (state.planRestriction.accountHasIt === false) return 'DENIED';
    return 'UNKNOWN';
  }
  return 'GRANTED'; // no restriction at all -> unconditionally available
}

const rows = raw.planRoleResults.map((r, i) => {
  const resolvedCapabilityId = classifyCapabilityIntent(r.prompt);
  const facts = factsByAlias[r.persona] || null;
  const fixture = PLAN_ROLE_EXPECTED_FIXTURE[i];
  if (!fixture) throw new Error(`No independent expected-result fixture entry for plan/role row ${i} - refusing to fabricate one`);
  const accountTier = facts?.serverPlan ?? null;
  const isAdmin = facts?.serverRole === 'super_admin';
  const state = resolvedCapabilityId ? resolveCapabilityAnswerState(resolvedCapabilityId, FACTS, accountTier, isAdmin) : null;
  const resolvedEntitlement = entitlementFromState(state);
  return {
    evidenceId: `plan-role-${String(i + 1).padStart(2, '0')}-${r.persona}`,
    timestampUtc: r.timestamp,
    personaAlias: r.persona,
    market: r.market,
    plan: r.plan,
    role: r.role,
    language: r.lang,
    prompt: r.prompt,
    response: r.answer,
    supportCategory: 'FEATURE_REQUEST',
    resolvedResult: resolvedCapabilityId,
    expectedResult: fixture.expectedResult,
    expectationSource: 'static_fixture',
    resolvedEntitlement,
    expectedEntitlement: fixture.expectedEntitlement,
    implementationSourceSha: FINAL_SHA,
    // This ROW's own terminal call predates the delta redeploy (captured under the prior TEST
    // deploy) - the classifier/answer content is unaffected (verified: none of these 13 prompts
    // match any Finding 2/3/4 pattern change), but the call itself was not re-executed against
    // v32, so its runtime version is honestly marked historical rather than claimed current.
    historicalVersion: true,
    testProjectRef: 'ljfizgrdyzxddswcedwr',
    deployedFunctionVersion: 'chat-ai-v31-historical-call',
    evidenceMethod: 'live_terminal_http',
    serverVerified: facts ? {
      http: facts.http,
      serverPlan: facts.serverPlan,
      serverRole: facts.serverRole,
      serverMarket: facts.serverCountry,
      method: 'auth_signin_plus_rls_scoped_select_readonly',
      capturedAtUtc: serverFacts.capturedAtUtc,
    } : { note: 'no server-fact verification available for this persona this round' },
  };
});

writeFileSync(
  'evidence/product-truth/2026-09-24-final-delta-closure-plan-role-final-rows.json',
  JSON.stringify({ finalImplementationSha: FINAL_SHA, rows }, null, 2) + '\n',
);
for (const r of rows) {
  console.log(r.evidenceId, '| resolvedResult:', r.resolvedResult, '| serverPlan:', r.serverVerified.serverPlan, '| serverRole:', r.serverVerified.serverRole);
}
console.log('Wrote evidence/product-truth/2026-09-24-final-delta-closure-plan-role-final-rows.json');
